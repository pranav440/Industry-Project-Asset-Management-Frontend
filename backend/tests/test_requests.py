import io
import os
import tempfile
import zipfile
from datetime import date
from pathlib import Path

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


def make_client(*, raise_server_exceptions: bool = True, upload_dir: str | None = None):
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    session_factory = sessionmaker(bind=engine)
    Base.metadata.create_all(engine)
    app = FastAPI()
    app.include_router(router)

    if upload_dir is None:
        upload_dir = tempfile.mkdtemp(prefix="amx_test_req_uploads_")
    settings.request_upload_dir = upload_dir

    def db_override():
        with session_factory() as db:
            yield db

    admin = User(
        id=1,
        full_name="Admin User",
        email="admin@example.com",
        employee_id="ADM001",
        role=UserRole.admin,
        password_hash="x",
    )
    employee = User(
        id=2,
        full_name="Employee User",
        email="employee@example.com",
        employee_id="EMP001",
        role=UserRole.employee,
        password_hash="x",
    )
    app.dependency_overrides[get_db] = db_override
    app.dependency_overrides[get_current_user] = lambda: admin
    client = TestClient(app, raise_server_exceptions=raise_server_exceptions)
    return client, session_factory, admin, employee


def seed_requests(session_factory):
    with session_factory() as db:
        rows = [
            Request(
                request_id="REQ-2026-0001",
                requester_name="Alice Green",
                requester_email="alice@company.com",
                department="Operations",
                request_type=RequestType.asset_request,
                requested_item="Laptop",
                category="Hardware",
                quantity=2,
                priority=RequestPriority.high,
                request_date=date(2026, 9, 10),
                status=RequestStatus.pending,
                justification="Need laptops for onboarding.",
                processing_guidelines="Review vendor and budget.",
            ),
            Request(
                request_id="REQ-2026-0002",
                requester_name="Bob Brown",
                requester_email="bob@company.com",
                department="IT",
                request_type=RequestType.consumable_request,
                requested_item="Cat6 patch cables",
                category="Networking",
                quantity=20,
                priority=RequestPriority.medium,
                request_date=date(2026, 9, 11),
                status=RequestStatus.in_review,
                justification="Need cable spares.",
                processing_guidelines="Validate inventory and assign delivery.",
            ),
            Request(
                request_id="REQ-2026-0003",
                requester_name="Carol White",
                requester_email="carol@company.com",
                department="Finance",
                request_type=RequestType.asset_request,
                requested_item="Monitor",
                category="Hardware",
                quantity=3,
                priority=RequestPriority.low,
                request_date=date(2026, 9, 12),
                status=RequestStatus.fulfilled,
                justification="Workstation refresh.",
                processing_guidelines="Coordinate delivery to finance office.",
            ),
        ]
        db.add_all(rows)
        db.commit()


def test_requests_list_filters_and_pagination():
    client, session_factory, _, _ = make_client()
    seed_requests(session_factory)

    response = client.get("/api/requests", params={"search": "Cat6", "page": 1, "page_size": 10})
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["request_id"] == "REQ-2026-0002"

    response = client.get("/api/requests", params={"request_type": "Consumable Request", "status": "In Review", "priority": "Medium", "department": "IT", "request_date": "2026-09-11"})
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["requested_item"] == "Cat6 patch cables"

    response = client.get("/api/requests", params={"page": 2, "page_size": 1})
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["page"] == 2
    assert body["page_size"] == 1
    assert body["total"] == 3
    assert len(body["items"]) == 1


def test_get_request_detail_and_missing_request():
    client, session_factory, _, _ = make_client()
    seed_requests(session_factory)

    response = client.get("/api/requests/REQ-2026-0002")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == "In Review"
    assert body["history"] == []

    response = client.get("/api/requests/REQ-DOES-NOT-EXIST")
    assert response.status_code == 404


def test_valid_transitions_create_history_and_audit():
    client, session_factory, admin, _ = make_client()
    with session_factory() as db:
        db.add(
            Request(
                request_id="REQ-2026-0101",
                requester_name="Dana Cole",
                requester_email="dana@company.com",
                department="Engineering",
                request_type=RequestType.asset_request,
                requested_item="Workstation",
                category="Hardware",
                quantity=1,
                priority=RequestPriority.high,
                request_date=date(2026, 9, 13),
                status=RequestStatus.pending,
                justification="Need to support field operations.",
                processing_guidelines="Approve after review.",
            )
        )
        db.commit()

    response = client.post("/api/requests/REQ-2026-0101/transition", json={"target_status": "In Review", "operational_note": "Under review by admin."})
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == "In Review"
    assert body["history"][0]["stage"] == "In Review"
    assert body["history"][0]["performed_by"] == admin.full_name
    assert body["history"][0]["note"] == "Under review by admin."

    response = client.post("/api/requests/REQ-2026-0101/transition", json={"target_status": "Fulfilled", "operational_note": "Approved and completed."})
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == "Fulfilled"
    assert len(body["history"]) == 2

    with session_factory() as db:
        request = db.query(Request).filter_by(request_id="REQ-2026-0101").one()
        assert request.status == RequestStatus.fulfilled
        history = db.query(RequestHistory).filter_by(request_id=request.request_id).all()
        assert len(history) == 2
        assert all(record.performed_by == admin.full_name for record in history)


