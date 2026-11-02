from datetime import date, datetime, timezone
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.deps import get_current_user
from app.models import (
    Asset,
    AssetMovement,
    AssetMovementStatus,
    AssetStatus,
    Consumable,
    ConsumableIssue,
    ConsumableOperationType,
    ConsumableStockMovement,
    Request,
    RequestHistory,
    RequestPriority,
    RequestStatus,
    RequestType,
    User,
    UserRole,
)
from app.routers.consumables import router as consumables_router
from app.routers.dashboard import router as dashboard_router


def make_test_environment():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    session_factory = sessionmaker(bind=engine, expire_on_commit=False)
    Base.metadata.create_all(engine)

    app = FastAPI()
    app.include_router(consumables_router)
    app.include_router(dashboard_router)

    def db_override():
        with session_factory() as db:
            yield db

    app.dependency_overrides[get_db] = db_override

    # Create test users
    emp1 = User(
        id=10,
        full_name="Marcus Vance",
        email="m.vance@company.com",
        employee_id="EMP-4092",
        role=UserRole.employee,
        password_hash="x",
        is_active=True,
    )
    emp2 = User(
        id=11,
        full_name="Sarah Jenkins",
        email="s.jenkins@company.com",
        employee_id="EMP-1002",
        role=UserRole.employee,
        password_hash="x",
        is_active=True,
    )
    emp_empty = User(
        id=12,
        full_name="Empty User",
        email="empty@company.com",
        employee_id="EMP-9999",
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

    now = datetime.now(timezone.utc)

    with session_factory() as db:
        db.add_all([emp1, emp2, emp_empty, admin])
        db.commit()

        # Seed Requests for emp1
        # REQ-001: Pending
        r1 = Request(
            request_id="REQ-2026-0001",
            requester_name="Marcus Vance",
            requester_email="m.vance@company.com",
            department="Product Design",
            request_type=RequestType.asset_request,
            requested_item="Test Monitor",
            category="Hardware",
            quantity=1,
            priority=RequestPriority.high,
            request_date=date(2026, 2, 1),
            status=RequestStatus.pending,
            justification="Workstation monitor",
            processing_guidelines="Standard",
        )
        # REQ-002: In Review
        r2 = Request(
            request_id="REQ-2026-0002",
            requester_name="Marcus Vance",
            requester_email="m.vance@company.com",
            department="Product Design",
            request_type=RequestType.asset_request,
            requested_item="Test Keyboard",
            category="Peripherals",
            quantity=1,
            priority=RequestPriority.medium,
            request_date=date(2026, 2, 5),
            status=RequestStatus.in_review,
            justification="Ergonomic keyboard",
            processing_guidelines="Standard",
        )
        # REQ-003: Fulfilled (Uppercase email for case-insensitivity test)
        r3 = Request(
            request_id="REQ-2026-0003",
            requester_name="Marcus Vance",
            requester_email="M.VANCE@COMPANY.COM",
            department="Product Design",
            request_type=RequestType.consumable_request,
            requested_item="USB-C Cable",
            category="Cables & Adapters",
            quantity=4,
            priority=RequestPriority.medium,
            request_date=date(2026, 2, 10),
            status=RequestStatus.fulfilled,
            justification="Monitor cabling",
            processing_guidelines="Standard",
        )
        # REQ-004: Rejected
        r4 = Request(
            request_id="REQ-2026-0004",
            requester_name="Marcus Vance",
            requester_email="m.vance@company.com",
            department="Product Design",
            request_type=RequestType.asset_request,
            requested_item="Luxury Desk Chair",
            category="Furniture",
            quantity=1,
            priority=RequestPriority.low,
            request_date=date(2026, 2, 12),
            status=RequestStatus.rejected,
            justification="Upgrade chair",
            processing_guidelines="Standard",
        )
        # Seed Requests for emp2
        # REQ-005: Pending
        r5 = Request(
            request_id="REQ-2026-0005",
            requester_name="Sarah Jenkins",
            requester_email="s.jenkins@company.com",
            department="Engineering",
            request_type=RequestType.asset_request,
            requested_item="Dev Laptop",
            category="Hardware",
            quantity=1,
            priority=RequestPriority.high,
            request_date=date(2026, 2, 15),
            status=RequestStatus.pending,
            justification="Engineering dev machine",
            processing_guidelines="Standard",
        )
        # REQ-006: Fulfilled
        r6 = Request(
            request_id="REQ-2026-0006",
            requester_name="Sarah Jenkins",
            requester_email="s.jenkins@company.com",
            department="Engineering",
            request_type=RequestType.consumable_request,
            requested_item="Cleaning Kit",
            category="Device Cleaning & Care",
            quantity=5,
            priority=RequestPriority.low,
            request_date=date(2026, 2, 16),
            status=RequestStatus.fulfilled,
            justification="Screen maintenance",
            processing_guidelines="Standard",
        )

        db.add_all([r1, r2, r3, r4, r5, r6])
        db.commit()

        # Seed Consumables
        c1 = Consumable(
            consumable_id="CON-001",
            name="USB-C to DisplayPort Cable (2m)",
            category="Cables & Adapters",
            batch_id="BAT-001",
            location="Storage Room B",
            available_stock=50,
            threshold=10,
            batch_quantity=60,
        )
        c2 = Consumable(
            consumable_id="CON-002",
            name="Memory Foam Wrist Rest",
            category="Desk Ergonomics",
            batch_id="BAT-002",
            location="Storage Room B",
            available_stock=20,
            threshold=5,
            batch_quantity=30,
        )
        c3 = Consumable(
            consumable_id="CON-003",
            name="Microfiber Screen Cleaning Solution",
            category="Device Cleaning & Care",
            batch_id="BAT-003",
            location="Storage Room A",
            available_stock=15,
            threshold=5,
            batch_quantity=20,
        )
        db.add_all([c1, c2, c3])
        db.commit()

        # Seed Consumable Issues:
        # Issue 1: Current month for emp1 (via REQ-2026-0003)
        iss1 = ConsumableIssue(
            issue_id="ISS-2026-001",
            consumable_id=c1.id,
            issue_date=now,
            quantity=4,
            request_reference="REQ-2026-0003",
            issued_by_user_id=admin.id,
            remaining_stock=46,
        )
        # Issue 2: Prior month for emp1 (via REQ-2026-0003)
        iss2 = ConsumableIssue(
            issue_id="ISS-2025-099",
            consumable_id=c2.id,
            issue_date=datetime(2025, 1, 15, 10, 0, tzinfo=timezone.utc),
            quantity=2,
            request_reference="REQ-2026-0003",
            issued_by_user_id=admin.id,
            remaining_stock=18,
        )
        # Issue 3: Current month for emp2 (via REQ-2026-0006)
        iss3 = ConsumableIssue(
            issue_id="ISS-2026-002",
            consumable_id=c3.id,
            issue_date=now,
            quantity=5,
            request_reference="REQ-2026-0006",
            issued_by_user_id=admin.id,
            remaining_stock=10,
        )
        # Issue 4: Orphan issue (None request_reference)
        iss4 = ConsumableIssue(
            issue_id="ISS-2026-003",
            consumable_id=c1.id,
            issue_date=now,
            quantity=10,
            request_reference=None,
            issued_by_user_id=admin.id,
            remaining_stock=36,
        )
        # Issue 5: Orphan issue (nonexistent request_reference)
        iss5 = ConsumableIssue(
            issue_id="ISS-2026-004",
            consumable_id=c2.id,
            issue_date=now,
            quantity=8,
            request_reference="REQ-NONEXISTENT",
            issued_by_user_id=admin.id,
            remaining_stock=10,
        )
        db.add_all([iss1, iss2, iss3, iss4, iss5])
        db.commit()

        # Seed Assets:
        # Asset 1: Assigned to Marcus Vance (full_name) - Active
        a1 = Asset(
            asset_id="AST-001",
            name="MacBook Pro 16",
            status=AssetStatus.active,
            category="Compute & Laptops",
            specification="M3 Max 36GB",
            serial_number="SER-001",
            location="HQ Floor 4",
            custodian="Marcus Vance",
            purchase_date=datetime(2026, 1, 1),
            vendor_name="Apple",
            total_cost="349900",
            warranty_period="3 Years",
            qr_code_value="assetmx:AST-001",
            qr_code_data_url="data:image/png;base64,x",
        )
        # Asset 2: Assigned to EMP-4092 (employee_id) - In Maintenance
        a2 = Asset(
            asset_id="AST-002",
            name="Dell UltraSharp 32",
            status=AssetStatus.in_maintenance,
            category="Displays & Monitors",
            specification="4K USB-C Hub",
            serial_number="SER-002",
            location="HQ Floor 4",
            custodian="EMP-4092",
            purchase_date=datetime(2026, 1, 5),
            vendor_name="Dell",
            total_cost="89500",
            warranty_period="3 Years",
            qr_code_value="assetmx:AST-002",
            qr_code_data_url="data:image/png;base64,x",
        )
        # Asset 3: Assigned to Sarah Jenkins (emp2) - Active
        a3 = Asset(
            asset_id="AST-003",
            name="Lenovo ThinkPad",
            status=AssetStatus.active,
            category="Compute & Laptops",
            specification="Intel i7 16GB",
            serial_number="SER-003",
            location="HQ Floor 2",
            custodian="Sarah Jenkins",
            purchase_date=datetime(2026, 1, 10),
            vendor_name="Lenovo",
            total_cost="72000",
            warranty_period="3 Years",
            qr_code_value="assetmx:AST-003",
            qr_code_data_url="data:image/png;base64,x",
        )
        # Asset 4: Unassigned
        a4 = Asset(
            asset_id="AST-004",
            name="Office Projector",
            status=AssetStatus.active,
            category="Displays",
            specification="1080p",
            serial_number="SER-004",
            location="Conf Room",
            custodian="Unassigned",
            purchase_date=datetime(2026, 1, 12),
            vendor_name="Epson",
            total_cost="56000",
            warranty_period="2 Years",
            qr_code_value="assetmx:AST-004",
            qr_code_data_url="data:image/png;base64,x",
        )
        db.add_all([a1, a2, a3, a4])
        db.commit()

    return app, emp1, emp2, emp_empty, admin


# =====================================================================
# Employee Consumption Tests
# =====================================================================

def test_employee_can_retrieve_own_consumable_issues():
    app, emp1, _emp2, _empty, _admin = make_test_environment()
    app.dependency_overrides[get_current_user] = lambda: emp1
    client = TestClient(app)

    response = client.get("/api/consumables/my")
    assert response.status_code == 200
    data = response.json()

    # emp1 has 2 issues: ISS-2026-001 (4 units) and ISS-2025-099 (2 units)
    assert data["total"] == 2
    assert len(data["items"]) == 2
    assert data["allTimeTotalUnits"] == 6
    assert data["thisMonthTotalUnits"] == 4

    issue_ids = [item["id"] for item in data["items"]]
    assert "ISS-2026-001" in issue_ids
    assert "ISS-2025-099" in issue_ids

    # Check required frontend fields
    first_item = data["items"][0]
    assert "itemName" in first_item
    assert "item_name" in first_item
    assert "categoryKey" in first_item
    assert "category_key" in first_item
    assert "quantityIssued" in first_item
    assert "quantity_issued" in first_item
    assert "fulfillmentDate" in first_item
    assert "relatedRequestId" in first_item
    assert first_item["relatedRequestId"] == "REQ-2026-0003"
    assert first_item["status"] == "Fulfilled / Issued"
    assert "icon" in first_item
    assert "isCurrentMonth" in first_item

    # Check summary
    summary = data["summary"]
    assert summary["totalIssued"] == 6
    assert summary["activeCategoriesCount"] == 2
    assert len(summary["categories"]) == 2


def test_employee_cannot_retrieve_another_employee_issues():
    app, emp1, emp2, _empty, _admin = make_test_environment()

    # emp1 requesting
    app.dependency_overrides[get_current_user] = lambda: emp1
    client1 = TestClient(app)
    res1 = client1.get("/api/consumables/my")
    assert res1.status_code == 200
    data1 = res1.json()
    emp1_issue_ids = [item["id"] for item in data1["items"]]
    assert "ISS-2026-002" not in emp1_issue_ids  # Belonging to emp2

    # emp2 requesting
    app.dependency_overrides[get_current_user] = lambda: emp2
    client2 = TestClient(app)
    res2 = client2.get("/api/consumables/my")
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["total"] == 1
    assert data2["items"][0]["id"] == "ISS-2026-002"
    assert data2["items"][0]["relatedRequestId"] == "REQ-2026-0006"
    assert data2["allTimeTotalUnits"] == 5
    assert "ISS-2026-001" not in [item["id"] for item in data2["items"]]


def test_email_matching_is_case_insensitive():
    app, emp1, _emp2, _empty, _admin = make_test_environment()
    # In fixture, REQ-2026-0003 was seeded with uppercase email "M.VANCE@COMPANY.COM"
    # while emp1 has lowercase email "m.vance@company.com"
    app.dependency_overrides[get_current_user] = lambda: emp1
    client = TestClient(app)

    response = client.get("/api/consumables/my")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 2
    assert any(item["relatedRequestId"] == "REQ-2026-0003" for item in data["items"])


def test_missing_or_invalid_request_references_handled_safely():
    app, emp1, emp2, _empty, _admin = make_test_environment()
    app.dependency_overrides[get_current_user] = lambda: emp1
    client = TestClient(app)

    response = client.get("/api/consumables/my")
    assert response.status_code == 200
    data = response.json()

    # Issues with request_reference=None (ISS-2026-003) or nonexistent (ISS-2026-004)
    # must never be returned to an employee
    returned_ids = [item["id"] for item in data["items"]]
    assert "ISS-2026-003" not in returned_ids
    assert "ISS-2026-004" not in returned_ids


def test_consumption_filters_and_pagination():
    app, emp1, _emp2, _empty, _admin = make_test_environment()
    app.dependency_overrides[get_current_user] = lambda: emp1
    client = TestClient(app)

    # 1. time_filter = "month"
    res_month = client.get("/api/consumables/my?time_filter=month")
    assert res_month.status_code == 200
    data_month = res_month.json()
    assert data_month["total"] == 1
    assert data_month["items"][0]["id"] == "ISS-2026-001"
    assert data_month["summary"]["period"] == "This Month"
    assert data_month["summary"]["totalIssued"] == 4

    # 2. time_filter = "all"
    res_all = client.get("/api/consumables/my?time_filter=all")
    assert res_all.status_code == 200
    data_all = res_all.json()
    assert data_all["total"] == 2
    assert data_all["summary"]["period"] == "All Time"

    # 3. category filter
    res_cat = client.get("/api/consumables/my?category=cables")
    assert res_cat.status_code == 200
    data_cat = res_cat.json()
    assert data_cat["total"] == 1
    assert data_cat["items"][0]["categoryKey"] == "cables"

    # 4. search filter
    res_search = client.get("/api/consumables/my?search=DisplayPort")
    assert res_search.status_code == 200
    data_search = res_search.json()
    assert data_search["total"] == 1
    assert "DisplayPort" in data_search["items"][0]["itemName"]

    # 5. pagination
    res_page = client.get("/api/consumables/my?page=1&page_size=1")
    assert res_page.status_code == 200
    data_page = res_page.json()
    assert len(data_page["items"]) == 1
    assert data_page["total"] == 2
    assert data_page["total_pages"] == 2
    assert data_page["page"] == 1


def test_unauthenticated_consumption_rejected():
    app, _emp1, _emp2, _empty, _admin = make_test_environment()
    # No dependency override for get_current_user
    client = TestClient(app)

    response = client.get("/api/consumables/my")
    assert response.status_code == 401


# =====================================================================
# Employee Dashboard Tests
# =====================================================================

def test_employee_receives_correct_assigned_asset_count():
    app, emp1, _emp2, _empty, _admin = make_test_environment()
    app.dependency_overrides[get_current_user] = lambda: emp1
    client = TestClient(app)

    response = client.get("/api/dashboard/employee")
    assert response.status_code == 200
    data = response.json()

    # emp1 matches AST-001 (Marcus Vance) and AST-002 (EMP-4092)
    assert data["assignedAssetsCount"] == 2
    assert data["assigned_assets_count"] == 2
    assert data["assetsInMaintenanceCount"] == 1
    assert len(data["assignedAssets"]) == 2

    asset_ids = [a["asset_id"] for a in data["assignedAssets"]]
    assert "AST-001" in asset_ids
    assert "AST-002" in asset_ids


def test_employee_receives_correct_request_statistics():
    app, emp1, _emp2, _empty, _admin = make_test_environment()
    app.dependency_overrides[get_current_user] = lambda: emp1
    client = TestClient(app)

    response = client.get("/api/dashboard/employee")
    assert response.status_code == 200
    data = response.json()

    # emp1:
    # REQ-001: Pending
    # REQ-002: In Review
    # REQ-003: Fulfilled
    # REQ-004: Rejected
    assert data["openRequests"] == 2
    assert data["open_requests"] == 2
    assert data["awaitingApproval"] == 1
    assert data["awaiting_approval"] == 1
    assert data["summary"]["closedRequests"] == 2
    assert data["summary"]["totalRequests"] == 4


def test_employee_receives_only_own_recent_activity():
    app, emp1, _emp2, _empty, _admin = make_test_environment()
    app.dependency_overrides[get_current_user] = lambda: emp1
    client = TestClient(app)

    response = client.get("/api/dashboard/employee")
    assert response.status_code == 200
    data = response.json()

    # Recent requests must contain only emp1 requests
    recent_req_ids = [r["request_id"] for r in data["recentRequests"]]
    assert len(recent_req_ids) == 4
    assert "REQ-2026-0001" in recent_req_ids
    assert "REQ-2026-0002" in recent_req_ids
    assert "REQ-2026-0003" in recent_req_ids
    assert "REQ-2026-0004" in recent_req_ids
    assert "REQ-2026-0005" not in recent_req_ids  # emp2

    # Consumables received this month for emp1 is 4 units (ISS-2026-001)
    assert data["consumablesReceived"] == 4
    assert data["consumables_received"] == 4

    # Preview recent consumable issues
    recent_iss_ids = [i["id"] for i in data["recentConsumableIssues"]]
    assert "ISS-2026-001" in recent_iss_ids
    assert "ISS-2026-002" not in recent_iss_ids  # emp2


def test_empty_data_cases_return_valid_responses():
    app, _emp1, _emp2, emp_empty, _admin = make_test_environment()
    app.dependency_overrides[get_current_user] = lambda: emp_empty
    client = TestClient(app)

    response = client.get("/api/dashboard/employee")
    assert response.status_code == 200
    data = response.json()

    assert data["openRequests"] == 0
    assert data["awaitingApproval"] == 0
    assert data["assignedAssetsCount"] == 0
    assert data["consumablesReceived"] == 0
    assert data["recentRequests"] == []
    assert data["assignedAssets"] == []
    assert data["recentConsumableIssues"] == []
    assert data["consumptionSummary"]["totalIssued"] == 0
    assert data["consumptionSummary"]["categories"] == []


def test_another_employee_data_never_included():
    app, _emp1, emp2, _empty, _admin = make_test_environment()
    app.dependency_overrides[get_current_user] = lambda: emp2
    client = TestClient(app)

    response = client.get("/api/dashboard/employee")
    assert response.status_code == 200
    data = response.json()

    # emp2 has AST-003 assigned
    assert data["assignedAssetsCount"] == 1
    assert data["assignedAssets"][0]["asset_id"] == "AST-003"

    # emp2 requests: REQ-005 (Pending), REQ-006 (Fulfilled)
    assert data["openRequests"] == 1
    assert data["awaitingApproval"] == 1
    assert data["summary"]["totalRequests"] == 2

    # emp2 consumables this month: 5 units
    assert data["consumablesReceived"] == 5


def test_unauthenticated_dashboard_rejected():
    app, _emp1, _emp2, _empty, _admin = make_test_environment()
    client = TestClient(app)

    response = client.get("/api/dashboard/employee")
    assert response.status_code == 401
