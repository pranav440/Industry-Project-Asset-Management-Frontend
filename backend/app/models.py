import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, JSON, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class UserRole(str, enum.Enum):
    employee = "employee"
    host = "host"
    admin = "admin"
    guard = "guard"
    superadmin = "superadmin"


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        UniqueConstraint("email", name="uq_users_email"),
        UniqueConstraint("employee_id", name="uq_users_employee_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    full_name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255))
    employee_id: Mapped[str] = mapped_column(String(64))
    password_hash: Mapped[str] = mapped_column(String(72))
    role: Mapped[UserRole] = mapped_column(Enum(UserRole, native_enum=False, length=32))
    is_active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )


class AssetStatus(str, enum.Enum):
    active = "Active"
    in_maintenance = "In Maintenance"
    disposed = "Disposed"
    in_transit = "In Transit"


class Asset(Base):
    __tablename__ = "assets"
    __table_args__ = (
        UniqueConstraint("asset_id", name="uq_assets_asset_id"),
        UniqueConstraint("qr_code_value", name="uq_assets_qr_code_value"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    asset_id: Mapped[str] = mapped_column(String(64), index=True)
    name: Mapped[str] = mapped_column(String(255))
    status: Mapped[AssetStatus] = mapped_column(
        Enum(AssetStatus, native_enum=False, length=32),
        default=AssetStatus.active,
    )
    category: Mapped[str] = mapped_column(String(120))
    specification: Mapped[str | None] = mapped_column(String(255), nullable=True)
    serial_number: Mapped[str | None] = mapped_column(String(120), nullable=True)
    location: Mapped[str] = mapped_column(String(255))
    custodian: Mapped[str] = mapped_column(String(255))
    purchase_date: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    vendor_name: Mapped[str] = mapped_column(String(255))
    total_cost: Mapped[str] = mapped_column(String(64))
    warranty_period: Mapped[str] = mapped_column(String(120))
    invoice_reference: Mapped[str | None] = mapped_column(String(255), nullable=True)
    depreciation: Mapped[str | None] = mapped_column(String(255), nullable=True)
    allocation_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    documents: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    qr_code_value: Mapped[str] = mapped_column(String(128))
    qr_code_data_url: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )


class AssetMovementStatus(str, enum.Enum):
    initiated = "Initiated"
    in_transit = "In Transit"
    completed = "Completed"
    cancelled = "Cancelled"


class AssetMovement(Base):
    __tablename__ = "asset_movements"
    __table_args__ = (
        UniqueConstraint("movement_id", name="uq_asset_movements_movement_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    asset_id: Mapped[int] = mapped_column(ForeignKey("assets.id"), index=True)
    movement_id: Mapped[str] = mapped_column(String(64), index=True)
    from_location: Mapped[str] = mapped_column(String(255))
    to_location: Mapped[str] = mapped_column(String(255))
    from_custodian: Mapped[str] = mapped_column(String(255))
    to_custodian: Mapped[str] = mapped_column(String(255))
    reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[AssetMovementStatus] = mapped_column(
        Enum(AssetMovementStatus, native_enum=False, length=32),
        default=AssetMovementStatus.in_transit,
    )
    initiated_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    initiated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    action: Mapped[str] = mapped_column(String(120), index=True)
    asset_id: Mapped[int] = mapped_column(ForeignKey("assets.id"), index=True)
    asset_identifier: Mapped[str] = mapped_column(String(64), index=True)
    actor_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        index=True,
    )
    before_state: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    after_state: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    movement_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)


class MaintenanceType(str, enum.Enum):
    preventive = "Preventive"
    corrective = "Corrective"


class MaintenanceStatus(str, enum.Enum):
    completed = "Completed"


class Maintenance(Base):
    __tablename__ = "maintenance_records"
    __table_args__ = (
        UniqueConstraint("maintenance_id", name="uq_maintenance_records_maintenance_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    maintenance_id: Mapped[str] = mapped_column(String(64), index=True)
    asset_id: Mapped[int] = mapped_column(ForeignKey("assets.id"), index=True)
    service_date: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    maintenance_type: Mapped[MaintenanceType] = mapped_column(
        Enum(MaintenanceType, native_enum=False, length=32),
    )
    service_vendor: Mapped[str] = mapped_column(String(255))
    technician: Mapped[str | None] = mapped_column(String(255), nullable=True)
    maintenance_cost: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    status: Mapped[MaintenanceStatus] = mapped_column(
        Enum(MaintenanceStatus, native_enum=False, length=32),
        default=MaintenanceStatus.completed,
    )
    service_notes: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    created_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
