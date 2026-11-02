import io
import os
import tempfile
from datetime import date
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import settings
from app.database import Base, get_db
from app.deps import get_current_user
from app.models import AuditLog, Request, RequestAttachment, RequestHistory, RequestPriority, RequestStatus, RequestType, User, UserRole
from app.routers.requests import router


SAMPLE_PDF = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n"


def make_test_environment():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    session_factory = sessionmaker(bind=engine, expire_on_commit=False)
    Base.metadata.create_all(engine)

    upload_dir = tempfile.mkdtemp(prefix="amx_test_emp_uploads_")
    settings.request_upload_dir = upload_dir

    app = FastAPI()
    app.include_router(router)

    def db_override():
        with session_factory() as db:
            yield db

    employee1 = User(
        id=10,
        full_name="Marcus Vance",
        email="m.vance@company.com",
        employee_id="EMP-1001",
        role=UserRole.employee,
        password_hash="x",
        is_active=True,
    )
    employee2 = User(
        id=11,
        full_name="Sarah Jenkins",
        email="s.jenkins@company.com",
        employee_id="EMP-1002",
        role=UserRole.employee,
        password_hash="x",
        is_active=True,
    )
    admin = User(
        id=1,
        full_name="Admin User",
        email="admin@company.com",
        employee_id="ADM-0001",
        role=UserRole.admin,
        password_hash="x",
        is_active=True,
    )

    with session_factory() as db:
        db.add_all([employee1, employee2, admin])
        db.commit()

    app.dependency_overrides[get_db] = db_override
    app.dependency_overrides[get_current_user] = lambda: employee1
    client = TestClient(app)

    return client, session_factory, employee1, employee2, admin, upload_dir


# 1. Employee can create an internal request (Asset and Consumable)
def test_employee_can_create_internal_request():
    client, session_factory, employee1, _, _, _ = make_test_environment()

    # Asset request with camelCase frontend fields
    payload_asset = {
        "requestType": "Asset Request",
        "itemName": "Dell UltraSharp 27 4K Monitor (U2723QE)",
        "category": "Peripherals & Displays",
        "subCategory": "External Displays & Mounts",
        "quantity": 2,
        "priority": "High",
        "justification": "Primary monitor for dual-display UI/UX design workflow.",
        "estimatedCost": "579.00",
        "department": "Product Design",
    }
    res = client.post("/api/requests", json=payload_asset)
    assert res.status_code == 201, res.text
    data = res.json()

    assert data["request_id"].startswith("REQ-")
    assert data["request_source"] == "Internal"
    assert data["status"] == "Pending"
    assert data["request_type"] == "Asset Request"
    assert data["requested_item"] == "Dell UltraSharp 27 4K Monitor (U2723QE)"
    assert "Peripherals & Displays" in data["category"]
    assert "External Displays & Mounts" in data["category"]
    assert data["quantity"] == 2
    assert data["priority"] == "High"
    assert data["department"] == "Product Design"
    assert data["requester_name"] == employee1.full_name
    assert data["requester_email"] == employee1.email
    assert data["request_date"] == date.today().isoformat()
    assert data["estimated_cost"] == "579.00"

    # Consumable request with snake_case fields
    payload_consumable = {
        "request_type": "Consumable Request",
        "requested_item": "USB-C to HDMI 4K braided adapters (Pack of 3)",
        "category": "IT Cables & Adapters",
        "quantity": 5,
        "priority": "Medium",
        "justification": "Required for conference room hookups and client demos.",
    }
    res_c = client.post("/api/requests", json=payload_consumable)
    assert res_c.status_code == 201, res_c.text
    data_c = res_c.json()
    assert data_c["request_type"] == "Consumable Request"
    assert data_c["quantity"] == 5
    assert data_c["status"] == "Pending"


