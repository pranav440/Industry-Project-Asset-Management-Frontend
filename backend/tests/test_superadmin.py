from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.models import AuditLog, Department, User, UserRole
from app.routers.auth import router as auth_router
from app.routers.superadmin import router as superadmin_router
from app.security import hash_password


def make_superadmin_test_setup():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    session_factory = sessionmaker(bind=engine)
    Base.metadata.create_all(engine)

    app = FastAPI()
    app.include_router(auth_router)
    app.include_router(superadmin_router)

    with session_factory() as db:
        dept = Department(code="EXEC", name="Executive Administration", is_active=True)
        db.add(dept)
        db.commit()

        sa_user = User(
            full_name="SuperAdmin Master",
            email="superadmin.master@assetmx.local",
            employee_id="SAD999",
            password_hash=hash_password("SuperSecret@123"),
            role=UserRole.superadmin,
            department="Executive Administration",
            department_id=dept.id,
            is_active=True,
        )
        reg_user = User(
            full_name="Regular Admin",
            email="reg.admin@assetmx.local",
            employee_id="ADM888",
            password_hash=hash_password("AdminSecret@123"),
            role=UserRole.admin,
            department="Operations",
            is_active=True,
        )
        db.add_all([sa_user, reg_user])
        db.commit()

        # Seed an audit log
        audit = AuditLog(
            action="system.startup",
            asset_identifier="SYSTEM",
            actor_user_id=sa_user.id,
            metadata_json='{"version": "1.0"}',
        )
        db.add(audit)
        db.commit()

    def db_override():
        with session_factory() as db:
            yield db

    app.dependency_overrides[get_db] = db_override
    client = TestClient(app)
    return client, session_factory, app


def test_superadmin_auth_and_user_crud():
    client, _, _ = make_superadmin_test_setup()

    # Login as SuperAdmin
    login_resp = client.post(
        "/api/auth/login",
        json={"role": "superadmin", "identifier": "superadmin.master@assetmx.local", "password": "SuperSecret@123"},
    )
    assert login_resp.status_code == 200
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. List users
    users_resp = client.get("/api/superadmin/users", headers=headers)
    assert users_resp.status_code == 200
    u_data = users_resp.json()
    assert u_data["total"] >= 2

    # 2. Create user (SA-01)
    create_resp = client.post(
        "/api/superadmin/users",
        json={
            "full_name": "New Manager",
            "email": "manager@assetmx.local",
            "employee_id": "MGR001",
            "role": "department_head",
            "department": "Executive Administration",
            "password": "Password@123",
        },
        headers=headers,
    )
    assert create_resp.status_code == 201
    created_user = create_resp.json()
    assert created_user["email"] == "manager@assetmx.local"
    assert created_user["role"] == "department_head"
    user_id = created_user["id"]

    # 3. Update user
    update_resp = client.put(
        f"/api/superadmin/users/{user_id}",
        json={"full_name": "New Manager Senior", "role": "admin"},
        headers=headers,
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["full_name"] == "New Manager Senior"
    assert update_resp.json()["role"] == "admin"

    # 4. Status update (deactivate user)
    status_resp = client.patch(
        f"/api/superadmin/users/{user_id}/status",
        json={"is_active": False},
        headers=headers,
    )
    assert status_resp.status_code == 200
    assert status_resp.json()["is_active"] is False


def test_non_superadmin_forbidden():
    client, _, _ = make_superadmin_test_setup()

    # Login as regular Admin
    login_resp = client.post(
        "/api/auth/login",
        json={"role": "admin", "identifier": "reg.admin@assetmx.local", "password": "AdminSecret@123"},
    )
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Regular admin should be blocked from SuperAdmin endpoints
    resp = client.get("/api/superadmin/users", headers=headers)
    assert resp.status_code == 403
    assert "SuperAdmin role required" in resp.json()["detail"]


def test_superadmin_audit_logs_and_export():
    client, _, _ = make_superadmin_test_setup()

    login_resp = client.post(
        "/api/auth/login",
        json={"role": "superadmin", "identifier": "superadmin.master@assetmx.local", "password": "SuperSecret@123"},
    )
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Query audit logs
    audit_resp = client.get("/api/superadmin/audit-logs", headers=headers)
    assert audit_resp.status_code == 200
    audits = audit_resp.json()
    assert audits["total"] >= 1
    assert audits["items"][0]["action"] == "system.startup"

    # Export audit logs to CSV
    export_resp = client.get("/api/superadmin/audit-logs/export", headers=headers)
    assert export_resp.status_code == 200
    assert export_resp.headers["content-type"].startswith("text/csv")
    assert "system.startup" in export_resp.text


def test_superadmin_system_config():
    client, _, _ = make_superadmin_test_setup()

    login_resp = client.post(
        "/api/auth/login",
        json={"role": "superadmin", "identifier": "superadmin.master@assetmx.local", "password": "SuperSecret@123"},
    )
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Get config
    cfg_resp = client.get("/api/superadmin/config", headers=headers)
    assert cfg_resp.status_code == 200
    configs = cfg_resp.json()["configs"]
    assert len(configs) >= 4

    # Update config
    update_resp = client.put(
        "/api/superadmin/config",
        json={"configs": [{"key": "app.requests.approval_sla_hours", "value": 24}]},
        headers=headers,
    )
    assert update_resp.status_code == 200
    updated_items = {c["key"]: c["value"] for c in update_resp.json()["configs"]}
    assert updated_items["app.requests.approval_sla_hours"] == 24


def test_superadmin_analytics():
    client, _, _ = make_superadmin_test_setup()

    login_resp = client.post(
        "/api/auth/login",
        json={"role": "superadmin", "identifier": "superadmin.master@assetmx.local", "password": "SuperSecret@123"},
    )
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    analytics_resp = client.get("/api/superadmin/analytics", headers=headers)
    assert analytics_resp.status_code == 200
    a_data = analytics_resp.json()
    assert a_data["total_users"] >= 2
    assert "superadmin" in a_data["users_by_role"]
    assert "fulfillment_rate_percent" in a_data
    assert "average_approval_cycle_hours" in a_data

