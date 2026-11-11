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
    id: str | None = None
    name: str
    status: AssetStatusValue
    category: str
    specification: str | None
    serial_number: str | None
    serialNumber: str | None = None
    location: str
    custodian: str
    custodianName: str | None = None
    purchase_date: date
    vendor_name: str
    total_cost: str
    totalCost: str | None = None
    warranty_period: str
    warrantyPeriod: str | None = None
    invoice_reference: str | None
    depreciation: str | None
    allocation_date: date | None
    assignedDate: str | None = None
    documents: dict[str, Any] | None
    qr_code_value: str
    qr_code_data_url: str
    icon: str | None = None
    category_key: str | None = None
    categoryKey: str | None = None
    movement_history: list["AssetMovementOut"] = Field(default_factory=list)
    maintenance_history: list["MaintenanceHistoryOut"] = Field(default_factory=list)
    audit_history: list["AuditLogOut"] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


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
    qr_code: str = Field(min_length=1, max_length=500)

    @field_validator("qr_code")
    @classmethod
    def validate_qr_code(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("QR code cannot be empty")
        return s


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


class EmployeeRequestCreate(BaseModel):
    request_type: RequestTypeValue = Field(default="Asset Request")
    requested_item: str = Field(min_length=1, max_length=255)
    category: str = Field(min_length=1, max_length=120)
    sub_category: str | None = Field(default=None, max_length=120)
    quantity: int = Field(default=1, ge=1)
    priority: RequestPriorityValue = Field(default="Medium")
    justification: str = Field(min_length=1, max_length=2000)
    estimated_cost: str | None = Field(default=None, max_length=64)
    department: str | None = Field(default=None, max_length=160)
    processing_guidelines: str | None = Field(default=None, max_length=2000)

    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    @model_validator(mode="before")
    @classmethod
    def normalize_aliases(cls, data: Any) -> Any:
        if isinstance(data, dict):
            d = dict(data)
            if "requested_item" not in d:
                if "requestedItem" in d:
                    d["requested_item"] = d["requestedItem"]
                elif "itemName" in d:
                    d["requested_item"] = d["itemName"]
            if "request_type" not in d and "requestType" in d:
                d["request_type"] = d["requestType"]
            if "sub_category" not in d and "subCategory" in d:
                d["sub_category"] = d["subCategory"]
            if "estimated_cost" not in d and "estimatedCost" in d:
                d["estimated_cost"] = d["estimatedCost"]
            if "processing_guidelines" not in d and "processingGuidelines" in d:
                d["processing_guidelines"] = d["processingGuidelines"]
            return d
        return data

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
    qr_code_value: str | None = None
    qr_code_data_url: str | None = None

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
    qr_code: str = Field(min_length=1, max_length=500)

    @field_validator("qr_code")
    @classmethod
    def validate_qr_code(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("QR code cannot be empty")
        return s

class GatePassQRValidateRequest(BaseModel):
    qr_code: str = Field(min_length=1, max_length=500)
    expected_pass_id: str | None = Field(default=None, max_length=64)
    target_action: Literal["exit", "entry", "inspect"] = "inspect"


class GatePassQRValidationOut(BaseModel):
    valid: bool
    pass_id: str | None = None
    pass_type: str | None = None
    status: str | None = None
    asset_or_item: str | None = None
    quantity: int | None = None
    destination: str | None = None
    requester_name: str | None = None
    action_eligible: bool = False
    eligibility_reason: str | None = None
    resolved_format: str | None = None
    message: str



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
    asset_status: AssetStatusValue | None = None


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
    asset_status: str | None = None


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


class EmployeeConsumableIssueOut(BaseModel):
    id: str
    issue_id: str
    item_name: str
    itemName: str
    specification: str
    category: str
    category_key: str
    categoryKey: str
    quantity_issued: int
    quantityIssued: int
    fulfillment_date: str
    fulfillmentDate: str
    raw_date: str
    rawDate: str
    related_request_id: str
    relatedRequestId: str
    status: str = "Fulfilled / Issued"
    reference: str
    icon: str
    is_current_month: bool
    isCurrentMonth: bool

    model_config = ConfigDict(populate_by_name=True)


class EmployeeConsumptionCategoryMetric(BaseModel):
    name: str
    category_key: str
    categoryKey: str
    units: int
    percentage: float
    color_class: str
    colorClass: str
    color: str

    model_config = ConfigDict(populate_by_name=True)


class EmployeeConsumptionSummaryOut(BaseModel):
    period: str
    cycle_reference: str
    cycleReference: str
    total_issued: int
    totalIssued: int
    active_categories_count: int
    activeCategoriesCount: int
    distinct_categories_count: int
    distinctCategoriesCount: int
    categories: list[EmployeeConsumptionCategoryMetric]

    model_config = ConfigDict(populate_by_name=True)


class EmployeeConsumptionListResponse(BaseModel):
    items: list[EmployeeConsumableIssueOut]
    summary: EmployeeConsumptionSummaryOut
    all_time_total_units: int
    allTimeTotalUnits: int
    this_month_total_units: int
    thisMonthTotalUnits: int
    total: int
    page: int
    page_size: int
    total_pages: int

    model_config = ConfigDict(populate_by_name=True)


class EmployeeDashboardSummaryMetrics(BaseModel):
    open_requests: int
    openRequests: int
    awaiting_approval: int
    awaitingApproval: int
    closed_requests: int
    closedRequests: int
    total_requests: int
    totalRequests: int
    assigned_assets_count: int
    assignedAssetsCount: int
    assets_in_maintenance_count: int
    assetsInMaintenanceCount: int
    consumables_received: int
    consumablesReceived: int

    model_config = ConfigDict(populate_by_name=True)


class EmployeeDashboardResponse(BaseModel):
    summary: EmployeeDashboardSummaryMetrics
    open_requests: int
    openRequests: int
    awaiting_approval: int
    awaitingApproval: int
    assigned_assets_count: int
    assignedAssetsCount: int
    assets_in_maintenance_count: int
    assetsInMaintenanceCount: int
    consumables_received: int
    consumablesReceived: int
    recent_requests: list[RequestListItemOut]
    recentRequests: list[RequestListItemOut]
    assigned_assets: list[AssetOut]
    assignedAssets: list[AssetOut]
    consumption: EmployeeConsumptionSummaryOut
    consumption_summary: EmployeeConsumptionSummaryOut
    consumptionSummary: EmployeeConsumptionSummaryOut
    recent_consumable_issues: list[EmployeeConsumableIssueOut]
    recentConsumableIssues: list[EmployeeConsumableIssueOut]

    model_config = ConfigDict(populate_by_name=True)


class HostKpiActiveGatePasses(BaseModel):
    total: int = 0
    outbound: int = 0
    inboundScheduled: int = 0
    inbound_scheduled: int = 0
    badgeText: str = "Live"
    badge_text: str = "Live"

    model_config = ConfigDict(populate_by_name=True)


class HostKpiPendingActions(BaseModel):
    total: int = 0
    subtext: str = "Verification & check-in required"
    badgeText: str = "Priority"
    badge_text: str = "Priority"

    model_config = ConfigDict(populate_by_name=True)


class HostKpiMovement(BaseModel):
    total: int = 0
    completed: int = 0
    inTransit: int = 0
    in_transit: int = 0
    trend: str = "+0%"

    model_config = ConfigDict(populate_by_name=True)


class HostKpiEscalated(BaseModel):
    total: int = 0
    subtext: str = "Security officer review queue"
    badgeText: str = "Review"
    badge_text: str = "Review"

    model_config = ConfigDict(populate_by_name=True)


class HostDashboardKpis(BaseModel):
    activeGatePasses: HostKpiActiveGatePasses
    active_gate_passes: HostKpiActiveGatePasses
    pendingHostActions: HostKpiPendingActions
    pending_host_actions: HostKpiPendingActions
    todaysMovement: HostKpiMovement
    todays_movement: HostKpiMovement
    escalatedGatePasses: HostKpiEscalated
    escalated_gate_passes: HostKpiEscalated

    model_config = ConfigDict(populate_by_name=True)


class HostGatePassActivityItemOut(BaseModel):
    id: str
    pass_id: str
    passType: str
    pass_type: str
    assetName: str
    asset_name: str
    serialNumber: str
    serial_number: str
    requesterName: str
    requester_name: str
    department: str
    schedule: str
    status: str
    destination: str | None = None
    gateLocation: str | None = None
    gate_location: str | None = None

    model_config = ConfigDict(populate_by_name=True)


class HostMovementScanItemOut(BaseModel):
    id: str
    movement_id: str
    status: str
    assetTag: str
    asset_tag: str
    assetName: str
    asset_name: str
    route: str
    station: str
    timeAgo: str
    time_ago: str
    initiated_at: str | None = None

    model_config = ConfigDict(populate_by_name=True)


class HostPendingActionItemOut(BaseModel):
    id: str
    passId: str
    pass_id: str
    title: str
    requester: str
    actionText: str
    action_text: str
    actionType: str
    action_type: str
    icon: str
    isPrimary: bool
    is_primary: bool
    buttonText: str
    button_text: str
    assetName: str
    asset_name: str
    serialNumber: str
    serial_number: str
    destination: str
    carrier: str
    instructions: str

    model_config = ConfigDict(populate_by_name=True)


class HostOperationalAlertItemOut(BaseModel):
    id: str
    title: str
    description: str
    location: str
    timeAgo: str
    time_ago: str
    severity: str
    icon: str
    dotColor: str
    dot_color: str

    model_config = ConfigDict(populate_by_name=True)


class HostDashboardResponse(BaseModel):
    kpis: HostDashboardKpis
    summary: HostDashboardKpis
    activeGatePasses: HostKpiActiveGatePasses
    active_gate_passes: HostKpiActiveGatePasses
    pendingHostActions: HostKpiPendingActions
    pending_host_actions: HostKpiPendingActions
    todaysMovement: HostKpiMovement
    todays_movement: HostKpiMovement
    escalatedGatePasses: HostKpiEscalated
    escalated_gate_passes: HostKpiEscalated
    gatePassActivity: list[HostGatePassActivityItemOut]
    gate_pass_activity: list[HostGatePassActivityItemOut]
    movementOverview: list[HostMovementScanItemOut]
    movement_overview: list[HostMovementScanItemOut]
    pendingActions: list[HostPendingActionItemOut]
    pending_actions: list[HostPendingActionItemOut]
    operationalAlerts: list[HostOperationalAlertItemOut]
    operational_alerts: list[HostOperationalAlertItemOut]

    model_config = ConfigDict(populate_by_name=True)


class HostMovementListResponse(BaseModel):
    items: list[HostMovementScanItemOut]
    total: int
    page: int
    page_size: int
    total_pages: int

    model_config = ConfigDict(populate_by_name=True)


class HostAlertListResponse(BaseModel):
    items: list[HostOperationalAlertItemOut]
    total: int

    model_config = ConfigDict(populate_by_name=True)


class GuardDashboardKpiItem(BaseModel):
    total: int = 0
    badgeText: str = ""
    badge_text: str = ""
    subtext: str = ""

    model_config = ConfigDict(populate_by_name=True)


class GuardDashboardKpis(BaseModel):
    expectedInbound: GuardDashboardKpiItem
    expected_inbound: GuardDashboardKpiItem
    expectedOutbound: GuardDashboardKpiItem
    expected_outbound: GuardDashboardKpiItem
    pendingVerification: GuardDashboardKpiItem
    pending_verification: GuardDashboardKpiItem
    todaysCompletedEntries: GuardDashboardKpiItem
    todays_completed_entries: GuardDashboardKpiItem

    model_config = ConfigDict(populate_by_name=True)


class GuardVerificationQueueItemOut(BaseModel):
    id: str
    requesterName: str
    requester_name: str
    requesterBadge: str = "Staff"
    requester_badge: str = "Staff"
    department: str = "Administration"
    assetName: str
    asset_name: str
    serialNumber: str = "—"
    serial_number: str = "—"
    type: str
    status: str
    action: str
    carrier: str | None = None
    destination: str | None = None
    origin: str | None = None
    flagReason: str | None = None
    flag_reason: str | None = None

    model_config = ConfigDict(populate_by_name=True)


class GuardRecentActivityItemOut(BaseModel):
    id: str
    title: str
    time: str
    passId: str
    pass_id: str
    plateOrBadge: str
    plate_or_badge: str
    assetName: str
    asset_name: str
    notes: str
    badgeText: str
    badge_text: str
    isFlagged: bool = False
    is_flagged: bool = False
    type: str

    model_config = ConfigDict(populate_by_name=True)


class GuardUpcomingMovementItemOut(BaseModel):
    id: str
    time: str
    title: str
    type: str
    personLabel: str = "Requester"
    person_label: str = "Requester"
    personName: str
    person_name: str
    details: str
    statusBadge: str
    status_badge: str

    model_config = ConfigDict(populate_by_name=True)


class GuardCheckpointAlertItemOut(BaseModel):
    id: str
    title: str
    severity: str
    badgeText: str
    badge_text: str
    icon: str
    description: str
    passId: str | None = None
    pass_id: str | None = None
    serialNumber: str | None = None
    serial_number: str | None = None
    acknowledged: bool = False

    model_config = ConfigDict(populate_by_name=True)


class GuardDashboardResponse(BaseModel):
    kpis: GuardDashboardKpis
    verificationQueue: list[GuardVerificationQueueItemOut]
    verification_queue: list[GuardVerificationQueueItemOut]
    recentActivity: list[GuardRecentActivityItemOut]
    recent_activity: list[GuardRecentActivityItemOut]
    upcomingMovements: list[GuardUpcomingMovementItemOut]
    upcoming_movements: list[GuardUpcomingMovementItemOut]
    checkpointAlerts: list[GuardCheckpointAlertItemOut]
    checkpoint_alerts: list[GuardCheckpointAlertItemOut]

    model_config = ConfigDict(populate_by_name=True)


class GuardLogChecklistItemOut(BaseModel):
    title: str
    status: str
    verified: bool

    model_config = ConfigDict(populate_by_name=True)


class GuardLogTimelineEventOut(BaseModel):
    time: str
    title: str
    desc: str
    completed: bool

    model_config = ConfigDict(populate_by_name=True)


class GuardMovementLogRecordOut(BaseModel):
    id: str
    passId: str
    pass_id: str
    assetId: str
    asset_id: str
    assetName: str
    asset_name: str
    serialNumber: str
    serial_number: str
    category: Literal["Physical Movement", "Administrative", "Security Escalation"] = "Physical Movement"
    direction: Literal["Outward", "Inward", "N/A"]
    directionLabel: str
    direction_label: str
    requesterName: str
    requester_name: str
    requesterBadge: str
    requester_badge: str
    department: str
    date: str
    dateDisplay: str
    date_display: str
    timeDisplay: str
    time_display: str
    status: Literal["Cleared", "Pending", "Flagged"]
    guardName: str
    guard_name: str
    guardBadge: str
    guard_badge: str
    checkpoint: str
    checkpointFull: str
    checkpoint_full: str
    approvingAdmin: str
    approving_admin: str
    custodian: str
    carrierVehicle: str
    carrier_vehicle: str
    manifestHash: str
    manifest_hash: str
    tamperSealId: str
    tamper_seal_id: str
    inspectedQty: int
    inspected_qty: int
    expectedQty: int
    expected_qty: int
    hasDiscrepancy: bool
    has_discrepancy: bool
    discrepancyStatusTitle: str
    discrepancy_status_title: str
    discrepancyDetails: str
    discrepancy_details: str
    guardRemarks: str
    guard_remarks: str
    checklist: list[GuardLogChecklistItemOut] = Field(default_factory=list)
    timeline: list[GuardLogTimelineEventOut] = Field(default_factory=list)

    model_config = ConfigDict(populate_by_name=True)


class GuardLogsKpisOut(BaseModel):
    totalMovements: int
    total_movements: int
    inboundEntries: int
    inbound_entries: int
    outboundExits: int
    outbound_exits: int
    flaggedMovements: int
    flagged_movements: int
    totalRecords: int = 0
    total_records: int = 0

    model_config = ConfigDict(populate_by_name=True)


class GuardMovementLogListResponse(BaseModel):
    items: list[GuardMovementLogRecordOut]
    total: int
    page: int
    pageSize: int
    page_size: int
    totalPages: int
    total_pages: int
    kpis: GuardLogsKpisOut

    model_config = ConfigDict(populate_by_name=True)


class GuardEscalationTimelineEventOut(BaseModel):
    id: str
    timestamp: str
    event: str
    actor: str
    actorRole: str = "Officer"
    actor_role: str = "Officer"
    note: str | None = None

    model_config = ConfigDict(populate_by_name=True)


class GuardEscalationRegisterItemOut(BaseModel):
    id: str
    passId: str
    pass_id: str
    assetId: str
    asset_id: str
    assetName: str
    asset_name: str
    requesterName: str
    requester_name: str
    department: str
    destination: str
    passType: str
    pass_type: str
    gatePassStatus: str
    gate_pass_status: str
    holdStatus: Literal["Active", "Cleared"]
    hold_status: Literal["Active", "Cleared"]
    holdStatusTitle: str
    hold_status_title: str
    escalationReason: str
    escalation_reason: str
    actionRequired: str | None = None
    action_required: str | None = None
    escalatedBy: str
    escalated_by: str
    escalationTimestamp: datetime
    escalation_timestamp: datetime
    dateDisplay: str
    date_display: str
    timeDisplay: str
    time_display: str
    checkpoint: str
    overrideBy: str | None = None
    override_by: str | None = None
    overrideTimestamp: datetime | None = None
    override_timestamp: datetime | None = None
    overrideNote: str | None = None
    override_note: str | None = None
    timeline: list[GuardEscalationTimelineEventOut] = []

    model_config = ConfigDict(populate_by_name=True)


class GuardEscalationKpisOut(BaseModel):
    totalHolds: int
    total_holds: int
    activeHolds: int
    active_holds: int
    clearedOverridden: int
    cleared_overridden: int

    model_config = ConfigDict(populate_by_name=True)


class GuardEscalationRegisterResponse(BaseModel):
    items: list[GuardEscalationRegisterItemOut]
    total: int
    page: int
    pageSize: int
    page_size: int
    totalPages: int
    total_pages: int
    kpis: GuardEscalationKpisOut

    model_config = ConfigDict(populate_by_name=True)


class AdminDashboardSummary(BaseModel):
    open_requests: int
    pending_approvals: int
    low_stock_alerts: int
    monthly_spend: float | None = None
    budget_utilized: float | None = None


class AdminDashboardAssetInventory(BaseModel):
    total_assets: int
    by_status: dict[str, int]


class AdminDashboardRequestItem(BaseModel):
    request_id: str
    requested_item: str
    status: str
    request_date: str
    approval_date: str | None = None
    fulfillment_date: str | None = None


class AdminDashboardExpiryAlert(BaseModel):
    item_id: str
    name: str
    expiry_date: str
    severity: str
    days_remaining: int


class AdminDashboardStockLevel(BaseModel):
    category: str
    available_stock: int
    threshold: int
    status: str


class AdminDashboardResponse(BaseModel):
    summary: AdminDashboardSummary
    asset_inventory: AdminDashboardAssetInventory
    my_requests: list[AdminDashboardRequestItem]
    expiry_alerts: list[AdminDashboardExpiryAlert]
    stock_levels: list[AdminDashboardStockLevel]
    department_consumption: dict[str, Any] | None = None
    recent_pos: list[dict[str, Any]] | None = None

    model_config = ConfigDict(populate_by_name=True)