# 2. Request identity is derived from authenticated user (cannot be spoofed)
def test_request_identity_derived_from_authenticated_user():
    client, session_factory, employee1, _, _, _ = make_test_environment()

    # Attempt to spoof identity and source in request body
    spoofed_payload = {
        "requestType": "Asset Request",
        "itemName": "Ergonomic Mechanical Keyboard",
        "category": "Peripherals",
        "quantity": 1,
        "priority": "Low",
        "justification": "Ergonomic typing comfort.",
        "requester_name": "Attacker Name",
        "requester_email": "attacker@evil.com",
        "request_source": "External",
    }
    res = client.post("/api/requests", json=spoofed_payload)
    assert res.status_code == 201, res.text
    data = res.json()

    assert data["requester_name"] == employee1.full_name
    assert data["requester_email"] == employee1.email
    assert data["request_source"] == "Internal"


# 3. Initial status is Pending, RequestHistory and AuditLog are created in same transaction
def test_initial_status_pending_and_history_and_audit_created():
    client, session_factory, employee1, _, _, _ = make_test_environment()

    res = client.post(
        "/api/requests",
        json={
            "itemName": "Test Headset",
            "category": "Audio",
            "quantity": 1,
            "priority": "Medium",
            "justification": "Active noise cancelling for remote meetings.",
        },
    )
    assert res.status_code == 201, res.text
    req_id = res.json()["request_id"]

    with session_factory() as db:
        req = db.query(Request).filter_by(request_id=req_id).one()
        assert req.status == RequestStatus.pending
        assert req.request_source == "Internal"

        # Check initial history
        history = db.query(RequestHistory).filter_by(request_id=req_id).all()
        assert len(history) == 1
        assert history[0].stage == "Pending"
        assert history[0].performed_by == employee1.full_name
        assert history[0].action == "Requisition submitted by employee"
        assert history[0].note == "Active noise cancelling for remote meetings."

        # Check audit log
        audit = db.query(AuditLog).filter_by(request_identifier=req_id).one()
        assert audit.action == "employee_request_created"
        assert audit.actor_user_id == employee1.id
        assert audit.after_state["status"] == "Pending"
        assert audit.after_state["request_source"] == "Internal"


# 4. Input validation: missing fields, invalid quantity, invalid priority
def test_employee_request_validation():
    client, _, _, _, _, _ = make_test_environment()

    # Negative quantity
    res = client.post(
        "/api/requests",
        json={"itemName": "Mouse", "category": "Peripherals", "quantity": -1, "priority": "Low", "justification": "Valid"},
    )
    assert res.status_code == 422

    # Zero quantity
    res = client.post(
        "/api/requests",
        json={"itemName": "Mouse", "category": "Peripherals", "quantity": 0, "priority": "Low", "justification": "Valid"},
    )
    assert res.status_code == 422

    # Empty requested item
    res = client.post(
        "/api/requests",
        json={"itemName": "   ", "category": "Peripherals", "quantity": 1, "priority": "Low", "justification": "Valid"},
    )
    assert res.status_code == 422

    # Empty category
    res = client.post(
        "/api/requests",
        json={"itemName": "Mouse", "category": "   ", "quantity": 1, "priority": "Low", "justification": "Valid"},
    )
    assert res.status_code == 422

    # Empty justification
    res = client.post(
        "/api/requests",
        json={"itemName": "Mouse", "category": "Peripherals", "quantity": 1, "priority": "Low", "justification": "   "},
    )
    assert res.status_code == 422

    # Invalid priority
    res = client.post(
        "/api/requests",
        json={"itemName": "Mouse", "category": "Peripherals", "quantity": 1, "priority": "Urgent", "justification": "Valid"},
    )
    assert res.status_code == 422

    # Invalid request type
    res = client.post(
        "/api/requests",
        json={"requestType": "Service Request", "itemName": "Mouse", "category": "Peripherals", "quantity": 1, "priority": "Low", "justification": "Valid"},
    )
    assert res.status_code == 422


