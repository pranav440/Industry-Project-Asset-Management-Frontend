import decimal
import re
from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

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
    request_source: str = "Internal"
    date_received: date | None = None
    external_reference: str | None = None
    contact_info: str | None = None
    estimated_cost: str | None = None
    procurement_reference: str | None = None
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


def format_file_size(size_bytes: int) -> str:
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    else:
        return f"{size_bytes / (1024 * 1024):.1f} MB"


class RequestAttachmentOut(BaseModel):
    attachment_id: str
    id: str
    request_id: str
    original_filename: str
    name: str
    content_type: str
    type: str
    file_size: int
    size: str
    uploaded_at: datetime
    uploadDate: str
    download_url: str
    preview_url: str

    model_config = {"from_attributes": True}


class RequestDetailOut(RequestListItemOut):
    history: list[RequestHistoryOut] = Field(default_factory=list)
    attachments: list[RequestAttachmentOut] = Field(default_factory=list)


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


class ExternalRequestCreate(BaseModel):
    request_source: Literal["External"] = "External"
    date_received: date
    external_reference: str | None = Field(default=None, max_length=255)
    requester_name: str = Field(min_length=1, max_length=160)
    department: str | None = Field(default=None, max_length=160)
    contact_info: str | None = Field(default=None, max_length=255)
    requester_email: str | None = Field(default=None, max_length=255)
    request_type: RequestTypeValue
    requested_item: str = Field(min_length=1, max_length=255)
    category: str = Field(min_length=1, max_length=120)
    quantity: int = Field(default=1, ge=1)
    estimated_cost: str | None = Field(default=None, max_length=64)
    procurement_reference: str | None = Field(default=None, max_length=255)
    priority: RequestPriorityValue
    justification: str = Field(min_length=1, max_length=500)
    processing_guidelines: str | None = Field(default=None, max_length=2000)

    @field_validator("requester_name")
    @classmethod
    def validate_requester_name(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("Requester name cannot be empty")
        return s

    @field_validator("requested_item")
    @classmethod
    def validate_requested_item(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("Requested item cannot be empty")
        return s

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("Category cannot be empty")
        return s

    @field_validator("justification")
    @classmethod
    def validate_justification(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("Justification cannot be empty")
        if len(s) > 500:
            raise ValueError("Justification must be at most 500 characters")
        return s

    @field_validator("estimated_cost")
    @classmethod
    def validate_estimated_cost(cls, v: str | None) -> str | None:
        if v is None:
            return None
        cleaned = v.strip()
        if not cleaned:
            return None
        if cleaned.startswith("₹") or cleaned.startswith("$"):
            cleaned = cleaned[1:].strip()
        cleaned_num = cleaned.replace(",", "")
        lower = cleaned_num.lower()
        if "nan" in lower or "inf" in lower:
            raise ValueError("Estimated cost must be a valid finite number")
        try:
            d = decimal.Decimal(cleaned_num)
        except (decimal.InvalidOperation, TypeError):
            raise ValueError("Estimated cost must be a valid non-negative number")
        if d.is_nan() or d.is_infinite():
            raise ValueError("Estimated cost must be a valid finite number")
        if d < 0:
            raise ValueError("Estimated cost cannot be negative")
        return f"{d:.2f}"



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


class AssetValuationCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    effective_date: date
    new_recorded_value: decimal.Decimal
    formula_used: str | None = Field(default=None, max_length=255)
    notes: str = Field(min_length=1, max_length=2000)
    reference: str | None = Field(default=None, max_length=255)

    @model_validator(mode="before")
    @classmethod
    def normalize_aliases(cls, data: Any) -> Any:
        if isinstance(data, dict):
            mapped = dict(data)
            if "effectiveDate" in mapped and "effective_date" not in mapped:
                mapped["effective_date"] = mapped["effectiveDate"]
            if "newRecordedValue" in mapped and "new_recorded_value" not in mapped:
                mapped["new_recorded_value"] = mapped["newRecordedValue"]
            if "formulaUsed" in mapped and "formula_used" not in mapped:
                mapped["formula_used"] = mapped["formulaUsed"]
            if "calculation_notes" in mapped and "notes" not in mapped:
                mapped["notes"] = mapped["calculation_notes"]
            return mapped
        return data

    @field_validator("new_recorded_value", mode="before")
    @classmethod
    def validate_new_recorded_value(cls, v: Any) -> decimal.Decimal:
        if v is None:
            raise ValueError("New recorded value is required")
        if isinstance(v, (int, float)):
            import math
            if math.isnan(v) or math.isinf(v):
                raise ValueError("New recorded value must be a finite number")
            if v < 0:
                raise ValueError("New recorded value cannot be negative")
            return decimal.Decimal(str(v)).quantize(decimal.Decimal("0.01"))
        if isinstance(v, decimal.Decimal):
            if v.is_nan() or v.is_infinite():
                raise ValueError("New recorded value must be a finite number")
            if v < 0:
                raise ValueError("New recorded value cannot be negative")
            return v.quantize(decimal.Decimal("0.01"))
        if isinstance(v, str):
            cleaned = v.strip()
            if cleaned.lower() in {"nan", "inf", "-inf", "+inf", "infinity", "-infinity"}:
                raise ValueError("New recorded value must be a finite number")
            cleaned = re.sub(r"[₹$,\s]", "", cleaned)
            if not cleaned:
                raise ValueError("New recorded value cannot be empty")
            try:
                val = decimal.Decimal(cleaned)
            except Exception:
                raise ValueError("New recorded value must be a valid numeric amount")
            if val.is_nan() or val.is_infinite():
                raise ValueError("New recorded value must be a finite number")
            if val < 0:
                raise ValueError("New recorded value cannot be negative")
            return val.quantize(decimal.Decimal("0.01"))
        raise ValueError("Invalid type for new recorded value")


class AssetValuationOut(BaseModel):
    valuation_id: str
    id: str
    asset_id: str
    assetId: str
    effective_date: date
    effectiveDate: str
    previous_value: float | None
    previousValue: float | None
    new_recorded_value: float
    newRecordedValue: float
    formula_used: str | None
    formulaUsed: str | None
    notes: str
    reference: str | None
    updated_by: str
    updatedBy: str
    recorded_at: datetime
    recordedAt: str

    model_config = ConfigDict(from_attributes=True)


class AssetValuationSummary(BaseModel):
    asset_id: str
    assetId: str
    original_acquisition_cost: str
    originalAcquisitionCost: str
    current_recorded_value: str
    currentRecordedValue: str
    last_valuation_update: str | None
    lastValuationUpdate: str | None
    configured_depreciation_formula: str | None
    configuredDepreciationFormula: str | None


class AssetValuationResponse(BaseModel):
    summary: AssetValuationSummary
    items: list[AssetValuationOut]
    valuations: list[AssetValuationOut]
    history: list[AssetValuationOut]
    total: int


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