def test_invalid_transitions_and_inputs_are_rejected():
    client, session_factory, _, _ = make_client()
    with session_factory() as db:
        db.add(
            Request(
                request_id="REQ-2026-0201",
                requester_name="Eve Hall",
                requester_email="eve@company.com",
                department="Operations",
                request_type=RequestType.consumable_request,
                requested_item="Printer paper",
                category="Office",
                quantity=10,
                priority=RequestPriority.low,
                request_date=date(2026, 9, 14),
                status=RequestStatus.fulfilled,
                justification="Already completed.",
                processing_guidelines="No further action.",
            )
        )
        db.commit()

    assert client.post("/api/requests/REQ-2026-0201/transition", json={"target_status": "Rejected"}).status_code == 409
    assert client.post("/api/requests/REQ-2026-0201/transition", json={"target_status": "In Review"}).status_code == 409
    assert client.post("/api/requests/REQ-2026-0201/transition", json={"target_status": "Unknown"}).status_code == 422
    assert client.post("/api/requests/REQ-2026-0201/transition", json={"target_status": "Rejected", "operational_note": "x" * 2001}).status_code == 422


def test_auth_errors_and_unauthenticated_admin_only_access():
    client, session_factory, _, employee = make_client()
    seed_requests(session_factory)

    client.app.dependency_overrides.pop(get_current_user)
    assert client.get("/api/requests").status_code == 401
    assert client.get("/api/requests/REQ-2026-0001").status_code == 401
    assert client.post("/api/requests/REQ-2026-0001/transition", json={"target_status": "In Review"}).status_code == 401

    client.app.dependency_overrides[get_current_user] = lambda: employee
    assert client.get("/api/requests").status_code == 403
    assert client.post("/api/requests/REQ-2026-0001/transition", json={"target_status": "In Review"}).status_code == 403


def test_transition_transaction_rolls_back_on_audit_failure(monkeypatch):
    client, session_factory, _, _ = make_client(raise_server_exceptions=False)
    with session_factory() as db:
        db.add(
            Request(
                request_id="REQ-2026-0301",
                requester_name="Frank Diaz",
                requester_email="frank@company.com",
                department="Operations",
                request_type=RequestType.asset_request,
                requested_item="Docking Station",
                category="Hardware",
                quantity=1,
                priority=RequestPriority.medium,
                request_date=date(2026, 9, 15),
                status=RequestStatus.pending,
                justification="Support flexible work.",
                processing_guidelines="Approve once reviewed.",
            )
        )
        db.commit()

    import app.routers.requests as requests_router

    def boom(*args, **kwargs):
        raise RuntimeError("audit fail")

    monkeypatch.setattr(requests_router, "_create_audit_log", boom)
    response = client.post("/api/requests/REQ-2026-0301/transition", json={"target_status": "In Review"})
    assert response.status_code == 500

    with session_factory() as db:
        request = db.query(Request).filter_by(request_id="REQ-2026-0301").one()
        assert request.status == RequestStatus.pending
        assert db.query(RequestHistory).filter_by(request_id="REQ-2026-0301").count() == 0


def valid_external_payload(**overrides):
    payload = {
        "request_source": "External",
        "date_received": "2026-10-26",
        "external_reference": "EXT-REF-1002",
        "requester_name": "Dr. Sarah Connor",
        "department": "Facilities & Operations",
        "contact_info": "+91 98765 43210",
        "requester_email": "s.connor@external.local",
        "request_type": "Asset Request",
        "requested_item": "Precision Laser Level",
        "category": "Office Equipment",
        "quantity": 2,
        "estimated_cost": "18500.00",
        "procurement_reference": "PO-REQ-4421",
        "priority": "Medium",
        "justification": "Required for site alignment auditing.",
        "processing_guidelines": "External requisition recorded for administrative review.",
    }
    payload.update(overrides)
    return payload


