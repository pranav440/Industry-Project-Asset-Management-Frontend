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
    AssetMovement,
    AssetMovementStatus,
    AssetStatus,
    Maintenance,
    MaintenanceType,
    Request,
    RequestHistory,
    RequestPriority,
    RequestStatus,
    RequestType,
    User,
    UserRole,
)
from app.routers import reports


def make_client(*, raise_server_exceptions: bool = True):
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    session_factory = sessionmaker(bind=engine)
    Base.metadata.create_all(engine)
    app = FastAPI()
    app.include_router(reports.router)

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


def seed_reports_data(session_factory):
    with session_factory() as db:
        db.add_all([
            Asset(
                asset_id="AST-001",
                name="Laptop A",
                status=AssetStatus.active,
                category="Hardware",
                specification="Laptop",
                serial_number="SN-1",
                location="HQ",
                custodian="IT",
                purchase_date=datetime(2024, 1, 15),
                vendor_name="Vendor A",
                total_cost="120000",
                warranty_period="24 months",
                invoice_reference="INV-1",
                depreciation="10%",
                allocation_date=None,
                documents=None,
                qr_code_value="assetmx:1",
                qr_code_data_url="data:image/png;base64,abc",
            ),
            Asset(
                asset_id="AST-002",
                name="Laptop B",
                status=AssetStatus.in_maintenance,
                category="Hardware",
                specification="Laptop",
                serial_number="SN-2",
                location="HQ",
                custodian="Operations",
                purchase_date=datetime(2023, 8, 10),
                vendor_name="Vendor B",
                total_cost="140000",
                warranty_period="18 months",
                invoice_reference="INV-2",
                depreciation="12%",
                allocation_date=None,
                documents=None,
                qr_code_value="assetmx:2",
                qr_code_data_url="data:image/png;base64,def",
            ),
            Asset(
                asset_id="AST-003",
                name="Desk C",
                status=AssetStatus.disposed,
                category="Furniture",
                specification="Desk",
                serial_number="SN-3",
                location="Warehouse",
                custodian="Facilities",
                purchase_date=datetime(2020, 3, 1),
                vendor_name="Vendor C",
                total_cost="50000",
                warranty_period="12 months",
                invoice_reference="INV-3",
                depreciation="15%",
                allocation_date=None,
                documents=None,
                qr_code_value="assetmx:3",
                qr_code_data_url="data:image/png;base64,ghi",
            ),
            Maintenance(
                maintenance_id="MNT-001",
                asset_id=1,
                service_date=datetime(2026, 9, 10, 9, 30),
                maintenance_type=MaintenanceType.preventive,
                service_vendor="Dell Care",
                technician="Ramesh",
                maintenance_cost=2500.00,
                status="Completed",
                service_notes="Routine check",
                created_by_user_id=1,
            ),
            Maintenance(
                maintenance_id="MNT-002",
                asset_id=2,
                service_date=datetime(2026, 9, 12, 11, 0),
                maintenance_type=MaintenanceType.corrective,
                service_vendor="HP Care",
                technician="Neha",
                maintenance_cost=1500.00,
                status="Completed",
                service_notes="Battery replacement",
                created_by_user_id=1,
            ),
            Request(
                request_id="REQ-2026-001",
                requester_name="Jane Doe",
                requester_email="jane@example.com",
                department="Operations",
                request_type=RequestType.asset_request,
                requested_item="Laptop",
                category="Hardware",
                quantity=1,
                priority=RequestPriority.high,
                request_date=date(2026, 9, 11),
                status=RequestStatus.pending,
                justification="Need a laptop",
                processing_guidelines="Review by IT",
            ),
            Request(
                request_id="REQ-2026-002",
                requester_name="John Smith",
                requester_email="john@example.com",
                department="Finance",
                request_type=RequestType.consumable_request,
                requested_item="A4 Paper",
                category="Office",
                quantity=5,
                priority=RequestPriority.medium,
                request_date=date(2026, 9, 12),
                status=RequestStatus.in_review,
                justification="Paper stock low",
                processing_guidelines="Check stock",
            ),
            Request(
                request_id="REQ-2026-003",
                requester_name="Alice Lee",
                requester_email="alice@example.com",
                department="Operations",
                request_type=RequestType.asset_request,
                requested_item="Monitor",
                category="Hardware",
                quantity=1,
                priority=RequestPriority.low,
                request_date=date(2026, 8, 1),
                status=RequestStatus.fulfilled,
                justification="Monitor needed",
                processing_guidelines="Approved",
            ),
            Request(
                request_id="REQ-2026-004",
                requester_name="Bob Jones",
                requester_email="bob@example.com",
                department="IT",
                request_type=RequestType.consumable_request,
                requested_item="Printer Ink",
                category="Office",
                quantity=2,
                priority=RequestPriority.high,
                request_date=date(2026, 9, 13),
                status=RequestStatus.rejected,
                justification="Not approved",
                processing_guidelines="Reassess",
            ),
            AssetMovement(
                asset_id=1,
                movement_id="MOV-001",
                from_location="Warehouse",
                to_location="HQ",
                from_custodian="Warehouse",
                to_custodian="IT",
                reason="Department allocation",
                status=AssetMovementStatus.in_transit,
                initiated_by_user_id=1,
                initiated_at=datetime(2026, 9, 8, 8, 0),
                completed_at=None,
            ),
            AssetMovement(
                asset_id=2,
                movement_id="MOV-002",
                from_location="HQ",
                to_location="Lab",
                from_custodian="Operations",
                to_custodian="Lab Team",
                reason="Maintenance handoff",
                status=AssetMovementStatus.completed,
                initiated_by_user_id=1,
                initiated_at=datetime(2026, 9, 9, 9, 0),
                completed_at=datetime(2026, 9, 10, 10, 0),
            ),
        ])
        db.flush()
        db.add_all([
            RequestHistory(
                history_id="RH-001",
                request_id="REQ-2026-001",
                timestamp=datetime(2026, 9, 11, 9, 0),
                stage=RequestStatus.pending.value,
                action="Status Updated",
                performed_by="Admin User",
                note="Submitted",
            ),
            RequestHistory(
                history_id="RH-002",
                request_id="REQ-2026-002",
                timestamp=datetime(2026, 9, 12, 10, 0),
                stage=RequestStatus.in_review.value,
                action="Status Updated",
                performed_by="Admin User",
                note="Under review",
            ),
            RequestHistory(
                history_id="RH-003",
                request_id="REQ-2026-003",
                timestamp=datetime(2026, 8, 2, 10, 0),
                stage=RequestStatus.fulfilled.value,
                action="Status Updated",
                performed_by="Admin User",
                note="Completed",
            ),
        ])
        db.commit()


