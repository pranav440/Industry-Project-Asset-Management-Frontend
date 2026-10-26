import base64
import decimal
import io
import re
import uuid
from datetime import datetime, time

import qrcode
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_admin
from app.models import (
    Asset,
    AssetMovement,
    AssetMovementStatus,
    AssetStatus,
    AssetValuation,
    AuditLog,
    Maintenance,
    MaintenanceStatus,
    MaintenanceType,
    User,
)
from app.schemas import (
    AssetCreate,
    AssetListResponse,
    AssetMovementOut,
    AssetOut,
    AssetTransferOut,
    AssetTransferRequest,
    AssetUpdate,
    AssetValuationCreate,
    AssetValuationOut,
    AssetValuationResponse,
    AssetValuationSummary,
    AuditLogOut,
    MaintenanceHistoryOut,
    MaintenanceOut,
    MaintenanceCreate,
)

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
    return _to_response_with_history(asset, [], [], [])


def _movement_response(movement: AssetMovement) -> AssetMovementOut:
    return AssetMovementOut(
        movement_id=movement.movement_id,
        from_location=movement.from_location,
        to_location=movement.to_location,
        from_custodian=movement.from_custodian,
        to_custodian=movement.to_custodian,
        reason=movement.reason,
        status=movement.status.value,
        initiated_by_user_id=movement.initiated_by_user_id,
        initiated_at=movement.initiated_at,
        completed_at=movement.completed_at,
    )


def _maintenance_response(record: Maintenance, asset: Asset, user: User | None) -> MaintenanceOut:
    return MaintenanceOut(
        maintenance_id=record.maintenance_id,
        asset_id=asset.asset_id,
        service_date=record.service_date.date(),
        maintenance_type=record.maintenance_type.value,
        service_vendor=record.service_vendor,
        technician=record.technician,
        maintenance_cost=record.maintenance_cost,
        status=record.status.value,
        service_notes=record.service_notes,
        created_at=record.created_at,
        created_by=user.full_name if user is not None else str(record.created_by_user_id),
    )


def _maintenance_history_response(record: Maintenance) -> MaintenanceHistoryOut:
    amount = f"{record.maintenance_cost:,.2f}".rstrip("0").rstrip(".")
    return MaintenanceHistoryOut(
        id=record.maintenance_id,
        date=record.service_date.strftime("%d %b %Y"),
        serviceEvent=record.maintenance_type.value,
        vendor=record.service_vendor,
        cost=f"₹{amount}",
        status=record.status.value,
    )


def _to_response_with_history(
    asset: Asset,
    movements: list[AssetMovement],
    audits: list[AuditLog],
    maintenance: list[Maintenance],
) -> AssetOut:
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
        movement_history=[_movement_response(movement) for movement in movements],
        maintenance_history=[_maintenance_history_response(record) for record in maintenance],
        audit_history=[AuditLogOut(
            id=audit.id,
            action=audit.action,
            asset_identifier=audit.asset_identifier,
            actor_user_id=audit.actor_user_id,
            occurred_at=audit.occurred_at,
            before_state=audit.before_state,
            after_state=audit.after_state,
            movement_id=audit.movement_id,
            metadata=audit.metadata_json,
        ) for audit in audits],
    )


def _asset_history(db: Session, asset: Asset) -> tuple[list[AssetMovement], list[AuditLog], list[Maintenance]]:
    movements = db.scalars(
        select(AssetMovement)
        .where(AssetMovement.asset_id == asset.id)
        .order_by(AssetMovement.initiated_at.asc(), AssetMovement.id.asc())
    ).all()
    audits = db.scalars(
        select(AuditLog)
        .where(AuditLog.asset_id == asset.id)
        .order_by(AuditLog.occurred_at.asc(), AuditLog.id.asc())
    ).all()
    maintenance = db.scalars(
        select(Maintenance)
        .where(Maintenance.asset_id == asset.id)
        .order_by(Maintenance.service_date.desc(), Maintenance.id.desc())
    ).all()
    return movements, audits, maintenance


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
    movements, audits, maintenance = _asset_history(db, asset)
    return _to_response_with_history(asset, movements, audits, maintenance)


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
    movements, audits, maintenance = _asset_history(db, asset)
    return _to_response_with_history(asset, movements, audits, maintenance)


