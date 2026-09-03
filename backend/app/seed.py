from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import User, UserRole
from app.security import hash_password

SEED_PASSWORD = "AssetMX@123"

SEED_USERS = [
    {
        "full_name": "Employee",
        "email": "employee@assetmx.local",
        "employee_id": "EMP001",
        "role": UserRole.employee,
    },
    {
        "full_name": "Host",
        "email": "host@assetmx.local",
        "employee_id": "HST001",
        "role": UserRole.host,
    },
    {
        "full_name": "Admin",
        "email": "admin@assetmx.local",
        "employee_id": "ADM001",
        "role": UserRole.admin,
    },
    {
        "full_name": "Guard",
        "email": "guard@assetmx.local",
        "employee_id": "GRD001",
        "role": UserRole.guard,
    },
    {
        "full_name": "SuperAdmin",
        "email": "superadmin@assetmx.local",
        "employee_id": "SAD001",
        "role": UserRole.superadmin,
    },
]


def seed_users(db: Session) -> None:
    existing = db.scalar(select(User.id).limit(1))
    if existing is not None:
        return

    password_hash = hash_password(SEED_PASSWORD)
    for row in SEED_USERS:
        db.add(User(**row, password_hash=password_hash, is_active=True))
    db.commit()
