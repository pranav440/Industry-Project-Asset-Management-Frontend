from datetime import date, datetime, time, timedelta, timezone

import pytest
from fastapi import FastAPI, status
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.deps import get_current_user
from app.models import (
    Asset,
    AssetMovement,
    AssetMovementStatus,
    AssetStatus,
    AuditLog,
    GatePass,
    GatePassHistory,
    GatePassStatus,
    GatePassType,
    User,
    UserRole,
)
from app.routers.dashboard import IST, router as dashboard_router
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
    app.include_router(dashboard_router)
    app.include_router(gate_passes_router)

    def db_override():
        with session_factory() as db:
            yield db

    app.dependency_overrides[get_db] = db_override

    # Create users for all relevant roles
    host_user = User(
        id=1,
        full_name="Sarah Jenkins",
        email="host@assetmx.local",
        employee_id="HST001",
        role=UserRole.host,
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
    superadmin_user = User(
        id=3,
        full_name="SuperAdmin Master",
        email="superadmin@assetmx.local",
        employee_id="SAD001",
        role=UserRole.superadmin,
        password_hash="x",
        is_active=True,
    )
    guard_user = User(
        id=4,
        full_name="Checkpoint Guard",
        email="guard@assetmx.local",
        employee_id="GRD001",
        role=UserRole.guard,
        password_hash="x",
        is_active=True,
    )
    employee_user = User(
        id=5,
        full_name="Elena Rostova",
        email="employee@assetmx.local",
        employee_id="EMP001",
        role=UserRole.employee,
        password_hash="x",
        is_active=True,
    )

    with session_factory() as db:
        db.add_all([host_user, admin_user, superadmin_user, guard_user, employee_user])
        db.commit()

    return app, session_factory, {
        "host": host_user,
        "admin": admin_user,
        "superadmin": superadmin_user,
        "guard": guard_user,
        "employee": employee_user,
    }


# ==============================================================================
# Host Permissions & Gate Pass Operations Tests
# ==============================================================================


def test_host_can_create_gate_pass_request():
    """Host can raise returnable and non-returnable gate-pass requests (GP-01)."""
    app, session_factory, users = make_test_environment()
    app.dependency_overrides[get_current_user] = lambda: users["host"]
    client = TestClient(app)

    payload = {
        "pass_type": "Returnable",
        "asset_or_item": "Oscilloscope Probe Kit",
        "quantity": 2,
        "destination": "Calibration Lab B",
        "movement_date": date.today().isoformat(),
        "purpose": "Sensor diagnostic calibration",
        "department": "Engineering Ops",
    }

    res = client.post("/api/gate-passes", json=payload)
    assert res.status_code == status.HTTP_201_CREATED, res.text
    data = res.json()
    assert data["status"] == "Pending"
    assert data["requester_name"] == users["host"].full_name
    assert data["pass_type"] == "Returnable"
    assert data["asset_or_item"] == "Oscilloscope Probe Kit"
    assert data["quantity"] == 2

    # Verify audit log and gate pass history recorded
    with session_factory() as db:
        gp = db.scalar(select(GatePass).where(GatePass.pass_id == data["pass_id"]))
        assert gp is not None
        assert gp.requester_name == users["host"].full_name

        audit = db.scalar(
            select(AuditLog).where(
                AuditLog.gate_pass_id == gp.id,
                AuditLog.action == "gate_pass_created",
            )
        )
        assert audit is not None
        assert audit.actor_user_id == users["host"].id

        hist = db.scalars(select(GatePassHistory).where(GatePassHistory.pass_id == gp.pass_id)).all()
        assert len(hist) == 1
        assert hist[0].action == "Gate Pass Created"
        assert hist[0].performed_by == users["host"].full_name


def test_host_cannot_approve_or_reject_gate_pass_request():
    """Host role must not be granted approval or rejection permissions (GP-02)."""
    app, session_factory, users = make_test_environment()
    today = date.today()

    with session_factory() as db:
        gp = GatePass(
            pass_id="GP-DEC-001",
            pass_type=GatePassType.asset_movement,
            request_date=today,
            status=GatePassStatus.pending,
            requester_name=users["host"].full_name,
            department="Operations",
            asset_or_item="Item X",
            quantity=1,
            destination="Depot",
            purpose="Transit",
        )
        db.add(gp)
        db.commit()

    app.dependency_overrides[get_current_user] = lambda: users["host"]
    client = TestClient(app)

    # Host attempts Approve -> 403 Forbidden
    res_appr = client.post(
        "/api/gate-passes/GP-DEC-001/decision",
        json={"target_status": "Approved", "note": "Host self-approval attempt"},
    )
    assert res_appr.status_code == status.HTTP_403_FORBIDDEN

    # Host attempts Reject -> 403 Forbidden
    res_rej = client.post(
        "/api/gate-passes/GP-DEC-001/decision",
        json={"target_status": "Rejected", "note": "Host reject attempt"},
    )
    assert res_rej.status_code == status.HTTP_403_FORBIDDEN


def test_host_cannot_override_gate_pass():
    """Host cannot perform administrative overrides."""
    app, session_factory, users = make_test_environment()
    today = date.today()

    with session_factory() as db:
        db.add(
            GatePass(
                pass_id="GP-OVR-001",
                pass_type=GatePassType.asset_movement,
                request_date=today,
                status=GatePassStatus.pending,
                requester_name=users["host"].full_name,
                department="Operations",
                asset_or_item="Item Y",
                quantity=1,
                destination="Depot",
                purpose="Transit",
            )
        )
        db.commit()

    app.dependency_overrides[get_current_user] = lambda: users["host"]
    client = TestClient(app)

    res = client.post(
        "/api/gate-passes/GP-OVR-001/override",
        json={"note": "Host override attempt"},
    )
    assert res.status_code == status.HTTP_403_FORBIDDEN


def test_host_cannot_perform_exit_entry_or_manual_escalate():
    """Host must not perform exit verification, entry verification, or manual escalation."""
    app, session_factory, users = make_test_environment()
    today = date.today()

    with session_factory() as db:
        # Pass 1: Approved -> ready for exit verification
        db.add(
            GatePass(
                pass_id="GP-HOST-V01",
                pass_type=GatePassType.returnable,
                request_date=today,
                status=GatePassStatus.approved,
                requester_name=users["host"].full_name,
                department="Operations",
                asset_or_item="Device 1",
                quantity=1,
                destination="Site B",
                purpose="Testing",
            )
        )
        # Pass 2: Active returnable -> ready for entry verification
        db.add(
            GatePass(
                pass_id="GP-HOST-V02",
                pass_type=GatePassType.returnable,
                request_date=today,
                status=GatePassStatus.active,
                requester_name=users["host"].full_name,
                department="Operations",
                asset_or_item="Device 2",
                quantity=1,
                destination="Site B",
                purpose="Testing",
                exit_status="Verified",
                exit_officer=users["guard"].full_name,
            )
        )
        # Pass 3: Approved -> ready for escalation
        db.add(
            GatePass(
                pass_id="GP-HOST-V03",
                pass_type=GatePassType.asset_movement,
                request_date=today,
                status=GatePassStatus.approved,
                requester_name=users["host"].full_name,
                department="Operations",
                asset_or_item="Device 3",
                quantity=1,
                destination="Site B",
                purpose="Testing",
            )
        )
        db.commit()

    app.dependency_overrides[get_current_user] = lambda: users["host"]
    client = TestClient(app)

    # 1. Host exit verification -> 403 Forbidden
    res_exit = client.post(
        "/api/gate-passes/GP-HOST-V01/exit-verification",
        json={"exit_gate": "Gate 1", "exit_notes": "Host verification attempt"},
    )
    assert res_exit.status_code == status.HTTP_403_FORBIDDEN

    # 2. Host entry verification -> 403 Forbidden
    res_entry = client.post(
        "/api/gate-passes/GP-HOST-V02/entry-verification",
        json={"entry_gate": "Gate 1", "entry_notes": "Host verification attempt"},
    )
    assert res_entry.status_code == status.HTTP_403_FORBIDDEN

    # 3. Host manual escalation -> 403 Forbidden
    res_esc = client.post(
        "/api/gate-passes/GP-HOST-V03/escalate",
        json={"reason": "Host manual escalation attempt", "action_required": "Review"},
    )
    assert res_esc.status_code == status.HTTP_403_FORBIDDEN


def test_host_scoped_gate_pass_access():
    """Host can only view and list gate passes they initiated; unrelated passes are restricted."""
    app, session_factory, users = make_test_environment()
    today = date.today()

    with session_factory() as db:
        # Pass 1: initiated by Host Sarah Jenkins
        gp1 = GatePass(
            pass_id="GP-OWN-001",
            pass_type=GatePassType.returnable,
            request_date=today,
            status=GatePassStatus.pending,
            requester_name=users["host"].full_name,
            department="Operations",
            asset_or_item="Server Blade",
            quantity=1,
            destination="Remote DC",
            purpose="Upgrade",
        )
        # Pass 2: initiated by Elena Rostova (unrelated)
        gp2 = GatePass(
            pass_id="GP-OTHER-002",
            pass_type=GatePassType.asset_movement,
            request_date=today,
            status=GatePassStatus.approved,
            requester_name="Elena Rostova",
            department="Engineering",
            asset_or_item="Testing Kit",
            quantity=1,
            destination="Field Unit",
            purpose="Testing",
        )
        db.add_all([gp1, gp2])
        db.commit()

    # 1. Host lists gate passes -> sees only own pass
    app.dependency_overrides[get_current_user] = lambda: users["host"]
    client = TestClient(app)

    res_list = client.get("/api/gate-passes")
    assert res_list.status_code == status.HTTP_200_OK
    data_list = res_list.json()
    assert data_list["total"] == 1
    assert data_list["items"][0]["pass_id"] == "GP-OWN-001"

    # 2. Host views own pass -> 200 OK
    res_own = client.get("/api/gate-passes/GP-OWN-001")
    assert res_own.status_code == status.HTTP_200_OK
    assert res_own.json()["pass_id"] == "GP-OWN-001"

    # 3. Host views unrelated user's pass -> 403 Forbidden
    res_other = client.get("/api/gate-passes/GP-OTHER-002")
    assert res_other.status_code == status.HTTP_403_FORBIDDEN
    assert "Not authorized" in res_other.json()["detail"]

    # 4. Guard can list and view all passes
    app.dependency_overrides[get_current_user] = lambda: users["guard"]
    res_guard_list = client.get("/api/gate-passes")
    assert res_guard_list.status_code == status.HTTP_200_OK
    assert res_guard_list.json()["total"] == 2

    res_guard_detail = client.get("/api/gate-passes/GP-OTHER-002")
    assert res_guard_detail.status_code == status.HTTP_200_OK

    # 5. Admin can list and view all passes
    app.dependency_overrides[get_current_user] = lambda: users["admin"]
    res_admin_list = client.get("/api/gate-passes")
    assert res_admin_list.status_code == status.HTTP_200_OK
    assert res_admin_list.json()["total"] == 2


# ==============================================================================
# Guard & Approver Responsibilities & Lifecycle Tests
# ==============================================================================


def test_guard_verification_issuance_and_escalation():
    """Guard retains verification and issuance responsibilities (GP-03, GP-04)."""
    app, session_factory, users = make_test_environment()
    today = date.today()

    with session_factory() as db:
        # Pass 1: Approved -> for exit verification
        gp1 = GatePass(
            pass_id="GP-GRD-001",
            pass_type=GatePassType.returnable,
            request_date=today,
            status=GatePassStatus.approved,
            requester_name="Elena",
            department="Engineering",
            asset_or_item="Laser Calibrator",
            quantity=1,
            destination="Lab B",
            purpose="Maintenance",
        )
        # Pass 2: Active returnable -> for entry verification
        gp2 = GatePass(
            pass_id="GP-GRD-002",
            pass_type=GatePassType.returnable,
            request_date=today,
            status=GatePassStatus.active,
            requester_name="Elena",
            department="Engineering",
            asset_or_item="Network Analyzer",
            quantity=1,
            destination="Site C",
            purpose="Testing",
            exit_status="Verified",
            exit_officer=users["guard"].full_name,
        )
        # Pass 3: Approved -> for manual escalation
        gp3 = GatePass(
            pass_id="GP-GRD-003",
            pass_type=GatePassType.asset_movement,
            request_date=today,
            status=GatePassStatus.approved,
            requester_name="Elena",
            department="Engineering",
            asset_or_item="Server Module",
            quantity=1,
            destination="Site D",
            purpose="Relocation",
        )
        db.add_all([gp1, gp2, gp3])
        db.commit()

    app.dependency_overrides[get_current_user] = lambda: users["guard"]
    client = TestClient(app)

    # 1. Guard exit verification
    res_exit = client.post(
        "/api/gate-passes/GP-GRD-001/exit-verification",
        json={"exit_gate": "Gate 1", "exit_notes": "Physical goods & seal verified by Guard"},
    )
    assert res_exit.status_code == status.HTTP_200_OK
    data_exit = res_exit.json()
    assert data_exit["status"] == "Active"
    assert data_exit["exit_status"] == "Verified"
    assert data_exit["exit_officer"] == users["guard"].full_name

    # 2. Guard entry verification
    res_entry = client.post(
        "/api/gate-passes/GP-GRD-002/entry-verification",
        json={"entry_gate": "Gate 1", "entry_notes": "Return intake verified by Guard"},
    )
    assert res_entry.status_code == status.HTTP_200_OK
    data_entry = res_entry.json()
    assert data_entry["status"] == "Completed"
    assert data_entry["entry_status"] == "Verified"
    assert data_entry["entry_officer"] == users["guard"].full_name

    # 3. Guard manual escalation
    res_esc = client.post(
        "/api/gate-passes/GP-GRD-003/escalate",
        json={"reason": "Packaging seal breached at perimeter", "action_required": "Security review"},
    )
    assert res_esc.status_code == status.HTTP_200_OK
    data_esc = res_esc.json()
    assert data_esc["status"] == "Escalated"
    assert data_esc["escalation_is_escalated"] is True
    assert data_esc["escalation_escalated_by"] == users["guard"].full_name


def test_entry_verification_rejects_non_returnable_pass():
    """Non-returnable gate pass entry verification must be rejected with 409 Conflict."""
    app, session_factory, users = make_test_environment()
    today = date.today()

    with session_factory() as db:
        gp = GatePass(
            pass_id="GP-NONRET-001",
            pass_type=GatePassType.non_returnable,
            request_date=today,
            status=GatePassStatus.active,
            requester_name="Elena",
            department="Operations",
            asset_or_item="Demo Hardware Unit",
            quantity=1,
            destination="Client Site",
            purpose="Permanent handover",
            exit_status="Verified",
            exit_officer=users["guard"].full_name,
        )
        db.add(gp)
        db.commit()

    app.dependency_overrides[get_current_user] = lambda: users["guard"]
    client = TestClient(app)

    res = client.post(
        "/api/gate-passes/GP-NONRET-001/entry-verification",
        json={"entry_gate": "Gate 1", "entry_notes": "Erroneous return attempt"},
    )
    assert res.status_code == status.HTTP_409_CONFLICT
    assert "cannot undergo entry verification" in res.json()["detail"]


def test_entry_verification_allows_returnable_pass():
    """Returnable gate pass entry verification completes successfully (GP-05)."""
    app, session_factory, users = make_test_environment()
    today = date.today()

    with session_factory() as db:
        gp = GatePass(
            pass_id="GP-RET-001",
            pass_type=GatePassType.returnable,
            request_date=today,
            status=GatePassStatus.active,
            requester_name="Elena",
            department="Operations",
            asset_or_item="Thermal Camera",
            quantity=1,
            destination="Field Unit",
            purpose="Diagnostics",
            exit_status="Verified",
            exit_officer=users["guard"].full_name,
        )
        db.add(gp)
        db.commit()

    app.dependency_overrides[get_current_user] = lambda: users["guard"]
    client = TestClient(app)

    res = client.post(
        "/api/gate-passes/GP-RET-001/entry-verification",
        json={"entry_gate": "Gate 1", "entry_notes": "Returned in good condition"},
    )
    assert res.status_code == status.HTTP_200_OK
    assert res.json()["status"] == "Completed"
    assert res.json()["entry_status"] == "Verified"


def test_invalid_verification_transitions_for_guard():
    """Guard invalid status transitions are rejected with 409 Conflict."""
    app, session_factory, users = make_test_environment()
    today = date.today()

    with session_factory() as db:
        # Pass 1: Pending (cannot exit verify)
        db.add(
            GatePass(
                pass_id="GP-TRANS-PND",
                pass_type=GatePassType.asset_movement,
                request_date=today,
                status=GatePassStatus.pending,
                requester_name="Elena",
                department="Eng",
                asset_or_item="Item",
                quantity=1,
                destination="Dest",
                purpose="Purpose",
            )
        )
        # Pass 2: Completed (cannot entry verify or escalate)
        db.add(
            GatePass(
                pass_id="GP-TRANS-CMP",
                pass_type=GatePassType.returnable,
                request_date=today,
                status=GatePassStatus.completed,
                requester_name="Elena",
                department="Eng",
                asset_or_item="Item",
                quantity=1,
                destination="Dest",
                purpose="Purpose",
                exit_status="Verified",
                entry_status="Verified",
            )
        )
        db.commit()

    app.dependency_overrides[get_current_user] = lambda: users["guard"]
    client = TestClient(app)

    # 1. Exit verification on Pending pass -> 409 Conflict
    res_exit = client.post(
        "/api/gate-passes/GP-TRANS-PND/exit-verification",
        json={"exit_gate": "Gate 1"},
    )
    assert res_exit.status_code == status.HTTP_409_CONFLICT

    # 2. Entry verification on Completed pass -> 409 Conflict
    res_entry = client.post(
        "/api/gate-passes/GP-TRANS-CMP/entry-verification",
        json={"entry_gate": "Gate 1"},
    )
    assert res_entry.status_code == status.HTTP_409_CONFLICT

    # 3. Escalation on Completed pass -> 409 Conflict
    res_esc = client.post(
        "/api/gate-passes/GP-TRANS-CMP/escalate",
        json={"reason": "Late", "action_required": "None"},
    )
    assert res_esc.status_code == status.HTTP_409_CONFLICT


def test_admin_and_superadmin_governance_intact():
    """Existing Admin and SuperAdmin governance behavior remains intact (GP-02)."""
    app, session_factory, users = make_test_environment()
    today = date.today()

    with session_factory() as db:
        db.add(
            GatePass(
                pass_id="GP-ADM-001",
                pass_type=GatePassType.asset_movement,
                request_date=today,
                status=GatePassStatus.pending,
                requester_name="Elena",
                department="Eng",
                asset_or_item="Switch",
                quantity=1,
                destination="Dest",
                purpose="Purpose",
            )
        )
        db.add(
            GatePass(
                pass_id="GP-ESC-001",
                pass_type=GatePassType.asset_movement,
                request_date=today,
                status=GatePassStatus.escalated,
                requester_name="Elena",
                department="Eng",
                asset_or_item="Switch 2",
                quantity=1,
                destination="Dest",
                purpose="Purpose",
                escalation_is_escalated=True,
                escalation_reason="Hold",
            )
        )
        db.commit()

    # Admin approves pending pass
    app.dependency_overrides[get_current_user] = lambda: users["admin"]
    client = TestClient(app)
    res_adm = client.post(
        "/api/gate-passes/GP-ADM-001/decision",
        json={"target_status": "Approved", "note": "Approved by Admin"},
    )
    assert res_adm.status_code == status.HTTP_200_OK
    assert res_adm.json()["status"] == "Approved"

    # SuperAdmin overrides escalated pass
    app.dependency_overrides[get_current_user] = lambda: users["superadmin"]
    res_sup = client.post(
        "/api/gate-passes/GP-ESC-001/override",
        json={"note": "Executive override by SuperAdmin"},
    )
    assert res_sup.status_code == status.HTTP_200_OK
    assert res_sup.json()["status"] == "Approved"
    assert res_sup.json()["decision_status"] == "Override Granted by Administrator"


# ==============================================================================
# Timezone Handling Tests (Asia/Kolkata IST, UTC+05:30)
# ==============================================================================


def test_todays_movement_ist_reporting_day_boundaries():
    """
    Test IST reporting-day boundaries (UTC+05:30) for dashboard Today's Movement KPI.
    UTC timestamps stored in the database must be correctly mapped to IST reporting days:
    - 00:05 IST today (18:35 UTC yesterday) is counted under TODAY.
    - 23:55 IST yesterday (18:25 UTC yesterday) is counted under YESTERDAY (excluded).
    - 23:55 IST today (18:25 UTC today) is counted under TODAY.
    - 00:05 IST tomorrow (18:35 UTC today) is counted under TOMORROW (excluded).
    """
    app, session_factory, users = make_test_environment()

    # Calculate IST reference boundaries
    now_utc = datetime.now(timezone.utc)
    now_ist = now_utc.astimezone(IST)
    today_ist = now_ist.date()

    start_ist = datetime.combine(today_ist, time.min, tzinfo=IST)
    end_ist = start_ist + timedelta(days=1)

    start_utc = start_ist.astimezone(timezone.utc)
    end_utc = end_ist.astimezone(timezone.utc)

    with session_factory() as db:
        ast = Asset(
            asset_id="AST-TZ-001",
            name="Testing Device",
            status=AssetStatus.active,
            category="Hardware",
            location="HQ",
            custodian="Custodian",
            purchase_date=datetime(2026, 1, 1),
            vendor_name="V",
            total_cost="100",
            warranty_period="1y",
            qr_code_value="qrB",
            qr_code_data_url="data:image/png;base64,b",
        )
        db.add(ast)
        db.flush()

        # Movement 1: 10 minutes BEFORE today's IST midnight -> 23:50 IST yesterday (EXCLUDED)
        # In UTC: start_utc - 10 minutes
        db.add(
            AssetMovement(
                asset_id=ast.id,
                movement_id="MOV-TZ-YESTERDAY",
                from_location="Bay A",
                to_location="Bay B",
                from_custodian="C1",
                to_custodian="C2",
                status=AssetMovementStatus.completed,
                initiated_by_user_id=users["host"].id,
                initiated_at=start_utc - timedelta(minutes=10),
            )
        )

        # Movement 2: 10 minutes AFTER today's IST midnight -> 00:10 IST today (INCLUDED, near midnight)
        # In UTC: start_utc + 10 minutes
        db.add(
            AssetMovement(
                asset_id=ast.id,
                movement_id="MOV-TZ-MIDNIGHT-START",
                from_location="Bay B",
                to_location="Bay C",
                from_custodian="C2",
                to_custodian="C3",
                status=AssetMovementStatus.in_transit,
                initiated_by_user_id=users["host"].id,
                initiated_at=start_utc + timedelta(minutes=10),
            )
        )

        # Movement 3: Midday IST today (INCLUDED)
        db.add(
            AssetMovement(
                asset_id=ast.id,
                movement_id="MOV-TZ-MIDDAY",
                from_location="Bay C",
                to_location="Bay D",
                from_custodian="C3",
                to_custodian="C4",
                status=AssetMovementStatus.completed,
                initiated_by_user_id=users["host"].id,
                initiated_at=start_utc + timedelta(hours=12),
            )
        )

        # Movement 4: 10 minutes BEFORE tomorrow's IST midnight -> 23:50 IST today (INCLUDED, near midnight)
        # In UTC: end_utc - 10 minutes
        db.add(
            AssetMovement(
                asset_id=ast.id,
                movement_id="MOV-TZ-MIDNIGHT-END",
                from_location="Bay D",
                to_location="Bay E",
                from_custodian="C4",
                to_custodian="C5",
                status=AssetMovementStatus.in_transit,
                initiated_by_user_id=users["host"].id,
                initiated_at=end_utc - timedelta(minutes=10),
            )
        )

        # Movement 5: 10 minutes AFTER tomorrow's IST midnight -> 00:10 IST tomorrow (EXCLUDED)
        # In UTC: end_utc + 10 minutes
        db.add(
            AssetMovement(
                asset_id=ast.id,
                movement_id="MOV-TZ-TOMORROW",
                from_location="Bay E",
                to_location="Bay F",
                from_custodian="C5",
                to_custodian="C6",
                status=AssetMovementStatus.initiated,
                initiated_by_user_id=users["host"].id,
                initiated_at=end_utc + timedelta(minutes=10),
            )
        )
        db.commit()

    app.dependency_overrides[get_current_user] = lambda: users["host"]
    client = TestClient(app)

    # 1. Host Dashboard Today's Movement KPI
    res_dash = client.get("/api/dashboard/host")
    assert res_dash.status_code == status.HTTP_200_OK
    dash_data = res_dash.json()

    # Exactly 3 movements belong to today's IST reporting day (Movements 2, 3, 4)
    assert dash_data["todaysMovement"]["total"] == 3
    assert dash_data["todaysMovement"]["completed"] == 1
    assert dash_data["todaysMovement"]["inTransit"] == 2

    # 2. Host Movements endpoint filtering by today's IST date
    res_mov = client.get(
        "/api/dashboard/host/movements",
        params={"date": today_ist.isoformat()},
    )
    assert res_mov.status_code == status.HTTP_200_OK
    mov_data = res_mov.json()
    assert mov_data["total"] == 3
    mov_ids = [m["id"] for m in mov_data["items"]]
    assert "MOV-TZ-MIDNIGHT-START" in mov_ids
    assert "MOV-TZ-MIDDAY" in mov_ids
    assert "MOV-TZ-MIDNIGHT-END" in mov_ids
    assert "MOV-TZ-YESTERDAY" not in mov_ids
    assert "MOV-TZ-TOMORROW" not in mov_ids


# ==============================================================================
# Host Dashboard Scoped KPIs & Collections Tests
# ==============================================================================


def test_host_receives_correct_dashboard_kpis():
    """Host dashboard KPIs reflect passes initiated by Host and IST day boundaries."""
    app, session_factory, users = make_test_environment()
    today_ist = datetime.now(timezone.utc).astimezone(IST).date()
    now_utc = datetime.now(timezone.utc)

    with session_factory() as db:
        ast1 = Asset(
            asset_id="AST-2026-0001",
            name="MacBook Pro 16",
            status=AssetStatus.active,
            category="Hardware",
            location="Main Gate",
            custodian="Elena Rostova",
            purchase_date=datetime(2026, 1, 1),
            vendor_name="Apple",
            total_cost="2500",
            warranty_period="2 years",
            qr_code_value="qr1",
            qr_code_data_url="data:image/png;base64,1",
        )
        db.add(ast1)
        db.flush()

        # 1 active outbound pass initiated by Host
        db.add(
            GatePass(
                pass_id="GP-2026-0001",
                pass_type=GatePassType.non_returnable,
                request_date=today_ist,
                status=GatePassStatus.active,
                requester_name=users["host"].full_name,
                department="Engineering",
                asset_or_item="MacBook Pro 16",
                quantity=1,
                destination="Client Site",
                movement_date=today_ist,
                purpose="Demo deployment",
                exit_status="Verified",
                exit_officer=users["guard"].full_name,
            )
        )
        # 1 active returnable pass (inbound scheduled, pending return intake) initiated by Host
        db.add(
            GatePass(
                pass_id="GP-2026-0002",
                pass_type=GatePassType.returnable,
                request_date=today_ist,
                status=GatePassStatus.active,
                requester_name=users["host"].full_name,
                department="Infrastructure",
                asset_or_item="Multimeter Kit",
                quantity=1,
                destination="Field Station",
                movement_date=today_ist,
                purpose="Diagnostics",
                exit_status="Verified",
                entry_status="Pending",
            )
        )
        # 1 pending pass initiated by Host (awaiting review/action)
        db.add(
            GatePass(
                pass_id="GP-2026-0003",
                pass_type=GatePassType.asset_movement,
                request_date=today_ist,
                status=GatePassStatus.pending,
                requester_name=users["host"].full_name,
                department="Operations",
                asset_or_item="Catalyst Switch",
                quantity=1,
                destination="HQ Bay",
                movement_date=today_ist,
                purpose="Relocation",
            )
        )
        # 1 escalated pass initiated by Host
        db.add(
            GatePass(
                pass_id="GP-2026-0004",
                pass_type=GatePassType.maintenance,
                request_date=today_ist,
                status=GatePassStatus.escalated,
                requester_name=users["host"].full_name,
                department="QA Labs",
                asset_or_item="LaserJet Printer",
                quantity=1,
                destination="Vendor Depot",
                movement_date=today_ist,
                purpose="Repairs",
                escalation_is_escalated=True,
                escalation_reason="Serial mismatch",
                escalation_timestamp=now_utc,
            )
        )
        # 1 pass initiated by another user (should NOT count on Host's dashboard)
        db.add(
            GatePass(
                pass_id="GP-OTHER-0005",
                pass_type=GatePassType.asset_movement,
                request_date=today_ist,
                status=GatePassStatus.active,
                requester_name="Elena Rostova",
                department="Engineering",
                asset_or_item="Oscilloscope",
                quantity=1,
                destination="Site D",
                purpose="Testing",
            )
        )
        # 1 asset movement today (in transit)
        db.add(
            AssetMovement(
                asset_id=ast1.id,
                movement_id="MOV-2026-0001",
                from_location="Main Gate",
                to_location="Client Facility",
                from_custodian="Ops",
                to_custodian="Elena Rostova",
                status=AssetMovementStatus.in_transit,
                initiated_by_user_id=users["host"].id,
                initiated_at=now_utc,
            )
        )
        db.commit()

    app.dependency_overrides[get_current_user] = lambda: users["host"]
    client = TestClient(app)

    res = client.get("/api/dashboard/host")
    assert res.status_code == status.HTTP_200_OK
    data = res.json()

    # Active gate passes: 2 active initiated by Host (1 outbound + 1 inboundScheduled)
    assert data["activeGatePasses"]["total"] == 2
    assert data["activeGatePasses"]["outbound"] == 1
    assert data["activeGatePasses"]["inboundScheduled"] == 1
    assert data["activeGatePasses"]["badgeText"] == "Live"

    # Pending host actions: 2 (1 pending pass awaiting review + 1 active returnable pass awaiting return intake)
    assert data["pendingHostActions"]["total"] == 2

    # Today's movement: 1 movement initiated today
    assert data["todaysMovement"]["total"] == 1
    assert data["todaysMovement"]["inTransit"] == 1
    assert data["todaysMovement"]["completed"] == 0

    # Escalated gate passes: 1 initiated by Host
    assert data["escalatedGatePasses"]["total"] == 1

    # Check collections only contain Host's items
    activity_ids = [item["pass_id"] for item in data["gatePassActivity"]]
    assert len(activity_ids) == 4
    assert "GP-OTHER-0005" not in activity_ids


def test_active_and_escalated_gate_pass_counts():
    """Verify active and escalated KPI tallies are correctly scoped for Host."""
    app, session_factory, users = make_test_environment()
    today = date.today()

    with session_factory() as db:
        # 3 active passes for Host
        for i in range(1, 4):
            db.add(
                GatePass(
                    pass_id=f"GP-ACT-{i}",
                    pass_type=GatePassType.asset_movement,
                    request_date=today,
                    status=GatePassStatus.active,
                    requester_name=users["host"].full_name,
                    department="Dept",
                    asset_or_item=f"Item {i}",
                    quantity=1,
                    destination="Dest",
                    purpose="Transit",
                )
            )
        # 2 escalated passes for Host
        for i in range(1, 3):
            db.add(
                GatePass(
                    pass_id=f"GP-ESC-{i}",
                    pass_type=GatePassType.returnable,
                    request_date=today,
                    status=GatePassStatus.escalated,
                    requester_name=users["host"].full_name,
                    department="Dept",
                    asset_or_item=f"Esc Item {i}",
                    quantity=1,
                    destination="Dest",
                    purpose="Transit",
                    escalation_is_escalated=True,
                    escalation_reason="Security hold",
                )
            )
        # 1 completed pass (should not count as active or escalated)
        db.add(
            GatePass(
                pass_id="GP-COMP-1",
                pass_type=GatePassType.maintenance,
                request_date=today,
                status=GatePassStatus.completed,
                requester_name=users["host"].full_name,
                department="Dept",
                asset_or_item="Old Item",
                quantity=1,
                destination="Dest",
                purpose="Done",
            )
        )
        db.commit()

    app.dependency_overrides[get_current_user] = lambda: users["host"]
    client = TestClient(app)

    res = client.get("/api/dashboard/host")
    assert res.status_code == status.HTTP_200_OK
    data = res.json()

    assert data["activeGatePasses"]["total"] == 3
    assert data["escalatedGatePasses"]["total"] == 2


def test_empty_database_returns_valid_response():
    """Host dashboard handles empty state gracefully."""
    app, _, users = make_test_environment()
    app.dependency_overrides[get_current_user] = lambda: users["host"]
    client = TestClient(app)

    res = client.get("/api/dashboard/host")
    assert res.status_code == status.HTTP_200_OK
    data = res.json()

    assert data["activeGatePasses"]["total"] == 0
    assert data["pendingHostActions"]["total"] == 0
    assert data["todaysMovement"]["total"] == 0
    assert data["escalatedGatePasses"]["total"] == 0
    assert data["gatePassActivity"] == []
    assert data["movementOverview"] == []
    assert data["pendingActions"] == []
    assert data["operationalAlerts"] == []


def test_unauthorized_roles_cannot_access_host_dashboard():
    """Unauthenticated users, employees, guards, and admins cannot access Host dashboard."""
    app, _, users = make_test_environment()
    client = TestClient(app)

    # 1. Unauthenticated -> 401
    assert client.get("/api/dashboard/host").status_code == status.HTTP_401_UNAUTHORIZED

    # 2. Employee -> 403
    app.dependency_overrides[get_current_user] = lambda: users["employee"]
    res_emp = client.get("/api/dashboard/host")
    assert res_emp.status_code == status.HTTP_403_FORBIDDEN
    assert "Host role required" in res_emp.json()["detail"]

    # 3. Guard -> 403
    app.dependency_overrides[get_current_user] = lambda: users["guard"]
    assert client.get("/api/dashboard/host").status_code == status.HTTP_403_FORBIDDEN

    # 4. Admin -> 403
    app.dependency_overrides[get_current_user] = lambda: users["admin"]
    assert client.get("/api/dashboard/host").status_code == status.HTTP_403_FORBIDDEN


def test_host_receives_real_movement_records_and_filters():
    """Test movement records listing, search, status filter, and date filter."""
    app, session_factory, users = make_test_environment()
    today_ist = datetime.now(timezone.utc).astimezone(IST).date()
    start_ist = datetime.combine(today_ist, time.min, tzinfo=IST)
    dt_today = start_ist.astimezone(timezone.utc) + timedelta(hours=8)

    with session_factory() as db:
        ast1 = Asset(
            asset_id="AST-M-001",
            name="Cisco Catalyst 9300",
            status=AssetStatus.in_transit,
            category="Network",
            location="Server Room 2",
            custodian="IT",
            purchase_date=datetime(2026, 1, 1),
            vendor_name="Cisco",
            total_cost="5000",
            warranty_period="3y",
            qr_code_value="qrM1",
            qr_code_data_url="data:image/png;base64,m1",
        )
        ast2 = Asset(
            asset_id="AST-M-002",
            name="Dell UltraSharp 32",
            status=AssetStatus.active,
            category="Hardware",
            location="Design Lab",
            custodian="Design",
            purchase_date=datetime(2026, 1, 1),
            vendor_name="Dell",
            total_cost="800",
            warranty_period="3y",
            qr_code_value="qrM2",
            qr_code_data_url="data:image/png;base64,m2",
        )
        db.add_all([ast1, ast2])
        db.flush()

        db.add_all([
            AssetMovement(
                asset_id=ast1.id,
                movement_id="MOV-2026-0181",
                from_location="Server Room 2",
                to_location="Lab 4 Corridor",
                from_custodian="IT",
                to_custodian="Security",
                status=AssetMovementStatus.in_transit,
                initiated_by_user_id=users["host"].id,
                initiated_at=dt_today,
            ),
            AssetMovement(
                asset_id=ast2.id,
                movement_id="MOV-2026-0182",
                from_location="Design Lab",
                to_location="Loading Bay",
                from_custodian="Design",
                to_custodian="Logistics",
                status=AssetMovementStatus.completed,
                initiated_by_user_id=users["host"].id,
                initiated_at=dt_today - timedelta(hours=2),
                completed_at=dt_today - timedelta(hours=1),
            ),
        ])
        db.commit()

    app.dependency_overrides[get_current_user] = lambda: users["host"]
    client = TestClient(app)

    # 1. Fetch all movements
    res = client.get("/api/dashboard/host/movements")
    assert res.status_code == status.HTTP_200_OK
    data = res.json()
    assert data["total"] == 2

    # 2. Filter by search term
    res_search = client.get("/api/dashboard/host/movements", params={"search": "Catalyst"})
    assert res_search.status_code == status.HTTP_200_OK
    assert res_search.json()["total"] == 1
    assert res_search.json()["items"][0]["assetName"] == "Cisco Catalyst 9300"

    # 3. Filter by status
    res_stat = client.get("/api/dashboard/host/movements", params={"status": "in-transit"})
    assert res_stat.status_code == status.HTTP_200_OK
    assert res_stat.json()["total"] == 1
    assert res_stat.json()["items"][0]["id"] == "MOV-2026-0181"

    # 4. Filter by IST reporting date
    res_date = client.get("/api/dashboard/host/movements", params={"date": today_ist.isoformat()})
    assert res_date.status_code == status.HTTP_200_OK
    assert res_date.json()["total"] == 2


def test_no_duplicate_movement_records_returned():
    """Movement query does not return duplicate records."""
    app, session_factory, users = make_test_environment()
    today = date.today()

    with session_factory() as db:
        ast = Asset(
            asset_id="AST-DUP-1",
            name="Single Asset",
            status=AssetStatus.active,
            category="Hardware",
            location="HQ",
            custodian="Custodian",
            purchase_date=datetime(2026, 1, 1),
            vendor_name="V",
            total_cost="100",
            warranty_period="1y",
            qr_code_value="qrDup",
            qr_code_data_url="data:image/png;base64,d",
        )
        db.add(ast)
        db.flush()

        db.add(
            AssetMovement(
                asset_id=ast.id,
                movement_id="MOV-DUP-TEST",
                from_location="Bay A",
                to_location="Bay B",
                from_custodian="C1",
                to_custodian="C2",
                status=AssetMovementStatus.in_transit,
                initiated_by_user_id=users["host"].id,
                initiated_at=datetime.combine(today, time(11, 0)),
            )
        )
        db.commit()

    app.dependency_overrides[get_current_user] = lambda: users["host"]
    client = TestClient(app)

    res = client.get("/api/dashboard/host/movements")
    assert res.status_code == status.HTTP_200_OK
    data = res.json()
    assert data["total"] == 1
    assert len(data["items"]) == 1


def test_host_alerts_derived_from_escalated_and_overdue_passes():
    """Host operational alerts surface escalated and overdue gate passes initiated by Host."""
    app, session_factory, users = make_test_environment()
    today_ist = datetime.now(timezone.utc).astimezone(IST).date()
    yesterday_ist = today_ist - timedelta(days=1)

    with session_factory() as db:
        # 1. Escalated pass initiated by Host
        db.add(
            GatePass(
                pass_id="GP-ESC-ALERT-1",
                pass_type=GatePassType.asset_movement,
                request_date=today_ist,
                status=GatePassStatus.escalated,
                requester_name=users["host"].full_name,
                department="Operations",
                asset_or_item="Calibrator",
                quantity=1,
                destination="Dest",
                purpose="Testing",
                escalation_is_escalated=True,
                escalation_reason="Tamper seal broken during inspection",
                escalation_timestamp=datetime.now(timezone.utc),
            )
        )
        # 2. Overdue pass initiated by Host (scheduled yesterday, still pending)
        db.add(
            GatePass(
                pass_id="GP-OVD-ALERT-1",
                pass_type=GatePassType.returnable,
                request_date=yesterday_ist,
                status=GatePassStatus.pending,
                requester_name=users["host"].full_name,
                department="Operations",
                asset_or_item="Spectrometer",
                quantity=1,
                destination="Gate 3 Checkpoint",
                movement_date=yesterday_ist,
                purpose="Lab delivery",
            )
        )
        # 3. Unrelated user's overdue pass (should NOT appear in Host alerts)
        db.add(
            GatePass(
                pass_id="GP-OTHER-OVD",
                pass_type=GatePassType.returnable,
                request_date=yesterday_ist,
                status=GatePassStatus.pending,
                requester_name="Elena Rostova",
                department="Engineering",
                asset_or_item="Other Item",
                quantity=1,
                destination="Gate 1",
                movement_date=yesterday_ist,
                purpose="Other delivery",
            )
        )
        db.commit()

    app.dependency_overrides[get_current_user] = lambda: users["host"]
    client = TestClient(app)

    res = client.get("/api/dashboard/host/alerts")
    assert res.status_code == status.HTTP_200_OK
    data = res.json()
    assert data["total"] == 2
    alert_ids = [a["id"] for a in data["items"]]
    assert "ALT-ESC-GP-ESC-ALERT-1" in alert_ids
    assert "ALT-OVD-GP-OVD-ALERT-1" in alert_ids
    assert "ALT-OVD-GP-OTHER-OVD" not in alert_ids

    # Critical severity on overdue past today
    ovd_alert = next(a for a in data["items"] if a["id"] == "ALT-OVD-GP-OVD-ALERT-1")
    assert ovd_alert["severity"] == "critical"
    assert "Spectrometer" in ovd_alert["description"]
