import hashlib
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.models import PasswordResetToken, User, UserRole
from app.routers import auth
from app.security import hash_password, verify_password


def make_auth_test_setup():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    Base.metadata.create_all(bind=engine)

    app = FastAPI()
    app.include_router(auth.router)

    def override_get_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    return app, TestingSession


def seed_test_user(db: Session) -> User:
    user = User(
        id=1,
        full_name="Password Test User",
        email="reset_me@assetmx.com",
        employee_id="RST-001",
        role=UserRole.employee,
        password_hash=hash_password("old_password_123"),
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def test_password_reset_confirm_successful():
    app, TestingSession = make_auth_test_setup()
    db = TestingSession()
    user = seed_test_user(db)

    # Insert a valid reset token
    raw_token = "secret-valid-token-12345"
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=30)

    token_record = PasswordResetToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=expires_at,
    )
    db.add(token_record)
    db.commit()
    db.close()

    client = TestClient(app)

    # Confirm password reset with new password
    new_password = "BrandNewSecurePassword@2026"
    res = client.post(
        "/api/auth/password-reset/confirm",
        json={"token": raw_token, "password": new_password},
    )
    assert res.status_code == 200
    assert res.json()["detail"] == "Password reset successfully"

    # Verify user can log in with new password
    login_res = client.post(
        "/api/auth/login",
        json={
            "role": "employee",
            "identifier": "reset_me@assetmx.com",
            "password": new_password,
        },
    )
    assert login_res.status_code == 200
    assert "access_token" in login_res.json()

    # Verify old password no longer works
    fail_res = client.post(
        "/api/auth/login",
        json={
            "role": "employee",
            "identifier": "reset_me@assetmx.com",
            "password": "old_password_123",
        },
    )
    assert fail_res.status_code == 401


def test_password_reset_token_single_use():
    app, TestingSession = make_auth_test_setup()
    db = TestingSession()
    user = seed_test_user(db)

    raw_token = "single-use-token-abc"
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=30)

    db.add(
        PasswordResetToken(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=expires_at,
        )
    )
    db.commit()
    db.close()

    client = TestClient(app)

    # First reset should succeed
    res1 = client.post(
        "/api/auth/password-reset/confirm",
        json={"token": raw_token, "password": "PasswordOne123!"},
    )
    assert res1.status_code == 200

    # Second reset with same token must fail
    res2 = client.post(
        "/api/auth/password-reset/confirm",
        json={"token": raw_token, "password": "PasswordTwo456!"},
    )
    assert res2.status_code == 400
    assert "Invalid or expired reset token" in res2.json()["detail"]


def test_password_reset_expired_token():
    app, TestingSession = make_auth_test_setup()
    db = TestingSession()
    user = seed_test_user(db)

    raw_token = "expired-token-xyz-123456789"
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    # Expired 10 minutes ago
    expires_at = datetime.now(timezone.utc) - timedelta(minutes=10)

    db.add(
        PasswordResetToken(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=expires_at,
        )
    )
    db.commit()
    db.close()

    client = TestClient(app)

    res = client.post(
        "/api/auth/password-reset/confirm",
        json={"token": raw_token, "password": "ExpiredPassword123!"},
    )
    assert res.status_code == 400
    assert "Invalid or expired reset token" in res.json()["detail"]


def test_password_reset_invalid_token():
    app, TestingSession = make_auth_test_setup()
    client = TestClient(app)

    res = client.post(
        "/api/auth/password-reset/confirm",
        json={"token": "completely-nonexistent-token", "password": "SomePassword123!"},
    )
    assert res.status_code == 400
    assert "Invalid or expired reset token" in res.json()["detail"]
