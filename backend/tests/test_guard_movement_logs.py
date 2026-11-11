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


def test_guard_movement_logs_authorization():
    app, session_factory, guard_user, admin_user, employee_user, host_user = make_test_environment()

    # 1. Unauthenticated -> 401
    client_unauth = TestClient(app)
    resp = client_unauth.get("/api/gate-passes/movement-logs")
    assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    # 2. Guard -> 200
    app.dependency_overrides[get_current_user] = lambda: guard_user
    client_guard = TestClient(app)
    resp = client_guard.get("/api/gate-passes/movement-logs")
    assert resp.status_code == status.HTTP_200_OK

    # 3. Admin -> 200
    app.dependency_overrides[get_current_user] = lambda: admin_user
    client_admin = TestClient(app)
    resp = client_admin.get("/api/gate-passes/movement-logs")
    assert resp.status_code == status.HTTP_200_OK

    # 4. Employee -> 403
    app.dependency_overrides[get_current_user] = lambda: employee_user
    client_emp = TestClient(app)
    resp = client_emp.get("/api/gate-passes/movement-logs")
    assert resp.status_code == status.HTTP_403_FORBIDDEN

    # 5. Host -> 403
    app.dependency_overrides[get_current_user] = lambda: host_user
    client_host = TestClient(app)
    resp = client_host.get("/api/gate-passes/movement-logs")
    assert resp.status_code == status.HTTP_403_FORBIDDEN


