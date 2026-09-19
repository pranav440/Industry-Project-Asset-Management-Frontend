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
    AssetStatus,
    AuditLog,
    Consumable,
    ConsumableIssue,
    ConsumableStockMovement,
    Maintenance,
    User,
    UserRole,
)
from app.routers.assets import router
from app.routers.consumables import router as consumables_router
from app.seed import DEMO_ASSETS, seed_demo_assets


def make_client(*, raise_server_exceptions: bool = True) -> tuple[TestClient, sessionmaker, object, object]:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    session_factory = sessionmaker(bind=engine)
    Base.metadata.create_all(engine)
    app = FastAPI()
    app.include_router(router)
    app.include_router(consumables_router)

    def db_override():
        with session_factory() as db:
            yield db

    admin = User(id=1, full_name="Admin", email="admin@example.com", employee_id="ADM001", role=UserRole.admin, password_hash="x")
    employee = User(id=2, full_name="Employee", email="employee@example.com", employee_id="EMP001", role=UserRole.employee, password_hash="x")
    app.dependency_overrides[get_db] = db_override
    app.dependency_overrides[get_current_user] = lambda: admin
    client = TestClient(app, raise_server_exceptions=raise_server_exceptions)
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


def test_admin_transfer_persists_history_and_preserves_current_assignment():
    client, session_factory, _, _ = make_client()
    created = client.post("/api/assets", json=asset_payload()).json()
    response = client.post(
        f"/api/assets/{created['asset_id']}/transfer",
        json={"destination_location": "Regional Annex", "new_custodian": "Operations"},
    )

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["movement"]["movement_id"].startswith("TRF-")
    assert body["movement"]["from_location"] == "HQ"
    assert body["movement"]["to_location"] == "Regional Annex"
    assert body["movement"]["reason"] is None
    assert body["movement"]["status"] == "In Transit"
    assert body["asset"]["status"] == "In Transit"
    assert body["asset"]["location"] == "HQ"
    assert body["asset"]["custodian"] == "IT"

    detail = client.get(f"/api/assets/{created['asset_id']}")
    assert detail.status_code == 200
    detail_body = detail.json()
    assert len(detail_body["movement_history"]) == 1
    assert len(detail_body["audit_history"]) == 1
    assert detail_body["audit_history"][0]["movement_id"] == body["movement"]["movement_id"]

    with session_factory() as db:
        asset = db.query(Asset).filter_by(asset_id=created["asset_id"]).one()
        assert db.query(AssetMovement).filter_by(asset_id=asset.id).count() == 1
        assert db.query(AuditLog).filter_by(asset_id=asset.id).count() == 1


def test_transfer_validation_authorization_and_active_conflict():
    client, session_factory, _, employee = make_client()
    created = client.post("/api/assets", json=asset_payload()).json()
    asset_id = created["asset_id"]

    assert client.post(f"/api/assets/{asset_id}/transfer", json={"new_custodian": "Ops"}).status_code == 422
    assert client.post(f"/api/assets/{asset_id}/transfer", json={"destination_location": "HQ"}).status_code == 422

    client.app.dependency_overrides[get_current_user] = lambda: employee
    assert client.post(
        f"/api/assets/{asset_id}/transfer",
        json={"destination_location": "Remote", "new_custodian": "Ops"},
    ).status_code == 403
    client.app.dependency_overrides[get_current_user] = lambda: User(
        id=1, full_name="Admin", email="admin@example.com", employee_id="ADM001", role=UserRole.admin, password_hash="x"
    )

    first = client.post(
        f"/api/assets/{asset_id}/transfer",
        json={"destination_location": "Remote", "new_custodian": "Ops", "transfer_reason": "Project move"},
    )
    assert first.status_code == 201
    assert first.json()["movement"]["reason"] == "Project move"
    second = client.post(
        f"/api/assets/{asset_id}/transfer",
        json={"destination_location": "Warehouse", "new_custodian": "Facilities"},
    )
    assert second.status_code == 409

    with session_factory() as db:
        asset = db.query(Asset).filter_by(asset_id=asset_id).one()
        assert asset.status.value == "In Transit"
        assert asset.location == "HQ"
        assert asset.custodian == "IT"
        assert db.query(AssetMovement).filter_by(asset_id=asset.id).count() == 1
        assert db.query(AuditLog).filter_by(asset_id=asset.id).count() == 1


