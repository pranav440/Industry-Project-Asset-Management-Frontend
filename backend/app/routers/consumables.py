import uuid
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_admin, require_authenticated_user
from app.models import (
    AuditLog,
    Consumable,
    ConsumableIssue,
    ConsumableOperationType,
    ConsumableStockMovement,
    Request,
    User,
)
from app.schemas import (
    ConsumableCreate,
    ConsumableIssueCreate,
    ConsumableIssueOut,
    ConsumableListResponse,
    ConsumableMovementOut,
    ConsumableOut,
    ConsumableStockOperation,
    ConsumableUpdate,
    EmployeeConsumableIssueOut,
    EmployeeConsumptionCategoryMetric,
    EmployeeConsumptionListResponse,
    EmployeeConsumptionSummaryOut,
)

router = APIRouter(prefix="/api/consumables", tags=["consumables"])


def _unique_id(db: Session, model, field_name: str, prefix: str) -> str:
    year = date.today().year
    field = getattr(model, field_name)
    while True:
        candidate = f"{prefix}-{year}-{uuid.uuid4().hex[:8].upper()}"
        if db.scalar(select(model.id).where(field == candidate)) is None:
            return candidate


def _stock_status(stock: int, threshold: int) -> str:
    if stock <= 0:
        return "Out of Stock"
    if stock <= threshold:
        return "Low Stock"
    return "In Stock"


def _user_name(db: Session, user_id: int) -> str:
    user = db.get(User, user_id)
    return user.full_name if user is not None else str(user_id)


def _movement_response(db: Session, movement: ConsumableStockMovement) -> ConsumableMovementOut:
    return ConsumableMovementOut(
        movement_id=movement.movement_id,
        timestamp=movement.timestamp,
        operation_type=movement.operation_type.value,
        delta_quantity=movement.delta_quantity,
        post_balance=movement.post_balance,
        reference=movement.reference,
        created_by=_user_name(db, movement.created_by_user_id),
    )


def _issue_response(db: Session, issue: ConsumableIssue) -> ConsumableIssueOut:
    return ConsumableIssueOut(
        issue_id=issue.issue_id,
        issue_date=issue.issue_date,
        quantity=issue.quantity,
        request_reference=issue.request_reference,
        issued_by=_user_name(db, issue.issued_by_user_id),
        remaining_stock=issue.remaining_stock,
    )


def _consumable_response(
    db: Session,
    consumable: Consumable,
    *,
    include_history: bool = False,
) -> ConsumableOut:
    issues: list[ConsumableIssueOut] = []
    movements: list[ConsumableMovementOut] = []
    if include_history:
        issues = [
            _issue_response(db, issue)
            for issue in db.scalars(
                select(ConsumableIssue)
                .where(ConsumableIssue.consumable_id == consumable.id)
                .order_by(ConsumableIssue.issue_date.desc(), ConsumableIssue.id.desc())
            ).all()
        ]
        movements = [
            _movement_response(db, movement)
            for movement in db.scalars(
                select(ConsumableStockMovement)
                .where(ConsumableStockMovement.consumable_id == consumable.id)
                .order_by(ConsumableStockMovement.timestamp.desc(), ConsumableStockMovement.id.desc())
            ).all()
        ]
    return ConsumableOut(
        consumable_id=consumable.consumable_id,
        name=consumable.name,
        category=consumable.category,
        batch_id=consumable.batch_id,
        location=consumable.location,
        available_stock=consumable.available_stock,
        threshold=consumable.threshold,
        batch_quantity=consumable.batch_quantity,
        expiry_date=consumable.expiry_date,
        stock_status=_stock_status(consumable.available_stock, consumable.threshold),
        issue_history=issues,
        movement_ledger=movements,
    )


def _find_consumable(db: Session, consumable_id: str, *, lock: bool = False) -> Consumable | None:
    query = select(Consumable).where(Consumable.consumable_id == consumable_id)
    if lock:
        query = query.with_for_update()
    return db.scalar(query)


