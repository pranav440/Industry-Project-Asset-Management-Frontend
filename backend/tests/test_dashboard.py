from datetime import date, datetime, timedelta

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.deps import get_current_user
from app.models import (
    Asset,
    AssetStatus,
    Consumable,
    Request,
    RequestHistory,
    RequestPriority,
    RequestStatus,
    RequestType,
    User,
    UserRole,
)
from app.routers.dashboard import router


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


def seed_dashboard_data(session_factory):
    with session_factory() as db:
        db.add_all([
            Request(
                request_id="REQ-2026-0001",
                requester_name="Admin User",
                requester_email="admin@example.com",
                department="Operations",
                request_type=RequestType.asset_request,
                requested_item="Laptop",
                category="Hardware",
                quantity=2,
                priority=RequestPriority.high,
                request_date=date(2026, 9, 10),
                status=RequestStatus.pending,
                justification="Need laptop for onboarding.",
                processing_guidelines="Review and approve.",
            ),
            Request(
                request_id="REQ-2026-0002",
                requester_name="Admin User",
                requester_email="admin@example.com",
                department="IT",
                request_type=RequestType.consumable_request,
                requested_item="Paper",
                category="Office",
                quantity=10,
                priority=RequestPriority.medium,
                request_date=date(2026, 9, 11),
                status=RequestStatus.in_review,
                justification="Stationery demand.",
                processing_guidelines="Check inventory.",
            ),
            Request(
                request_id="REQ-2026-0003",
                requester_name="Other User",
                requester_email="other@example.com",
                department="Finance",
                request_type=RequestType.asset_request,
                requested_item="Monitor",
                category="Hardware",
                quantity=3,
                priority=RequestPriority.low,
                request_date=date(2026, 9, 12),
                status=RequestStatus.fulfilled,
                justification="Completed.",
                processing_guidelines="N/A",
            ),
            Request(
                request_id="REQ-2026-0004",
                requester_name="Other User",
                requester_email="other@example.com",
                department="Operations",
                request_type=RequestType.consumable_request,
                requested_item="Ink",
                category="Office",
                quantity=1,
                priority=RequestPriority.low,
                request_date=date(2026, 9, 13),
                status=RequestStatus.rejected,
                justification="Rejected.",
                processing_guidelines="N/A",
            ),
            Asset(
                asset_id="AST-0001",
                name="Laptop A",
                status=AssetStatus.active,
                category="Hardware",
                specification="Laptop",
                serial_number="SN-1",
                location="HQ",
                custodian="IT",
                purchase_date=datetime(2026, 1, 10),
                vendor_name="Vendor 1",
                total_cost="1000",
                warranty_period="12 months",
                invoice_reference=None,
                depreciation=None,
                allocation_date=None,
                documents=None,
                qr_code_value="assetmx:1",
                qr_code_data_url="data:image/png;base64,abc",
            ),
            Asset(
                asset_id="AST-0002",
                name="Laptop B",
                status=AssetStatus.in_maintenance,
                category="Hardware",
                specification="Laptop",
                serial_number="SN-2",
                location="HQ",
                custodian="IT",
                purchase_date=datetime(2026, 1, 12),
                vendor_name="Vendor 2",
                total_cost="1200",
                warranty_period="12 months",
                invoice_reference=None,
                depreciation=None,
                allocation_date=None,
                documents=None,
                qr_code_value="assetmx:2",
                qr_code_data_url="data:image/png;base64,def",
            ),
            Asset(
                asset_id="AST-0003",
                name="Laptop C",
                status=AssetStatus.in_transit,
                category="Hardware",
                specification="Laptop",
                serial_number="SN-3",
                location="HQ",
                custodian="Ops",
                purchase_date=datetime(2026, 2, 10),
                vendor_name="Vendor 3",
                total_cost="1300",
                warranty_period="12 months",
                invoice_reference=None,
                depreciation=None,
                allocation_date=None,
                documents=None,
                qr_code_value="assetmx:3",
                qr_code_data_url="data:image/png;base64,ghi",
            ),
            Consumable(
                consumable_id="CON-0001",
                name="Ink Cartridge",
                category="Office",
                batch_id="B1",
                location="HQ",
                available_stock=0,
                threshold=5,
                batch_quantity=10,
                expiry_date=date.today() - timedelta(days=1),
            ),
            Consumable(
                consumable_id="CON-0002",
                name="Paper Ream",
                category="Office",
                batch_id="B2",
                location="HQ",
                available_stock=3,
                threshold=5,
                batch_quantity=20,
                expiry_date=date.today() + timedelta(days=10),
            ),
            Consumable(
                consumable_id="CON-0003",
                name="Batteries",
                category="IT",
                batch_id="B3",
                location="HQ",
                available_stock=60,
                threshold=10,
                batch_quantity=60,
                expiry_date=date.today() + timedelta(days=60),
            ),
            Consumable(
                consumable_id="CON-0004",
                name="Mouse Pad",
                category="IT",
                batch_id="B4",
                location="HQ",
                available_stock=5,
                threshold=5,
                batch_quantity=20,
                expiry_date=None,
            ),
        ])
        db.flush()
        db.add_all([
            RequestHistory(
                history_id="RH-0001",
                request_id="REQ-2026-0001",
                timestamp=datetime(2026, 9, 10, 9, 0),
                stage=RequestStatus.pending.value,
                action="Status Updated",
                performed_by="Admin User",
                note="Initial submission.",
            ),
            RequestHistory(
                history_id="RH-0002",
                request_id="REQ-2026-0001",
                timestamp=datetime(2026, 9, 11, 9, 0),
                stage=RequestStatus.in_review.value,
                action="Status Updated",
                performed_by="Admin User",
                note="Review started.",
            ),
            RequestHistory(
                history_id="RH-0003",
                request_id="REQ-2026-0002",
                timestamp=datetime(2026, 9, 12, 9, 0),
                stage=RequestStatus.in_review.value,
                action="Status Updated",
                performed_by="Admin User",
                note="Under review.",
            ),
            RequestHistory(
                history_id="RH-0004",
                request_id="REQ-2026-0003",
                timestamp=datetime(2026, 9, 12, 10, 0),
                stage=RequestStatus.fulfilled.value,
                action="Status Updated",
                performed_by="Other User",
                note="Completed.",
            ),
        ])
        db.commit()