def test_unauthenticated_disposed_and_missing_transfer_assets():
    client, session_factory, _, _ = make_client()
    client.app.dependency_overrides.pop(get_current_user)
    assert client.post(
        "/api/assets/AST-MISSING/transfer",
        json={"destination_location": "Remote", "new_custodian": "Ops"},
    ).status_code == 401

    client.app.dependency_overrides[get_current_user] = lambda: User(
        id=1, full_name="Admin", email="admin@example.com", employee_id="ADM001", role=UserRole.admin, password_hash="x"
    )
    assert client.post(
        "/api/assets/AST-MISSING/transfer",
        json={"destination_location": "Remote", "new_custodian": "Ops"},
    ).status_code == 404

    disposed = client.post("/api/assets", json=asset_payload("Disposed Laptop")).json()
    with session_factory() as db:
        asset = db.query(Asset).filter_by(asset_id=disposed["asset_id"]).one()
        asset.status = AssetStatus.disposed
        db.commit()
    assert client.post(
        f"/api/assets/{disposed['asset_id']}/transfer",
        json={"destination_location": "Remote", "new_custodian": "Ops"},
    ).status_code == 409


def test_transfer_transaction_rolls_back_on_movement_persistence_failure(monkeypatch):
    client, session_factory, _, _ = make_client(raise_server_exceptions=False)
    created = client.post("/api/assets", json=asset_payload()).json()
    other = client.post("/api/assets", json=asset_payload("Other Laptop", "Remote")).json()
    with session_factory() as db:
        other_asset = db.query(Asset).filter_by(asset_id=other["asset_id"]).one()
        db.add(AssetMovement(
            asset_id=other_asset.id,
            movement_id="TRF-COLLISION",
            from_location="Remote",
            to_location="Warehouse",
            from_custodian="IT",
            to_custodian="Ops",
            status="In Transit",
            initiated_by_user_id=1,
        ))
        db.commit()

    class FixedUuid:
        hex = "COLLISION"

    import app.routers.assets as assets_router
    monkeypatch.setattr(assets_router.uuid, "uuid4", lambda: FixedUuid())
    response = client.post(
        f"/api/assets/{created['asset_id']}/transfer",
        json={"destination_location": "Remote", "new_custodian": "Ops"},
    )
    assert response.status_code == 500

    with session_factory() as db:
        asset = db.query(Asset).filter_by(asset_id=created["asset_id"]).one()
        assert asset.status == AssetStatus.active
        assert db.query(AssetMovement).filter_by(asset_id=asset.id).count() == 0
        assert db.query(AuditLog).filter_by(asset_id=asset.id).count() == 0


def maintenance_payload(**overrides) -> dict:
    payload = {
        "service_date": "2026-09-19",
        "maintenance_type": "Preventive",
        "service_vendor": "Dell Care Services",
        "technician": "Ramesh Sharma",
        "maintenance_cost": 2400,
        "service_notes": "Hardware diagnostics completed.",
    }
    payload.update(overrides)
    return payload


def test_maintenance_get_empty_and_invalid_asset():
    client, _, _, _ = make_client()
    created = client.post("/api/assets", json=asset_payload()).json()
    response = client.get(f"/api/assets/{created['asset_id']}/maintenance")
    assert response.status_code == 200
    assert response.json() == []
    assert client.get("/api/assets/AST-MISSING/maintenance").status_code == 404


