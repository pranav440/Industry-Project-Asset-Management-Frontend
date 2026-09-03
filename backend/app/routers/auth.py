from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import User, UserRole
from app.schemas import LoginRequest, LoginResponse, UserOut
from app.security import create_access_token, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])

INVALID_CREDENTIALS = "Invalid email/employee ID, password, or role"


def _find_user(db: Session, identifier: str) -> User | None:
    ident = identifier.strip()
    if not ident:
        return None
    if "@" in ident:
        return db.scalar(select(User).where(func.lower(User.email) == ident.lower()))
    return db.scalar(select(User).where(User.employee_id == ident))


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
