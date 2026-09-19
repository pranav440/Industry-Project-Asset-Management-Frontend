from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

Role = Literal["employee", "host", "admin", "guard", "superadmin"]


class LoginRequest(BaseModel):
    role: Role
    identifier: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=1, max_length=128)
    remember: bool = False


class UserOut(BaseModel):
    id: int
    full_name: str
    email: str
    employee_id: str
    role: Role

    model_config = {"from_attributes": True}


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserOut


class PasswordResetRequest(BaseModel):
    identifier: str = Field(min_length=1, max_length=255)


class PasswordResetConfirm(BaseModel):
    token: str = Field(min_length=20, max_length=256)
    password: str = Field(min_length=12, max_length=128)


AssetStatusValue = Literal["Active", "In Maintenance", "Disposed", "In Transit"]
AssetMovementStatusValue = Literal["Initiated", "In Transit", "Completed", "Cancelled"]
ConsumableOperationTypeValue = Literal[
    "Initial Inward / Batch Receipt",
    "Stock Adjustment / Correction",
    "Disbursement / Issue",
]
ConsumableStockStatusValue = Literal["In Stock", "Low Stock", "Out of Stock"]


class AssetCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    category: str = Field(min_length=1, max_length=120)
    specification: str | None = Field(default=None, max_length=255)
    serial_number: str | None = Field(default=None, max_length=120)
    location: str = Field(min_length=1, max_length=255)
    custodian: str = Field(min_length=1, max_length=255)
    purchase_date: date
    vendor_name: str = Field(min_length=1, max_length=255)
    total_cost: str = Field(min_length=1, max_length=64)
    warranty_period: str = Field(min_length=1, max_length=120)
    invoice_reference: str | None = Field(default=None, max_length=255)
    depreciation: str | None = Field(default=None, max_length=255)
    allocation_date: date | None = None
    documents: dict[str, Any] | None = None


class AssetUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    status: AssetStatusValue | None = None
    category: str | None = Field(default=None, min_length=1, max_length=120)
    specification: str | None = Field(default=None, max_length=255)
    serial_number: str | None = Field(default=None, max_length=120)
    location: str | None = Field(default=None, min_length=1, max_length=255)
    custodian: str | None = Field(default=None, min_length=1, max_length=255)
    purchase_date: date | None = None
    vendor_name: str | None = Field(default=None, min_length=1, max_length=255)
    total_cost: str | None = Field(default=None, min_length=1, max_length=64)
    warranty_period: str | None = Field(default=None, min_length=1, max_length=120)
    invoice_reference: str | None = Field(default=None, max_length=255)
    depreciation: str | None = Field(default=None, max_length=255)
    allocation_date: date | None = None
    documents: dict[str, Any] | None = None


class AssetOut(BaseModel):
    asset_id: str
    name: str
    status: AssetStatusValue
    category: str
    specification: str | None
    serial_number: str | None
    location: str
    custodian: str
    purchase_date: date
    vendor_name: str
    total_cost: str
    warranty_period: str
    invoice_reference: str | None
    depreciation: str | None
    allocation_date: date | None
    documents: dict[str, Any] | None
    qr_code_value: str
    qr_code_data_url: str
    movement_history: list["AssetMovementOut"]
    maintenance_history: list["MaintenanceHistoryOut"]
    audit_history: list["AuditLogOut"]

    model_config = {"from_attributes": True}


class AssetListResponse(BaseModel):
    items: list[AssetOut]
    page: int
    page_size: int
    total: int
    total_pages: int


class AssetTransferRequest(BaseModel):
    destination_location: str = Field(min_length=1, max_length=255)
    new_custodian: str = Field(min_length=1, max_length=255)
    transfer_reason: str | None = Field(default=None, max_length=500)


class AssetMovementOut(BaseModel):
    movement_id: str
    from_location: str
    to_location: str
    from_custodian: str
    to_custodian: str
    reason: str | None
    status: AssetMovementStatusValue
    initiated_by_user_id: int
    initiated_at: datetime
    completed_at: datetime | None


class AuditLogOut(BaseModel):
    id: int
    action: str
    asset_identifier: str
    actor_user_id: int
    occurred_at: datetime
    before_state: dict[str, Any] | None
    after_state: dict[str, Any] | None
    movement_id: str | None
    metadata: dict[str, Any] | None


RequestTypeValue = Literal["Asset Request", "Consumable Request"]
RequestPriorityValue = Literal["High", "Medium", "Low"]
RequestStatusValue = Literal["Pending", "In Review", "Fulfilled", "Rejected"]


class RequestListItemOut(BaseModel):
    request_id: str
    requester_name: str
    requester_email: str
    department: str
    request_type: RequestTypeValue
    requested_item: str
    category: str
    quantity: int = Field(ge=1)
    priority: RequestPriorityValue
    request_date: date
    status: RequestStatusValue
    justification: str
    processing_guidelines: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class RequestHistoryOut(BaseModel):
    history_id: str
    timestamp: datetime
    stage: RequestStatusValue
    action: str
    performed_by: str
    note: str | None

    model_config = {"from_attributes": True}


class RequestDetailOut(RequestListItemOut):
    history: list[RequestHistoryOut] = Field(default_factory=list)


class RequestListResponse(BaseModel):
    items: list[RequestListItemOut]
    total: int
    page: int
    page_size: int


class RequestTransitionRequest(BaseModel):
    target_status: RequestStatusValue
    operational_note: str | None = Field(default=None, max_length=2000)


class RequestTransitionOut(RequestDetailOut):
    pass