@router.post("/{asset_id}/transfer", response_model=AssetTransferOut, status_code=status.HTTP_201_CREATED)
def initiate_transfer(
    asset_id: str,
    body: AssetTransferRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AssetTransferOut:
    destination = body.destination_location.strip()
    new_custodian = body.new_custodian.strip()
    if not destination:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Destination location is required")
    if not new_custodian:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="New custodian is required")

    asset = db.scalar(select(Asset).where(Asset.asset_id == asset_id).with_for_update())
    if asset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")
    if asset.status == AssetStatus.disposed:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Disposed assets cannot be transferred")

    active_transfer = db.scalar(
        select(AssetMovement.id).where(
            AssetMovement.asset_id == asset.id,
            AssetMovement.status.in_((AssetMovementStatus.initiated, AssetMovementStatus.in_transit)),
        ).limit(1)
    )
    if active_transfer is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Asset already has an active transfer")

    before_state = {
        "status": asset.status.value,
        "location": asset.location,
        "custodian": asset.custodian,
    }
    movement_id = f"TRF-{uuid.uuid4().hex[:12].upper()}"
    movement = AssetMovement(
        asset_id=asset.id,
        movement_id=movement_id,
        from_location=asset.location,
        to_location=destination,
        from_custodian=asset.custodian,
        to_custodian=new_custodian,
        reason=body.transfer_reason.strip() if body.transfer_reason else None,
        status=AssetMovementStatus.in_transit,
        initiated_by_user_id=admin.id,
    )
    asset.status = AssetStatus.in_transit
    audit = AuditLog(
        action="Asset transfer initiated",
        asset_id=asset.id,
        asset_identifier=asset.asset_id,
        actor_user_id=admin.id,
        before_state=before_state,
        after_state={"status": asset.status.value},
        movement_id=movement_id,
        metadata_json={"destination_location": destination, "new_custodian": new_custodian},
    )
    db.add_all((movement, audit))
    db.commit()
    db.refresh(asset)
    db.refresh(movement)
    movements, audits, maintenance = _asset_history(db, asset)
    return AssetTransferOut(
        movement=_movement_response(movement),
        asset=_to_response_with_history(asset, movements, audits, maintenance),
    )


