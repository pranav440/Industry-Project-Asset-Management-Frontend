from fastapi import Depends, FastAPI, status
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.deps import (
    get_current_active_user,
    get_current_user,
    require_admin,
    require_authenticated_user,
    require_employee,
    require_host,
    require_roles,
)
from app.models import User, UserRole
from app.security import create_access_token


def make_test_environment():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    session_factory = sessionmaker(bind=engine, expire_on_commit=False)
    Base.metadata.create_all(engine)

    app = FastAPI()

    def db_override():
        with session_factory() as db:
            yield db

    app.dependency_overrides[get_db] = db_override

    # Test route definitions with different dependency requirements
    @app.get("/auth-only")
    def auth_only_route(current_user: User = Depends(require_authenticated_user)):
        return {"id": current_user.id, "role": current_user.role.value}

    @app.get("/active-user")
    def active_user_route(current_user: User = Depends(get_current_active_user)):
        return {"id": current_user.id, "role": current_user.role.value}

    @app.get("/admin-only")
    def admin_only_route(current_user: User = Depends(require_admin)):
        return {"id": current_user.id, "role": current_user.role.value}

    @app.get("/employee-only")
    def employee_only_route(current_user: User = Depends(require_roles(["employee"]))):
        return {"id": current_user.id, "role": current_user.role.value}

    @app.get("/employee-helper")
    def employee_helper_route(current_user: User = Depends(require_employee)):
        return {"id": current_user.id, "role": current_user.role.value}

    @app.get("/host-enabled")
    def host_enabled_route(current_user: User = Depends(require_roles(["admin", "host"]))):
        return {"id": current_user.id, "role": current_user.role.value}

    @app.get("/host-helper")
    def host_helper_route(current_user: User = Depends(require_host)):
        return {"id": current_user.id, "role": current_user.role.value}

    @app.get("/admin-or-superadmin")
    def admin_or_superadmin_route(
        current_user: User = Depends(require_roles([UserRole.admin, UserRole.superadmin]))
    ):
        return {"id": current_user.id, "role": current_user.role.value}

    tokens = {}
    with session_factory() as db:
        users = {
            "admin": User(
                id=1,
                full_name="Admin User",
                email="admin@assetmx.local",
                employee_id="ADM001",
                role=UserRole.admin,
                password_hash="test",
                is_active=True,
            ),
            "employee": User(
                id=2,
                full_name="Employee User",
                email="employee@assetmx.local",
                employee_id="EMP001",
                role=UserRole.employee,
                password_hash="test",
                is_active=True,
            ),
            "host": User(
                id=3,
                full_name="Host User",
                email="host@assetmx.local",
                employee_id="HST001",
                role=UserRole.host,
                password_hash="test",
                is_active=True,
            ),
            "superadmin": User(
                id=4,
                full_name="SuperAdmin User",
                email="superadmin@assetmx.local",
                employee_id="SAD001",
                role=UserRole.superadmin,
                password_hash="test",
                is_active=True,
            ),
            "guard": User(
                id=5,
                full_name="Guard User",
                email="guard@assetmx.local",
                employee_id="GRD001",
                role=UserRole.guard,
                password_hash="test",
                is_active=True,
            ),
            "inactive": User(
                id=6,
                full_name="Inactive User",
                email="inactive@assetmx.local",
                employee_id="INA001",
                role=UserRole.employee,
                password_hash="test",
                is_active=False,
            ),
        }
        for u in users.values():
            db.add(u)
        db.commit()

        for key, user in users.items():
            tokens[key] = create_access_token(user_id=user.id, role=user.role.value, remember=False)[0]

    client = TestClient(app)
    return client, tokens


def test_unauthenticated_requests_remain_rejected():
    client, _ = make_test_environment()

    # 1. No Authorization header
    res = client.get("/auth-only")
    assert res.status_code == status.HTTP_401_UNAUTHORIZED
    assert res.json()["detail"] == "Not authenticated"

    # 2. Non-Bearer authorization header
    res = client.get("/auth-only", headers={"Authorization": "Basic 12345"})
    assert res.status_code == status.HTTP_401_UNAUTHORIZED
    assert res.json()["detail"] == "Not authenticated"

    # 3. Invalid / malformed bearer token
    res = client.get("/auth-only", headers={"Authorization": "Bearer invalid.token.value"})
    assert res.status_code == status.HTTP_401_UNAUTHORIZED
    assert res.json()["detail"] == "Invalid or expired token"


def test_inactive_user_token_rejected():
    client, tokens = make_test_environment()
    res = client.get("/auth-only", headers={"Authorization": f"Bearer {tokens['inactive']}"})
    assert res.status_code == status.HTTP_401_UNAUTHORIZED
    assert res.json()["detail"] == "Invalid or expired token"


