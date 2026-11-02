from collections.abc import Callable, Sequence

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import InvalidTokenError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, UserRole
from app.security import decode_access_token

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if creds is None or creds.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        payload = decode_access_token(creds.credentials)
        user_id = int(payload["sub"])
    except (InvalidTokenError, KeyError, TypeError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    user = db.get(User, user_id)
    if user is None or not user.is_active or payload.get("role") != user.role.value:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    return user


def require_authenticated_user(current_user: User = Depends(get_current_user)) -> User:
    """Dependency that ensures the request is from a valid, active authenticated user regardless of role."""
    return current_user


get_current_active_user = require_authenticated_user


def require_roles(
    allowed_roles: Sequence[str | UserRole] | str | UserRole,
    *,
    detail: str | None = None,
) -> Callable[[User], User]:
    """Factory creating a FastAPI dependency that verifies current_user possesses one of the allowed roles."""
    if isinstance(allowed_roles, (str, UserRole)):
        roles_iterable = [allowed_roles]
    else:
        roles_iterable = list(allowed_roles)

    normalized_roles = {
        role.value if isinstance(role, UserRole) else str(role).strip()
        for role in roles_iterable
    }
    error_detail = detail or "Insufficient role permissions"

    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        user_role = (
            current_user.role.value
            if isinstance(current_user.role, UserRole)
            else str(current_user.role).strip()
        )
        if user_role not in normalized_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=error_detail,
            )
        return current_user

    return role_checker


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Preserve existing admin authorization semantics."""
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin role required")
    return current_user


require_employee = require_roles([UserRole.employee], detail="Employee role required")
require_host = require_roles([UserRole.host], detail="Host role required")
require_admin_or_superadmin = require_roles(
    [UserRole.admin, UserRole.superadmin],
    detail="Admin role required",
)
require_guard_or_admin = require_roles(
    [UserRole.guard, UserRole.admin, UserRole.superadmin],
    detail="Guard or admin role required",
)
require_gate_pass_creator = require_roles(
    [UserRole.admin, UserRole.superadmin, UserRole.host],
    detail="Admin or host role required",
)
require_gate_staff = require_roles(
    [UserRole.admin, UserRole.superadmin, UserRole.guard, UserRole.host],
    detail="Admin, guard, or host role required",
)

