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
    AuditLog,
    GatePass,
    GatePassHistory,
    GatePassStatus,
    GatePassType,
    User,
    UserRole,
)
from app.routers.gate_passes import router as gate_passes_router


def make_test_environment():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    session_factory = sessionmaker(bind=engine, expire_on_commit=False)
    Base.metadata.create_all(engine)

    app = FastAPI()
    app.include_router(gate_passes_router)

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
        full_name="Employee Jane",
        email="jane@assetmx.local",
        employee_id="EMP001",
        role=UserRole.employee,
        password_hash="x",
        is_active=True,
    )
    host_user = User(
        id=4,
        full_name="Host User Bob",
        email="host@assetmx.local",
        employee_id="HST001",
        role=UserRole.host,
        password_hash="x",
        is_active=True,
    )

    with session_factory() as db:
        db.add_all([guard_user, admin_user, employee_user, host_user])
        db.commit()

    return app, session_factory, guard_user, admin_user, employee_user, host_user


def test_escalation_register_authorization():
    app, _, guard_user, admin_user, employee_user, host_user = make_test_environment()

    # 1. Unauthenticated -> 401
    client_unauth = TestClient(app)
    resp = client_unauth.get("/api/gate-passes/escalation-register")
    assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    # 2. Guard -> 200
    app.dependency_overrides[get_current_user] = lambda: guard_user
    client_guard = TestClient(app)
    resp = client_guard.get("/api/gate-passes/escalation-register")
    assert resp.status_code == status.HTTP_200_OK

    # 3. Admin -> 200
    app.dependency_overrides[get_current_user] = lambda: admin_user
    client_admin = TestClient(app)
    resp = client_admin.get("/api/gate-passes/escalation-register")
    assert resp.status_code == status.HTTP_200_OK

    # 4. Employee -> 403
    app.dependency_overrides[get_current_user] = lambda: employee_user
    client_emp = TestClient(app)
    resp = client_emp.get("/api/gate-passes/escalation-register")
    assert resp.status_code == status.HTTP_403_FORBIDDEN

    # 5. Host -> 403
    app.dependency_overrides[get_current_user] = lambda: host_user
    client_host = TestClient(app)
    resp = client_host.get("/api/gate-passes/escalation-register")
    assert resp.status_code == status.HTTP_403_FORBIDDEN