# 5. Employee can list their own requests with filters and pagination
def test_employee_can_list_own_requests_with_filters():
    client, session_factory, employee1, employee2, _, _ = make_test_environment()

    # Create 3 requests for Marcus (employee1)
    client.app.dependency_overrides[get_current_user] = lambda: employee1
    r1 = client.post(
        "/api/requests",
        json={"itemName": "UltraSharp Monitor", "category": "Displays", "quantity": 1, "priority": "High", "justification": "Design work"},
    ).json()["request_id"]
    r2 = client.post(
        "/api/requests",
        json={"itemName": "Mechanical Keyboard", "category": "Peripherals", "quantity": 1, "priority": "Low", "justification": "Typing"},
    ).json()["request_id"]
    r3 = client.post(
        "/api/requests",
        json={"itemName": "Ethernet Adapter", "category": "Networking", "quantity": 2, "priority": "Medium", "justification": "Wired connection"},
    ).json()["request_id"]

    # Create 1 request for Sarah (employee2)
    client.app.dependency_overrides[get_current_user] = lambda: employee2
    client.post(
        "/api/requests",
        json={"itemName": "Standing Desk Riser", "category": "Furniture", "quantity": 1, "priority": "Medium", "justification": "Ergonomics"},
    )

    # Switch back to Marcus
    client.app.dependency_overrides[get_current_user] = lambda: employee1

    # List my requests without filters
    res = client.get("/api/requests/my")
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["total"] == 3
    assert len(data["items"]) == 3
    req_ids = [item["request_id"] for item in data["items"]]
    assert r1 in req_ids
    assert r2 in req_ids
    assert r3 in req_ids

    # Filter by priority
    res_prio = client.get("/api/requests/my?priority=High")
    assert res_prio.status_code == 200
    prio_data = res_prio.json()
    assert prio_data["total"] == 1
    assert prio_data["items"][0]["request_id"] == r1

    # Filter by search
    res_search = client.get("/api/requests/my?search=Keyboard")
    assert res_search.status_code == 200
    search_data = res_search.json()
    assert search_data["total"] == 1
    assert search_data["items"][0]["request_id"] == r2

    # Filter by category
    res_cat = client.get("/api/requests/my?category=Displays")
    assert res_cat.status_code == 200
    cat_data = res_cat.json()
    assert cat_data["total"] == 1
    assert cat_data["items"][0]["request_id"] == r1

    # Pagination
    res_page = client.get("/api/requests/my?page=1&page_size=2")
    assert res_page.status_code == 200
    page_data = res_page.json()
    assert page_data["total"] == 3
    assert len(page_data["items"]) == 2
    assert page_data["page"] == 1
    assert page_data["page_size"] == 2


# 6. Employee cannot see another employee's requests
def test_employee_cannot_see_another_employees_requests():
    client, _, employee1, employee2, _, _ = make_test_environment()

    # Marcus creates request
    client.app.dependency_overrides[get_current_user] = lambda: employee1
    m_res = client.post(
        "/api/requests",
        json={"itemName": "Secret Project Device", "category": "Hardware", "quantity": 1, "priority": "High", "justification": "Confidential work"},
    )
    assert m_res.status_code == 201
    marcus_req_id = m_res.json()["request_id"]

    # Sarah lists her requests
    client.app.dependency_overrides[get_current_user] = lambda: employee2
    sarah_list = client.get("/api/requests/my")
    assert sarah_list.status_code == 200
    sarah_data = sarah_list.json()
    assert sarah_data["total"] == 0
    assert len(sarah_data["items"]) == 0
    assert marcus_req_id not in [item["request_id"] for item in sarah_data["items"]]


# 7. Employee can access their own request details
def test_employee_can_access_own_request_details():
    client, _, employee1, _, _, _ = make_test_environment()

    client.app.dependency_overrides[get_current_user] = lambda: employee1
    create_res = client.post(
        "/api/requests",
        json={"itemName": "4K Webcam", "category": "Peripherals", "quantity": 1, "priority": "Medium", "justification": "Client presentations"},
    )
    assert create_res.status_code == 201
    req_id = create_res.json()["request_id"]

    details_res = client.get(f"/api/requests/{req_id}")
    assert details_res.status_code == 200, details_res.text
    details = details_res.json()
    assert details["request_id"] == req_id
    assert details["requested_item"] == "4K Webcam"
    assert details["requester_email"] == employee1.email
    assert len(details["history"]) >= 1


