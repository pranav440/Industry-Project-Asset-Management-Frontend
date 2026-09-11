from datetime import date
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
    movement_history: list[Any]
    maintenance_history: list[Any]
    audit_history: list[Any]

    model_config = {"from_attributes": True}


class AssetListResponse(BaseModel):
    items: list[AssetOut]
    page: int
    page_size: int
    total: int
    total_pages: int
