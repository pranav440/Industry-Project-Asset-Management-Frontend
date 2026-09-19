import enum
from datetime import date, datetime

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Integer, JSON, Numeric, String, Text, UniqueConstraint, func
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


class RequestType(str, enum.Enum):
    asset_request = "Asset Request"
    consumable_request = "Consumable Request"


class RequestPriority(str, enum.Enum):
    high = "High"
    medium = "Medium"
    low = "Low"


class RequestStatus(str, enum.Enum):
    pending = "Pending"
    in_review = "In Review"
    fulfilled = "Fulfilled"
    rejected = "Rejected"


class Request(Base):
    __tablename__ = "requests"
    __table_args__ = (
        UniqueConstraint("request_id", name="uq_requests_request_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    request_id: Mapped[str] = mapped_column(String(64), index=True)
    requester_name: Mapped[str] = mapped_column(String(160))
    requester_email: Mapped[str] = mapped_column(String(255))
    department: Mapped[str] = mapped_column(String(160))
    request_type: Mapped[RequestType] = mapped_column(Enum(RequestType, native_enum=False, length=32))
    requested_item: Mapped[str] = mapped_column(String(255))
    category: Mapped[str] = mapped_column(String(120))
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    priority: Mapped[RequestPriority] = mapped_column(Enum(RequestPriority, native_enum=False, length=32))
    request_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[RequestStatus] = mapped_column(
        Enum(RequestStatus, native_enum=False, length=32),
        default=RequestStatus.pending,
    )
    justification: Mapped[str] = mapped_column(Text)
    processing_guidelines: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )


class RequestHistory(Base):
    __tablename__ = "request_history"
    __table_args__ = (
        UniqueConstraint("history_id", name="uq_request_history_history_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    history_id: Mapped[str] = mapped_column(String(64), index=True)
    request_id: Mapped[str] = mapped_column(ForeignKey("requests.request_id"), index=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        index=True,
    )
    stage: Mapped[str] = mapped_column(String(32))
    action: Mapped[str] = mapped_column(String(120))
    performed_by: Mapped[str] = mapped_column(String(160))
    note: Mapped[str | None] = mapped_column(Text, nullable=True)


class GatePassType(str, enum.Enum):
    asset_movement = "Asset Movement"
    returnable = "Returnable"
    non_returnable = "Non-Returnable"
    maintenance = "Maintenance"


class GatePassStatus(str, enum.Enum):
    pending = "Pending"
    approved = "Approved"
    rejected = "Rejected"
    active = "Active"
    completed = "Completed"
    escalated = "Escalated"


class GatePass(Base):
    __tablename__ = "gate_passes"
    __table_args__ = (
        UniqueConstraint("pass_id", name="uq_gate_passes_pass_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    pass_id: Mapped[str] = mapped_column(String(64), index=True)
    pass_type: Mapped[GatePassType] = mapped_column(Enum(GatePassType, native_enum=False, length=32))
    request_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[GatePassStatus] = mapped_column(
        Enum(GatePassStatus, native_enum=False, length=32),
        default=GatePassStatus.pending,
    )
    requester_name: Mapped[str] = mapped_column(String(160))
    department: Mapped[str] = mapped_column(String(160), default="Administration")
    asset_or_item: Mapped[str] = mapped_column(String(255))
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    current_location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    destination: Mapped[str] = mapped_column(String(255))
    movement_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    purpose: Mapped[str] = mapped_column(Text)
    authorization_state: Mapped[str] = mapped_column(String(160), default="Pending Review")
    decision_status: Mapped[str] = mapped_column(String(160), default="Awaiting Review")
    decision_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    decision_by: Mapped[str | None] = mapped_column(String(160), nullable=True)
    exit_status: Mapped[str | None] = mapped_column(String(32), nullable=True)
    exit_timestamp: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    exit_gate: Mapped[str | None] = mapped_column(String(120), nullable=True)
    exit_officer: Mapped[str | None] = mapped_column(String(160), nullable=True)
    exit_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    entry_status: Mapped[str | None] = mapped_column(String(32), nullable=True)
    entry_timestamp: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    entry_gate: Mapped[str | None] = mapped_column(String(120), nullable=True)
    entry_officer: Mapped[str | None] = mapped_column(String(160), nullable=True)
    entry_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    escalation_is_escalated: Mapped[bool] = mapped_column(default=False)
    escalation_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    escalation_timestamp: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    escalation_action_required: Mapped[str | None] = mapped_column(String(255), nullable=True)
    escalation_escalated_by: Mapped[str | None] = mapped_column(String(160), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )


class GatePassHistory(Base):
    __tablename__ = "gate_pass_history"
    __table_args__ = (
        UniqueConstraint("history_id", name="uq_gate_pass_history_history_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    history_id: Mapped[str] = mapped_column(String(64), index=True)
    pass_id: Mapped[str] = mapped_column(ForeignKey("gate_passes.pass_id"), index=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        index=True,
    )
    action: Mapped[str] = mapped_column(String(160))
    performed_by: Mapped[str] = mapped_column(String(160))
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    status_snapshot: Mapped[str] = mapped_column(String(64))


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
    asset_id: Mapped[int | None] = mapped_column(ForeignKey("assets.id"), index=True, nullable=True)
    asset_identifier: Mapped[str] = mapped_column(String(64), index=True)
    consumable_id: Mapped[int | None] = mapped_column(ForeignKey("consumables.id"), index=True, nullable=True)
    consumable_identifier: Mapped[str | None] = mapped_column(String(64), index=True, nullable=True)
    request_id: Mapped[int | None] = mapped_column(ForeignKey("requests.id"), index=True, nullable=True)
    request_identifier: Mapped[str | None] = mapped_column(String(64), index=True, nullable=True)
    gate_pass_id: Mapped[int | None] = mapped_column(ForeignKey("gate_passes.id"), index=True, nullable=True)
    gate_pass_identifier: Mapped[str | None] = mapped_column(String(64), index=True, nullable=True)
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


class ConsumableOperationType(str, enum.Enum):
    initial_inward = "Initial Inward / Batch Receipt"
    adjustment = "Stock Adjustment / Correction"
    issue = "Disbursement / Issue"


class Consumable(Base):
    __tablename__ = "consumables"
    __table_args__ = (
        UniqueConstraint("consumable_id", name="uq_consumables_consumable_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    consumable_id: Mapped[str] = mapped_column(String(64), index=True)
    name: Mapped[str] = mapped_column(String(255))
    category: Mapped[str] = mapped_column(String(120))
    batch_id: Mapped[str] = mapped_column(String(120))
    location: Mapped[str] = mapped_column(String(255))
    available_stock: Mapped[int] = mapped_column(Integer, nullable=False)
    threshold: Mapped[int] = mapped_column(Integer, nullable=False)
    batch_quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    expiry_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )


class ConsumableStockMovement(Base):
    __tablename__ = "consumable_stock_movements"
    __table_args__ = (
        UniqueConstraint("movement_id", name="uq_consumable_stock_movements_movement_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    movement_id: Mapped[str] = mapped_column(String(64), index=True)
    consumable_id: Mapped[int] = mapped_column(ForeignKey("consumables.id"), index=True)
    operation_type: Mapped[ConsumableOperationType] = mapped_column(
        Enum(ConsumableOperationType, native_enum=False, length=48),
    )
    delta_quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    post_balance: Mapped[int] = mapped_column(Integer, nullable=False)
    reference: Mapped[str] = mapped_column(String(500))
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        index=True,
    )
    created_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)


class ConsumableIssue(Base):
    __tablename__ = "consumable_issues"
    __table_args__ = (
        UniqueConstraint("issue_id", name="uq_consumable_issues_issue_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    issue_id: Mapped[str] = mapped_column(String(64), index=True)
    consumable_id: Mapped[int] = mapped_column(ForeignKey("consumables.id"), index=True)
    issue_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        index=True,
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    request_reference: Mapped[str | None] = mapped_column(String(255), nullable=True)
    issued_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    remaining_stock: Mapped[int] = mapped_column(Integer, nullable=False)
