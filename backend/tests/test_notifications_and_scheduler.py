import uuid
from datetime import date, datetime, timedelta, timezone

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.models import (
    Asset,
    Consumable,
    GatePass,
    GatePassStatus,
    GatePassType,
    Notification,
    Request,
    RequestPriority,
    RequestStatus,
    RequestType,
    User,
    UserRole,
)
from app.routers import notifications, requests
from app.security import create_access_token, hash_password


def make_test_setup():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    Base.metadata.create_all(bind=engine)

    app = FastAPI()
    app.include_router(notifications.router)
    app.include_router(requests.router)

    def override_get_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    return app, TestingSession


def seed_test_users(db: Session):
    admin = User(
        id=1,
        full_name="Admin Test",
        email="admin@assetmx.com",
        employee_id="ADM-001",
        role=UserRole.admin,
        password_hash=hash_password("adminpass"),
        is_active=True,
    )
    guard = User(
        id=2,
        full_name="Guard Officer",
        email="guard@assetmx.com",
        employee_id="GRD-001",
        role=UserRole.guard,
        password_hash=hash_password("guardpass"),
        is_active=True,
    )
    employee = User(
        id=3,
        full_name="Emp Requester",
        email="emp@assetmx.com",
        employee_id="EMP-001",
        role=UserRole.employee,
        password_hash=hash_password("emppass"),
        is_active=True,
    )
    db.add_all([admin, guard, employee])
    db.commit()


def test_notifications_crud_and_read():
    app, TestingSession = make_test_setup()
    db = TestingSession()
    seed_test_users(db)

    # Add notifications for guard and admin
    n1 = Notification(
        notification_id="NTF-001",
        target_role="admin",
        title="Admin Alert",
        message="System alert for admin",
        category="system",
        priority="high",
        is_read=False,
    )
    n2 = Notification(
        notification_id="NTF-002",
        target_role="guard",
        title="Gate Pass Alert",
        message="Vehicle checkpoint flag",
        category="gate_pass",
        priority="urgent",
        is_read=False,
    )
    db.add_all([n1, n2])
    db.commit()
    db.close()

    client = TestClient(app)
    admin_token, _ = create_access_token(user_id=1, role="admin")
    guard_token, _ = create_access_token(user_id=2, role="guard")

    # Admin sees n1 but not n2
    res_admin = client.get("/api/notifications", headers={"Authorization": f"Bearer {admin_token}"})
    assert res_admin.status_code == 200
    data = res_admin.json()
    assert data["total"] == 1
    assert data["unread_count"] == 1
    assert data["items"][0]["notification_id"] == "NTF-001"

    # Mark NTF-001 as read
    res_read = client.post("/api/notifications/NTF-001/read", headers={"Authorization": f"Bearer {admin_token}"})
    assert res_read.status_code == 200
    assert res_read.json()["is_read"] is True

    # Check unread count is now 0
    res_admin2 = client.get("/api/notifications", headers={"Authorization": f"Bearer {admin_token}"})
    assert res_admin2.json()["unread_count"] == 0

    # Guard sees n2
    res_guard = client.get("/api/notifications", headers={"Authorization": f"Bearer {guard_token}"})
    assert res_guard.status_code == 200
    assert res_guard.json()["total"] == 1
    assert res_guard.json()["items"][0]["notification_id"] == "NTF-002"

    # Read all for guard
    res_readall = client.post("/api/notifications/read-all", headers={"Authorization": f"Bearer {guard_token}"})
    assert res_readall.status_code == 200
    assert res_readall.json()["updated_count"] == 1


def test_overdue_gate_pass_auto_escalation_and_alerts():
    app, TestingSession = make_test_setup()
    db = TestingSession()
    seed_test_users(db)

    # Create returnable gate pass with movement_date in the past
    past_date = date.today() - timedelta(days=3)
    overdue_gp = GatePass(
        pass_id="GP-OVERDUE-01",
        pass_type=GatePassType.returnable,
        request_date=date.today() - timedelta(days=5),
        status=GatePassStatus.active,
        requester_name="Emp Requester",
        department="Engineering",
        asset_or_item="Precision Calibration Tool",
        quantity=1,
        destination="Client Site B",
        movement_date=past_date,
        purpose="Offsite diagnostics",
        escalation_is_escalated=False,
    )
    db.add(overdue_gp)

    # Create low stock consumable
    consumable = Consumable(
        consumable_id="CON-LOW-01",
        name="Cat6 Ethernet Cable",
        category="Networking",
        batch_id="BAT-01",
        location="Shelf A-3",
        available_stock=3,
        threshold=10,
        batch_quantity=100,
    )
    db.add(consumable)
    db.commit()
    db.close()

    client = TestClient(app)
    admin_token, _ = create_access_token(user_id=1, role="admin")

    # Trigger alert check
    res = client.post("/api/notifications/check-alerts", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200
    payload = res.json()
    assert payload["overdue_gate_passes_escalated"] == 1
    assert payload["low_stock_alerts_generated"] == 1

    # Verify gate pass in DB is now Escalated
    db = TestingSession()
    updated_gp = db.scalar(select(GatePass).where(GatePass.pass_id == "GP-OVERDUE-01"))
    assert updated_gp.status == GatePassStatus.escalated
    assert updated_gp.escalation_is_escalated is True
    assert "exceeded movement/return date" in updated_gp.escalation_reason

    # Verify Guard receives urgent notification
    guard_token, _ = create_access_token(user_id=2, role="guard")
    guard_notifs = client.get("/api/notifications", headers={"Authorization": f"Bearer {guard_token}"}).json()
    assert any(n["category"] == "gate_pass" and "GP-OVERDUE-01" in n["title"] for n in guard_notifs["items"])

    # Verify Admin receives consumable low stock alert
    admin_notifs = client.get("/api/notifications", headers={"Authorization": f"Bearer {admin_token}"}).json()
    assert any(n["category"] == "consumable" and "CON-LOW-01" in n["message"] for n in admin_notifs["items"])
    db.close()


def test_requisition_transition_generates_notification():
    app, TestingSession = make_test_setup()
    db = TestingSession()
    seed_test_users(db)

    # Seed an open requisition
    req = Request(
        request_id="REQ-2026-9001",
        requester_name="Emp Requester",
        requester_email="emp@assetmx.com",
        department="Engineering",
        request_type=RequestType.asset_request,
        requested_item="Ergonomic Workstation Chair",
        category="Furniture",
        quantity=1,
        priority=RequestPriority.medium,
        request_date=date.today(),
        status=RequestStatus.pending,
        justification="Back support requirement",
        processing_guidelines="Standard issue",
    )
    db.add(req)
    db.commit()
    db.close()

    client = TestClient(app)
    admin_token, _ = create_access_token(user_id=1, role="admin")
    emp_token, _ = create_access_token(user_id=3, role="employee")

    # Transition to Fulfilled
    res = client.post(
        "/api/requests/REQ-2026-9001/transition",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"target_status": "Fulfilled", "operational_note": "Chair dispatched from inventory"},
    )
    assert res.status_code == 200
    assert res.json()["status"] == "Fulfilled"

    # Employee checks notifications
    emp_notifs = client.get("/api/notifications", headers={"Authorization": f"Bearer {emp_token}"}).json()
    assert emp_notifs["total"] >= 1
    chair_notif = next(n for n in emp_notifs["items"] if "REQ-2026-9001" in n["title"])
    assert "Fulfilled" in chair_notif["title"]
    assert "Ergonomic Workstation Chair" in chair_notif["message"]
    assert "Chair dispatched from inventory" in chair_notif["message"]