def test_guard_movement_logs_filtering_and_pagination():
    app, session_factory, guard_user, _, _, _ = make_test_environment()
    app.dependency_overrides[get_current_user] = lambda: guard_user
    client = TestClient(app)

    now_utc = datetime.now(timezone.utc)

    with session_factory() as db:
        # Create an Asset
        asset1 = Asset(
            asset_id="AST-2026-0001",
            name="Cisco Catalyst 9300",
            category="Networking",
            serial_number="CS-9300-8801",
            location="Server Room A",
            custodian="Elena Rostova",
            purchase_date=datetime(2025, 1, 1),
            vendor_name="Cisco Systems",
            total_cost="$3500",
            warranty_period="3 Years",
            qr_code_value="AMX-AST-2026-0001",
            qr_code_data_url="data:image/png;base64,fake",
        )
        db.add(asset1)
        db.flush()

        # Pass 1: Outward exit verified (Cleared)
        gp1 = GatePass(
            pass_id="GP-2026-0001",
            pass_type=GatePassType.asset_movement,
            request_date=(now_utc - timedelta(days=2)).date(),
            status=GatePassStatus.active,
            requester_name="Elena Rostova",
            department="Hardware Engineering",
            asset_or_item="AST-2026-0001",
            quantity=1,
            destination="Regional Datacenter",
            purpose="Urgent switch replacement",
            exit_gate="Gate-01A",
            exit_officer="Guard Officer John",
            exit_status="Verified",
            exit_timestamp=now_utc - timedelta(days=2),
        )
        # Pass 2: Inward entry verified (Cleared)
        gp2 = GatePass(
            pass_id="GP-2026-0002",
            pass_type=GatePassType.returnable,
            request_date=(now_utc - timedelta(days=1)).date(),
            status=GatePassStatus.completed,
            requester_name="Viktor Chen",
            department="Datacenter Ops",
            asset_or_item="Generic Tools",
            quantity=2,
            destination="Field Site B",
            purpose="Field diagnostic",
            exit_gate="Gate-01A",
            exit_officer="Guard Officer John",
            exit_status="Verified",
            exit_timestamp=now_utc - timedelta(days=1, hours=4),
            entry_gate="Gate-01B",
            entry_officer="Guard Officer John",
            entry_status="Verified",
            entry_timestamp=now_utc - timedelta(days=1),
        )
        # Pass 3: Flagged / Escalated
        gp3 = GatePass(
            pass_id="GP-2026-0003",
            pass_type=GatePassType.asset_movement,
            request_date=now_utc.date(),
            status=GatePassStatus.escalated,
            requester_name="Marcus Vance",
            department="Security",
            asset_or_item="Thermal Camera",
            quantity=1,
            destination="External Lab",
            purpose="Calibration",
            escalation_is_escalated=True,
            escalation_reason="Serial mismatch detected at lane barrier",
            escalation_timestamp=now_utc,
            escalation_escalated_by="Guard Officer John",
        )
        # Pass 4: Pending authorization
        gp4 = GatePass(
            pass_id="GP-2026-0004",
            pass_type=GatePassType.asset_movement,
            request_date=now_utc.date(),
            status=GatePassStatus.pending,
            requester_name="Sarah Connor",
            department="Operations",
            asset_or_item="Backup Unit",
            quantity=1,
            destination="HQ Office",
            purpose="Relocation",
        )
        db.add_all([gp1, gp2, gp3, gp4])
        db.flush()

        # GatePassHistory entries (authoritative ledger)
        h1 = GatePassHistory(
            history_id="GPH-2026-0001",
            pass_id=gp1.pass_id,
            timestamp=now_utc - timedelta(days=2),
            action="Exit Verification",
            performed_by="Guard Officer John",
            note="Physical hardware tags verified against outward manifest.",
            status_snapshot="Active",
        )
        h2 = GatePassHistory(
            history_id="GPH-2026-0002",
            pass_id=gp2.pass_id,
            timestamp=now_utc - timedelta(days=1),
            action="Entry Verification",
            performed_by="Guard Officer John",
            note="Return intake inspected and verified.",
            status_snapshot="Completed",
        )
        h3 = GatePassHistory(
            history_id="GPH-2026-0003",
            pass_id=gp3.pass_id,
            timestamp=now_utc,
            action="Escalated",
            performed_by="Guard Officer John",
            note="Serial mismatch detected at lane barrier",
            status_snapshot="Escalated",
        )
        h4 = GatePassHistory(
            history_id="GPH-2026-0004",
            pass_id=gp4.pass_id,
            timestamp=now_utc,
            action="Gate Pass Created",
            performed_by="Sarah Connor",
            note="Created pass request",
            status_snapshot="Pending",
        )
        db.add_all([h1, h2, h3, h4])

        # Also add AuditLog entries to prove they do NOT duplicate history
        al1 = AuditLog(
            action="gate_pass_exit_verified",
            gate_pass_identifier=gp1.pass_id,
            actor_user_id=1,
            asset_identifier="AST-2026-0001",
            occurred_at=now_utc - timedelta(days=2),
        )
        db.add(al1)
        db.commit()

    # 1. Fetch all (page 1, size 10)
    res = client.get("/api/gate-passes/movement-logs")
    assert res.status_code == status.HTTP_200_OK
    data = res.json()
    assert data["total"] == 4
    assert len(data["items"]) == 4
    # Authoritative KPI checks:
    # Total ledger records = 4, but physical movements = 2 (h1 exit + h2 entry).
    # Administrative event (h4) and Escalation (h3) do NOT inflate movement totals.
    kpis = data["kpis"]
    assert kpis["totalRecords"] == 4
    assert kpis["totalMovements"] == 2
    assert kpis["inboundEntries"] == 1
    assert kpis["outboundExits"] == 1
    assert kpis["flaggedMovements"] == 1

    # 2. Asset resolution and event classification check on Pass 1 (Outward physical transit)
    p1 = next(item for item in data["items"] if item["passId"] == "GP-2026-0001")
    assert p1["assetName"] == "Cisco Catalyst 9300"
    assert p1["serialNumber"] == "CS-9300-8801"
    assert p1["category"] == "Physical Movement"
    assert p1["direction"] == "Outward"
    assert p1["status"] == "Cleared"
    assert p1["checkpoint"] == "Gate-01A"
    assert p1["manifestHash"] == "Standard Manifest (No Hash Stored)"
    assert p1["tamperSealId"] == "N/A (Untracked)"
    # Individual checklist items are not persisted in backend; must not fabricate green checkmarks
    assert p1["checklist"] == []
    assert len(p1["timeline"]) >= 1

    # Check Pass 3 (Security Escalation Hold - not a physical movement)
    p3 = next(item for item in data["items"] if item["passId"] == "GP-2026-0003")
    assert p3["category"] == "Security Escalation"
    assert p3["direction"] == "N/A"
    assert p3["status"] == "Flagged"
    assert p3["hasDiscrepancy"] is True

    # Check Pass 4 (Administrative Event - not a physical movement)
    p4 = next(item for item in data["items"] if item["passId"] == "GP-2026-0004")
    assert p4["category"] == "Administrative"
    assert p4["direction"] == "N/A"
    assert p4["status"] == "Pending"

    # 3. Direction filter: Inward
    res_in = client.get("/api/gate-passes/movement-logs?direction=Inward")
    assert res_in.status_code == status.HTTP_200_OK
    data_in = res_in.json()
    assert data_in["total"] == 1
    assert data_in["items"][0]["passId"] == "GP-2026-0002"
    assert data_in["items"][0]["direction"] == "Inward"
    assert data_in["items"][0]["category"] == "Physical Movement"

    # 3b. Direction filter: Movements (Physical Movements Only)
    res_mov = client.get("/api/gate-passes/movement-logs?direction=movements")
    assert res_mov.status_code == status.HTTP_200_OK
    data_mov = res_mov.json()
    assert data_mov["total"] == 2
    assert {item["passId"] for item in data_mov["items"]} == {"GP-2026-0001", "GP-2026-0002"}

    # 4. Status filter: Flagged
    res_flag = client.get("/api/gate-passes/movement-logs?status=Flagged")
    assert res_flag.status_code == status.HTTP_200_OK
    data_flag = res_flag.json()
    assert data_flag["total"] == 1
    assert data_flag["items"][0]["passId"] == "GP-2026-0003"
    assert data_flag["items"][0]["hasDiscrepancy"] is True

    # 5. Search filter: by passId or requester
    res_search = client.get("/api/gate-passes/movement-logs?search=Elena")
    assert res_search.status_code == status.HTTP_200_OK
    data_search = res_search.json()
    assert data_search["total"] == 1
    assert data_search["items"][0]["requesterName"] == "Elena Rostova"

    # 6. Pagination: page_size=2
    res_p1 = client.get("/api/gate-passes/movement-logs?page=1&page_size=2")
    assert res_p1.status_code == status.HTTP_200_OK
    d_p1 = res_p1.json()
    assert len(d_p1["items"]) == 2
    assert d_p1["totalPages"] == 2
    assert d_p1["page"] == 1

    res_p2 = client.get("/api/gate-passes/movement-logs?page=2&page_size=2")
    assert res_p2.status_code == status.HTTP_200_OK
    d_p2 = res_p2.json()
    assert len(d_p2["items"]) == 2
    assert d_p2["page"] == 2

    # Verify multi-page completeness across page boundaries (e.g. export pagination)
    all_paginated_ids = [item["id"] for item in d_p1["items"]] + [item["id"] for item in d_p2["items"]]
    assert len(all_paginated_ids) == 4
    assert len(set(all_paginated_ids)) == 4
    assert set(all_paginated_ids) == {"GPH-2026-0001", "GPH-2026-0002", "GPH-2026-0003", "GPH-2026-0004"}

    # 7. Date filtering
    # Filter only yesterday to today
    from_d = (now_utc - timedelta(days=1)).strftime("%Y-%m-%d")
    to_d = now_utc.strftime("%Y-%m-%d")
    res_date = client.get(f"/api/gate-passes/movement-logs?from_date={from_d}&to_date={to_d}")
    assert res_date.status_code == status.HTTP_200_OK
    d_date = res_date.json()
    # Should exclude GP-2026-0001 (which was 2 days ago)
    assert d_date["total"] == 3
    assert all(item["passId"] != "GP-2026-0001" for item in d_date["items"])

    # 8. Unmatched filter returns empty items with total=0
    res_empty = client.get("/api/gate-passes/movement-logs?search=NonExistentItem999")
    assert res_empty.status_code == status.HTTP_200_OK
    d_empty = res_empty.json()
    assert d_empty["total"] == 0
    assert len(d_empty["items"]) == 0
    assert d_empty["totalPages"] == 1
    assert d_empty["kpis"]["totalMovements"] == 0