# 8. Employee cannot access another employee's request details (403 Forbidden)
def test_employee_cannot_access_another_employees_request_details():
    client, _, employee1, employee2, _, _ = make_test_environment()

    client.app.dependency_overrides[get_current_user] = lambda: employee1
    create_res = client.post(
        "/api/requests",
        json={"itemName": "Marcus Confidential Request", "category": "R&D", "quantity": 1, "priority": "High", "justification": "Sensitive task"},
    )
    assert create_res.status_code == 201
    marcus_req_id = create_res.json()["request_id"]

    # Sarah attempts to access Marcus's request -> 403 Forbidden
    client.app.dependency_overrides[get_current_user] = lambda: employee2
    sarah_access = client.get(f"/api/requests/{marcus_req_id}")
    assert sarah_access.status_code == 403
    assert "Access denied" in sarah_access.json()["detail"]

    # Non-existent request -> 404 Not Found
    missing_access = client.get("/api/requests/REQ-9999-NONEXISTENT")
    assert missing_access.status_code == 404


# 9. Employee can upload and retrieve their own attachments
def test_employee_can_upload_and_retrieve_own_attachments():
    client, _, employee1, _, _, _ = make_test_environment()

    client.app.dependency_overrides[get_current_user] = lambda: employee1
    create_res = client.post(
        "/api/requests",
        json={"itemName": "Laptop Stand", "category": "Ergonomics", "quantity": 1, "priority": "Low", "justification": "Desk comfort"},
    )
    req_id = create_res.json()["request_id"]

    # Upload attachment
    upload_res = client.post(
        f"/api/requests/{req_id}/attachments",
        files={"file": ("spec_sheet.pdf", SAMPLE_PDF, "application/pdf")},
    )
    assert upload_res.status_code == 201, upload_res.text
    att_meta = upload_res.json()
    att_id = att_meta["attachment_id"]
    assert att_meta["request_id"] == req_id
    assert att_meta["original_filename"] == "spec_sheet.pdf"

    # List attachments
    list_res = client.get(f"/api/requests/{req_id}/attachments")
    assert list_res.status_code == 200
    att_list = list_res.json()
    assert len(att_list) == 1
    assert att_list[0]["attachment_id"] == att_id

    # Download attachment
    download_res = client.get(f"/api/requests/{req_id}/attachments/{att_id}/download")
    assert download_res.status_code == 200
    assert download_res.content == SAMPLE_PDF
    assert 'attachment; filename="spec_sheet.pdf"' in download_res.headers["content-disposition"]

    # Preview attachment
    preview_res = client.get(f"/api/requests/{req_id}/attachments/{att_id}/preview")
    assert preview_res.status_code == 200
    assert preview_res.content == SAMPLE_PDF
    assert 'inline; filename="spec_sheet.pdf"' in preview_res.headers["content-disposition"]


# 10. Employee cannot access another employee's attachments
def test_employee_cannot_access_another_employees_attachments():
    client, _, employee1, employee2, _, _ = make_test_environment()

    # Marcus creates request and uploads an attachment
    client.app.dependency_overrides[get_current_user] = lambda: employee1
    create_res = client.post(
        "/api/requests",
        json={"itemName": "Marcus Asset", "category": "IT", "quantity": 1, "priority": "Low", "justification": "Valid"},
    )
    marcus_req_id = create_res.json()["request_id"]

    upload_res = client.post(
        f"/api/requests/{marcus_req_id}/attachments",
        files={"file": ("marcus_doc.pdf", SAMPLE_PDF, "application/pdf")},
    )
    assert upload_res.status_code == 201
    att_id = upload_res.json()["attachment_id"]

    # Switch to Sarah (employee2)
    client.app.dependency_overrides[get_current_user] = lambda: employee2

    # Attempt to upload attachment to Marcus's request -> 403
    sarah_upload = client.post(
        f"/api/requests/{marcus_req_id}/attachments",
        files={"file": ("sarah_doc.pdf", SAMPLE_PDF, "application/pdf")},
    )
    assert sarah_upload.status_code == 403

    # Attempt to list Marcus's attachments -> 403
    sarah_list = client.get(f"/api/requests/{marcus_req_id}/attachments")
    assert sarah_list.status_code == 403

    # Attempt to download Marcus's attachment -> 403
    sarah_dl = client.get(f"/api/requests/{marcus_req_id}/attachments/{att_id}/download")
    assert sarah_dl.status_code == 403

    # Attempt to preview Marcus's attachment -> 403
    sarah_prev = client.get(f"/api/requests/{marcus_req_id}/attachments/{att_id}/preview")
    assert sarah_prev.status_code == 403


