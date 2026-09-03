import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import PasswordResetToken, User, UserRole
from app.schemas import LoginRequest, LoginResponse, PasswordResetConfirm, PasswordResetRequest, UserOut
from app.security import create_access_token, hash_password, verify_password
from app.config import settings

router = APIRouter(prefix="/api/auth", tags=["auth"])

INVALID_CREDENTIALS = "Invalid email/employee ID, password, or role"
RESET_REQUEST_MESSAGE = "If the account exists, password reset instructions have been sent."


def _find_user(db: Session, identifier: str) -> User | None:
    ident = identifier.strip()
    if not ident:
        return None
    if "@" in ident:
        return db.scalar(select(User).where(func.lower(User.email) == ident.lower()))
    return db.scalar(select(User).where(User.employee_id == ident))


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


@router.post("/login", response_model=LoginResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)) -> LoginResponse:
    user = _find_user(db, body.identifier)
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=INVALID_CREDENTIALS)
    if not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=INVALID_CREDENTIALS)
    if user.role != UserRole(body.role):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=INVALID_CREDENTIALS)

    token, expires_in = create_access_token(
        user_id=user.id,
        role=user.role.value,
        remember=body.remember,
    )
    return LoginResponse(
        access_token=token,
        expires_in=expires_in,
        user=UserOut.model_validate(user),
    )


@router.get("/me", response_model=UserOut)
def me(current: User = Depends(get_current_user)) -> User:
    return current


@router.post("/password-reset/request", status_code=status.HTTP_202_ACCEPTED)
def request_password_reset(body: PasswordResetRequest, db: Session = Depends(get_db)) -> dict[str, str]:
    user = _find_user(db, body.identifier)
    if user is not None and user.is_active:
        db.execute(delete(PasswordResetToken).where(PasswordResetToken.user_id == user.id))
        raw_token = secrets.token_urlsafe(32)
        db.add(PasswordResetToken(
            user_id=user.id,
            token_hash=_token_hash(raw_token),
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=settings.password_reset_expire_minutes),
        ))
        db.commit()
    return {"detail": RESET_REQUEST_MESSAGE}


@router.post("/password-reset/confirm")
def confirm_password_reset(body: PasswordResetConfirm, db: Session = Depends(get_db)) -> dict[str, str]:
    reset = db.scalar(
        select(PasswordResetToken)
        .where(PasswordResetToken.token_hash == _token_hash(body.token))
        .with_for_update()
    )
    now = datetime.now(timezone.utc)
    if reset is None or reset.used_at is not None or reset.expires_at <= now:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset token")
    user = db.get(User, reset.user_id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset token")
    user.password_hash = hash_password(body.password)
    reset.used_at = now
    db.commit()
    return {"detail": "Password reset successfully"}