GatePassTypeValue = Literal["Asset Movement", "Returnable", "Non-Returnable", "Maintenance"]
GatePassStatusValue = Literal["Pending", "Approved", "Rejected", "Active", "Completed", "Escalated"]


class GatePassHistoryOut(BaseModel):
    history_id: str
    timestamp: datetime
    action: str
    performed_by: str
    note: str | None
    status_snapshot: str

    model_config = {"from_attributes": True}


class GatePassOut(BaseModel):
    pass_id: str
    pass_type: GatePassTypeValue
    request_date: date
    status: GatePassStatusValue
    requester_name: str
    department: str
    asset_or_item: str
    quantity: int = Field(ge=1)
    current_location: str | None
    destination: str
    movement_date: date | None
    purpose: str
    authorization_state: str
    decision_status: str
    decision_date: datetime | None
    decision_by: str | None
    exit_status: str | None
    exit_timestamp: datetime | None
    exit_gate: str | None
    exit_officer: str | None
    exit_notes: str | None
    entry_status: str | None
    entry_timestamp: datetime | None
    entry_gate: str | None
    entry_officer: str | None
    entry_notes: str | None
    escalation_is_escalated: bool
    escalation_reason: str | None
    escalation_timestamp: datetime | None
    escalation_action_required: str | None
    escalation_escalated_by: str | None
    created_at: datetime
    updated_at: datetime
    history: list[GatePassHistoryOut] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class GatePassListResponse(BaseModel):
    items: list[GatePassOut]
    total: int
    page: int
    page_size: int


class GatePassCreateRequest(BaseModel):
    pass_type: GatePassTypeValue = Field(min_length=1)
    asset_or_item: str = Field(min_length=1, max_length=255)
    quantity: int = Field(ge=1)
    destination: str = Field(min_length=1, max_length=255)
    movement_date: date
    purpose: str = Field(min_length=1, max_length=2000)


class GatePassDecisionRequest(BaseModel):
    target_status: Literal["Approved", "Rejected"]
    note: str | None = Field(default=None, max_length=2000)


class GatePassVerificationRequest(BaseModel):
    exit_gate: str | None = Field(default=None, min_length=1, max_length=120)
    exit_notes: str | None = Field(default=None, max_length=2000)
    entry_gate: str | None = Field(default=None, min_length=1, max_length=120)
    entry_notes: str | None = Field(default=None, max_length=2000)


class GatePassEscalationRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=2000)
    action_required: str = Field(min_length=1, max_length=255)


class GatePassOverrideRequest(BaseModel):
    note: str | None = Field(default=None, max_length=2000)


class AssetTransferOut(BaseModel):
    movement: AssetMovementOut
    asset: AssetOut


class MaintenanceCreate(BaseModel):
    service_date: date
    maintenance_type: Literal["Preventive", "Corrective"]
    service_vendor: str = Field(min_length=1, max_length=255)
    technician: str | None = Field(default=None, max_length=255)
    maintenance_cost: float = Field(ge=0, le=9999999999.99)
    service_notes: str | None = Field(default=None, max_length=2000)


class MaintenanceOut(BaseModel):
    maintenance_id: str
    asset_id: str
    service_date: date
    maintenance_type: Literal["Preventive", "Corrective"]
    service_vendor: str
    technician: str | None
    maintenance_cost: float
    status: Literal["Completed"]
    service_notes: str | None
    created_at: datetime
    created_by: str


class MaintenanceHistoryOut(BaseModel):
    id: str
    date: str
    serviceEvent: str
    vendor: str
    cost: str
    status: Literal["Completed", "Scheduled", "In Progress"]


class ConsumableCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    category: str = Field(min_length=1, max_length=120)
    batch_id: str = Field(min_length=1, max_length=120)
    location: str = Field(min_length=1, max_length=255)
    initial_stock: int = Field(ge=0)
    threshold: int = Field(ge=0)
    expiry_date: date | None = None


class ConsumableUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    category: str | None = Field(default=None, min_length=1, max_length=120)
    batch_id: str | None = Field(default=None, min_length=1, max_length=120)
    location: str | None = Field(default=None, min_length=1, max_length=255)
    threshold: int | None = Field(default=None, ge=0)
    expiry_date: date | None = None


class ConsumableStockOperation(BaseModel):
    operation_type: Literal["Initial Inward / Batch Receipt", "Stock Adjustment / Correction"]
    delta_quantity: int
    reference: str | None = Field(default=None, max_length=500)


class ConsumableIssueCreate(BaseModel):
    quantity: int = Field(gt=0)
    request_reference: str | None = Field(default=None, max_length=255)


class ConsumableMovementOut(BaseModel):
    movement_id: str
    timestamp: datetime
    operation_type: ConsumableOperationTypeValue
    delta_quantity: int
    post_balance: int
    reference: str
    created_by: str


class ConsumableIssueOut(BaseModel):
    issue_id: str
    issue_date: datetime
    quantity: int
    request_reference: str | None
    issued_by: str
    remaining_stock: int


class ConsumableOut(BaseModel):
    consumable_id: str
    name: str
    category: str
    batch_id: str
    location: str
    available_stock: int
    threshold: int
    batch_quantity: int
    expiry_date: date | None
    stock_status: ConsumableStockStatusValue
    issue_history: list[ConsumableIssueOut] = Field(default_factory=list)
    movement_ledger: list[ConsumableMovementOut] = Field(default_factory=list)


class ConsumableListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    total_pages: int
    items: list[ConsumableOut]
