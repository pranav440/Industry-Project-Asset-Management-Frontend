import io
from datetime import date, datetime
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
    User,
    UserRole,
)
from app.routers.assets import router


def make_test_environment():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    session_factory = sessionmaker(bind=engine, expire_on_commit=False)
    Base.metadata.create_all(engine)

    app = FastAPI()
    app.include_router(router)

    def db_override():
        with session_factory() as db:
            yield db

    employee1 = User(
        id=10,
        full_name="Marcus Vance",
        email="m.vance@company.com",
        employee_id="EMP-4092",
        role=UserRole.employee,
        password_hash="x",
        is_active=True,
    )
    employee2 = User(
        id=11,
        full_name="Sarah Jenkins",
        email="s.jenkins@company.com",
        employee_id="EMP-1002",
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

    with session_factory() as db:
        db.add_all([employee1, employee2, admin])
        db.commit()

        # Seed test assets with varied custodians
        assets = [
            # 1. Assigned by full name
            Asset(
                asset_id="AST-TEST-0001",
                name="MacBook Pro 16",
                category="Compute & Laptops",
                specification="M3 Max, 36GB RAM",
                serial_number="C02G901QMD6T",
                location="HQ Floor 4",
                custodian="Marcus Vance",
                purchase_date=datetime(2026, 1, 10),
                vendor_name="Apple",
                total_cost="349900",
                warranty_period="3 Years",
                allocation_date=datetime(2026, 1, 12),
                status=AssetStatus.active,
                qr_code_value="assetmx:AST-TEST-0001",
                qr_code_data_url="data:image/png;base64,placeholder",
            ),
            # 2. Assigned by employee ID
            Asset(
                asset_id="AST-TEST-0002",
                name="Dell UltraSharp 32 4K Monitor",
                category="Displays & Mounts",
                specification="32 inch 4K USB-C Hub",
                serial_number="CN-0F349-74261",
                location="HQ Floor 4 Desk B-412",
                custodian="EMP-4092",
                purchase_date=datetime(2026, 2, 1),
                vendor_name="Dell",
                total_cost="89000",
                warranty_period="3 Years",
                allocation_date=datetime(2026, 2, 5),
                status=AssetStatus.in_maintenance,
                qr_code_value="assetmx:AST-TEST-0002",
                qr_code_data_url="data:image/png;base64,placeholder",
            ),
            # 3. Case-insensitive and whitespace-tolerant custodian with combined format
            Asset(
                asset_id="AST-TEST-0003",
                name="Logitech MX Master 3S Mouse",
                category="Peripherals & Audio",
                specification="Ergonomic Bluetooth Mouse",
                serial_number="SN-LOGI-8812",
                location="HQ Floor 4",
                custodian="  marcus vance (emp-4092)  ",
                purchase_date=datetime(2026, 2, 10),
                vendor_name="Logitech",
                total_cost="9500",
                warranty_period="1 Year",
                allocation_date=datetime(2026, 2, 12),
                status=AssetStatus.in_transit,
                qr_code_value="assetmx:AST-TEST-0003",
                qr_code_data_url="data:image/png;base64,placeholder",
            ),
            # 4. Assigned to another employee (Sarah Jenkins)
            Asset(
                asset_id="AST-TEST-0004",
                name="Dell Latitude Laptop",
                category="Compute & Laptops",
                specification="Core i7, 16GB RAM",
                serial_number="DL-99124-LAT",
                location="Building C Floor 2",
                custodian="Sarah Jenkins",
                purchase_date=datetime(2026, 1, 15),
                vendor_name="Dell",
                total_cost="75000",
                warranty_period="3 Years",
                status=AssetStatus.active,
                qr_code_value="assetmx:AST-TEST-0004",
                qr_code_data_url="data:image/png;base64,placeholder",
            ),
            # 5. Unassigned asset
            Asset(
                asset_id="AST-TEST-0005",
                name="Spares Inventory ThinkPad",
                category="Compute & Laptops",
                specification="Core i5",
                serial_number="TP-SPARE-001",
                location="IT Storage B-102",
                custodian="Unassigned",
                purchase_date=datetime(2026, 3, 1),
                vendor_name="Lenovo",
                total_cost="65000",
                warranty_period="1 Year",
                status=AssetStatus.active,
                qr_code_value="assetmx:AST-TEST-0005",
                qr_code_data_url="data:image/png;base64,placeholder",
            ),
            # 6. General departmental custodian
            Asset(
                asset_id="AST-TEST-0006",
                name="Conference Room Projector",
                category="Displays & AV",
                specification="Laser 4K Projector",
                serial_number="PRJ-CONF-992",
                location="Conference Room A",
                custodian="Operations",
                purchase_date=datetime(2026, 1, 5),
                vendor_name="Epson",
                total_cost="120000",
                warranty_period="2 Years",
                status=AssetStatus.active,
                qr_code_value="assetmx:AST-TEST-0006",
                qr_code_data_url="data:image/png;base64,placeholder",
            ),
        ]
        db.add_all(assets)
        db.commit()

        # Add movement for AST-TEST-0001
        m1 = AssetMovement(
            asset_id=assets[0].id,
            movement_id="TRF-TEST-0001",
            from_location="IT Storage",
            to_location="HQ Floor 4",
            from_custodian="IT Operations",
            to_custodian="Marcus Vance",
            reason="Workstation setup",
            status=AssetMovementStatus.completed,
            initiated_by_user_id=admin.id,
        )
        db.add(m1)
        db.commit()

    app.dependency_overrides[get_db] = db_override
    app.dependency_overrides[get_current_user] = lambda: employee1
    client = TestClient(app)

    return client, session_factory, employee1, employee2, admin


# 1. Employee can retrieve their assigned assets by full name
def test_employee_can_retrieve_assigned_assets_by_full_name():
    client, _, employee1, _, _ = make_test_environment()

    res = client.get("/api/assets/my")
    assert res.status_code == 200, res.text
    data = res.json()
    item_ids = [item["asset_id"] for item in data["items"]]

    # AST-TEST-0001 has custodian="Marcus Vance"
    assert "AST-TEST-0001" in item_ids
    asset1 = next(item for item in data["items"] if item["asset_id"] == "AST-TEST-0001")
    assert asset1["name"] == "MacBook Pro 16"
    assert asset1["id"] == "AST-TEST-0001"
    assert asset1["custodian"] == "Marcus Vance"
    assert len(asset1["movement_history"]) >= 1


# 2. Employee can retrieve their assigned assets by employee ID
def test_employee_can_retrieve_assigned_assets_by_employee_id():
    client, _, employee1, _, _ = make_test_environment()

    res = client.get("/api/assets/my")
    assert res.status_code == 200, res.text
    data = res.json()
    item_ids = [item["asset_id"] for item in data["items"]]

    # AST-TEST-0002 has custodian="EMP-4092"
    assert "AST-TEST-0002" in item_ids
    asset2 = next(item for item in data["items"] if item["asset_id"] == "AST-TEST-0002")
    assert asset2["name"] == "Dell UltraSharp 32 4K Monitor"
    assert asset2["status"] == "In Maintenance"


# 3. Custodian matching is case-insensitive and whitespace-tolerant
def test_custodian_matching_case_insensitive_and_whitespace_tolerant():
    client, _, employee1, _, _ = make_test_environment()

    res = client.get("/api/assets/my")
    assert res.status_code == 200, res.text
    data = res.json()
    item_ids = [item["asset_id"] for item in data["items"]]

    # AST-TEST-0003 has custodian="  marcus vance (emp-4092)  "
    assert "AST-TEST-0003" in item_ids
    asset3 = next(item for item in data["items"] if item["asset_id"] == "AST-TEST-0003")
    assert asset3["name"] == "Logitech MX Master 3S Mouse"
    assert asset3["status"] == "In Transit"


# 4. Unassigned assets are not returned
def test_unassigned_and_other_employee_assets_not_returned():
    client, _, employee1, _, _ = make_test_environment()

    res = client.get("/api/assets/my")
    assert res.status_code == 200, res.text
    data = res.json()
    item_ids = [item["asset_id"] for item in data["items"]]

    # Marcus should only have 3 assets (AST-TEST-0001, 0002, 0003)
    assert len(item_ids) == 3
    assert "AST-TEST-0004" not in item_ids  # Sarah Jenkins
    assert "AST-TEST-0005" not in item_ids  # Unassigned
    assert "AST-TEST-0006" not in item_ids  # Operations


# 5. Category and status filters work
def test_category_and_status_filters():
    client, _, employee1, _, _ = make_test_environment()

    # Category: compute
    res_compute = client.get("/api/assets/my?category=compute")
    assert res_compute.status_code == 200
    compute_ids = [item["asset_id"] for item in res_compute.json()["items"]]
    assert "AST-TEST-0001" in compute_ids
    assert "AST-TEST-0002" not in compute_ids

    # Category: displays
    res_displays = client.get("/api/assets/my?category=displays")
    assert res_displays.status_code == 200
    display_ids = [item["asset_id"] for item in res_displays.json()["items"]]
    assert "AST-TEST-0002" in display_ids
    assert "AST-TEST-0001" not in display_ids

    # Status: active
    res_active = client.get("/api/assets/my?status=active")
    assert res_active.status_code == 200
    active_ids = [item["asset_id"] for item in res_active.json()["items"]]
    assert "AST-TEST-0001" in active_ids
    assert "AST-TEST-0002" not in active_ids

    # Status: maintenance
    res_maint = client.get("/api/assets/my?status=maintenance")
    assert res_maint.status_code == 200
    maint_ids = [item["asset_id"] for item in res_maint.json()["items"]]
    assert "AST-TEST-0002" in maint_ids
    assert "AST-TEST-0001" not in maint_ids

    # Status: transit
    res_transit = client.get("/api/assets/my?status=transit")
    assert res_transit.status_code == 200
    transit_ids = [item["asset_id"] for item in res_transit.json()["items"]]
    assert "AST-TEST-0003" in transit_ids

    # Search filter
    res_search = client.get("/api/assets/my?search=Logitech")
    assert res_search.status_code == 200
    search_ids = [item["asset_id"] for item in res_search.json()["items"]]
    assert search_ids == ["AST-TEST-0003"]


# 6. Employee can access their own asset details
def test_employee_can_access_own_asset_details():
    client, _, employee1, _, _ = make_test_environment()

    # Marcus accessing AST-TEST-0001
    res = client.get("/api/assets/AST-TEST-0001")
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["asset_id"] == "AST-TEST-0001"
    assert data["name"] == "MacBook Pro 16"
    assert data["custodian"] == "Marcus Vance"
    assert data["total_cost"] == "349900"
    assert data["warranty_period"] == "3 Years"
    assert len(data["movement_history"]) == 1
    assert data["movement_history"][0]["movement_id"] == "TRF-TEST-0001"


# 7. Employee cannot access another employee's asset details
def test_employee_cannot_access_another_employees_asset_details():
    client, _, employee1, employee2, _ = make_test_environment()

    # Marcus attempting to access Sarah's asset -> 403 Forbidden
    res_sarah = client.get("/api/assets/AST-TEST-0004")
    assert res_sarah.status_code == 403
    assert "Access denied" in res_sarah.json()["detail"]

    # Marcus attempting to access unassigned asset -> 403 Forbidden
    res_unassigned = client.get("/api/assets/AST-TEST-0005")
    assert res_unassigned.status_code == 403

    # Marcus attempting to access non-existent asset -> 404 Not Found
    res_missing = client.get("/api/assets/AST-DOES-NOT-EXIST")
    assert res_missing.status_code == 404


# 8. Unauthenticated access is rejected
def test_unauthenticated_access_is_rejected():
    client, _, _, _, _ = make_test_environment()
    client.app.dependency_overrides.pop(get_current_user)

    # Unauthenticated /my
    res_my = client.get("/api/assets/my")
    assert res_my.status_code == 401

    # Unauthenticated detail
    res_detail = client.get("/api/assets/AST-TEST-0001")
    assert res_detail.status_code == 401


# 9. Existing admin asset listing and detail access remain intact
def test_admin_asset_listing_and_detail_access_intact():
    client, _, employee1, _, admin = make_test_environment()

    # Switch to admin
    client.app.dependency_overrides[get_current_user] = lambda: admin

    # Admin list all assets (sees all 6 assets)
    res_all = client.get("/api/assets")
    assert res_all.status_code == 200
    all_data = res_all.json()
    assert all_data["total"] == 6

    # Admin can access Marcus's asset
    res_m = client.get("/api/assets/AST-TEST-0001")
    assert res_m.status_code == 200

    # Admin can access Sarah's asset
    res_s = client.get("/api/assets/AST-TEST-0004")
    assert res_s.status_code == 200

    # Admin can access unassigned asset
    res_u = client.get("/api/assets/AST-TEST-0005")
    assert res_u.status_code == 200

    # Employee cannot access general admin listing (/api/assets)
    client.app.dependency_overrides[get_current_user] = lambda: employee1
    emp_res = client.get("/api/assets")
    assert emp_res.status_code == 403
