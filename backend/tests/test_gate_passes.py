from datetime import date

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.deps import get_current_user
from app.models import GatePass, GatePassHistory, User, UserRole
from app.routers.gate_passes import router


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


def test_create_gate_pass_admin_and_initial_history_audit():
    client, session_factory, admin, _ = make_client()

    response = client.post(
        "/api/gate-passes",
        json={
            "pass_type": "Asset Movement",
            "asset_or_item": "Laptop",
            "quantity": 2,
            "destination": "Warehouse B",
            "movement_date": "2026-09-20",
            "purpose": "Reassignment to site operations",
        },
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["status"] == "Pending"
    assert body["requester_name"] == admin.full_name
    assert body["pass_id"].startswith("GP-")
    assert body["history"][0]["action"] == "Gate Pass Created"
    assert body["history"][0]["performed_by"] == admin.full_name

    with session_factory() as db:
        gate_pass = db.query(GatePass).one()
        assert gate_pass.status.value == "Pending"
        assert gate_pass.request_date == date.today()
        history = db.query(GatePassHistory).filter_by(pass_id=gate_pass.pass_id).all()
        assert len(history) == 1
        assert history[0].action == "Gate Pass Created"


def test_list_gate_passes_filters_and_pagination():
    client, session_factory, _, _ = make_client()
    with session_factory() as db:
        db.add_all([
            GatePass(
                pass_id="GP-2026-0001",
                pass_type="Asset Movement",
                request_date=date(2026, 9, 10),
                status="Pending",
                requester_name="Alice Green",
                department="Operations",
                asset_or_item="Laptop",
                quantity=2,
                current_location="Office A",
                destination="Warehouse B",
                movement_date=date(2026, 9, 11),
                purpose="Move to operations team",
                authorization_state="Pending Review",
                decision_status="Awaiting Review",
                decision_date=None,
                decision_by=None,
            ),
            GatePass(
                pass_id="GP-2026-0002",
                pass_type="Returnable",
                request_date=date(2026, 9, 11),
                status="Approved",
                requester_name="Bob Brown",
                department="IT",
                asset_or_item="Monitor",
                quantity=1,
                current_location="Server Room",
                destination="Branch Office",
                movement_date=date(2026, 9, 12),
                purpose="Screen replacement",
                authorization_state="Approved by Admin",
                decision_status="Approved",
                decision_date=date(2026, 9, 12),
                decision_by="Admin User",
            ),
        ])
        db.commit()

    response = client.get("/api/gate-passes", params={"search": "Monitor", "page": 1, "page_size": 10})
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["pass_id"] == "GP-2026-0002"

    response = client.get("/api/gate-passes", params={"pass_type": "Asset Movement", "status": "Pending", "location": "Office A", "date": "2026-09-10"})
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["destination"] == "Warehouse B"

    response = client.get("/api/gate-passes", params={"page": 2, "page_size": 1})
    assert response.status_code == 200
    body = response.json()
    assert body["page"] == 2
    assert body["page_size"] == 1
    assert body["total"] == 2


def test_get_gate_pass_detail_includes_history_and_handles_missing_pass():
    client, session_factory, _, _ = make_client()
    with session_factory() as db:
        gate_pass = GatePass(
            pass_id="GP-2026-0003",
            pass_type="Asset Movement",
            request_date=date(2026, 9, 13),
            status="Approved",
            requester_name="Dana Cole",
            department="Engineering",
            asset_or_item="Docking Station",
            quantity=1,
            current_location="HQ",
            destination="Lab 2",
            movement_date=date(2026, 9, 14),
            purpose="Move to testing bench",
            authorization_state="Approved by Admin",
            decision_status="Approved",
            decision_date=date(2026, 9, 13),
            decision_by="Admin User",
        )
        db.add(gate_pass)
        db.commit()
        db.add(GatePassHistory(history_id="GPH-2026-0001", pass_id=gate_pass.pass_id, timestamp=gate_pass.request_date, action="Gate Pass Created", performed_by="Admin User", note="Created", status_snapshot="Pending"))
        db.commit()

    response = client.get("/api/gate-passes/GP-2026-0003")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == "Approved"
    assert len(body["history"]) == 1

    response = client.get("/api/gate-passes/GP-NOT-FOUND")
    assert response.status_code == 404


def test_decision_transition_approve_reject_and_invalid_status():
    client, session_factory, admin, _ = make_client()
    with session_factory() as db:
        db.add(
            GatePass(
                pass_id="GP-2026-0101",
                pass_type="Asset Movement",
                request_date=date(2026, 9, 15),
                status="Pending",
                requester_name="Eve Hall",
                department="Operations",
                asset_or_item="Printer",
                quantity=1,
                current_location="Office A",
                destination="Branch K",
                movement_date=date(2026, 9, 16),
                purpose="Replacement printing station",
                authorization_state="Pending Review",
                decision_status="Awaiting Review",
            )
        )
        db.commit()

    response = client.post("/api/gate-passes/GP-2026-0101/decision", json={"target_status": "Approved", "note": "Approved by admin."})
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == "Approved"
    assert body["decision_by"] == admin.full_name
    assert body["history"][0]["action"] == "Decision Updated"

    response = client.post("/api/gate-passes/GP-2026-0101/decision", json={"target_status": "Rejected", "note": "Not allowed after approved."})
    assert response.status_code == 409

    response = client.post("/api/gate-passes/GP-2026-0101/decision", json={"target_status": "Active", "note": "Bad transition"})
    assert response.status_code == 422


def test_exit_and_entry_verification_transition_and_invalid_status():
    client, session_factory, admin, _ = make_client()
    with session_factory() as db:
        db.add(
            GatePass(
                pass_id="GP-2026-0201",
                pass_type="Asset Movement",
                request_date=date(2026, 9, 18),
                status="Approved",
                requester_name="Frank Diaz",
                department="Logistics",
                asset_or_item="Forklift",
                quantity=1,
                current_location="Warehouse",
                destination="Site 2",
                movement_date=date(2026, 9, 19),
                purpose="Equipment relocation",
                authorization_state="Approved by Admin",
                decision_status="Approved",
                decision_date=date(2026, 9, 18),
                decision_by="Admin User",
            )
        )
        db.commit()

    response = client.post("/api/gate-passes/GP-2026-0201/exit-verification", json={"exit_gate": "Gate 5", "exit_notes": "Loaded and departed."})
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == "Active"
    assert body["exit_status"] == "Verified"
    assert body["exit_officer"] == admin.full_name

    response = client.post("/api/gate-passes/GP-2026-0201/entry-verification", json={"entry_gate": "Gate 8", "entry_notes": "Received at destination."})
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == "Completed"
    assert body["entry_status"] == "Verified"
    assert body["entry_officer"] == admin.full_name

    response = client.post("/api/gate-passes/GP-2026-0201/entry-verification", json={"entry_gate": "Gate 8", "entry_notes": "Again"})
    assert response.status_code == 409


def test_escalation_and_override_and_invalid_state():
    client, session_factory, admin, _ = make_client()
    with session_factory() as db:
        db.add(
            GatePass(
                pass_id="GP-2026-0301",
                pass_type="Asset Movement",
                request_date=date(2026, 9, 20),
                status="Pending",
                requester_name="Grace Lee",
                department="Operations",
                asset_or_item="CCTV Camera",
                quantity=3,
                current_location="Office A",
                destination="Security Room",
                movement_date=date(2026, 9, 21),
                purpose="Security upgrade",
                authorization_state="Pending Review",
                decision_status="Awaiting Review",
            )
        )
        db.commit()

    escalated = client.post("/api/gate-passes/GP-2026-0301/escalate", json={"reason": "Pending document review", "action_required": "Verify supporting memo"})
    assert escalated.status_code == 200, escalated.text
    body = escalated.json()
    assert body["status"] == "Escalated"
    assert body["escalation_reason"] == "Pending document review"
    assert body["escalation_escalated_by"] == admin.full_name

    override = client.post("/api/gate-passes/GP-2026-0301/override", json={"note": "Override approved by admin."})
    assert override.status_code == 200, override.text
    body = override.json()
    assert body["status"] == "Approved"
    assert body["decision_status"] == "Override Granted by Administrator"
    assert body["authorization_state"] == "Administrative Override Clearance"

    with session_factory() as db:
        gate_pass = db.query(GatePass).filter_by(pass_id="GP-2026-0301").one()
        gate_pass.status = "Completed"
        db.commit()

    invalid = client.post("/api/gate-passes/GP-2026-0301/escalate", json={"reason": "Again", "action_required": "No action"})
    assert invalid.status_code == 409


def test_auth_errors_and_admin_only_access():
    client, session_factory, _, employee = make_client()
    with session_factory() as db:
        db.add(
            GatePass(
                pass_id="GP-2026-0401",
                pass_type="Asset Movement",
                request_date=date(2026, 9, 22),
                status="Pending",
                requester_name="Hank Moore",
                department="Facilities",
                asset_or_item="Air Conditioner",
                quantity=1,
                current_location="HQ",
                destination="Server Room",
                movement_date=date(2026, 9, 23),
                purpose="Cooling fix",
                authorization_state="Pending Review",
                decision_status="Awaiting Review",
            )
        )
        db.commit()

    client.app.dependency_overrides.pop(get_current_user)
    assert client.get("/api/gate-passes").status_code == 401
    assert client.get("/api/gate-passes/GP-2026-0401").status_code == 401
    assert client.post("/api/gate-passes/GP-2026-0401/decision", json={"target_status": "Approved"}).status_code == 401

    client.app.dependency_overrides[get_current_user] = lambda: employee
    assert client.get("/api/gate-passes").status_code == 403
    assert client.post("/api/gate-passes/GP-2026-0401/decision", json={"target_status": "Approved"}).status_code == 403


def test_gate_passes_rollback_on_transition_error(monkeypatch):
    client, session_factory, _, _ = make_client(raise_server_exceptions=False)
    with session_factory() as db:
        db.add(
            GatePass(
                pass_id="GP-2026-0501",
                pass_type="Asset Movement",
                request_date=date(2026, 9, 24),
                status="Pending",
                requester_name="Iris Hall",
                department="IT",
                asset_or_item="Router",
                quantity=1,
                current_location="HQ",
                destination="Edge Office",
                movement_date=date(2026, 9, 25),
                purpose="Network patch",
                authorization_state="Pending Review",
                decision_status="Awaiting Review",
            )
        )
        db.commit()

    import app.routers.gate_passes as gate_pass_router

    def boom(*args, **kwargs):
        raise RuntimeError("audit fail")

    monkeypatch.setattr(gate_pass_router, "_create_audit_log", boom)
    response = client.post("/api/gate-passes/GP-2026-0501/decision", json={"target_status": "Approved", "note": "Should fail"})
    assert response.status_code == 500