@router.get("/{asset_id}/maintenance", response_model=list[MaintenanceOut])
def list_maintenance(
    asset_id: str,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[MaintenanceOut]:
    asset = db.scalar(select(Asset).where(Asset.asset_id == asset_id))
    if asset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")
    records = db.scalars(
        select(Maintenance)
        .where(Maintenance.asset_id == asset.id)
        .order_by(Maintenance.service_date.desc(), Maintenance.id.desc())
    ).all()
    return [
        _maintenance_response(record, asset, db.get(User, record.created_by_user_id))
        for record in records
    ]


@router.post("/{asset_id}/maintenance", response_model=MaintenanceOut, status_code=status.HTTP_201_CREATED)
def create_maintenance(
    asset_id: str,
    body: MaintenanceCreate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> MaintenanceOut:
    service_vendor = body.service_vendor.strip()
    if not service_vendor:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Service vendor is required")

    asset = db.scalar(select(Asset).where(Asset.asset_id == asset_id).with_for_update())
    if asset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")

    maintenance_id = f"MNT-{uuid.uuid4().hex[:12].upper()}"
    record = Maintenance(
        maintenance_id=maintenance_id,
        asset_id=asset.id,
        service_date=_to_datetime(body.service_date),
        maintenance_type=MaintenanceType(body.maintenance_type),
        service_vendor=service_vendor,
        technician=body.technician.strip() if body.technician and body.technician.strip() else None,
        maintenance_cost=body.maintenance_cost,
        status=MaintenanceStatus.completed,
        service_notes=body.service_notes.strip() if body.service_notes and body.service_notes.strip() else None,
        created_by_user_id=admin.id,
    )
    audit = AuditLog(
        action="Maintenance record created",
        asset_id=asset.id,
        asset_identifier=asset.asset_id,
        actor_user_id=admin.id,
        before_state={"asset_status": asset.status.value},
        after_state={"asset_status": asset.status.value, "maintenance_id": maintenance_id},
        metadata_json={"maintenance_type": body.maintenance_type, "maintenance_status": "Completed"},
    )
    db.add_all((record, audit))
    db.commit()
    db.refresh(record)
    return _maintenance_response(record, asset, admin)


def _parse_monetary_baseline(total_cost: str | None) -> decimal.Decimal | None:
    if not total_cost:
        return None
    cleaned = re.sub(r"[^\d.]", "", total_cost.strip())
    if not cleaned:
        return None
    try:
        val = decimal.Decimal(cleaned)
        if val.is_nan() or val.is_infinite() or val < 0:
            return None
        return val.quantize(decimal.Decimal("0.01"))
    except Exception:
        return None


def _format_currency(value: decimal.Decimal | float | int | str | None) -> str:
    if value is None:
        return "Not recorded"
    if isinstance(value, str):
        cleaned = re.sub(r"[^\d.]", "", value.strip())
        if not cleaned:
            return value.strip() if value.strip() else "Not recorded"
        try:
            val_float = float(cleaned)
        except ValueError:
            return value.strip()
    else:
        val_float = float(value)
    formatted = f"{val_float:,.2f}".rstrip("0").rstrip(".")
    return f"₹{formatted}"


def _generate_valuation_id(db: Session) -> str:
    year = datetime.now().year
    while True:
        candidate = f"VAL-{year}-{uuid.uuid4().hex[:8].upper()}"
        if db.scalar(select(AssetValuation.id).where(AssetValuation.valuation_id == candidate)) is None:
            return candidate


def _valuation_out(val: AssetValuation) -> AssetValuationOut:
    prev_float = float(val.previous_value) if val.previous_value is not None else None
    new_float = float(val.new_recorded_value)
    return AssetValuationOut(
        valuation_id=val.valuation_id,
        id=val.valuation_id,
        asset_id=val.asset_id,
        assetId=val.asset_id,
        effective_date=val.effective_date,
        effectiveDate=val.effective_date.isoformat(),
        previous_value=prev_float,
        previousValue=prev_float,
        new_recorded_value=new_float,
        newRecordedValue=new_float,
        formula_used=val.formula_used,
        formulaUsed=val.formula_used,
        notes=val.notes,
        reference=val.reference,
        updated_by=val.updated_by,
        updatedBy=val.updated_by,
        recorded_at=val.recorded_at,
        recordedAt=val.recorded_at.strftime("%Y-%m-%d %H:%M:%S") if val.recorded_at else "",
    )


@router.post("/{asset_id}/valuations", response_model=AssetValuationOut, status_code=status.HTTP_201_CREATED)
def record_valuation(
    asset_id: str,
    body: AssetValuationCreate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AssetValuationOut:
    asset = db.scalar(select(Asset).where(Asset.asset_id == asset_id).with_for_update())
    if asset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")

    latest_valuation = db.scalar(
        select(AssetValuation)
        .where(AssetValuation.asset_id == asset.asset_id)
        .order_by(AssetValuation.recorded_at.desc(), AssetValuation.id.desc())
        .limit(1)
    )

    if latest_valuation is not None:
        previous_value = latest_valuation.new_recorded_value
    else:
        previous_value = _parse_monetary_baseline(asset.total_cost)

    valuation_id = _generate_valuation_id(db)
    user_display = f"{admin.full_name} ({admin.role.value})" if admin.role else admin.full_name

    valuation = AssetValuation(
        valuation_id=valuation_id,
        asset_id=asset.asset_id,
        effective_date=body.effective_date,
        previous_value=previous_value,
        new_recorded_value=body.new_recorded_value,
        formula_used=body.formula_used.strip() if body.formula_used and body.formula_used.strip() else None,
        notes=body.notes.strip(),
        reference=body.reference.strip() if body.reference and body.reference.strip() else None,
        updated_by=user_display,
        updated_by_user_id=admin.id,
    )

    audit = AuditLog(
        action="asset_valuation_recorded",
        asset_id=asset.id,
        asset_identifier=asset.asset_id,
        actor_user_id=admin.id,
        before_state={
            "valuation": float(previous_value) if previous_value is not None else None,
            "recorded_value": str(previous_value) if previous_value is not None else "Not recorded",
        },
        after_state={
            "valuation": float(body.new_recorded_value),
            "recorded_value": str(body.new_recorded_value),
            "valuation_id": valuation_id,
        },
        metadata_json={
            "valuation_id": valuation_id,
            "effective_date": body.effective_date.isoformat(),
            "formula_used": body.formula_used.strip() if body.formula_used and body.formula_used.strip() else None,
            "reference": body.reference.strip() if body.reference and body.reference.strip() else None,
            "notes": body.notes.strip(),
        },
    )

    try:
        db.add_all((valuation, audit))
        db.commit()
        db.refresh(valuation)
    except Exception:
        db.rollback()
        raise

    return _valuation_out(valuation)


@router.get("/{asset_id}/valuations", response_model=AssetValuationResponse)
def get_asset_valuations(
    asset_id: str,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AssetValuationResponse:
    asset = db.scalar(select(Asset).where(Asset.asset_id == asset_id))
    if asset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")

    records = db.scalars(
        select(AssetValuation)
        .where(AssetValuation.asset_id == asset.asset_id)
        .order_by(AssetValuation.effective_date.desc(), AssetValuation.recorded_at.desc(), AssetValuation.id.desc())
    ).all()

    if records:
        latest = records[0]
        current_value = _format_currency(latest.new_recorded_value)
        last_update = latest.effective_date.isoformat()
    else:
        current_value = _format_currency(asset.total_cost)
        last_update = None

    summary = AssetValuationSummary(
        asset_id=asset.asset_id,
        assetId=asset.asset_id,
        original_acquisition_cost=_format_currency(asset.total_cost),
        originalAcquisitionCost=_format_currency(asset.total_cost),
        current_recorded_value=current_value,
        currentRecordedValue=current_value,
        last_valuation_update=last_update,
        lastValuationUpdate=last_update,
        configured_depreciation_formula=asset.depreciation,
        configuredDepreciationFormula=asset.depreciation,
    )
    items = [_valuation_out(r) for r in records]
    return AssetValuationResponse(
        summary=summary,
        items=items,
        valuations=items,
        history=items,
        total=len(items),
    )