def test_historical_event_semantics_preserved_across_lifecycle_changes():
    """Verify that an Exit Verification event remains Outward and Cleared even if the pass later becomes Completed or Escalated."""
    app, session_factory, guard_user, _, _, _ = make_test_environment()
    app.dependency_overrides[get_current_user] = lambda: guard_user
    client = TestClient(app)

    now_utc = datetime.now(timezone.utc)

    with session_factory() as db:
        gp = GatePass(
            pass_id="GP-LIFECYCLE-99",
            pass_type=GatePassType.returnable,
            request_date=(now_utc - timedelta(days=5)).date(),
            status=GatePassStatus.completed,  # Current final state
            requester_name="Lifecycle Tester",
            department="QA Engineering",
            asset_or_item="Calibration Rig",
            quantity=1,
            destination="Lab B",
            purpose="Routine Audit",
            exit_gate="Gate-North",
            exit_officer="Officer Dave",
            exit_status="Verified",
            exit_timestamp=now_utc - timedelta(days=4),
            entry_gate="Gate-South",
            entry_officer="Officer Dave",
            entry_status="Verified",
            entry_timestamp=now_utc - timedelta(days=1),
        )
        db.add(gp)
        db.flush()

        # Step 1: Created
        h1 = GatePassHistory(
            history_id="HIST-01",
            pass_id=gp.pass_id,
            timestamp=now_utc - timedelta(days=5),
            action="Gate Pass Created",
            performed_by="Lifecycle Tester",
            note="Request submitted",
            status_snapshot="Pending",
        )
        # Step 2: Exit verified (Outbound physical movement)
        h2 = GatePassHistory(
            history_id="HIST-02",
            pass_id=gp.pass_id,
            timestamp=now_utc - timedelta(days=4),
            action="Exit Verification",
            performed_by="Officer Dave",
            note="Dispatched outbound through Gate-North",
            status_snapshot="Active",
        )
        # Step 3: Escalated hold (Administrative / Security hold, NOT a physical movement)
        h3 = GatePassHistory(
            history_id="HIST-03",
            pass_id=gp.pass_id,
            timestamp=now_utc - timedelta(days=3),
            action="Escalated",
            performed_by="Officer Dave",
            note="Tag discrepancy flagged at checkpoint",
            status_snapshot="Escalated",
        )
        # Step 4: Decision updated (Administrative clearance, NOT a physical movement)
        h4 = GatePassHistory(
            history_id="HIST-04",
            pass_id=gp.pass_id,
            timestamp=now_utc - timedelta(days=2),
            action="Decision Updated",
            performed_by="Admin Kane",
            note="Escalation resolved and approved for return",
            status_snapshot="Approved",
        )
        # Step 5: Entry verified (Inbound physical movement)
        h5 = GatePassHistory(
            history_id="HIST-05",
            pass_id=gp.pass_id,
            timestamp=now_utc - timedelta(days=1),
            action="Entry Verification",
            performed_by="Officer Dave",
            note="Return intake completed",
            status_snapshot="Completed",
        )
        db.add_all([h1, h2, h3, h4, h5])
        db.commit()

    res = client.get("/api/gate-passes/movement-logs?search=GP-LIFECYCLE-99")
    assert res.status_code == status.HTTP_200_OK
    data = res.json()
    assert data["total"] == 5

    # Movement totals must count ONLY actual entry and exit verification events (h2 and h5 = 2 movements)
    kpis = data["kpis"]
    assert kpis["totalRecords"] == 5
    assert kpis["totalMovements"] == 2
    assert kpis["inboundEntries"] == 1
    assert kpis["outboundExits"] == 1
    assert kpis["flaggedMovements"] == 1  # h3

    items_by_id = {item["id"]: item for item in data["items"]}

    # Event 1: Creation
    assert items_by_id["HIST-01"]["category"] == "Administrative"
    assert items_by_id["HIST-01"]["direction"] == "N/A"
    assert items_by_id["HIST-01"]["status"] == "Pending"

    # Event 2: Exit Verification remains Outward and Cleared even though pass is Completed
    assert items_by_id["HIST-02"]["category"] == "Physical Movement"
    assert items_by_id["HIST-02"]["direction"] == "Outward"
    assert items_by_id["HIST-02"]["directionLabel"] == "Outward / Exit"
    assert items_by_id["HIST-02"]["status"] == "Cleared"

    # Event 3: Escalated hold remains Security Escalation and Flagged
    assert items_by_id["HIST-03"]["category"] == "Security Escalation"
    assert items_by_id["HIST-03"]["direction"] == "N/A"
    assert items_by_id["HIST-03"]["directionLabel"] == "Escalation Hold"
    assert items_by_id["HIST-03"]["status"] == "Flagged"

    # Event 4: Decision update remains Administrative
    assert items_by_id["HIST-04"]["category"] == "Administrative"
    assert items_by_id["HIST-04"]["direction"] == "N/A"
    assert items_by_id["HIST-04"]["directionLabel"] == "Administrative"

    # Event 5: Entry verification is Inward and Cleared
    assert items_by_id["HIST-05"]["category"] == "Physical Movement"
    assert items_by_id["HIST-05"]["direction"] == "Inward"
    assert items_by_id["HIST-05"]["directionLabel"] == "Inward / Entry"
    assert items_by_id["HIST-05"]["status"] == "Cleared"

