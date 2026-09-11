from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.deps import get_current_user
from app.models import Asset, User, UserRole
from app.routers.assets import router
from app.seed import DEMO_ASSETS, seed_demo_assets


def make_client() -> tuple[TestClient, sessionmaker, object, object]:
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

    admin = User(id=1, full_name="Admin", email="admin@example.com", employee_id="ADM001", role=UserRole.admin, password_hash="x")
    employee = User(id=2, full_name="Employee", email="employee@example.com", employee_id="EMP001", role=UserRole.employee, password_hash="x")
    app.dependency_overrides[get_db] = db_override
    app.dependency_overrides[get_current_user] = lambda: admin
    client = TestClient(app)
    return client, session_factory, admin, employee


def asset_payload(name: str = "Test Laptop", location: str = "HQ") -> dict[str, str]:
    return {
        "name": name,
        "category": "Hardware",
        "specification": "Laptop",
        "location": location,
        "custodian": "IT",
        "purchase_date": "2026-09-11",
        "vendor_name": "Vendor",
        "total_cost": "1000",
        "warranty_period": "3 Years",
    }


def test_admin_can_create_read_update_and_qr_is_persisted():
    client, _, _, _ = make_client()
    response = client.post("/api/assets", json=asset_payload())
    assert response.status_code == 201
    created = response.json()
    assert created["asset_id"].startswith("AST-")
    assert created["qr_code_value"].startswith("assetmx:")
    assert created["qr_code_data_url"].startswith("data:image/png;base64,")

    asset_id = created["asset_id"]
    assert client.get(f"/api/assets/{asset_id}").json()["qr_code_value"] == created["qr_code_value"]
    updated = client.put(f"/api/assets/{asset_id}", json={"status": "In Maintenance"})
    assert updated.status_code == 200
    assert updated.json()["status"] == "In Maintenance"


def test_auth_errors_and_invalid_asset_requests():
    client, _, _, employee = make_client()
    client.app.dependency_overrides.pop(get_current_user)
    assert client.get("/api/assets").status_code == 401
    client.app.dependency_overrides[get_current_user] = lambda: employee
    assert client.get("/api/assets").status_code == 403
    client.app.dependency_overrides[get_current_user] = lambda: User(
        id=1, full_name="Admin", email="admin@example.com", employee_id="ADM001", role=UserRole.admin, password_hash="x"
    )
    assert client.get("/api/assets/not-found").status_code == 404
    assert client.post("/api/assets", json={"name": "incomplete"}).status_code == 422


def test_filters_search_pagination_and_unique_ids():
    client, _, _, _ = make_client()
    first = client.post("/api/assets", json=asset_payload()).json()
    second = client.post("/api/assets", json=asset_payload("Second Laptop", "Remote")).json()
    assert first["asset_id"] != second["asset_id"]

    filtered = client.get("/api/assets", params={"location": "HQ", "custodian": "IT", "category": "Hardware", "search": "Laptop", "page_size": 1})
    assert filtered.status_code == 200
    body = filtered.json()
    assert body["total"] == 1
    assert body["total_pages"] == 1
    assert body["items"][0]["asset_id"] == first["asset_id"]


def test_demo_asset_seed_is_idempotent():
    client, session_factory, _, _ = make_client()
    with session_factory() as db:
        seed_demo_assets(db)
        seed_demo_assets(db)
        assets = db.query(Asset).all()
        assert len(assets) == len(DEMO_ASSETS)
        assert len({asset.asset_id for asset in assets}) == len(DEMO_ASSETS)
        assert all(asset.qr_code_data_url.startswith("data:image/png;base64,") for asset in assets)