def test_maintenance_create_types_optional_fields_and_persistence():
    client, session_factory, _, _ = make_client()
    created = client.post("/api/assets", json=asset_payload()).json()
    asset_id = created["asset_id"]

    preventive = client.post(f"/api/assets/{asset_id}/maintenance", json=maintenance_payload(maintenance_cost=0))
    assert preventive.status_code == 201, preventive.text
    preventive_body = preventive.json()
    assert preventive_body["maintenance_id"].startswith("MNT-")
    assert preventive_body["status"] == "Completed"
    assert preventive_body["maintenance_cost"] == 0

    corrective = client.post(
        f"/api/assets/{asset_id}/maintenance",
        json=maintenance_payload(
            maintenance_type="Corrective",
            technician=None,
            service_notes=None,
            maintenance_cost=125.5,
        ),
    )
    assert corrective.status_code == 201, corrective.text
    corrective_body = corrective.json()
    assert corrective_body["maintenance_type"] == "Corrective"
    assert corrective_body["technician"] is None
    assert corrective_body["service_notes"] is None
    assert corrective_body["maintenance_id"] != preventive_body["maintenance_id"]

    records = client.get(f"/api/assets/{asset_id}/maintenance").json()
    assert len(records) == 2
    assert {record["maintenance_id"] for record in records} == {
        preventive_body["maintenance_id"], corrective_body["maintenance_id"]
    }
    detail = client.get(f"/api/assets/{asset_id}").json()
    assert len(detail["maintenance_history"]) == 2
    assert detail["maintenance_history"][0]["id"] in {
        preventive_body["maintenance_id"], corrective_body["maintenance_id"]
    }

    with session_factory() as db:
        asset = db.query(Asset).filter_by(asset_id=asset_id).one()
        assert db.query(Maintenance).filter_by(asset_id=asset.id).count() == 2


def test_maintenance_validation_authentication_and_required_fields():
    client, _, _, employee = make_client()
    created = client.post("/api/assets", json=asset_payload()).json()
    path = f"/api/assets/{created['asset_id']}/maintenance"

    assert client.post(path, json=maintenance_payload(maintenance_type="Emergency")).status_code == 422
    assert client.post(path, json=maintenance_payload(maintenance_cost=-1)).status_code == 422
    assert client.post(path, json={"service_date": "2026-09-19"}).status_code == 422
    assert client.post(path, json=maintenance_payload(service_vendor="   ")).status_code == 422

    client.app.dependency_overrides.pop(get_current_user)
    assert client.get(path).status_code == 401
    assert client.post(path, json=maintenance_payload()).status_code == 401

    client.app.dependency_overrides[get_current_user] = lambda: employee
    assert client.get(path).status_code == 403
    assert client.post(path, json=maintenance_payload()).status_code == 403


def test_maintenance_audit_contains_actor_asset_and_reference():
    client, session_factory, _, _ = make_client()
    created = client.post("/api/assets", json=asset_payload()).json()
    response = client.post(
        f"/api/assets/{created['asset_id']}/maintenance",
        json=maintenance_payload(),
    )
    assert response.status_code == 201
    maintenance_id = response.json()["maintenance_id"]

    with session_factory() as db:
        asset = db.query(Asset).filter_by(asset_id=created["asset_id"]).one()
        audit = db.query(AuditLog).filter_by(asset_id=asset.id).one()
        assert audit.action == "Maintenance record created"
        assert audit.asset_identifier == created["asset_id"]
        assert audit.actor_user_id == 1
        assert audit.movement_id is None
        assert audit.after_state["maintenance_id"] == maintenance_id


def test_maintenance_and_audit_are_atomic_when_audit_creation_fails(monkeypatch):
    client, session_factory, _, _ = make_client(raise_server_exceptions=False)
    created = client.post("/api/assets", json=asset_payload()).json()

    import app.routers.assets as assets_router

    def fail_audit(*_args, **_kwargs):
        raise RuntimeError("audit insert failed")

    monkeypatch.setattr(assets_router, "AuditLog", fail_audit)
    response = client.post(
        f"/api/assets/{created['asset_id']}/maintenance",
        json=maintenance_payload(),
    )
    assert response.status_code == 500

    with session_factory() as db:
        asset = db.query(Asset).filter_by(asset_id=created["asset_id"]).one()
        assert db.query(Maintenance).filter_by(asset_id=asset.id).count() == 0
        assert db.query(AuditLog).filter_by(asset_id=asset.id).count() == 0