def test_escalation_register_active_vs_cleared_kpis_and_no_double_counting():
    app, session_factory, guard_user, admin_user, _, _ = make_test_environment()
    app.dependency_overrides[get_current_user] = lambda: guard_user
    client = TestClient(app)

    now_utc = datetime.now(timezone.utc)

    with session_factory() as db:
        # Pass 1: Currently active escalation hold
        gp1 = GatePass(
            pass_id="GP-2026-ACTIVE-01",
            pass_type=GatePassType.asset_movement,
            request_date=(now_utc - timedelta(days=2)).date(),
            status=GatePassStatus.escalated,
            requester_name="Elena Rostova",
            department="Hardware Engineering",
            asset_or_item="Cisco Catalyst 9300",
            quantity=1,
            destination="Regional Datacenter",
            purpose="Urgent replacement",
            escalation_is_escalated=True,
            escalation_reason="Serial mismatch detected on outward scan",
            escalation_timestamp=now_utc - timedelta(days=2),
            escalation_action_required="Physical inspection by admin",
            escalation_escalated_by="Guard Officer John",
            exit_gate="Gate-01A Main Gate",
        )
        h1 = GatePassHistory(
            history_id="GPH-001",
            pass_id=gp1.pass_id,
            timestamp=now_utc - timedelta(days=2),
            action="Escalated",
            performed_by="Guard Officer John",
            note="Serial mismatch detected on outward scan",
            status_snapshot="Escalated",
        )

        # Pass 2: Previously escalated, then Cleared by Administrative Override
        gp2 = GatePass(
            pass_id="GP-2026-CLEARED-02",
            pass_type=GatePassType.returnable,
            request_date=(now_utc - timedelta(days=3)).date(),
            status=GatePassStatus.completed,  # Progressed through lifecycle after override
            requester_name="Viktor Chen",
            department="Datacenter Ops",
            asset_or_item="Fiber Test Kit",
            quantity=1,
            destination="Field Site B",
            purpose="Field diagnostic",
            escalation_is_escalated=True,
            escalation_reason="Tamper seal missing on transport box",
            escalation_timestamp=now_utc - timedelta(days=3),
            escalation_action_required="Supervisor sign-off",
            escalation_escalated_by="Guard Officer John",
            exit_gate="Gate-01A Main Gate",
        )
        h2_1 = GatePassHistory(
            history_id="GPH-002-1",
            pass_id=gp2.pass_id,
            timestamp=now_utc - timedelta(days=3),
            action="Escalated",
            performed_by="Guard Officer John",
            note="Tamper seal missing on transport box",
            status_snapshot="Escalated",
        )
        h2_2 = GatePassHistory(
            history_id="GPH-002-2",
            pass_id=gp2.pass_id,
            timestamp=now_utc - timedelta(days=2),
            action="Override Granted",
            performed_by="Admin Lead",
            note="Re-inspected and verified clean by Security Admin Lead",
            status_snapshot="Approved",
        )
        h2_3 = GatePassHistory(
            history_id="GPH-002-3",
            pass_id=gp2.pass_id,
            timestamp=now_utc - timedelta(days=1),
            action="Entry Verification",
            performed_by="Guard Officer John",
            note="Completed inbound return",
            status_snapshot="Completed",
        )

        # Pass 3: Normal pass (never escalated) -> MUST NOT appear in register
        gp3 = GatePass(
            pass_id="GP-2026-NORMAL-03",
            pass_type=GatePassType.asset_movement,
            request_date=now_utc.date(),
            status=GatePassStatus.active,
            requester_name="Sarah Connor",
            department="Operations",
            asset_or_item="Standard Laptop",
            quantity=1,
            destination="HQ Office",
            purpose="Staff device",
        )

        db.add_all([gp1, gp2, gp3, h1, h2_1, h2_2, h2_3])
        db.commit()

    # Query escalation register
    res = client.get("/api/gate-passes/escalation-register")
    assert res.status_code == status.HTTP_200_OK
    data = res.json()

    # Pass 3 must NOT be present
    assert data["total"] == 2
    assert len(data["items"]) == 2
    assert {item["passId"] for item in data["items"]} == {"GP-2026-ACTIVE-01", "GP-2026-CLEARED-02"}

    # KPI checks:
    # totalHolds = 2 (no double counting)
    # activeHolds = 1 (GP-2026-ACTIVE-01)
    # clearedOverridden = 1 (GP-2026-CLEARED-02)
    kpis = data["kpis"]
    assert kpis["totalHolds"] == 2
    assert kpis["activeHolds"] == 1
    assert kpis["clearedOverridden"] == 1

    # Check Active hold item details
    active_item = next(i for i in data["items"] if i["passId"] == "GP-2026-ACTIVE-01")
    assert active_item["holdStatus"] == "Active"
    assert active_item["holdStatusTitle"] == "Active Escalation Hold"
    assert active_item["escalationReason"] == "Serial mismatch detected on outward scan"
    assert active_item["escalatedBy"] == "Guard Officer John"
    assert active_item["overrideBy"] is None
    assert len(active_item["timeline"]) == 1
    assert active_item["timeline"][0]["event"] == "Escalated"

    # Check Cleared by Override item details
    cleared_item = next(i for i in data["items"] if i["passId"] == "GP-2026-CLEARED-02")
    assert cleared_item["holdStatus"] == "Cleared"
    assert cleared_item["holdStatusTitle"] == "Cleared by Administrative Override"
    assert cleared_item["overrideBy"] == "Admin Lead"
    assert cleared_item["overrideNote"] == "Re-inspected and verified clean by Security Admin Lead"
    assert len(cleared_item["timeline"]) == 3

    # Filter status=Active
    res_active = client.get("/api/gate-passes/escalation-register?status=Active")
    assert res_active.status_code == status.HTTP_200_OK
    d_active = res_active.json()
    assert d_active["total"] == 1
    assert d_active["items"][0]["passId"] == "GP-2026-ACTIVE-01"

    # Filter status=Cleared
    res_cleared = client.get("/api/gate-passes/escalation-register?status=Cleared")
    assert res_cleared.status_code == status.HTTP_200_OK
    d_cleared = res_cleared.json()
    assert d_cleared["total"] == 1
    assert d_cleared["items"][0]["passId"] == "GP-2026-CLEARED-02"


