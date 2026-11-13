import base64
import csv
import decimal
import io
import re
import uuid
from datetime import date as dt_date, datetime, time
from typing import Any

import openpyxl
import qrcode
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_admin, require_admin_or_superadmin, require_authenticated_user
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
    UserRole,
)
from app.schemas import (
    AssetBulkUploadResponse,
    AssetBulkUploadRowError,
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
        asset_status=asset.status.value,
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


def _normalize_asset_category_key(cat: str | None) -> str:
    if not cat:
        return "compute"
    c = cat.lower()
    if any(k in c for k in ["compute", "laptop", "workstation", "macbook", "pc"]):
        return "compute"
    if any(k in c for k in ["display", "monitor", "screen"]):
        return "displays"
    if any(k in c for k in ["peripheral", "audio", "headset", "keyboard", "mouse"]):
        return "peripherals"
    if any(k in c for k in ["mobile", "tablet", "ipad", "security", "phone", "key"]):
        return "mobile"
    return "compute"


def _asset_icon(category: str | None, name: str | None = None) -> str:
    text = f"{category or ''} {name or ''}".lower()
    if any(k in text for k in ["laptop", "compute", "macbook", "workstation"]):
        return "laptop_mac"
    if any(k in text for k in ["display", "monitor", "screen"]):
        return "monitor"
    if any(k in text for k in ["keyboard"]):
        return "keyboard"
    if any(k in text for k in ["mouse"]):
        return "mouse"
    if any(k in text for k in ["headset", "audio"]):
        return "headphones"
    if any(k in text for k in ["tablet", "mobile", "ipad", "phone"]):
        return "tablet_mac"
    return "devices"


def _to_response_with_history(
    asset: Asset,
    movements: list[AssetMovement],
    audits: list[AuditLog],
    maintenance: list[Maintenance],
) -> AssetOut:
    assigned_date_str = None
    if asset.allocation_date:
        assigned_date_str = asset.allocation_date.strftime("%d %b %Y")
    elif asset.purchase_date:
        assigned_date_str = asset.purchase_date.strftime("%d %b %Y")

    cat_key = _normalize_asset_category_key(asset.category)
    icon_name = _asset_icon(asset.category, asset.name)

    return AssetOut(
        asset_id=asset.asset_id,
        id=asset.asset_id,
        name=asset.name,
        status=asset.status.value,
        category=asset.category,
        specification=asset.specification,
        serial_number=asset.serial_number,
        serialNumber=asset.serial_number,
        location=asset.location,
        custodian=asset.custodian,
        custodianName=asset.custodian,
        purchase_date=asset.purchase_date.date(),
        vendor_name=asset.vendor_name,
        total_cost=asset.total_cost,
        totalCost=asset.total_cost,
        warranty_period=asset.warranty_period,
        warrantyPeriod=asset.warranty_period,
        invoice_reference=asset.invoice_reference,
        depreciation=asset.depreciation,
        allocation_date=asset.allocation_date.date() if asset.allocation_date else None,
        assignedDate=assigned_date_str,
        documents=asset.documents,
        qr_code_value=asset.qr_code_value,
        qr_code_data_url=asset.qr_code_data_url,
        icon=icon_name,
        category_key=cat_key,
        categoryKey=cat_key,
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


def _is_custodian_match(custodian: str | None, user: User) -> bool:
    if not custodian:
        return False
    c_raw = custodian.strip()
    c_lower = c_raw.lower()
    if not c_lower or c_lower in {"unassigned", "none", "n/a", "-", "null"}:
        return False

    name = (user.full_name or "").strip().lower()
    emp_id = (user.employee_id or "").strip().lower()

    if name:
        if name == c_lower:
            return True
        pattern = rf"(^|[^\w]){re.escape(name)}([^\w]|$)"
        if re.search(pattern, c_lower):
            return True

    if emp_id:
        if emp_id == c_lower:
            return True
        pattern = rf"(^|[^\w]){re.escape(emp_id)}([^\w]|$)"
        if re.search(pattern, c_lower):
            return True

    return False


def _check_asset_access(asset: Asset, user: User) -> None:
    if user.role in (UserRole.admin, UserRole.superadmin):
        return
    if _is_custodian_match(asset.custodian, user):
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Access denied: asset is not assigned to current user",
    )


@router.get("", response_model=AssetListResponse)
def list_assets(
    location: str | None = Query(default=None),
    custodian: str | None = Query(default=None),
    category: str | None = Query(default=None),
    search: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AssetListResponse:
    query = select(Asset)
    if location and location.strip():
        query = query.where(Asset.location == location.strip())
    if custodian and custodian.strip():
        query = query.where(Asset.custodian == custodian.strip())
    if category and category.strip():
        query = query.where(Asset.category == category.strip())
    if status_filter and status_filter.strip() and status_filter.strip().lower() != "all":
        st = status_filter.strip().lower()
        matched_status = None
        for s in AssetStatus:
            if s.value.lower() == st:
                matched_status = s
                break
        if matched_status:
            query = query.where(Asset.status == matched_status)
        else:
            query = query.where(Asset.status == status_filter.strip())
    if search and search.strip():
        pattern = f"%{search.strip()}%"
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


@router.get("/my", response_model=AssetListResponse)
def list_my_assets(
    category: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    search: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
    current_user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
) -> AssetListResponse:
    name = (current_user.full_name or "").strip()
    emp_id = (current_user.employee_id or "").strip()

    or_conds = []
    if name:
        or_conds.append(func.trim(func.lower(Asset.custodian)) == name.lower())
        or_conds.append(Asset.custodian.ilike(f"%{name}%"))
    if emp_id:
        or_conds.append(func.trim(func.lower(Asset.custodian)) == emp_id.lower())
        or_conds.append(Asset.custodian.ilike(f"%{emp_id}%"))

    if not or_conds:
        return AssetListResponse(items=[], page=page, page_size=page_size, total=0, total_pages=0)

    query = select(Asset).where(
        Asset.custodian.isnot(None),
        or_(*or_conds),
    )

    if category and category.lower() != "all":
        cat_lower = category.strip().lower()
        if cat_lower == "compute":
            query = query.where(or_(
                Asset.category.ilike("%compute%"),
                Asset.category.ilike("%laptop%"),
                Asset.category.ilike("%workstation%"),
            ))
        elif cat_lower == "displays":
            query = query.where(or_(
                Asset.category.ilike("%display%"),
                Asset.category.ilike("%monitor%"),
            ))
        elif cat_lower == "peripherals":
            query = query.where(or_(
                Asset.category.ilike("%peripheral%"),
                Asset.category.ilike("%audio%"),
                Asset.category.ilike("%headset%"),
                Asset.category.ilike("%keyboard%"),
            ))
        elif cat_lower == "mobile":
            query = query.where(or_(
                Asset.category.ilike("%mobile%"),
                Asset.category.ilike("%security%"),
                Asset.category.ilike("%tablet%"),
                Asset.category.ilike("%key%"),
            ))
        else:
            query = query.where(Asset.category.ilike(f"%{category.strip()}%"))

    if status_filter and status_filter.lower() != "all":
        st = status_filter.strip().lower()
        if "active" in st:
            query = query.where(Asset.status == AssetStatus.active)
        elif "maint" in st:
            query = query.where(Asset.status == AssetStatus.in_maintenance)
        elif "transit" in st:
            query = query.where(Asset.status == AssetStatus.in_transit)
        elif "dispos" in st:
            query = query.where(Asset.status == AssetStatus.disposed)
        else:
            query = query.where(Asset.status.ilike(f"%{status_filter.strip()}%"))

    if search:
        pattern = f"%{search.strip()}%"
        query = query.where(or_(
            Asset.asset_id.ilike(pattern),
            Asset.name.ilike(pattern),
            Asset.specification.ilike(pattern),
            Asset.category.ilike(pattern),
            Asset.location.ilike(pattern),
            Asset.serial_number.ilike(pattern),
        ))

    all_candidates = db.scalars(query.order_by(Asset.created_at.desc(), Asset.id.desc())).all()
    seen_ids = set()
    filtered_items = []
    for asset in all_candidates:
        if asset.id not in seen_ids and _is_custodian_match(asset.custodian, current_user):
            seen_ids.add(asset.id)
            filtered_items.append(asset)

    total = len(filtered_items)
    total_pages = (total + page_size - 1) // page_size if total > 0 else 0
    paged_items = filtered_items[(page - 1) * page_size : page * page_size]

    results = []
    for asset in paged_items:
        movements = db.scalars(
            select(AssetMovement)
            .where(AssetMovement.asset_id == asset.id)
            .order_by(AssetMovement.initiated_at.asc(), AssetMovement.id.asc())
        ).all()
        results.append(_to_response_with_history(asset, movements, [], []))

    return AssetListResponse(
        items=results,
        page=page,
        page_size=page_size,
        total=total,
        total_pages=total_pages,
    )


@router.get("/{asset_id}", response_model=AssetOut)
def get_asset(
    asset_id: str,
    current_user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
) -> AssetOut:
    asset = db.scalar(select(Asset).where(Asset.asset_id == asset_id))
    if asset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")
    _check_asset_access(asset, current_user)
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


@router.post("/bulk", response_model=AssetBulkUploadResponse, status_code=status.HTTP_201_CREATED)
async def bulk_upload_assets(
    file: UploadFile = File(...),
    _admin: User = Depends(require_admin_or_superadmin),
    db: Session = Depends(get_db),
) -> AssetBulkUploadResponse:
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No file provided")

    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty file uploaded")

    filename = file.filename.lower()
    raw_rows: list[dict[str, Any]] = []

    if filename.endswith(".xlsx") or filename.endswith(".xls"):
        try:
            wb = openpyxl.load_workbook(io.BytesIO(contents), data_only=True)
            sheet = wb.active
            rows_iter = sheet.iter_rows(values_only=True)
            header_row = next(rows_iter, None)
            if not header_row:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Excel sheet has no header row")
            headers = [str(c).strip().lower().replace(" ", "_") if c is not None else f"col_{idx}" for idx, c in enumerate(header_row)]
            for r_idx, r_values in enumerate(rows_iter, start=2):
                if not any(v is not None and str(v).strip() for v in r_values):
                    continue
                row_dict = {headers[c_idx]: r_values[c_idx] for c_idx in range(min(len(headers), len(r_values)))}
                row_dict["_row_number"] = r_idx
                raw_rows.append(row_dict)
        except Exception as exc:
            if isinstance(exc, HTTPException):
                raise exc
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Failed to parse Excel file: {str(exc)}") from exc
    elif filename.endswith(".csv"):
        try:
            text_stream = io.StringIO(contents.decode("utf-8", errors="replace"))
            reader = csv.DictReader(text_stream)
            for r_idx, r_dict in enumerate(reader, start=2):
                normalized = {k.strip().lower().replace(" ", "_"): v for k, v in r_dict.items() if k}
                normalized["_row_number"] = r_idx
                raw_rows.append(normalized)
        except Exception as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Failed to parse CSV file: {str(exc)}") from exc
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported file format. Please upload .xlsx or .csv")

    if not raw_rows:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No data rows found in uploaded file")

    created_assets: list[Asset] = []
    errors: list[AssetBulkUploadRowError] = []

    def _get_val(row: dict[str, Any], *keys: str) -> str | None:
        for k in keys:
            normalized_k = k.lower().replace(" ", "_")
            if normalized_k in row and row[normalized_k] is not None:
                val = str(row[normalized_k]).strip()
                if val:
                    return val
        return None

    for row in raw_rows:
        r_num = row.get("_row_number", 0)
        name = _get_val(row, "name", "asset_name", "item_name", "title")
        category = _get_val(row, "category", "asset_category", "type")
        location = _get_val(row, "location", "site", "office", "facility")
        custodian = _get_val(row, "custodian", "assigned_to", "owner", "user")

        if not name:
            errors.append(AssetBulkUploadRowError(row=r_num, error="Missing required field: Asset Name"))
            continue
        if not category:
            errors.append(AssetBulkUploadRowError(row=r_num, error="Missing required field: Category"))
            continue
        if not location:
            errors.append(AssetBulkUploadRowError(row=r_num, error="Missing required field: Location"))
            continue
        if not custodian:
            errors.append(AssetBulkUploadRowError(row=r_num, error="Missing required field: Custodian"))
            continue

        specification = _get_val(row, "specification", "spec", "specs", "subcategory", "description")
        serial_number = _get_val(row, "serial_number", "serial_no", "serial", "sn")
        vendor_name = _get_val(row, "vendor_name", "vendor", "supplier") or "Direct Vendor"
        total_cost = _get_val(row, "total_cost", "cost", "price", "amount") or "0.00"
        warranty_period = _get_val(row, "warranty_period", "warranty", "warranty_end") or "12 Months"
        invoice_reference = _get_val(row, "invoice_reference", "invoice_no", "invoice", "po_number", "po")
        depreciation = _get_val(row, "depreciation", "depreciation_method", "rate")

        raw_pdate = row.get("purchase_date") or row.get("purchased_on") or row.get("date")
        parsed_pdate = None
        if isinstance(raw_pdate, datetime):
            parsed_pdate = raw_pdate
        elif isinstance(raw_pdate, dt_date):
            parsed_pdate = datetime.combine(raw_pdate, time.min)
        elif raw_pdate:
            try:
                parsed_pdate = datetime.strptime(str(raw_pdate).strip()[:10], "%Y-%m-%d")
            except ValueError:
                try:
                    parsed_pdate = datetime.strptime(str(raw_pdate).strip()[:10], "%d-%m-%Y")
                except ValueError:
                    parsed_pdate = datetime.now()
        else:
            parsed_pdate = datetime.now()

        asset_id = _asset_id(db)
        qr_value = f"assetmx:{asset_id}:{uuid.uuid4().hex}"
        qr_data_url = _qr_data_url(qr_value)

        new_asset = Asset(
            asset_id=asset_id,
            name=name,
            category=category,
            specification=specification,
            serial_number=serial_number,
            location=location,
            custodian=custodian,
            purchase_date=parsed_pdate,
            vendor_name=vendor_name,
            total_cost=total_cost,
            warranty_period=warranty_period,
            invoice_reference=invoice_reference,
            depreciation=depreciation,
            allocation_date=parsed_pdate,
            status=AssetStatus.active,
            qr_code_value=qr_value,
            qr_code_data_url=qr_data_url,
        )
        db.add(new_asset)
        created_assets.append(new_asset)

    if created_assets:
        db.commit()
        for a in created_assets:
            db.refresh(a)
        audit = AuditLog(
            action="asset.bulk_upload",
            asset_identifier=created_assets[0].asset_id if created_assets else "BULK-UPLOAD",
            actor_user_id=_admin.id,
            metadata_json=f'{{"total": {len(raw_rows)}, "created": {len(created_assets)}, "errors": {len(errors)}}}',
        )
        db.add(audit)
        db.commit()

    return AssetBulkUploadResponse(
        total_rows=len(raw_rows),
        successful_count=len(created_assets),
        failed_count=len(errors),
        created_assets=[_to_response(a) for a in created_assets],
        errors=errors,
    )


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

    qr_str = (body.qr_code or "").strip()
    if not qr_str:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="qr_code is mandatory for asset transfer under SRS QR-03",
        )

    asset = db.scalar(select(Asset).where(Asset.asset_id == asset_id).with_for_update())
    if asset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")
    if asset.status == AssetStatus.disposed:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Disposed assets cannot be transferred")

    # Real-time QR validation per SRS QR-03
    is_valid_qr = False
    if qr_str == asset.qr_code_value:
        is_valid_qr = True
    elif qr_str == f"assetmx:{asset.asset_id}":
        is_valid_qr = True
    elif qr_str == asset.asset_id:
        is_valid_qr = True
    elif qr_str.startswith("assetmx:"):
        parts = qr_str.split(":")
        if len(parts) >= 2 and parts[1] == asset.asset_id:
            is_valid_qr = True

    if not is_valid_qr:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"QR validation failed: Scanned QR code does not match asset '{asset.asset_id}'",
        )

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
        metadata_json={
            "destination_location": destination,
            "new_custodian": new_custodian,
            "qr_validated": True,
            "qr_code": qr_str,
        },
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

    before_status = asset.status.value
    if body.asset_status is not None:
        if body.asset_status != "Active":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Cannot transition asset status to '{body.asset_status}'. Only Active status transition is supported upon maintenance completion.",
            )
        if asset.status != AssetStatus.in_maintenance:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Asset must be In Maintenance to transition status to Active (current status: '{asset.status.value}').",
            )
        asset.status = AssetStatus.active
    after_status = asset.status.value

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
        before_state={"asset_status": before_status},
        after_state={"asset_status": after_status, "maintenance_id": maintenance_id},
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
