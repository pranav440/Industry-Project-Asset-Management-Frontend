import uuid
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_admin
from app.models import (
    AuditLog,
    Consumable,
    ConsumableIssue,
    ConsumableOperationType,
    ConsumableStockMovement,
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