def test_admin_can_create_valid_external_request():
    client, session_factory, admin, _ = make_client()
    payload = valid_external_payload()
    response = client.post("/api/requests/external", json=payload)
    assert response.status_code == 201, response.text
    data = response.json()

    assert data["request_id"].startswith("REQ-")
    assert data["status"] == "Pending"
    assert data["request_source"] == "External"
    assert data["date_received"] == "2026-10-26"
    assert data["external_reference"] == "EXT-REF-1002"
    assert data["requester_name"] == "Dr. Sarah Connor"
    assert data["department"] == "Facilities & Operations"
    assert data["contact_info"] == "+91 98765 43210"
    assert data["requester_email"] == "s.connor@external.local"
    assert data["request_type"] == "Asset Request"
    assert data["requested_item"] == "Precision Laser Level"
    assert data["category"] == "Office Equipment"
    assert data["quantity"] == 2
    assert data["estimated_cost"] == "18500.00"
    assert data["procurement_reference"] == "PO-REQ-4421"
    assert data["priority"] == "Medium"
    assert data["justification"] == "Required for site alignment auditing."
    assert data["attachments"] == []

    # Verify history in response
    assert len(data["history"]) == 1
    assert data["history"][0]["stage"] == "Pending"
    assert data["history"][0]["action"] == "External request recorded"
    assert data["history"][0]["performed_by"] == admin.full_name
    assert "EXT-REF-1002" in data["history"][0]["note"]

    # Verify DB persistence
    with session_factory() as db:
        req = db.query(Request).filter_by(request_id=data["request_id"]).one()
        assert req.request_source == "External"
        assert req.estimated_cost == "18500.00"
        assert req.external_reference == "EXT-REF-1002"

        history_records = db.query(RequestHistory).filter_by(request_id=req.request_id).all()
        assert len(history_records) == 1
        assert history_records[0].performed_by == admin.full_name

        audit_records = db.query(AuditLog).filter_by(request_identifier=req.request_id).all()
        assert len(audit_records) == 1
        assert audit_records[0].action == "external_request_created"
        assert audit_records[0].actor_user_id == admin.id
        assert audit_records[0].after_state["status"] == "Pending"
        assert audit_records[0].after_state["request_source"] == "External"


def test_external_request_defaults_when_optional_fields_omitted():
    client, session_factory, admin, _ = make_client()
    payload = {
        "date_received": "2026-10-26",
        "requester_name": "Marcus Vance",
        "request_type": "Consumable Request",
        "requested_item": "Cat6 Patch Cable",
        "category": "Consumables & Cables",
        "priority": "Low",
        "justification": "Cabinet patch replacement.",
    }
    response = client.post("/api/requests/external", json=payload)
    assert response.status_code == 201, response.text
    data = response.json()

    assert data["department"] == "General Operations"
    assert data["requester_email"] == "marcus.vance@external.local"
    assert data["quantity"] == 1
    assert data["request_source"] == "External"
    assert data["external_reference"] is None
    assert data["contact_info"] is None
    assert data["estimated_cost"] is None
    assert data["procurement_reference"] is None
    assert data["processing_guidelines"] == "External requisition recorded for administrative review."
    assert "Recorded via external request entry workflow." in data["history"][0]["note"]


def test_external_request_email_derived_from_contact_info():
    client, _, _, _ = make_client()
    payload = {
        "date_received": "2026-10-26",
        "requester_name": "Alice Vendor",
        "contact_info": "alice.v@external-contractor.com",
        "request_type": "Asset Request",
        "requested_item": "External Display",
        "category": "Peripherals & Displays",
        "priority": "High",
        "justification": "Contractor display equipment.",
    }
    response = client.post("/api/requests/external", json=payload)
    assert response.status_code == 201, response.text
    assert response.json()["requester_email"] == "alice.v@external-contractor.com"


def test_external_request_appears_in_list_and_detail_queries():
    client, _, _, _ = make_client()
    create_resp = client.post("/api/requests/external", json=valid_external_payload())
    assert create_resp.status_code == 201
    created_id = create_resp.json()["request_id"]

    # Test list endpoint
    list_resp = client.get("/api/requests")
    assert list_resp.status_code == 200
    items = list_resp.json()["items"]
    matched = [it for it in items if it["request_id"] == created_id]
    assert len(matched) == 1
    assert matched[0]["request_source"] == "External"
    assert matched[0]["estimated_cost"] == "18500.00"
    assert matched[0]["external_reference"] == "EXT-REF-1002"

    # Test detail endpoint
    detail_resp = client.get(f"/api/requests/{created_id}")
    assert detail_resp.status_code == 200
    detail = detail_resp.json()
    assert detail["request_source"] == "External"
    assert detail["estimated_cost"] == "18500.00"
    assert detail["attachments"] == []
    assert len(detail["history"]) == 1


def test_external_request_missing_required_fields_rejected():
    client, _, _, _ = make_client()
    base = valid_external_payload()

    for field in ["date_received", "requester_name", "requested_item", "category", "justification", "priority", "request_type"]:
        bad_payload = dict(base)
        del bad_payload[field]
        resp = client.post("/api/requests/external", json=bad_payload)
        assert resp.status_code == 422, f"Expected 422 for missing {field}"

    # Empty string validation
    for field in ["requester_name", "requested_item", "category", "justification"]:
        bad_payload = dict(base)
        bad_payload[field] = "   "
        resp = client.post("/api/requests/external", json=bad_payload)
        assert resp.status_code == 422, f"Expected 422 for blank {field}"