def test_escalation_workflow_and_eligibility_enforcement():
    app, session_factory, guard_user, admin_user, _, _ = make_test_environment()
    app.dependency_overrides[get_current_user] = lambda: guard_user
    client = TestClient(app)

    now_utc = datetime.now(timezone.utc)

    with session_factory() as db:
        # Eligible pass (Approved)
        gp_approved = GatePass(
            pass_id="GP-2026-ELIGIBLE-10",
            pass_type=GatePassType.asset_movement,
            request_date=now_utc.date(),
            status=GatePassStatus.approved,
            requester_name="Dave Miller",
            department="IT",
            asset_or_item="Server Blade",
            quantity=1,
            destination="Offsite Lab",
            purpose="Testing",
        )
        # Ineligible pass (Already Completed)
        gp_completed = GatePass(
            pass_id="GP-2026-COMPLETED-20",
            pass_type=GatePassType.asset_movement,
            request_date=now_utc.date(),
            status=GatePassStatus.completed,
            requester_name="Jane Doe",
            department="HR",
            asset_or_item="Laptop",
            quantity=1,
            destination="Branch A",
            purpose="Transfer",
        )
        db.add_all([gp_approved, gp_completed])
        db.commit()

    # 1. Attempt escalating non-existent pass -> 404
    res_404 = client.post(
        "/api/gate-passes/GP-NON-EXISTENT-999/escalate",
        json={"reason": "Test", "action_required": "Inspection"},
    )
    assert res_404.status_code == status.HTTP_404_NOT_FOUND

    # 2. Attempt escalating completed pass -> 409 Conflict
    res_409 = client.post(
        "/api/gate-passes/GP-2026-COMPLETED-20/escalate",
        json={"reason": "Discrepancy observed", "action_required": "Review"},
    )
    assert res_409.status_code == status.HTTP_409_CONFLICT

    # 3. Escalate eligible approved pass -> 200 OK
    res_ok = client.post(
        "/api/gate-passes/GP-2026-ELIGIBLE-10/escalate",
        json={
            "reason": "Cryptohash QR mismatch detected on outward transit lane",
            "action_required": "Supervisory verification required",
        },
    )
    assert res_ok.status_code == status.HTTP_200_OK
    assert res_ok.json()["status"] == "Escalated"
    assert res_ok.json()["escalation_is_escalated"] is True

    # Verify pass now appears in the escalation register as Active Hold
    res_reg = client.get("/api/gate-passes/escalation-register?search=GP-2026-ELIGIBLE-10")
    assert res_reg.status_code == status.HTTP_200_OK
    reg_data = res_reg.json()
    assert reg_data["total"] == 1
    item = reg_data["items"][0]
    assert item["passId"] == "GP-2026-ELIGIBLE-10"
    assert item["holdStatus"] == "Active"
    assert item["escalationReason"] == "Cryptohash QR mismatch detected on outward transit lane"
    assert item["actionRequired"] == "Supervisory verification required"

    # 4. Guard attempts to override/clear escalation -> 403 Forbidden (Guard cannot override)
    res_guard_override = client.post(
        "/api/gate-passes/GP-2026-ELIGIBLE-10/override",
        json={"note": "Guard trying to override"},
    )
    assert res_guard_override.status_code == status.HTTP_403_FORBIDDEN

    # 5. Admin overrides escalation -> 200 OK
    app.dependency_overrides[get_current_user] = lambda: admin_user
    client_admin = TestClient(app)
    res_admin_override = client_admin.post(
        "/api/gate-passes/GP-2026-ELIGIBLE-10/override",
        json={"note": "Admin inspected physical serial; cleared for departure."},
    )
    assert res_admin_override.status_code == status.HTTP_200_OK

    # Verify pass now transitions to Cleared by Override in the register
    res_reg_updated = client_admin.get("/api/gate-passes/escalation-register?search=GP-2026-ELIGIBLE-10")
    assert res_reg_updated.status_code == status.HTTP_200_OK
    upd_item = res_reg_updated.json()["items"][0]
    assert upd_item["holdStatus"] == "Cleared"
    assert upd_item["overrideBy"] == "Admin Lead"
    assert upd_item["overrideNote"] == "Admin inspected physical serial; cleared for departure."