def test_reports_requires_admin_auth():
    client, _, _, employee = make_client()
    client.app.dependency_overrides.pop(get_current_user)
    assert client.get("/api/reports/admin").status_code == 401

    client.app.dependency_overrides[get_current_user] = lambda: employee
    assert client.get("/api/reports/admin").status_code == 403


def test_reports_returns_admin_dashboard_contract():
    client, session_factory, _, _ = make_client()
    seed_reports_data(session_factory)

    response = client.get("/api/reports/admin")
    assert response.status_code == 200, response.text
    payload = response.json()

    assert "overview" in payload
    assert payload["overview"]["total_assets"] == 3
    assert payload["overview"]["assets_in_use"] == 1
    assert payload["overview"]["open_requests"] == 2
    assert payload["overview"]["maintenance_cost"] == 4000.0

    assert payload["asset_utilization"]["status_counts"]["Active"] == 1
    assert payload["asset_utilization"]["status_counts"]["In Maintenance"] == 1
    assert payload["asset_utilization"]["status_counts"]["Disposed"] == 1

    assert payload["requests"]["status_counts"]["Pending"] == 1
    assert payload["requests"]["status_counts"]["In Review"] == 1
    assert payload["requests"]["status_counts"]["Fulfilled"] == 1
    assert payload["requests"]["status_counts"]["Rejected"] == 1

    assert payload["reassignment"]["total_movements"] == 2
    assert payload["reassignment"]["records"][0]["movement_id"] == "MOV-001"

    assert payload["maintenance_vs_asset_value"]["total_maintenance_cost"] == 4000.0
    assert payload["maintenance_vs_asset_value"]["total_asset_value"] == 310000.0
    assert len(payload["maintenance_vs_asset_value"]["maintenance_details"]) == 2
    assert payload["maintenance_vs_asset_value"]["maintenance_details"][0]["asset_name"] in {"Laptop A", "Laptop B"}
    assert payload["maintenance_vs_asset_value"]["maintenance_details"][0]["maintenance_status"] == "Completed"

    assert payload["lifecycle"]["status_distribution"]["Disposed"] == 1
    assert payload["lifecycle"]["forecast"] is None
    assert payload["unsupported"]["monthly_spend"] is None
    assert payload["unsupported"]["budget_utilized"] is None
    assert payload["unsupported"]["department_consumption"] is None
    assert payload["unsupported"]["recent_purchase_orders"] is None
    assert payload["unsupported"]["procurement_registry"] is None
    assert payload["unsupported"]["wastage"] is None


def test_reports_applies_filters_and_handles_empty_results():
    client, session_factory, _, _ = make_client()
    seed_reports_data(session_factory)

    response = client.get(
        "/api/reports/admin",
        params={
            "date_from": "2026-09-11",
            "date_to": "2026-09-13",
            "location": "HQ",
            "category": "Hardware",
            "department": "Operations",
        },
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["overview"]["total_assets"] == 2
    assert body["overview"]["open_requests"] == 1
    assert body["maintenance_vs_asset_value"]["total_maintenance_cost"] == 1500.0
    assert body["requests"]["department_counts"]["Operations"] == 1

    empty = client.get("/api/reports/admin", params={"category": "Unknown"})
    assert empty.status_code == 200
    empty_body = empty.json()
    assert empty_body["overview"]["total_assets"] == 0
    assert empty_body["requests"]["total_requests"] == 0
    assert empty_body["reassignment"]["total_movements"] == 0

    invalid = client.get("/api/reports/admin", params={"date_from": "not-a-date"})
    assert invalid.status_code == 422


def test_reports_empty_database_returns_zeroes_and_nulls():
    client, _, _, _ = make_client()
    response = client.get("/api/reports/admin")
    assert response.status_code == 200
    body = response.json()
    assert body["overview"]["total_assets"] == 0
    assert body["overview"]["assets_in_use"] == 0
    assert body["overview"]["open_requests"] == 0
    assert body["overview"]["maintenance_cost"] == 0.0
    assert body["requests"]["total_requests"] == 0
    assert body["reassignment"]["total_movements"] == 0
    assert body["unsupported"]["monthly_spend"] is None