def test_external_request_invalid_inputs_rejected():
    client, _, _, _ = make_client()

    # Invalid quantity
    resp = client.post("/api/requests/external", json=valid_external_payload(quantity=0))
    assert resp.status_code == 422
    resp = client.post("/api/requests/external", json=valid_external_payload(quantity=-1))
    assert resp.status_code == 422

    # Invalid request type & priority
    resp = client.post("/api/requests/external", json=valid_external_payload(request_type="Unknown Request"))
    assert resp.status_code == 422
    resp = client.post("/api/requests/external", json=valid_external_payload(priority="Critical"))
    assert resp.status_code == 422

    # Invalid date
    resp = client.post("/api/requests/external", json=valid_external_payload(date_received="not-a-date"))
    assert resp.status_code == 422

    # Justification length > 500
    resp = client.post("/api/requests/external", json=valid_external_payload(justification="x" * 501))
    assert resp.status_code == 422

    # Invalid request_source (must be External)
    resp = client.post("/api/requests/external", json=valid_external_payload(request_source="Internal"))
    assert resp.status_code == 422

    # Invalid estimated cost: negative, NaN, infinity, malformed strings
    for bad_cost in ["-500", "-0.01", "NaN", "nan", "Infinity", "inf", "-Infinity", "abc", "12.34.56", "₹-200"]:
        resp = client.post("/api/requests/external", json=valid_external_payload(estimated_cost=bad_cost))
        assert resp.status_code == 422, f"Expected 422 for estimated_cost={bad_cost}"


def test_external_request_valid_estimated_cost_formats():
    client, _, _, _ = make_client()
    for valid_cost in ["15000", "15000.50", "₹25000", "$3000", "1,25,000.00", "0", "0.00"]:
        resp = client.post("/api/requests/external", json=valid_external_payload(estimated_cost=valid_cost))
        assert resp.status_code == 201, f"Expected 201 for valid cost format: {valid_cost}"
        assert resp.json()["estimated_cost"] is not None


def test_external_request_auth_enforcement():
    client, _, _, employee = make_client()
    payload = valid_external_payload()

    # Unauthenticated
    client.app.dependency_overrides.pop(get_current_user)
    assert client.post("/api/requests/external", json=payload).status_code == 401

    # Non-admin employee
    client.app.dependency_overrides[get_current_user] = lambda: employee
    assert client.post("/api/requests/external", json=payload).status_code == 403


def test_external_request_metadata_survives_transitions():
    client, session_factory, admin, _ = make_client()
    resp = client.post("/api/requests/external", json=valid_external_payload())
    assert resp.status_code == 201
    req_id = resp.json()["request_id"]

    # Transition to In Review
    t1 = client.post(f"/api/requests/{req_id}/transition", json={"target_status": "In Review", "operational_note": "Reviewing quotes."})
    assert t1.status_code == 200
    d1 = t1.json()
    assert d1["status"] == "In Review"
    assert d1["request_source"] == "External"
    assert d1["external_reference"] == "EXT-REF-1002"
    assert d1["estimated_cost"] == "18500.00"
    assert d1["date_received"] == "2026-10-26"
    assert d1["procurement_reference"] == "PO-REQ-4421"
    assert len(d1["history"]) == 2

    # Transition to Fulfilled
    t2 = client.post(f"/api/requests/{req_id}/transition", json={"target_status": "Fulfilled", "operational_note": "Procurement completed."})
    assert t2.status_code == 200
    d2 = t2.json()
    assert d2["status"] == "Fulfilled"
    assert d2["request_source"] == "External"
    assert d2["external_reference"] == "EXT-REF-1002"
    assert d2["estimated_cost"] == "18500.00"
    assert len(d2["history"]) == 3

    # Check database persistence
    with session_factory() as db:
        req = db.query(Request).filter_by(request_id=req_id).one()
        assert req.status == RequestStatus.fulfilled
        assert req.request_source == "External"
        assert req.estimated_cost == "18500.00"
        assert req.external_reference == "EXT-REF-1002"


def test_external_request_creation_rollback_on_failure(monkeypatch):
    client, session_factory, _, _ = make_client(raise_server_exceptions=False)
    import app.routers.requests as requests_router

    def boom(*args, **kwargs):
        raise RuntimeError("simulated audit failure during creation")

    monkeypatch.setattr(requests_router, "_create_external_audit_log", boom)
    resp = client.post("/api/requests/external", json=valid_external_payload())
    assert resp.status_code == 500

    with session_factory() as db:
        assert db.query(Request).filter_by(requested_item="Precision Laser Level").count() == 0
        assert db.query(RequestHistory).count() == 0
        assert db.query(AuditLog).count() == 0


