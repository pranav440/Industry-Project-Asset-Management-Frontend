import base64
import io
import uuid
from datetime import datetime, time

import qrcode
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_admin
from app.models import Asset, AssetStatus, User
from app.schemas import AssetCreate, AssetListResponse, AssetOut, AssetUpdate

router = APIRouter(prefix="/api/assets", tags=["assets"])


def _asset_id(db: Session) -> str:
    while True:
        candidate = f"AST-{uuid.uuid4().hex[:12].upper()}"
        if db.scalar(select(Asset.id).where(Asset.asset_id == candidate)) is None:
            return candidate


def _qr_data_url(value: str) -> str:
    image = qrcode.make(value)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    return f"data:image/png;base64,{encoded}"


def _to_datetime(value):
    return datetime.combine(value, time.min) if value is not None else None


def _to_response(asset: Asset) -> AssetOut:
    return AssetOut(
        asset_id=asset.asset_id,
        name=asset.name,
        status=asset.status.value,
        category=asset.category,
        specification=asset.specification,
        serial_number=asset.serial_number,
        location=asset.location,
        custodian=asset.custodian,
        purchase_date=asset.purchase_date.date(),
        vendor_name=asset.vendor_name,
        total_cost=asset.total_cost,
        warranty_period=asset.warranty_period,
        invoice_reference=asset.invoice_reference,
        depreciation=asset.depreciation,
        allocation_date=asset.allocation_date.date() if asset.allocation_date else None,
        documents=asset.documents,
        qr_code_value=asset.qr_code_value,
        qr_code_data_url=asset.qr_code_data_url,
        movement_history=[],
        maintenance_history=[],
        audit_history=[],
    )


@router.get("", response_model=AssetListResponse)
def list_assets(
    location: str | None = Query(default=None),
    custodian: str | None = Query(default=None),
    category: str | None = Query(default=None),
    search: str | None = Query(default=None),
    status_filter: AssetStatus | None = Query(default=None, alias="status"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AssetListResponse:
    query = select(Asset)
    if location:
        query = query.where(Asset.location == location)
    if custodian:
        query = query.where(Asset.custodian == custodian)
    if category:
        query = query.where(Asset.category == category)
    if status_filter:
        query = query.where(Asset.status == status_filter)
    if search:
        pattern = f"%{search}%"
        query = query.where(or_(
            Asset.asset_id.ilike(pattern),
            Asset.name.ilike(pattern),
            Asset.category.ilike(pattern),
            Asset.location.ilike(pattern),
            Asset.custodian.ilike(pattern),
            Asset.status.ilike(pattern),
        ))

    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    items = db.scalars(
        query.order_by(Asset.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    ).all()
    total_pages = (total + page_size - 1) // page_size
    return AssetListResponse(
        items=[_to_response(asset) for asset in items],
        page=page,
        page_size=page_size,
        total=total,
        total_pages=total_pages,
    )


@router.get("/{asset_id}", response_model=AssetOut)
def get_asset(asset_id: str, _admin: User = Depends(require_admin), db: Session = Depends(get_db)) -> AssetOut:
    asset = db.scalar(select(Asset).where(Asset.asset_id == asset_id))
    if asset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")
    return _to_response(asset)


@router.post("", response_model=AssetOut, status_code=status.HTTP_201_CREATED)
def create_asset(body: AssetCreate, _admin: User = Depends(require_admin), db: Session = Depends(get_db)) -> AssetOut:
    asset_id = _asset_id(db)
    qr_value = f"assetmx:{asset_id}:{uuid.uuid4().hex}"
    asset = Asset(
        asset_id=asset_id,
        name=body.name.strip(),
        category=body.category.strip(),
        specification=body.specification.strip() if body.specification else None,
        serial_number=body.serial_number.strip() if body.serial_number else None,
        location=body.location.strip(),
        custodian=body.custodian.strip(),
        purchase_date=_to_datetime(body.purchase_date),
        vendor_name=body.vendor_name.strip(),
        total_cost=body.total_cost.strip(),
        warranty_period=body.warranty_period.strip(),
        invoice_reference=body.invoice_reference.strip() if body.invoice_reference else None,
        depreciation=body.depreciation.strip() if body.depreciation else None,
        allocation_date=_to_datetime(body.allocation_date),
        documents=body.documents,
        qr_code_value=qr_value,
        qr_code_data_url=_qr_data_url(qr_value),
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return _to_response(asset)


@router.put("/{asset_id}", response_model=AssetOut)
def update_asset(
    asset_id: str,
    body: AssetUpdate,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AssetOut:
    asset = db.scalar(select(Asset).where(Asset.asset_id == asset_id))
    if asset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        if field in {"purchase_date", "allocation_date"}:
            value = _to_datetime(value)
        if field == "status":
            value = AssetStatus(value)
        if isinstance(value, str) and field not in {"status"}:
            value = value.strip()
        setattr(asset, field, value)
    db.commit()
    db.refresh(asset)
    return _to_response(asset)