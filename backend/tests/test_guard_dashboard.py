from datetime import date, datetime, time, timedelta, timezone

import pytest
from fastapi import FastAPI, status
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.deps import get_current_user
from app.models import (
    Asset,
    AssetStatus,
    GatePass,
    GatePassHistory,
    GatePassStatus,
    GatePassType,
    User,
    UserRole,
)
from app.routers.dashboard import IST, router as dashboard_router


def make_test_environment():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    session_factory = sessionmaker(bind=engine, expire_on_commit=False)
    Base.metadata.create_all(engine)

    app = FastAPI()
    app.include_router(dashboard_router)

    def db_override():
        with session_factory() as db:
            yield db

    app.dependency_overrides[get_db] = db_override

    guard_user = User(
        id=1,
        full_name="Guard Officer John",
        email="guard@assetmx.local",
        employee_id="GRD001",
        role=UserRole.guard,
        password_hash="x",
        is_active=True,
    )
    admin_user = User(
        id=2,
        full_name="Admin Lead",
        email="admin@assetmx.local",
        employee_id="ADM001",
        role=UserRole.admin,
        password_hash="x",
        is_active=True,
    )
    employee_user = User(
        id=3,
        full_name="Employee Dave",
        email="emp@assetmx.local",
        employee_id="EMP001",
        role=UserRole.employee,
        password_hash="x",
        is_active=True,
    )
    host_user = User(
        id=4,
        full_name="Host Sarah",
        email="host@assetmx.local",
        employee_id="HST001",
        role=UserRole.host,
        password_hash="x",
        is_active=True,
    )

    with session_factory() as db:
        db.add_all([guard_user, admin_user, employee_user, host_user])
        db.commit()

    return app, session_factory, {
        "guard": guard_user,
        "admin": admin_user,
        "employee": employee_user,
        "host": host_user,
    }


def test_guard_dashboard_unauthenticated():
    app, _, _ = make_test_environment()
    client = TestClient(app)
    response = client.get("/api/dashboard/guard")
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


def test_guard_dashboard_forbidden_roles():
    app, _, users = make_test_environment()

    # Employee forbidden
    app.dependency_overrides[get_current_user] = lambda: users["employee"]
    client = TestClient(app)
    resp_emp = client.get("/api/dashboard/guard")
    assert resp_emp.status_code == status.HTTP_403_FORBIDDEN

    # Host forbidden
    app.dependency_overrides[get_current_user] = lambda: users["host"]
    resp_host = client.get("/api/dashboard/guard")
    assert resp_host.status_code == status.HTTP_403_FORBIDDEN


def test_guard_dashboard_empty_state():
    app, _, users = make_test_environment()
    app.dependency_overrides[get_current_user] = lambda: users["guard"]
    client = TestClient(app)

    response = client.get("/api/dashboard/guard")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()

    assert data["kpis"]["expectedInbound"]["total"] == 0
    assert data["kpis"]["expectedOutbound"]["total"] == 0
    assert data["kpis"]["pendingVerification"]["total"] == 0
    assert data["kpis"]["todaysCompletedEntries"]["total"] == 0
    assert data["verificationQueue"] == []
    assert data["recentActivity"] == []
    assert data["upcomingMovements"] == []
    assert data["checkpointAlerts"] == []