def consumable_payload(**overrides) -> dict:
    payload = {
        "name": "Cyan Dye Ink Cartridge",
        "category": "Printing & Inks",
        "batch_id": "BAT-2026-09A",
        "location": "Admin Store",
        "initial_stock": 50,
        "threshold": 10,
        "expiry_date": "2027-01-31",
    }
    payload.update(overrides)
    return payload


def test_consumable_crud_and_initial_inward():
    client, session_factory, _, _ = make_client()
    created = client.post("/api/consumables", json=consumable_payload())
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["consumable_id"].startswith("CON-")
    assert body["available_stock"] == 50
    assert body["batch_quantity"] == 50
    assert body["stock_status"] == "In Stock"
    assert len(body["movement_ledger"]) == 1
    assert body["movement_ledger"][0]["operation_type"] == "Initial Inward / Batch Receipt"
    consumable_id = body["consumable_id"]

    listed = client.get("/api/consumables", params={"search": "Cyan", "category": "Printing & Inks", "location": "Admin Store"})
    assert listed.status_code == 200
    assert listed.json()["total"] == 1
    assert listed.json()["items"][0]["consumable_id"] == consumable_id

    updated = client.put(
        f"/api/consumables/{consumable_id}",
        json={"name": "Updated Cyan Cartridge", "threshold": 20},
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "Updated Cyan Cartridge"
    assert updated.json()["threshold"] == 20
    assert updated.json()["available_stock"] == 50

    detail = client.get(f"/api/consumables/{consumable_id}")
    assert detail.status_code == 200
    assert len(detail.json()["movement_ledger"]) == 1

    with session_factory() as db:
        record = db.query(Consumable).filter_by(consumable_id=consumable_id).one()
        assert db.query(ConsumableStockMovement).filter_by(consumable_id=record.id).count() == 1
        assert db.query(AuditLog).filter_by(consumable_id=record.id).count() == 2


def test_consumable_stock_adjustments_and_filters():
    client, session_factory, _, _ = make_client()
    created = client.post("/api/consumables", json=consumable_payload(initial_stock=10, threshold=10)).json()
    consumable_id = created["consumable_id"]

    positive = client.post(
        f"/api/consumables/{consumable_id}/stock",
        json={"operation_type": "Initial Inward / Batch Receipt", "delta_quantity": 5, "reference": "Restock"},
    )
    assert positive.status_code == 200
    assert positive.json()["available_stock"] == 15
    assert positive.json()["movement_ledger"][0]["post_balance"] == 15

    negative = client.post(
        f"/api/consumables/{consumable_id}/stock",
        json={"operation_type": "Stock Adjustment / Correction", "delta_quantity": -3},
    )
    assert negative.status_code == 200
    assert negative.json()["available_stock"] == 12
    assert negative.json()["stock_status"] == "In Stock"

    assert client.post(
        f"/api/consumables/{consumable_id}/stock",
        json={"operation_type": "Stock Adjustment / Correction", "delta_quantity": 0},
    ).status_code == 422
    assert client.post(
        f"/api/consumables/{consumable_id}/stock",
        json={"operation_type": "Stock Adjustment / Correction", "delta_quantity": -100},
    ).status_code == 409

    low = client.post("/api/consumables", json=consumable_payload(name="Low Item", initial_stock=2, threshold=5, batch_id="BAT-LOW")).json()
    assert client.get("/api/consumables", params={"status": "Low Stock"}).json()["total"] == 1
    assert client.get("/api/consumables", params={"expiry": "upcoming"}).status_code == 200
    assert client.get("/api/consumables", params={"page": 1, "page_size": 1}).json()["page_size"] == 1

    with session_factory() as db:
        record = db.query(Consumable).filter_by(consumable_id=consumable_id).one()
        assert record.available_stock == 12
        assert db.query(ConsumableStockMovement).filter_by(consumable_id=record.id).count() == 3
        assert db.query(AuditLog).filter_by(consumable_id=record.id).count() == 3
        assert low["stock_status"] == "Low Stock"


def test_consumable_issue_persists_issue_movement_and_audit():
    client, session_factory, _, _ = make_client()
    created = client.post("/api/consumables", json=consumable_payload(initial_stock=10)).json()
    consumable_id = created["consumable_id"]

    issued = client.post(
        f"/api/consumables/{consumable_id}/issue",
        json={"quantity": 4, "request_reference": "REQ-PRN-8821"},
    )
    assert issued.status_code == 200, issued.text
    body = issued.json()
    assert body["available_stock"] == 6
    assert body["issue_history"][0]["quantity"] == 4
    assert body["issue_history"][0]["remaining_stock"] == 6
    assert body["movement_ledger"][0]["operation_type"] == "Disbursement / Issue"
    assert body["movement_ledger"][0]["delta_quantity"] == -4
    assert body["movement_ledger"][0]["post_balance"] == 6

    assert client.post(f"/api/consumables/{consumable_id}/issue", json={"quantity": 7}).status_code == 409
    assert client.post(f"/api/consumables/{consumable_id}/issue", json={"quantity": 0}).status_code == 422
    assert client.post(f"/api/consumables/{consumable_id}/issue", json={"quantity": -1}).status_code == 422

    with session_factory() as db:
        record = db.query(Consumable).filter_by(consumable_id=consumable_id).one()
        assert record.available_stock == 6
        assert db.query(ConsumableIssue).filter_by(consumable_id=record.id).count() == 1
        assert db.query(ConsumableStockMovement).filter_by(consumable_id=record.id).count() == 2
        audits = db.query(AuditLog).filter_by(consumable_id=record.id).all()
        assert any(audit.action == "Consumable issued" for audit in audits)


def test_consumable_authorization_missing_and_invalid_records():
    client, _, _, employee = make_client()
    client.app.dependency_overrides.pop(get_current_user)
    assert client.get("/api/consumables").status_code == 401
    assert client.post("/api/consumables", json=consumable_payload()).status_code == 401

    client.app.dependency_overrides[get_current_user] = lambda: employee
    assert client.get("/api/consumables").status_code == 403
    assert client.post("/api/consumables", json=consumable_payload()).status_code == 403

    client.app.dependency_overrides[get_current_user] = lambda: User(
        id=1, full_name="Admin", email="admin@example.com", employee_id="ADM001", role=UserRole.admin, password_hash="x"
    )
    assert client.get("/api/consumables/CON-MISSING").status_code == 404
    assert client.put("/api/consumables/CON-MISSING", json={"name": "x"}).status_code == 404
    assert client.post("/api/consumables/CON-MISSING/stock", json={"operation_type": "Stock Adjustment / Correction", "delta_quantity": 1}).status_code == 404
    assert client.post("/api/consumables/CON-MISSING/issue", json={"quantity": 1}).status_code == 404


def test_consumable_audit_failure_rolls_back(monkeypatch):
    client, session_factory, _, _ = make_client(raise_server_exceptions=False)
    import app.routers.consumables as consumables_router

    monkeypatch.setattr(consumables_router, "_audit", lambda **_kwargs: (_ for _ in ()).throw(RuntimeError("audit failed")))
    response = client.post("/api/consumables", json=consumable_payload())
    assert response.status_code == 500
    with session_factory() as db:
        assert db.query(Consumable).count() == 0
        assert db.query(ConsumableStockMovement).count() == 0
        assert db.query(AuditLog).count() == 0