SAMPLE_PDF = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n"
SAMPLE_PNG = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
SAMPLE_JPG = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00\xff\xdb\x00C\x00\xff\xd9"


def make_test_docx() -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>')
        zf.writestr("word/document.xml", '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"></w:document>')
    return buf.getvalue()


def test_admin_upload_valid_pdf_and_images_and_docx():
    client, session_factory, admin, _ = make_client()
    seed_requests(session_factory)

    # 1. Upload valid PDF
    res = client.post(
        "/api/requests/REQ-2026-0001/attachments",
        files={"file": ("vendor_approval.pdf", SAMPLE_PDF, "application/pdf")},
    )
    assert res.status_code == 201, res.text
    meta = res.json()
    assert meta["attachment_id"].startswith("ATT-")
    assert meta["id"] == meta["attachment_id"]
    assert meta["request_id"] == "REQ-2026-0001"
    assert meta["original_filename"] == "vendor_approval.pdf"
    assert meta["name"] == "vendor_approval.pdf"
    assert meta["content_type"] == "application/pdf"
    assert meta["type"] == "application/pdf"
    assert meta["file_size"] == len(SAMPLE_PDF)
    assert meta["size"] == f"{len(SAMPLE_PDF)} B"
    assert "uploadDate" in meta
    assert meta["download_url"].endswith(f"/attachments/{meta['attachment_id']}/download")
    assert meta["preview_url"].endswith(f"/attachments/{meta['attachment_id']}/preview")

    # 2. Upload valid PNG image
    res_png = client.post(
        "/api/requests/REQ-2026-0001/attachments",
        files={"file": ("receipt.png", SAMPLE_PNG, "image/png")},
    )
    assert res_png.status_code == 201, res_png.text
    assert res_png.json()["content_type"] == "image/png"

    # 3. Upload valid JPEG image
    res_jpg = client.post(
        "/api/requests/REQ-2026-0001/attachments",
        files={"file": ("photo.jpg", SAMPLE_JPG, "image/jpeg")},
    )
    assert res_jpg.status_code == 201, res_jpg.text
    assert res_jpg.json()["content_type"] == "image/jpeg"

    # 4. Upload valid DOCX document
    docx_bytes = make_test_docx()
    res_docx = client.post(
        "/api/requests/REQ-2026-0001/attachments",
        files={"file": ("specs.docx", docx_bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
    )
    assert res_docx.status_code == 201, res_docx.text
    assert res_docx.json()["content_type"] == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


def test_attachment_metadata_persists_in_request_detail_and_list():
    client, session_factory, _, _ = make_client()
    seed_requests(session_factory)

    upload_res = client.post(
        "/api/requests/REQ-2026-0001/attachments",
        files={"file": ("approval.pdf", SAMPLE_PDF, "application/pdf")},
    )
    assert upload_res.status_code == 201
    att_id = upload_res.json()["attachment_id"]

    # Verify GET request detail includes attachments
    detail_res = client.get("/api/requests/REQ-2026-0001")
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert len(detail["attachments"]) == 1
    assert detail["attachments"][0]["attachment_id"] == att_id
    assert detail["attachments"][0]["name"] == "approval.pdf"
    # Never leak physical server path
    assert "storage_key" not in str(detail["attachments"][0])
    assert "uploads" not in str(detail["attachments"][0])

    # Verify GET request attachments endpoint
    list_res = client.get("/api/requests/REQ-2026-0001/attachments")
    assert list_res.status_code == 200
    items = list_res.json()
    assert len(items) == 1
    assert items[0]["attachment_id"] == att_id
    assert items[0]["original_filename"] == "approval.pdf"


def test_attachment_list_returns_empty_when_no_attachments():
    client, session_factory, _, _ = make_client()
    seed_requests(session_factory)

    res = client.get("/api/requests/REQ-2026-0002/attachments")
    assert res.status_code == 200
    assert res.json() == []


def test_download_stored_attachment_correctly():
    client, session_factory, _, _ = make_client()
    seed_requests(session_factory)

    upload_res = client.post(
        "/api/requests/REQ-2026-0001/attachments",
        files={"file": ("signed_form.pdf", SAMPLE_PDF, "application/pdf")},
    )
    assert upload_res.status_code == 201
    att_id = upload_res.json()["attachment_id"]

    download_res = client.get(f"/api/requests/REQ-2026-0001/attachments/{att_id}/download")
    assert download_res.status_code == 200
    assert download_res.content == SAMPLE_PDF
    assert download_res.headers["content-type"] == "application/pdf"
    assert download_res.headers["x-content-type-options"] == "nosniff"
    assert 'attachment; filename="signed_form.pdf"' in download_res.headers["content-disposition"]


def test_preview_inline_for_pdf_and_images_download_for_docx():
    client, session_factory, _, _ = make_client()
    seed_requests(session_factory)

    # PDF preview is inline
    pdf_upload = client.post(
        "/api/requests/REQ-2026-0001/attachments",
        files={"file": ("memo.pdf", SAMPLE_PDF, "application/pdf")},
    )
    pdf_id = pdf_upload.json()["attachment_id"]
    pdf_prev = client.get(f"/api/requests/REQ-2026-0001/attachments/{pdf_id}/preview")
    assert pdf_prev.status_code == 200
    assert pdf_prev.content == SAMPLE_PDF
    assert pdf_prev.headers["content-type"] == "application/pdf"
    assert pdf_prev.headers["x-content-type-options"] == "nosniff"
    assert 'inline; filename="memo.pdf"' in pdf_prev.headers["content-disposition"]

    # Image preview is inline
    img_upload = client.post(
        "/api/requests/REQ-2026-0001/attachments",
        files={"file": ("diagram.png", SAMPLE_PNG, "image/png")},
    )
    img_id = img_upload.json()["attachment_id"]
    img_prev = client.get(f"/api/requests/REQ-2026-0001/attachments/{img_id}/preview")
    assert img_prev.status_code == 200
    assert img_prev.content == SAMPLE_PNG
    assert 'inline; filename="diagram.png"' in img_prev.headers["content-disposition"]

    # DOCX preview is served as download for safety
    docx_upload = client.post(
        "/api/requests/REQ-2026-0001/attachments",
        files={"file": ("contract.docx", make_test_docx(), "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
    )
    docx_id = docx_upload.json()["attachment_id"]
    docx_prev = client.get(f"/api/requests/REQ-2026-0001/attachments/{docx_id}/preview")
    assert docx_prev.status_code == 200
    assert 'attachment; filename="contract.docx"' in docx_prev.headers["content-disposition"]


def test_unsupported_extensions_and_invalid_magic_bytes_rejected():
    client, session_factory, _, _ = make_client()
    seed_requests(session_factory)

    # Disallowed extensions
    for bad_name in ["script.sh", "payload.exe", "data.json", "archive.zip", "notes.txt"]:
        res = client.post(
            "/api/requests/REQ-2026-0001/attachments",
            files={"file": (bad_name, b"some content", "application/octet-stream")},
        )
        assert res.status_code == 400, f"Expected 400 for {bad_name}, got {res.status_code}"

    # Disallowed content / invalid magic bytes matching extension
    # Fake PDF (text instead of %PDF-)
    res_fake_pdf = client.post(
        "/api/requests/REQ-2026-0001/attachments",
        files={"file": ("fake.pdf", b"This is just plain text masquerading as pdf", "application/pdf")},
    )
    assert res_fake_pdf.status_code == 400
    assert "PDF" in res_fake_pdf.json()["detail"]

    # Executable masquerading as PDF
    res_exe_pdf = client.post(
        "/api/requests/REQ-2026-0001/attachments",
        files={"file": ("trojan.pdf", b"MZ\x90\x00\x03\x00\x00\x00", "application/pdf")},
    )
    assert res_exe_pdf.status_code == 400
    assert "Executable" in res_exe_pdf.json()["detail"]

    # HTML masquerading as PNG
    res_html_png = client.post(
        "/api/requests/REQ-2026-0001/attachments",
        files={"file": ("xss.png", b"<html><script>alert(1)</script></html>", "image/png")},
    )
    assert res_html_png.status_code == 400

    # Empty file
    res_empty = client.post(
        "/api/requests/REQ-2026-0001/attachments",
        files={"file": ("empty.pdf", b"", "application/pdf")},
    )
    assert res_empty.status_code == 400


def test_oversized_file_rejected_and_partial_file_cleaned():
    upload_tmp = tempfile.mkdtemp(prefix="amx_oversize_test_")
    client, session_factory, _, _ = make_client(upload_dir=upload_tmp)
    seed_requests(session_factory)

    # Construct payload larger than 15 MiB
    oversized_data = b"%PDF-1.4\n" + b"X" * (15 * 1024 * 1024 + 500)
    res = client.post(
        "/api/requests/REQ-2026-0001/attachments",
        files={"file": ("huge.pdf", oversized_data, "application/pdf")},
    )
    assert res.status_code == 413
    assert "15 MiB" in res.json()["detail"]

    # Verify no partial file remains in upload_dir
    files_in_dir = list(Path(upload_tmp).glob("*"))
    assert len(files_in_dir) == 0


def test_path_traversal_filenames_cannot_escape_private_directory():
    upload_tmp = tempfile.mkdtemp(prefix="amx_traversal_test_")
    client, session_factory, _, _ = make_client(upload_dir=upload_tmp)
    seed_requests(session_factory)

    # Attempt directory traversal in filename
    traversal_name = "../../../../outside.pdf"
    res = client.post(
        "/api/requests/REQ-2026-0001/attachments",
        files={"file": (traversal_name, SAMPLE_PDF, "application/pdf")},
    )
    assert res.status_code == 201
    meta = res.json()
    assert ".." not in meta["original_filename"]
    assert "/" not in meta["original_filename"]

    # Stored file must be strictly inside upload_tmp
    files_in_dir = list(Path(upload_tmp).glob("*"))
    assert len(files_in_dir) == 1
    assert files_in_dir[0].is_file()
    # Check parent directory was not written into
    parent_files = list(Path(upload_tmp).parent.glob("outside.pdf"))
    assert len(parent_files) == 0


def test_attachment_auth_enforcement_401_and_403():
    client, session_factory, _, employee = make_client()
    seed_requests(session_factory)

    # 1. Unauthenticated -> 401
    client.app.dependency_overrides.pop(get_current_user)
    assert client.post("/api/requests/REQ-2026-0001/attachments", files={"file": ("memo.pdf", SAMPLE_PDF, "application/pdf")}).status_code == 401
    assert client.get("/api/requests/REQ-2026-0001/attachments").status_code == 401
    assert client.get("/api/requests/REQ-2026-0001/attachments/ATT-001/download").status_code == 401
    assert client.get("/api/requests/REQ-2026-0001/attachments/ATT-001/preview").status_code == 401

    # 2. Non-admin (employee) -> 403
    client.app.dependency_overrides[get_current_user] = lambda: employee
    assert client.post("/api/requests/REQ-2026-0001/attachments", files={"file": ("memo.pdf", SAMPLE_PDF, "application/pdf")}).status_code == 403
    assert client.get("/api/requests/REQ-2026-0001/attachments").status_code == 403
    assert client.get("/api/requests/REQ-2026-0001/attachments/ATT-001/download").status_code == 403
    assert client.get("/api/requests/REQ-2026-0001/attachments/ATT-001/preview").status_code == 403


def test_missing_request_or_attachment_returns_404():
    client, session_factory, _, _ = make_client()
    seed_requests(session_factory)

    # Missing request on upload
    assert client.post("/api/requests/REQ-NONEXISTENT/attachments", files={"file": ("test.pdf", SAMPLE_PDF, "application/pdf")}).status_code == 404
    # Missing request on list
    assert client.get("/api/requests/REQ-NONEXISTENT/attachments").status_code == 404
    # Missing attachment on download
    assert client.get("/api/requests/REQ-2026-0001/attachments/ATT-NONEXISTENT/download").status_code == 404
    # Missing attachment on preview
    assert client.get("/api/requests/REQ-2026-0001/attachments/ATT-NONEXISTENT/preview").status_code == 404


def test_attachment_cannot_be_accessed_via_different_request_id():
    client, session_factory, _, _ = make_client()
    seed_requests(session_factory)

    # Upload attachment to REQ-2026-0001
    upload_res = client.post(
        "/api/requests/REQ-2026-0001/attachments",
        files={"file": ("memo.pdf", SAMPLE_PDF, "application/pdf")},
    )
    att_id = upload_res.json()["attachment_id"]

    # Attempt to download via REQ-2026-0002 -> 404
    assert client.get(f"/api/requests/REQ-2026-0002/attachments/{att_id}/download").status_code == 404
    # Attempt to preview via REQ-2026-0002 -> 404
    assert client.get(f"/api/requests/REQ-2026-0002/attachments/{att_id}/preview").status_code == 404


def test_upload_failure_cleans_up_file_and_preserves_existing(monkeypatch):
    upload_tmp = tempfile.mkdtemp(prefix="amx_cleanup_test_")
    client, session_factory, _, _ = make_client(raise_server_exceptions=False, upload_dir=upload_tmp)
    seed_requests(session_factory)

    # 1. First upload a valid attachment
    valid_res = client.post(
        "/api/requests/REQ-2026-0001/attachments",
        files={"file": ("existing.pdf", SAMPLE_PDF, "application/pdf")},
    )
    assert valid_res.status_code == 201
    valid_id = valid_res.json()["attachment_id"]

    # Verify 1 file exists on disk
    files_before = list(Path(upload_tmp).glob("*.dat"))
    assert len(files_before) == 1

    # 2. Simulate database failure on second upload
    import app.routers.requests as requests_router

    def boom(*args, **kwargs):
        raise RuntimeError("database crash during audit log")

    monkeypatch.setattr(requests_router, "_create_attachment_audit_log", boom)

    fail_res = client.post(
        "/api/requests/REQ-2026-0001/attachments",
        files={"file": ("failing.pdf", SAMPLE_PDF, "application/pdf")},
    )
    assert fail_res.status_code == 500

    # 3. Verify failed upload did NOT leave a partial or orphaned file
    files_after = list(Path(upload_tmp).glob("*.dat"))
    assert len(files_after) == 1
    assert files_after[0] == files_before[0]

    # Verify existing attachment is still valid and downloadable
    download_res = client.get(f"/api/requests/REQ-2026-0001/attachments/{valid_id}/download")
    assert download_res.status_code == 200

    # Verify no second record was created in DB
    with session_factory() as db:
        assert db.query(RequestAttachment).filter_by(request_id="REQ-2026-0001").count() == 1


def test_missing_stored_file_on_disk_handled_safely():
    upload_tmp = tempfile.mkdtemp(prefix="amx_missing_file_test_")
    client, session_factory, _, _ = make_client(upload_dir=upload_tmp)
    seed_requests(session_factory)

    upload_res = client.post(
        "/api/requests/REQ-2026-0001/attachments",
        files={"file": ("deleted_later.pdf", SAMPLE_PDF, "application/pdf")},
    )
    att_id = upload_res.json()["attachment_id"]

    # Remove the physical file from disk to simulate loss/corruption
    for f in Path(upload_tmp).glob("*.dat"):
        f.unlink()

    # Download returns 404 safely
    dl_res = client.get(f"/api/requests/REQ-2026-0001/attachments/{att_id}/download")
    assert dl_res.status_code == 404
    assert "Stored attachment file not found" in dl_res.json()["detail"]

    # Preview returns 404 safely
    prev_res = client.get(f"/api/requests/REQ-2026-0001/attachments/{att_id}/preview")
    assert prev_res.status_code == 404
    assert "Stored attachment file not found" in prev_res.json()["detail"]


def test_audit_logging_occurs_after_successful_upload():
    client, session_factory, admin, _ = make_client()
    seed_requests(session_factory)

    upload_res = client.post(
        "/api/requests/REQ-2026-0001/attachments",
        files={"file": ("audit_doc.pdf", SAMPLE_PDF, "application/pdf")},
    )
    assert upload_res.status_code == 201
    meta = upload_res.json()

    with session_factory() as db:
        audit = db.query(AuditLog).filter_by(action="request_attachment_uploaded").one()
        assert audit.actor_user_id == admin.id
        assert audit.request_identifier == "REQ-2026-0001"
        assert audit.metadata_json["attachment_id"] == meta["attachment_id"]
        assert audit.metadata_json["original_filename"] == "audit_doc.pdf"
        assert audit.metadata_json["size"] == len(SAMPLE_PDF)
        assert audit.metadata_json["content_type"] == "application/pdf"
        # Ensure file content is not logged
        assert "bytes" not in audit.metadata_json
        assert "SAMPLE_PDF" not in str(audit.metadata_json)


def test_attachment_endpoint_with_disposition_query_param():
    client, session_factory, _, employee = make_client()
    seed_requests(session_factory)

    upload_res = client.post(
        "/api/requests/REQ-2026-0001/attachments",
        files={"file": ("report.pdf", SAMPLE_PDF, "application/pdf")},
    )
    assert upload_res.status_code == 201
    att_id = upload_res.json()["attachment_id"]

    # 1. Default disposition is download
    res_default = client.get(f"/api/requests/REQ-2026-0001/attachments/{att_id}")
    assert res_default.status_code == 200
    assert res_default.content == SAMPLE_PDF
    assert 'attachment; filename="report.pdf"' in res_default.headers["content-disposition"]

    # 2. disposition=download / attachment
    res_dl = client.get(f"/api/requests/REQ-2026-0001/attachments/{att_id}?disposition=download")
    assert res_dl.status_code == 200
    assert 'attachment; filename="report.pdf"' in res_dl.headers["content-disposition"]

    res_att = client.get(f"/api/requests/REQ-2026-0001/attachments/{att_id}?disposition=attachment")
    assert res_att.status_code == 200
    assert 'attachment; filename="report.pdf"' in res_att.headers["content-disposition"]

    # 3. disposition=preview / inline
    res_prev = client.get(f"/api/requests/REQ-2026-0001/attachments/{att_id}?disposition=preview")
    assert res_prev.status_code == 200
    assert 'inline; filename="report.pdf"' in res_prev.headers["content-disposition"]

    res_inline = client.get(f"/api/requests/REQ-2026-0001/attachments/{att_id}?disposition=inline")
    assert res_inline.status_code == 200
    assert 'inline; filename="report.pdf"' in res_inline.headers["content-disposition"]

    # 4. Auth checks on unified endpoint
    client.app.dependency_overrides.pop(get_current_user)
    assert client.get(f"/api/requests/REQ-2026-0001/attachments/{att_id}").status_code == 401

    client.app.dependency_overrides[get_current_user] = lambda: employee
    assert client.get(f"/api/requests/REQ-2026-0001/attachments/{att_id}").status_code == 403