def _audit(
    *,
    consumable: Consumable,
    actor: User,
    action: str,
    before_state: dict | None,
    after_state: dict | None,
    metadata: dict | None = None,
) -> AuditLog:
    return AuditLog(
        asset_id=None,
        asset_identifier=consumable.consumable_id,
        consumable_id=consumable.id,
        consumable_identifier=consumable.consumable_id,
        actor_user_id=actor.id,
        action=action,
        before_state=before_state,
        after_state=after_state,
        metadata_json=metadata,
    )


@router.get("", response_model=ConsumableListResponse)
def list_consumables(
    search: str | None = Query(default=None),
    category: str | None = Query(default=None),
    stock_status: str | None = Query(default=None, alias="status"),
    expiry: str | None = Query(default=None),
    location: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> ConsumableListResponse:
    query = select(Consumable)
    if search:
        pattern = f"%{search}%"
        query = query.where(or_(
            Consumable.consumable_id.ilike(pattern),
            Consumable.name.ilike(pattern),
            Consumable.batch_id.ilike(pattern),
            Consumable.category.ilike(pattern),
        ))
    if category:
        query = query.where(Consumable.category == category)
    if location:
        query = query.where(Consumable.location == location)
    if stock_status == "Out of Stock":
        query = query.where(Consumable.available_stock <= 0)
    elif stock_status == "Low Stock":
        query = query.where(and_(Consumable.available_stock > 0, Consumable.available_stock <= Consumable.threshold))
    elif stock_status == "In Stock":
        query = query.where(Consumable.available_stock > Consumable.threshold)
    elif stock_status:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid stock status filter")

    today = date.today()
    if expiry == "none":
        query = query.where(Consumable.expiry_date.is_(None))
    elif expiry == "expired":
        query = query.where(Consumable.expiry_date < today)
    elif expiry == "upcoming":
        query = query.where(and_(Consumable.expiry_date >= today, Consumable.expiry_date <= today + timedelta(days=45)))
    elif expiry == "normal":
        query = query.where(Consumable.expiry_date > today + timedelta(days=45))
    elif expiry:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid expiry filter")

    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = db.scalars(
        query.order_by(Consumable.created_at.desc(), Consumable.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return ConsumableListResponse(
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
        items=[_consumable_response(db, row) for row in rows],
    )


def _normalize_category_key(cat: str | None) -> str:
    if not cat:
        return "other"
    c = cat.lower()
    if "cable" in c or "adapter" in c:
        return "cables"
    if "ergonomic" in c or "furniture" in c:
        return "ergonomics"
    if "stationery" in c or "paper" in c or "office" in c:
        return "stationery"
    if "clean" in c:
        return "cleaning"
    return "other"


def _category_icon(cat: str | None, name: str | None = None) -> str:
    text = f"{cat or ''} {name or ''}".lower()
    if "cable" in text or "adapter" in text or "thunderbolt" in text:
        return "cable"
    if "wrist" in text or "ergonomic" in text:
        return "pan_tool"
    if "clean" in text:
        return "cleaning_services"
    if "paper" in text or "pen" in text or "stationery" in text or "note" in text:
        return "edit_note"
    if "mouse" in text:
        return "mouse"
    if "keyboard" in text:
        return "keyboard"
    return "inventory_2"


CATEGORY_COLORS: dict[str, str] = {
    "cables": "#00687a",
    "ergonomics": "#4cd7f6",
    "stationery": "#57dffe",
    "cleaning": "#8b95ad",
    "other": "#00687a",
}

CATEGORY_COLOR_CLASSES: dict[str, str] = {
    "cables": "amx-mc-bar-cables",
    "ergonomics": "amx-mc-bar-ergonomics",
    "stationery": "amx-mc-bar-stationery",
    "cleaning": "amx-mc-bar-cleaning",
    "other": "amx-mc-bar-other",
}


@router.get("/my", response_model=EmployeeConsumptionListResponse)
def get_my_consumables(
    time_filter: str | None = Query(default=None),
    timeFilter: str | None = Query(default=None),
    category: str | None = Query(default=None),
    search: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    current_user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
) -> EmployeeConsumptionListResponse:
    effective_time_filter = (time_filter or timeFilter or "all").lower().strip()
    user_email = (current_user.email or "").strip().lower()

    now = datetime.now(timezone.utc)
    if not user_email:
        empty_summary = EmployeeConsumptionSummaryOut(
            period="This Month" if effective_time_filter == "month" else "All Time",
            cycle_reference=f"REC-{now.year}-M{now.month:02d}" if effective_time_filter == "month" else f"REC-{now.year}-ALL",
            cycleReference=f"REC-{now.year}-M{now.month:02d}" if effective_time_filter == "month" else f"REC-{now.year}-ALL",
            total_issued=0,
            totalIssued=0,
            active_categories_count=0,
            activeCategoriesCount=0,
            distinct_categories_count=0,
            distinctCategoriesCount=0,
            categories=[],
        )
        return EmployeeConsumptionListResponse(
            items=[],
            summary=empty_summary,
            all_time_total_units=0,
            allTimeTotalUnits=0,
            this_month_total_units=0,
            thisMonthTotalUnits=0,
            total=0,
            page=page,
            page_size=page_size,
            total_pages=0,
        )

    # Attribution: ConsumableIssue.request_reference -> Request.request_id -> Request.requester_email
    stmt = (
        select(ConsumableIssue, Consumable, Request)
        .join(Consumable, ConsumableIssue.consumable_id == Consumable.id)
        .join(Request, func.trim(ConsumableIssue.request_reference) == func.trim(Request.request_id))
        .where(
            ConsumableIssue.request_reference.isnot(None),
            func.lower(func.trim(Request.requester_email)) == user_email,
        )
        .order_by(ConsumableIssue.issue_date.desc(), ConsumableIssue.id.desc())
    )
    all_user_records = db.execute(stmt).all()

    all_time_total_units = sum(issue.quantity for issue, _con, _req in all_user_records)
    this_month_total_units = sum(
        issue.quantity
        for issue, _con, _req in all_user_records
        if issue.issue_date.year == now.year and issue.issue_date.month == now.month
    )

    # Apply time filter scoping
    if effective_time_filter == "month":
        time_scoped_records = [
            r for r in all_user_records
            if r[0].issue_date.year == now.year and r[0].issue_date.month == now.month
        ]
        period_label = "This Month"
        cycle_ref = f"REC-{now.year}-M{now.month:02d}"
    else:
        time_scoped_records = all_user_records
        period_label = "All Time"
        cycle_ref = f"REC-{now.year}-ALL"

    time_scoped_total_units = sum(issue.quantity for issue, _con, _req in time_scoped_records)

    # Compute category metrics distribution from time-scoped records
    cat_units: dict[str, int] = {}
    cat_keys: dict[str, str] = {}

    for issue, consumable, req in time_scoped_records:
        c_name = consumable.category or "Other"
        cat_units[c_name] = cat_units.get(c_name, 0) + issue.quantity
        if c_name not in cat_keys:
            cat_keys[c_name] = _normalize_category_key(c_name)

    cat_metrics: list[EmployeeConsumptionCategoryMetric] = []
    for c_name, units in cat_units.items():
        ckey = cat_keys[c_name]
        pct = round((units / time_scoped_total_units) * 100, 1) if time_scoped_total_units > 0 else 0.0
        cat_metrics.append(EmployeeConsumptionCategoryMetric(
            name=c_name,
            category_key=ckey,
            categoryKey=ckey,
            units=units,
            percentage=pct,
            color_class=CATEGORY_COLOR_CLASSES.get(ckey, "amx-mc-bar-other"),
            colorClass=CATEGORY_COLOR_CLASSES.get(ckey, "amx-mc-bar-other"),
            color=CATEGORY_COLORS.get(ckey, "#00687a"),
        ))
    cat_metrics.sort(key=lambda x: x.units, reverse=True)

    summary = EmployeeConsumptionSummaryOut(
        period=period_label,
        cycle_reference=cycle_ref,
        cycleReference=cycle_ref,
        total_issued=time_scoped_total_units,
        totalIssued=time_scoped_total_units,
        active_categories_count=len(cat_metrics),
        activeCategoriesCount=len(cat_metrics),
        distinct_categories_count=len(cat_metrics),
        distinctCategoriesCount=len(cat_metrics),
        categories=cat_metrics,
    )

    # Apply search and category filters
    filtered_records = []
    for issue, consumable, req in time_scoped_records:
        if category and category.strip().lower() != "all":
            cat_filter = category.strip().lower()
            c_name = (consumable.category or "").lower()
            c_key = _normalize_category_key(consumable.category)
            if cat_filter != c_key and cat_filter != c_name and cat_filter not in c_name:
                continue

        if search and search.strip():
            q = search.strip().lower()
            item_name = (consumable.name or "").lower()
            c_name = (consumable.category or "").lower()
            req_ref = (issue.request_reference or "").lower()
            issue_id = (issue.issue_id or "").lower()
            if q not in item_name and q not in c_name and q not in req_ref and q not in issue_id:
                continue

        filtered_records.append((issue, consumable, req))

    total = len(filtered_records)
    total_pages = (total + page_size - 1) // page_size if total > 0 else 0
    paged_slice = filtered_records[(page - 1) * page_size : page * page_size]

    items: list[EmployeeConsumableIssueOut] = []
    for issue, consumable, req in paged_slice:
        is_curr_m = (issue.issue_date.year == now.year and issue.issue_date.month == now.month)
        ckey = _normalize_category_key(consumable.category)
        icon = _category_icon(consumable.category, consumable.name)
        fulfillment_date_str = issue.issue_date.strftime("%d %b %Y")
        raw_date_str = issue.issue_date.strftime("%Y-%m-%d")
        req_id = issue.request_reference or ""

        items.append(EmployeeConsumableIssueOut(
            id=issue.issue_id,
            issue_id=issue.issue_id,
            item_name=consumable.name,
            itemName=consumable.name,
            specification=consumable.name,
            category=consumable.category,
            category_key=ckey,
            categoryKey=ckey,
            quantity_issued=issue.quantity,
            quantityIssued=issue.quantity,
            fulfillment_date=fulfillment_date_str,
            fulfillmentDate=fulfillment_date_str,
            raw_date=raw_date_str,
            rawDate=raw_date_str,
            related_request_id=req_id,
            relatedRequestId=req_id,
            status="Fulfilled / Issued",
            reference=issue.issue_id,
            icon=icon,
            is_current_month=is_curr_m,
            isCurrentMonth=is_curr_m,
        ))

    return EmployeeConsumptionListResponse(
        items=items,
        summary=summary,
        all_time_total_units=all_time_total_units,
        allTimeTotalUnits=all_time_total_units,
        this_month_total_units=this_month_total_units,
        thisMonthTotalUnits=this_month_total_units,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/{consumable_id}", response_model=ConsumableOut)
def get_consumable(
    consumable_id: str,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> ConsumableOut:
    consumable = _find_consumable(db, consumable_id)
    if consumable is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Consumable not found")
    return _consumable_response(db, consumable, include_history=True)


@router.post("", response_model=ConsumableOut, status_code=status.HTTP_201_CREATED)
def create_consumable(
    body: ConsumableCreate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> ConsumableOut:
    values = {
        "name": body.name.strip(),
        "category": body.category.strip(),
        "batch_id": body.batch_id.strip(),
        "location": body.location.strip(),
    }
    if not all(values.values()):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Name, category, batch ID, and location are required")

    consumable = Consumable(
        consumable_id=_unique_id(db, Consumable, "consumable_id", "CON"),
        **values,
        available_stock=body.initial_stock,
        threshold=body.threshold,
        batch_quantity=body.initial_stock,
        expiry_date=body.expiry_date,
    )
    db.add(consumable)
    db.flush()
    if body.initial_stock > 0:
        movement = ConsumableStockMovement(
            movement_id=_unique_id(db, ConsumableStockMovement, "movement_id", "MOV"),
            consumable_id=consumable.id,
            operation_type=ConsumableOperationType.initial_inward,
            delta_quantity=body.initial_stock,
            post_balance=body.initial_stock,
            reference="Initial consumable registration",
            created_by_user_id=admin.id,
        )
        db.add(movement)
    db.add(_audit(
        consumable=consumable,
        actor=admin,
        action="Consumable created",
        before_state=None,
        after_state={"available_stock": body.initial_stock, "threshold": body.threshold},
    ))
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise
    db.refresh(consumable)
    return _consumable_response(db, consumable, include_history=True)


@router.put("/{consumable_id}", response_model=ConsumableOut)
def update_consumable(
    consumable_id: str,
    body: ConsumableUpdate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> ConsumableOut:
    consumable = _find_consumable(db, consumable_id, lock=True)
    if consumable is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Consumable not found")
    before = {
        "name": consumable.name,
        "category": consumable.category,
        "batch_id": consumable.batch_id,
        "location": consumable.location,
        "threshold": consumable.threshold,
        "expiry_date": consumable.expiry_date.isoformat() if consumable.expiry_date else None,
    }
    changes = body.model_dump(exclude_unset=True)
    for field, value in changes.items():
        if isinstance(value, str):
            value = value.strip()
            if not value:
                raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"{field} is required")
        setattr(consumable, field, value)
    after = {field: getattr(consumable, field).isoformat() if field == "expiry_date" and getattr(consumable, field) else getattr(consumable, field) for field in before}
    db.add(_audit(consumable=consumable, actor=admin, action="Consumable updated", before_state=before, after_state=after))
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise
    db.refresh(consumable)
    return _consumable_response(db, consumable, include_history=True)


@router.post("/{consumable_id}/stock", response_model=ConsumableOut)
def operate_stock(
    consumable_id: str,
    body: ConsumableStockOperation,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> ConsumableOut:
    if body.delta_quantity == 0:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Stock delta cannot be zero")
    consumable = _find_consumable(db, consumable_id, lock=True)
    if consumable is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Consumable not found")
    new_balance = consumable.available_stock + body.delta_quantity
    if new_balance < 0:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Stock cannot become negative")
    movement = ConsumableStockMovement(
        movement_id=_unique_id(db, ConsumableStockMovement, "movement_id", "MOV"),
        consumable_id=consumable.id,
        operation_type=ConsumableOperationType(body.operation_type),
        delta_quantity=body.delta_quantity,
        post_balance=new_balance,
        reference=body.reference.strip() if body.reference and body.reference.strip() else "Manual stock operation",
        created_by_user_id=admin.id,
    )
    before = {"available_stock": consumable.available_stock}
    consumable.available_stock = new_balance
    db.add(movement)
    db.add(_audit(
        consumable=consumable,
        actor=admin,
        action="Consumable stock operation",
        before_state=before,
        after_state={"available_stock": new_balance},
        metadata={"operation_type": body.operation_type, "reference": movement.reference},
    ))
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise
    db.refresh(consumable)
    return _consumable_response(db, consumable, include_history=True)


@router.post("/{consumable_id}/issue", response_model=ConsumableOut)
def issue_consumable(
    consumable_id: str,
    body: ConsumableIssueCreate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> ConsumableOut:
    consumable = _find_consumable(db, consumable_id, lock=True)
    if consumable is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Consumable not found")
    if body.quantity > consumable.available_stock:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Insufficient stock")
    remaining = consumable.available_stock - body.quantity
    issue = ConsumableIssue(
        issue_id=_unique_id(db, ConsumableIssue, "issue_id", "ISS"),
        consumable_id=consumable.id,
        quantity=body.quantity,
        request_reference=body.request_reference.strip() if body.request_reference and body.request_reference.strip() else None,
        issued_by_user_id=admin.id,
        remaining_stock=remaining,
    )
    movement = ConsumableStockMovement(
        movement_id=_unique_id(db, ConsumableStockMovement, "movement_id", "MOV"),
        consumable_id=consumable.id,
        operation_type=ConsumableOperationType.issue,
        delta_quantity=-body.quantity,
        post_balance=remaining,
        reference=body.request_reference.strip() if body.request_reference and body.request_reference.strip() else "Internal consumption",
        created_by_user_id=admin.id,
    )
    before = {"available_stock": consumable.available_stock}
    consumable.available_stock = remaining
    db.add_all((issue, movement, _audit(
        consumable=consumable,
        actor=admin,
        action="Consumable issued",
        before_state=before,
        after_state={"available_stock": remaining},
        metadata={"issue_id": issue.issue_id, "quantity": body.quantity, "reference": movement.reference},
    )))
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise
    db.refresh(consumable)
    return _consumable_response(db, consumable, include_history=True)