def test_require_authenticated_user_accepts_any_active_role():
    client, tokens = make_test_environment()

    for role in ["admin", "employee", "host", "superadmin", "guard"]:
        res = client.get("/auth-only", headers={"Authorization": f"Bearer {tokens[role]}"})
        assert res.status_code == status.HTTP_200_OK
        assert res.json()["role"] == role

        res2 = client.get("/active-user", headers={"Authorization": f"Bearer {tokens[role]}"})
        assert res2.status_code == status.HTTP_200_OK
        assert res2.json()["role"] == role


def test_employee_accepted_by_employee_only_dependency():
    client, tokens = make_test_environment()

    # Employee accepted
    res = client.get("/employee-only", headers={"Authorization": f"Bearer {tokens['employee']}"})
    assert res.status_code == status.HTTP_200_OK
    assert res.json()["role"] == "employee"

    res_helper = client.get("/employee-helper", headers={"Authorization": f"Bearer {tokens['employee']}"})
    assert res_helper.status_code == status.HTTP_200_OK
    assert res_helper.json()["role"] == "employee"

    # Non-employees rejected with 403
    for non_emp in ["admin", "host", "guard", "superadmin"]:
        res_reject = client.get("/employee-only", headers={"Authorization": f"Bearer {tokens[non_emp]}"})
        assert res_reject.status_code == status.HTTP_403_FORBIDDEN
        assert res_reject.json()["detail"] == "Insufficient role permissions"


def test_host_accepted_by_host_enabled_dependency():
    client, tokens = make_test_environment()

    # Host accepted on host-enabled endpoint
    res_host = client.get("/host-enabled", headers={"Authorization": f"Bearer {tokens['host']}"})
    assert res_host.status_code == status.HTTP_200_OK
    assert res_host.json()["role"] == "host"

    # Admin also accepted on host-enabled endpoint
    res_admin = client.get("/host-enabled", headers={"Authorization": f"Bearer {tokens['admin']}"})
    assert res_admin.status_code == status.HTTP_200_OK
    assert res_admin.json()["role"] == "admin"

    # Host accepted on require_host helper
    res_host_helper = client.get("/host-helper", headers={"Authorization": f"Bearer {tokens['host']}"})
    assert res_host_helper.status_code == status.HTTP_200_OK
    assert res_host_helper.json()["role"] == "host"

    # Employee and guard rejected on host-enabled endpoint
    res_emp = client.get("/host-enabled", headers={"Authorization": f"Bearer {tokens['employee']}"})
    assert res_emp.status_code == status.HTTP_403_FORBIDDEN

    res_guard = client.get("/host-enabled", headers={"Authorization": f"Bearer {tokens['guard']}"})
    assert res_guard.status_code == status.HTTP_403_FORBIDDEN


def test_employee_and_host_rejected_by_admin_only_dependency():
    client, tokens = make_test_environment()

    # Employee rejected by require_admin with exact existing detail
    res_emp = client.get("/admin-only", headers={"Authorization": f"Bearer {tokens['employee']}"})
    assert res_emp.status_code == status.HTTP_403_FORBIDDEN
    assert res_emp.json()["detail"] == "Admin role required"

    # Host rejected by require_admin
    res_host = client.get("/admin-only", headers={"Authorization": f"Bearer {tokens['host']}"})
    assert res_host.status_code == status.HTTP_403_FORBIDDEN
    assert res_host.json()["detail"] == "Admin role required"

    # Guard rejected by require_admin
    res_guard = client.get("/admin-only", headers={"Authorization": f"Bearer {tokens['guard']}"})
    assert res_guard.status_code == status.HTTP_403_FORBIDDEN
    assert res_guard.json()["detail"] == "Admin role required"


def test_admin_and_superadmin_behaviour_preserves_existing_semantics():
    client, tokens = make_test_environment()

    # Admin accepted by require_admin
    res_admin = client.get("/admin-only", headers={"Authorization": f"Bearer {tokens['admin']}"})
    assert res_admin.status_code == status.HTTP_200_OK
    assert res_admin.json()["role"] == "admin"

    # In existing implementation, require_admin checks `current_user.role != UserRole.admin`
    # Superadmin is rejected by require_admin (preserves existing semantics)
    res_super = client.get("/admin-only", headers={"Authorization": f"Bearer {tokens['superadmin']}"})
    assert res_super.status_code == status.HTTP_403_FORBIDDEN
    assert res_super.json()["detail"] == "Admin role required"

    # However, superadmin and admin are both accepted when using require_roles([UserRole.admin, UserRole.superadmin])
    res_both_admin = client.get("/admin-or-superadmin", headers={"Authorization": f"Bearer {tokens['admin']}"})
    assert res_both_admin.status_code == status.HTTP_200_OK

    res_both_super = client.get("/admin-or-superadmin", headers={"Authorization": f"Bearer {tokens['superadmin']}"})
    assert res_both_super.status_code == status.HTTP_200_OK

    res_both_emp = client.get("/admin-or-superadmin", headers={"Authorization": f"Bearer {tokens['employee']}"})
    assert res_both_emp.status_code == status.HTTP_403_FORBIDDEN