def test_guard_dashboard_kpis_and_queue():
    app, session_factory, users = make_test_environment()
    now_utc = datetime.now(timezone.utc)
    today_ist = now_utc.astimezone(IST).date()

    with session_factory() as db:
        # Create an Asset
        asset = Asset(
            id=1,
            asset_id="AST-101",
            name="Cisco Catalyst Switch",
            status=AssetStatus.active,
            category="Network",
            serial_number="SN-CISCO-9901",
            location="HQ Server Room",
            custodian="IT Dept",
            purchase_date=datetime(2025, 1, 1),
            vendor_name="Cisco Inc",
            total_cost="5000",
            warranty_period="3 years",
            qr_code_value="AMX-AST-101",
            qr_code_data_url="data:image/png;base64,mock",
        )
        db.add(asset)

        # 1. Approved pass awaiting exit -> Expected Outbound + Pending Verification
        # Uses exact authoritative asset_id "AST-101"
        gp_approved = GatePass(
            id=1,
            pass_id="GP-2026-001",
            pass_type=GatePassType.asset_movement,
            request_date=today_ist,
            movement_date=today_ist,
            status=GatePassStatus.approved,
            requester_name="Alice Smith",
            department="Operations",
            asset_or_item="AST-101",
            quantity=1,
            destination="Branch Office",
            purpose="Hardware deployment",
            authorization_state="Approved by Admin",
        )

        # 2. Active Returnable pass awaiting entry -> Expected Inbound + Pending Verification
        # Has exited (exit_timestamp set), has NOT yet entered (entry_timestamp None)
        gp_active_ret = GatePass(
            id=2,
            pass_id="GP-2026-002",
            pass_type=GatePassType.returnable,
            request_date=today_ist - timedelta(days=2),
            movement_date=today_ist,
            status=GatePassStatus.active,
            requester_name="Bob Jones",
            department="Engineering",
            asset_or_item="Generic Multimeter Kit",
            quantity=1,
            destination="External Lab",
            purpose="Field testing",
            authorization_state="Active in Transit",
            exit_status="Verified",
            exit_timestamp=now_utc - timedelta(hours=5),
            exit_officer="Guard Officer John",
            exit_gate="Gate-01A",
        )

        # 3. Completed pass cleared today in IST -> Today's Completed Entries
        # Strictly has entry_status == "Verified" and entry_timestamp today
        gp_completed_today = GatePass(
            id=3,
            pass_id="GP-2026-003",
            pass_type=GatePassType.returnable,
            request_date=today_ist - timedelta(days=1),
            movement_date=today_ist - timedelta(days=1),
            status=GatePassStatus.completed,
            requester_name="Charlie Brown",
            department="IT",
            asset_or_item="Dell Laptop",
            quantity=1,
            destination="Client Site",
            purpose="Client demo",
            authorization_state="Completed",
            exit_status="Verified",
            exit_timestamp=now_utc - timedelta(hours=8),
            entry_status="Verified",
            entry_timestamp=now_utc - timedelta(hours=1),
            entry_officer="Guard Officer John",
            entry_gate="Gate-01A",
        )

        # 4. Escalated pass -> Checkpoint Alert + In Queue as Flagged
        # Excluded from Pending Verification KPI because it requires administrative exception handling
        gp_escalated = GatePass(
            id=4,
            pass_id="GP-2026-004",
            pass_type=GatePassType.non_returnable,
            request_date=today_ist,
            movement_date=today_ist,
            status=GatePassStatus.escalated,
            requester_name="Diana Prince",
            department="Security",
            asset_or_item="Surveillance Camera",
            quantity=1,
            destination="Scrap Depot",
            purpose="Decommission",
            authorization_state="Escalated",
            escalation_is_escalated=True,
            escalation_reason="Serial tag unreadable on physical inspection",
            escalation_timestamp=now_utc - timedelta(minutes=30),
            escalation_escalated_by="Guard Officer John",
        )

        # Gate pass history for recent activity
        h1 = GatePassHistory(
            id=1,
            history_id="GPH-001",
            pass_id="GP-2026-002",
            timestamp=now_utc - timedelta(hours=5),
            action="Exit Verification",
            performed_by="Guard Officer John",
            note="Exit barrier cleared [QR Validated]",
            status_snapshot="Active",
        )
        h2 = GatePassHistory(
            id=2,
            history_id="GPH-002",
            pass_id="GP-2026-003",
            timestamp=now_utc - timedelta(hours=1),
            action="Entry Verification",
            performed_by="Guard Officer John",
            note="Entry barrier cleared [QR Validated]",
            status_snapshot="Completed",
        )
        h3 = GatePassHistory(
            id=3,
            history_id="GPH-003",
            pass_id="GP-2026-004",
            timestamp=now_utc - timedelta(minutes=30),
            action="Escalated",
            performed_by="Guard Officer John",
            note="Discrepancy flagged",
            status_snapshot="Escalated",
        )

        db.add_all([gp_approved, gp_active_ret, gp_completed_today, gp_escalated, h1, h2, h3])
        db.commit()

    # Test as Guard
    app.dependency_overrides[get_current_user] = lambda: users["guard"]
    client = TestClient(app)
    response = client.get("/api/dashboard/guard")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()

    kpis = data["kpis"]
    # 1. Expected Inbound: exactly 1 (gp_active_ret: returnable, active, exited, not yet entered)
    assert kpis["expectedInbound"]["total"] == 1
    # 2. Expected Outbound: exactly 1 (gp_approved: approved, not yet exited)
    assert kpis["expectedOutbound"]["total"] == 1
    # 3. Pending Verification: exactly 2 (gp_approved awaiting exit + gp_active_ret awaiting entry)
    # gp_escalated is strictly EXCLUDED because it requires administrative action, not guard verification
    assert kpis["pendingVerification"]["total"] == 2
    # 4. Completed entries today: exactly 1 (gp_completed_today has entry_status == "Verified" today)
    # gp_active_ret has exit_timestamp today, but is NOT an entry, so it is NOT counted in completed entries!
    assert kpis["todaysCompletedEntries"]["total"] == 1

    # Verification Queue checks
    queue = data["verificationQueue"]
    queue_ids = [item["id"] for item in queue]
    assert "GP-2026-001" in queue_ids
    assert "GP-2026-002" in queue_ids
    assert "GP-2026-004" in queue_ids

    # Unambiguous exact match resolution check
    cisco_item = next(item for item in queue if item["id"] == "GP-2026-001")
    assert cisco_item["serialNumber"] == "SN-CISCO-9901"
    assert cisco_item["status"] == "Awaiting Exit"
    assert cisco_item["action"] == "verify"

    # Non-matching item returns "Unavailable", NOT an arbitrary asset serial number
    multimeter_item = next(item for item in queue if item["id"] == "GP-2026-002")
    assert multimeter_item["serialNumber"] == "Unavailable"
    assert multimeter_item["status"] == "Awaiting Entry"
    assert multimeter_item["action"] == "verify"

    # Flagged item check
    flagged_item = next(item for item in queue if item["id"] == "GP-2026-004")
    assert flagged_item["status"] == "Flagged"
    assert flagged_item["action"] == "flagged"
    assert flagged_item["flagReason"] == "Serial tag unreadable on physical inspection"

    # Recent Activity
    act = data["recentActivity"]
    assert len(act) >= 3
    act_titles = [a["title"] for a in act]
    assert "Record Exit / Cleared" in act_titles
    assert "Record Entry / Cleared" in act_titles
    assert "Discrepancy Flagged" in act_titles

    # Upcoming Movements: scheduled for today and not completed
    upcoming = data["upcomingMovements"]
    upcoming_ids = [m["id"] for m in upcoming]
    assert "GP-2026-001" in upcoming_ids
    assert "GP-2026-002" in upcoming_ids
    # Completed pass gp_completed_today is EXCLUDED from upcoming movements
    assert "GP-2026-003" not in upcoming_ids
    for mov in upcoming:
        assert mov["time"] == "Today"

    # Checkpoint Alerts
    alerts = data["checkpointAlerts"]
    assert len(alerts) == 1
    assert alerts[0]["passId"] == "GP-2026-004"
    assert alerts[0]["badgeText"] == "Unresolved"
    assert "Serial tag unreadable" in alerts[0]["description"]

    # Test as Admin (also authorized)
    app.dependency_overrides[get_current_user] = lambda: users["admin"]
    resp_admin = client.get("/api/dashboard/guard")
    assert resp_admin.status_code == status.HTTP_200_OK