def test_escalation_register_data_integrity_and_override_semantics():
    """Verify strictly grounded data semantics for Total Holds and Cleared/Overridden:
    - Pass with Escalated history event is counted in Total Checkpoint Holds.
    - Pass with only Decision Updated is NOT counted as Cleared & Overridden.
    - Pass with Override Granted is counted exactly once.
    - Multiple escalation or override history records for one pass do not inflate unique-pass KPIs.
    - Pass whose current status is Escalated but has no escalation history is NOT counted as a historically recorded checkpoint hold.
    """
    app, session_factory, guard_user, admin_user, _, _ = make_test_environment()
    app.dependency_overrides[get_current_user] = lambda: guard_user
    client = TestClient(app)

    now_utc = datetime.now(timezone.utc)

    with session_factory() as db:
        # 1. Pass with an Escalated history event -> counted in Total Checkpoint Holds
        gp_esc = GatePass(
            pass_id="GP-HIST-ESC-01",
            pass_type=GatePassType.asset_movement,
            request_date=now_utc.date(),
            status=GatePassStatus.escalated,
            requester_name="Officer Alice",
            department="Security",
            asset_or_item="Firewall Appliance",
            quantity=1,
            destination="Facility North",
            purpose="Maintenance",
        )
        h_esc = GatePassHistory(
            history_id="GPH-ESC-01",
            pass_id="GP-HIST-ESC-01",
            timestamp=now_utc - timedelta(hours=5),
            action="Escalated",
            performed_by="Guard Officer John",
            note="Physical tamper detected",
            status_snapshot="Escalated",
        )

        # 2. Pass with an Escalated history event AND only Decision Updated -> NOT counted as Cleared & Overridden
        gp_dec = GatePass(
            pass_id="GP-HIST-DEC-02",
            pass_type=GatePassType.asset_movement,
            request_date=now_utc.date(),
            status=GatePassStatus.approved,
            requester_name="Officer Bob",
            department="Operations",
            asset_or_item="Core Router",
            quantity=1,
            destination="Facility South",
            purpose="Deployment",
        )
        h_dec_1 = GatePassHistory(
            history_id="GPH-DEC-01",
            pass_id="GP-HIST-DEC-02",
            timestamp=now_utc - timedelta(hours=4),
            action="Escalated",
            performed_by="Guard Officer John",
            note="Missing paperwork",
            status_snapshot="Escalated",
        )
        h_dec_2 = GatePassHistory(
            history_id="GPH-DEC-02",
            pass_id="GP-HIST-DEC-02",
            timestamp=now_utc - timedelta(hours=3),
            action="Decision Updated",
            performed_by="Admin Lead",
            note="Administrative decision updated without gate override",
            status_snapshot="Approved",
        )

        # 3. Pass with Override Granted -> counted as Cleared & Overridden exactly once
        gp_ov = GatePass(
            pass_id="GP-HIST-OV-03",
            pass_type=GatePassType.returnable,
            request_date=now_utc.date(),
            status=GatePassStatus.approved,
            requester_name="Officer Charlie",
            department="IT",
            asset_or_item="Storage SAN",
            quantity=1,
            destination="External Lab",
            purpose="Testing",
        )
        h_ov_1 = GatePassHistory(
            history_id="GPH-OV-01",
            pass_id="GP-HIST-OV-03",
            timestamp=now_utc - timedelta(hours=4),
            action="Escalated",
            performed_by="Guard Officer John",
            note="Barcode unreadable",
            status_snapshot="Escalated",
        )
        h_ov_2 = GatePassHistory(
            history_id="GPH-OV-02",
            pass_id="GP-HIST-OV-03",
            timestamp=now_utc - timedelta(hours=2),
            action="Override Granted",
            performed_by="Admin Lead",
            note="Confirmed serial manually and approved release",
            status_snapshot="Approved",
        )

        # 4. Pass with multiple escalation and multiple override history records -> counted exactly once in KPIs
        gp_multi = GatePass(
            pass_id="GP-HIST-MULTI-04",
            pass_type=GatePassType.asset_movement,
            request_date=now_utc.date(),
            status=GatePassStatus.approved,
            requester_name="Officer Dave",
            department="Network",
            asset_or_item="Access Point Bundle",
            quantity=3,
            destination="Branch C",
            purpose="Upgrade",
        )
        h_m1 = GatePassHistory(
            history_id="GPH-M-01",
            pass_id="GP-HIST-MULTI-04",
            timestamp=now_utc - timedelta(hours=6),
            action="Escalated",
            performed_by="Guard Officer John",
            note="Escalation 1",
            status_snapshot="Escalated",
        )
        h_m2 = GatePassHistory(
            history_id="GPH-M-02",
            pass_id="GP-HIST-MULTI-04",
            timestamp=now_utc - timedelta(hours=5),
            action="Escalated",
            performed_by="Guard Officer John",
            note="Escalation 2 (duplicate or re-escalation)",
            status_snapshot="Escalated",
        )
        h_m3 = GatePassHistory(
            history_id="GPH-M-03",
            pass_id="GP-HIST-MULTI-04",
            timestamp=now_utc - timedelta(hours=4),
            action="Override Granted",
            performed_by="Admin Lead",
            note="Override 1",
            status_snapshot="Approved",
        )
        h_m4 = GatePassHistory(
            history_id="GPH-M-04",
            pass_id="GP-HIST-MULTI-04",
            timestamp=now_utc - timedelta(hours=3),
            action="Override Granted",
            performed_by="Admin Lead",
            note="Override 2 (supplementary override)",
            status_snapshot="Approved",
        )

        # 5. Pass whose current status is Escalated, but has NO escalation history record -> MUST NOT be counted
        gp_no_hist = GatePass(
            pass_id="GP-NO-HIST-ESC-05",
            pass_type=GatePassType.asset_movement,
            request_date=now_utc.date(),
            status=GatePassStatus.escalated,
            escalation_is_escalated=True,
            escalation_reason="Database state set without gate pass history",
            requester_name="Officer Eve",
            department="Security",
            asset_or_item="Backup Tape Drive",
            quantity=1,
            destination="Offsite Vault",
            purpose="Archival",
        )
        # Only has standard creation history, NO escalation action
        h_nh1 = GatePassHistory(
            history_id="GPH-NH-01",
            pass_id="GP-NO-HIST-ESC-05",
            timestamp=now_utc - timedelta(hours=10),
            action="Gate Pass Created",
            performed_by="Officer Eve",
            note="Initial request",
            status_snapshot="Pending",
        )

        db.add_all([
            gp_esc, h_esc,
            gp_dec, h_dec_1, h_dec_2,
            gp_ov, h_ov_1, h_ov_2,
            gp_multi, h_m1, h_m2, h_m3, h_m4,
            gp_no_hist, h_nh1,
        ])
        db.commit()

    # Query all escalation register records
    resp = client.get("/api/gate-passes/escalation-register")
    assert resp.status_code == status.HTTP_200_OK
    data = resp.json()

    # Pass 5 (GP-NO-HIST-ESC-05) MUST NOT be present because it lacks an escalation history event
    pass_ids = {item["passId"] for item in data["items"]}
    assert "GP-NO-HIST-ESC-05" not in pass_ids
    assert "GP-HIST-ESC-01" in pass_ids
    assert "GP-HIST-DEC-02" in pass_ids
    assert "GP-HIST-OV-03" in pass_ids
    assert "GP-HIST-MULTI-04" in pass_ids
    assert data["total"] == 4

    # KPI Verifications:
    # 1. Total Checkpoint Holds = 4 unique passes (GP-HIST-ESC-01, GP-HIST-DEC-02, GP-HIST-OV-03, GP-HIST-MULTI-04)
    #    Multiple history rows for GP-HIST-MULTI-04 must NOT inflate totalHolds
    #    GP-NO-HIST-ESC-05 must NOT be counted
    assert data["kpis"]["totalHolds"] == 4

    # 2. Active Escalation Holds = 1 (GP-HIST-ESC-01 is the only one in status Escalated)
    #    GP-NO-HIST-ESC-05 has status Escalated, but because it has no escalation history event, it is not in activeHolds
    assert data["kpis"]["activeHolds"] == 1

    # 3. Cleared & Overridden = 2 (GP-HIST-OV-03 and GP-HIST-MULTI-04)
    #    GP-HIST-DEC-02 only has "Decision Updated", so it must NOT be counted as Cleared & Overridden
    #    GP-HIST-MULTI-04 has 2 "Override Granted" history events, but must only be counted ONCE
    assert data["kpis"]["clearedOverridden"] == 2

    # Verify item details for Decision Updated pass: NOT an administrative override
    item_dec = next(i for i in data["items"] if i["passId"] == "GP-HIST-DEC-02")
    assert item_dec["overrideBy"] is None
    assert item_dec["overrideNote"] is None
    assert item_dec["holdStatusTitle"] != "Cleared by Administrative Override"

    # Verify item details for Override Granted pass: authentic override
    item_ov = next(i for i in data["items"] if i["passId"] == "GP-HIST-OV-03")
    assert item_ov["overrideBy"] == "Admin Lead"
    assert item_ov["overrideNote"] == "Confirmed serial manually and approved release"
    assert item_ov["holdStatus"] == "Cleared"
    assert item_ov["holdStatusTitle"] == "Cleared by Administrative Override"

    # Search specifically for the pass with no escalation history to confirm 0 results
    resp_unrecorded = client.get("/api/gate-passes/escalation-register?search=GP-NO-HIST-ESC-05")
    assert resp_unrecorded.status_code == status.HTTP_200_OK
    assert resp_unrecorded.json()["total"] == 0
    assert resp_unrecorded.json()["kpis"]["totalHolds"] == 0
    assert resp_unrecorded.json()["kpis"]["activeHolds"] == 0
