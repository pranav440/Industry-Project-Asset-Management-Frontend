from datetime import date

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.deps import get_current_user
from app.models import Request, RequestHistory, RequestPriority, RequestStatus, RequestType, User, UserRole
from app.routers.requests import router


def make_client(*, raise_server_exceptions: bool = True):
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    session_factory = sessionmaker(bind=engine)
    Base.metadata.create_all(engine)
    app = FastAPI()
    app.include_router(router)

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