def test_dashboard_auth_and_metrics():
    client, session_factory, _, employee = make_client()
    seed_dashboard_data(session_factory)

    client.app.dependency_overrides.pop(get_current_user)
    assert client.get("/api/dashboard/admin").status_code == 401

    client.app.dependency_overrides[get_current_user] = lambda: employee
    assert client.get("/api/dashboard/admin").status_code == 403

    client.app.dependency_overrides[get_current_user] = lambda: User(
        id=1,
        full_name="Admin User",
        email="admin@example.com",
        employee_id="ADM001",
        role=UserRole.admin,
        password_hash="x",
    )
    response = client.get("/api/dashboard/admin")
    assert response.status_code == 200, response.text
    body = response.json()

    assert body["summary"]["open_requests"] == 2
    assert body["summary"]["pending_approvals"] == 1
    assert body["summary"]["low_stock_alerts"] == 3
    assert body["summary"]["monthly_spend"] is None
    assert body["summary"]["budget_utilized"] is None

    assert body["asset_inventory"]["total_assets"] == 3
    assert body["asset_inventory"]["by_status"]["Active"] == 1
    assert body["asset_inventory"]["by_status"]["In Maintenance"] == 1
    assert body["asset_inventory"]["by_status"]["In Transit"] == 1
    assert body["asset_inventory"]["by_status"]["Disposed"] == 0

    assert len(body["my_requests"]) == 2
    assert {item["request_id"] for item in body["my_requests"]} == {"REQ-2026-0001", "REQ-2026-0002"}
    first = next(item for item in body["my_requests"] if item["request_id"] == "REQ-2026-0001")
    assert first["approval_date"] == "2026-09-11T09:00:00"
    assert first["fulfillment_date"] is None

    assert body["department_consumption"] is None
    assert body["recent_pos"] is None


def test_dashboard_expiry_and_stock_levels():
    client, session_factory, _, _ = make_client()
    with session_factory() as db:
        db.add_all([
            Consumable(
                consumable_id="CON-EXP-1",
                name="Expired Ink",
                category="Office",
                batch_id="B1",
                location="HQ",
                available_stock=2,
                threshold=10,
                batch_quantity=10,
                expiry_date=date.today() - timedelta(days=2),
            ),
            Consumable(
                consumable_id="CON-EXP-2",
                name="Today Ink",
                category="Office",
                batch_id="B2",
                location="HQ",
                available_stock=1,
                threshold=10,
                batch_quantity=10,
                expiry_date=date.today(),
            ),
            Consumable(
                consumable_id="CON-EXP-3",
                name="Soon Ink",
                category="Office",
                batch_id="B3",
                location="HQ",
                available_stock=1,
                threshold=10,
                batch_quantity=10,
                expiry_date=date.today() + timedelta(days=15),
            ),
            Consumable(
                consumable_id="CON-EXP-4",
                name="Far Future Ink",
                category="Office",
                batch_id="B4",
                location="HQ",
                available_stock=1,
                threshold=10,
                batch_quantity=10,
                expiry_date=date.today() + timedelta(days=60),
            ),
            Consumable(
                consumable_id="CON-EXP-5",
                name="No Expiry",
                category="Office",
                batch_id="B5",
                location="HQ",
                available_stock=1,
                threshold=10,
                batch_quantity=10,
                expiry_date=None,
            ),
        ])
        db.commit()

    response = client.get("/api/dashboard/admin")
    assert response.status_code == 200, response.text
    body = response.json()
    alerts = body["expiry_alerts"]
    assert [item["item_id"] for item in alerts] == ["CON-EXP-1", "CON-EXP-2", "CON-EXP-3"]
    assert alerts[0]["severity"] == "urgent"
    assert alerts[1]["severity"] == "urgent"
    assert alerts[2]["severity"] == "upcoming"

    stock = body["stock_levels"]
    office = next(item for item in stock if item["category"] == "Office")
    assert office["available_stock"] == 5
    assert office["threshold"] == 40
    assert office["status"] == "Low Stock"

    assert body["summary"]["low_stock_alerts"] == 5


def test_dashboard_empty_database():
    client, _, _, _ = make_client()
    response = client.get("/api/dashboard/admin")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["summary"]["open_requests"] == 0
    assert body["summary"]["pending_approvals"] == 0
    assert body["summary"]["low_stock_alerts"] == 0
    assert body["summary"]["monthly_spend"] is None
    assert body["summary"]["budget_utilized"] is None
    assert body["my_requests"] == []
    assert body["asset_inventory"]["total_assets"] == 0
    assert body["asset_inventory"]["by_status"] == {"Active": 0, "In Maintenance": 0, "In Transit": 0, "Disposed": 0}
    assert body["expiry_alerts"] == []
    assert body["stock_levels"] == []
    assert body["department_consumption"] is None
    assert body["recent_pos"] is None
