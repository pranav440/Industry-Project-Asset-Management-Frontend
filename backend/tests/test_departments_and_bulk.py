import io
import openpyxl
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.deps import decode_access_token, get_current_user
from app.models import Department, User, UserRole
from app.routers.assets import router as assets_router
from app.routers.auth import router as auth_router
from app.routers.departments import router as departments_router
from app.security import hash_password


def make_test_setup():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    session_factory = sessionmaker(bind=engine)
    Base.metadata.create_all(engine)

    app = FastAPI()
    app.include_router(auth_router)
    app.include_router(departments_router)
    app.include_router(assets_router)

    with session_factory() as db:
        dept_it = Department(code="IT", name="IT Operations", cost_center="CC-101", is_active=True)
        dept_eng = Department(code="ENG", name="Engineering", cost_center="CC-102", is_active=True)
        db.add_all([dept_it, dept_eng])
        db.commit()

        admin_user = User(
            full_name="Admin Test",
            email="admin.test@assetmx.local",
            employee_id="ADM999",
            password_hash=hash_password("Password@123"),
            role=UserRole.admin,
            department="IT Operations",
            department_id=dept_it.id,
            is_active=True,
        )
        emp_user = User(
            full_name="Employee Test",
            email="emp.test@assetmx.local",
            employee_id="EMP999",
            password_hash=hash_password("Password@123"),
            role=UserRole.employee,
            department="Engineering",
            department_id=dept_eng.id,
            is_active=True,
        )
        db.add_all([admin_user, emp_user])
        db.commit()

    def db_override():
        with session_factory() as db:
            yield db

    app.dependency_overrides[get_db] = db_override
    client = TestClient(app)
    return client, session_factory, app


def test_login_returns_department_and_jwt_claims():
    client, _, _ = make_test_setup()
    resp = client.post(
        "/api/auth/login",
        json={"role": "admin", "identifier": "admin.test@assetmx.local", "password": "Password@123"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["user"]["department"] == "IT Operations"

    payload = decode_access_token(data["access_token"])
    assert payload["role"] == "admin"
    assert payload["department"] == "IT Operations"


def test_list_and_create_departments():
    client, _, app = make_test_setup()
    login_resp = client.post(
        "/api/auth/login",
        json={"role": "admin", "identifier": "admin.test@assetmx.local", "password": "Password@123"},
    )
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # List departments
    list_resp = client.get("/api/departments", headers=headers)
    assert list_resp.status_code == 200
    items = list_resp.json()["items"]
    assert len(items) >= 2
    dept_names = [d["name"] for d in items]
    assert "IT Operations" in dept_names

    # Create new department
    create_resp = client.post(
        "/api/departments",
        json={"code": "HR", "name": "Human Resources", "cost_center": "CC-106", "budget_annual": 200000.0},
        headers=headers,
    )
    assert create_resp.status_code == 201
    created = create_resp.json()
    assert created["code"] == "HR"
    assert created["name"] == "Human Resources"

    # Reject duplicate code
    dup_resp = client.post(
        "/api/departments",
        json={"code": "HR", "name": "HR Duplicate", "cost_center": "CC-106"},
        headers=headers,
    )
    assert dup_resp.status_code == 409


def test_bulk_upload_assets_excel():
    client, _, app = make_test_setup()
    login_resp = client.post(
        "/api/auth/login",
        json={"role": "admin", "identifier": "admin.test@assetmx.local", "password": "Password@123"},
    )
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(["Asset Name", "Category", "Specification", "Serial Number", "Location", "Custodian", "Total Cost", "Vendor", "Warranty"])
    ws.append(["MacBook Pro 16", "Hardware", "M3 Max, 32GB RAM", "SN-MBP-9001", "Floor 3 Lab", "Engineering", "240000", "Apple Inc", "24 Months"])
    ws.append(["Dell UltraSharp 32", "Displays", "4K UHD IPS", "SN-MON-9002", "Floor 3 Lab", "Engineering", "65000", "Dell Inc", "36 Months"])
    # Invalid row missing name
    ws.append(["", "Hardware", "No Name Laptop", "SN-BAD-9003", "Storage", "Operations", "50000", "Vendor", "12 Months"])

    excel_buffer = io.BytesIO()
    wb.save(excel_buffer)
    excel_buffer.seek(0)

    files = {"file": ("bulk_test_assets.xlsx", excel_buffer, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
    resp = client.post("/api/assets/bulk", headers=headers, files=files)
    assert resp.status_code == 201
    res_data = resp.json()
    assert res_data["total_rows"] == 3
    assert res_data["successful_count"] == 2
    assert res_data["failed_count"] == 1
    assert len(res_data["errors"]) == 1
    assert "Asset Name" in res_data["errors"][0]["error"]

    created = res_data["created_assets"]
    assert len(created) == 2
    assert created[0]["name"] == "MacBook Pro 16"
    assert created[0]["qr_code_value"].startswith("assetmx:AST-")


def test_bulk_upload_assets_csv():
    client, _, app = make_test_setup()
    login_resp = client.post(
        "/api/auth/login",
        json={"role": "admin", "identifier": "admin.test@assetmx.local", "password": "Password@123"},
    )
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    csv_content = """Asset Name,Category,Location,Custodian,Total Cost,Vendor
Cisco Catalyst Switch,Networking,Server Room,IT Operations,120000,Cisco
Polycom Conference Unit,AV,Board Room,Admin,45000,Polycom
"""
    files = {"file": ("assets.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")}
    resp = client.post("/api/assets/bulk", headers=headers, files=files)
    assert resp.status_code == 201
    res_data = resp.json()
    assert res_data["total_rows"] == 2
    assert res_data["successful_count"] == 2
    assert res_data["failed_count"] == 0