# 11. Existing admin external request creation still works
def test_admin_external_request_creation_still_works():
    client, session_factory, _, _, admin, _ = make_test_environment()

    client.app.dependency_overrides[get_current_user] = lambda: admin
    ext_payload = {
        "request_source": "External",
        "date_received": "2026-03-01",
        "external_reference": "EXT-VENDOR-991",
        "requester_name": "Supplier Inc",
        "department": "Procurement",
        "contact_info": "vendor@supplier.com",
        "requester_email": "vendor@supplier.com",
        "request_type": "Asset Request",
        "requested_item": "Industrial Label Printer",
        "category": "Warehouse Hardware",
        "quantity": 1,
        "priority": "High",
        "justification": "Labeling outbound inventory.",
        "estimated_cost": "450.00",
    }
    res = client.post("/api/requests/external", json=ext_payload)
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["request_source"] == "External"
    assert data["external_reference"] == "EXT-VENDOR-991"
    assert data["requester_name"] == "Supplier Inc"

    with session_factory() as db:
        audit = db.query(AuditLog).filter_by(request_identifier=data["request_id"]).one()
        assert audit.action == "external_request_created"
        assert audit.actor_user_id == admin.id


# 12. Existing admin request management, transitions, and attachment access intact
def test_admin_management_and_transitions_intact():
    client, session_factory, employee1, _, admin, _ = make_test_environment()

    # Employee creates request
    client.app.dependency_overrides[get_current_user] = lambda: employee1
    res = client.post(
        "/api/requests",
        json={"itemName": "Ergonomic Chair", "category": "Furniture", "quantity": 1, "priority": "Low", "justification": "Back support"},
    )
    req_id = res.json()["request_id"]

    # Switch to Admin
    client.app.dependency_overrides[get_current_user] = lambda: admin

    # Admin can list all requests
    all_res = client.get("/api/requests")
    assert all_res.status_code == 200
    all_data = all_res.json()
    assert req_id in [item["request_id"] for item in all_data["items"]]

    # Admin can get employee's request details
    get_res = client.get(f"/api/requests/{req_id}")
    assert get_res.status_code == 200
    assert get_res.json()["request_id"] == req_id

    # Admin can upload attachment to employee's request
    admin_upload = client.post(
        f"/api/requests/{req_id}/attachments",
        files={"file": ("admin_approval.pdf", SAMPLE_PDF, "application/pdf")},
    )
    assert admin_upload.status_code == 201
    att_id = admin_upload.json()["attachment_id"]

    # Admin can download attachment
    admin_dl = client.get(f"/api/requests/{req_id}/attachments/{att_id}/download")
    assert admin_dl.status_code == 200

    # Admin can transition request status (Pending -> In Review)
    trans_res = client.post(
        f"/api/requests/{req_id}/transition",
        json={"target_status": "In Review", "operational_note": "Approved for administrative review."},
    )
    assert trans_res.status_code == 200
    trans_data = trans_res.json()
    assert trans_data["status"] == "In Review"

    # Transition history recorded
    assert any(h["stage"] == "In Review" for h in trans_data["history"])

    # Employee cannot transition request status (requires require_admin)
    client.app.dependency_overrides[get_current_user] = lambda: employee1
    emp_trans = client.post(
        f"/api/requests/{req_id}/transition",
        json={"target_status": "Fulfilled", "operational_note": "Employee cannot approve"},
    )
    assert emp_trans.status_code == 403
