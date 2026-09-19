import uuid
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_admin
from app.models import AuditLog, Request, RequestHistory, RequestPriority, RequestStatus, RequestType, User
from app.schemas import RequestDetailOut, RequestHistoryOut, RequestListResponse, RequestTransitionOut, RequestTransitionRequest

router = APIRouter(prefix="/api/requests", tags=["requests"])

VALID_REQUEST_TYPE_VALUES = {"Asset Request": RequestType.asset_request, "Consumable Request": RequestType.consumable_request}
VALID_PRIORITY_VALUES = {"High": RequestPriority.high, "Medium": RequestPriority.medium, "Low": RequestPriority.low}
VALID_STATUS_VALUES = {"Pending": RequestStatus.pending, "In Review": RequestStatus.in_review, "Fulfilled": RequestStatus.fulfilled, "Rejected": RequestStatus.rejected}
ALLOWED_TRANSITIONS = {
    RequestStatus.pending: {RequestStatus.in_review, RequestStatus.fulfilled, RequestStatus.rejected},
    RequestStatus.in_review: {RequestStatus.fulfilled, RequestStatus.rejected},
}


def _request_id(db: Session) -> str:
    year = date.today().year
    while True:
        candidate = f"REQ-{year}-{uuid.uuid4().hex[:8].upper()}"
        if db.scalar(select(Request.id).where(Request.request_id == candidate)) is None:
            return candidate


def _history_id(db: Session) -> str:
    year = date.today().year
    while True:
        candidate = f"RH-{year}-{uuid.uuid4().hex[:8].upper()}"
        if db.scalar(select(RequestHistory.id).where(RequestHistory.history_id == candidate)) is None:
            return candidate


def _status_label(value: RequestStatus) -> str:
    return value.value


def _request_history_response(history: RequestHistory) -> RequestHistoryOut:
    return RequestHistoryOut(
        history_id=history.history_id,
        timestamp=history.timestamp,
        stage=history.stage,
        action=history.action,
        performed_by=history.performed_by,
        note=history.note,
    )


def _request_response(db: Session, request: Request, *, include_history: bool = False) -> RequestDetailOut:
    history = []
    if include_history:
        history = [
            _request_history_response(row)
            for row in db.scalars(
                select(RequestHistory)
                .where(RequestHistory.request_id == request.request_id)
                .order_by(RequestHistory.timestamp.asc(), RequestHistory.id.asc())
            ).all()
        ]
    return RequestDetailOut(
        request_id=request.request_id,
        requester_name=request.requester_name,
        requester_email=request.requester_email,
        department=request.department,
        request_type=request.request_type.value,
        requested_item=request.requested_item,
        category=request.category,
        quantity=request.quantity,
        priority=request.priority.value,
        request_date=request.request_date,
        status=request.status.value,
        justification=request.justification,
        processing_guidelines=request.processing_guidelines,
        created_at=request.created_at,
        updated_at=request.updated_at,
        history=history,
    )


def _find_request(db: Session, request_id: str, *, lock: bool = False) -> Request | None:
    query = select(Request).where(Request.request_id == request_id)
    if lock:
        query = query.with_for_update()
    return db.scalar(query)


def _create_audit_log(*, db: Session, request: Request, actor: User, previous_status: RequestStatus, target_status: RequestStatus, operational_note: str | None) -> AuditLog:
    return AuditLog(
        action="request_status_transition",
        asset_id=None,
        asset_identifier="",
        consumable_id=None,
        consumable_identifier=None,
        request_id=request.id,
        request_identifier=request.request_id,
        actor_user_id=actor.id,
        before_state={"status": previous_status.value},
        after_state={"status": target_status.value},
        metadata_json={
            "request_id": request.request_id,
            "previous_status": previous_status.value,
            "new_status": target_status.value,
            "operational_note": operational_note,
        },
    )


def _create_history_entry(*, db: Session, request: Request, actor: User, target_status: RequestStatus, operational_note: str | None) -> RequestHistory:
    history = RequestHistory(
        history_id=_history_id(db),
        request_id=request.request_id,
        stage=target_status.value,
        action="Status Updated",
        performed_by=actor.full_name,
        note=operational_note,
    )
    db.add(history)
    return history


@router.get("", response_model=RequestListResponse)
def list_requests(
    search: str | None = Query(default=None),
    request_type: str | None = Query(default=None),
    status: str | None = Query(default=None),
    priority: str | None = Query(default=None),
    department: str | None = Query(default=None),
    request_date: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> RequestListResponse:
    query = select(Request)

    if search:
        pattern = f"%{search}%"
        query = query.where(or_(
            Request.request_id.ilike(pattern),
            Request.requester_name.ilike(pattern),
            Request.requested_item.ilike(pattern),
            Request.department.ilike(pattern),
        ))
    if request_type:
        request_type_key = VALID_REQUEST_TYPE_VALUES.get(request_type)
        if request_type_key is None:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid request type filter")
        query = query.where(Request.request_type == request_type_key)
    if status:
        status_key = VALID_STATUS_VALUES.get(status)
        if status_key is None:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid status filter")
        query = query.where(Request.status == status_key)
    if priority:
        priority_key = VALID_PRIORITY_VALUES.get(priority)
        if priority_key is None:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid priority filter")
        query = query.where(Request.priority == priority_key)
    if department:
        query = query.where(Request.department == department)
    if request_date:
        try:
            parsed_date = datetime.strptime(request_date, "%Y-%m-%d").date()
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid request date filter") from exc
        query = query.where(Request.request_date == parsed_date)

    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = db.scalars(
        query.order_by(Request.request_date.desc(), Request.created_at.desc(), Request.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return RequestListResponse(
        items=[_request_response(db, row).model_dump(exclude={"history"}) for row in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{request_id}", response_model=RequestDetailOut)
def get_request(
    request_id: str,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> RequestDetailOut:
    request = _find_request(db, request_id)
    if request is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")
    return _request_response(db, request, include_history=True)


@router.post("/{request_id}/transition", response_model=RequestDetailOut)
def transition_request(
    request_id: str,
    body: RequestTransitionRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> RequestDetailOut:
    if body.operational_note is not None and len(body.operational_note) > 2000:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Operational note too long")

    target_status = VALID_STATUS_VALUES.get(body.target_status)
    if target_status is None:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid target status")

    try:
        request = db.scalar(select(Request).where(Request.request_id == request_id).with_for_update())
        if request is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")

        current_status = request.status
        allowed_statuses = ALLOWED_TRANSITIONS.get(current_status)
        if allowed_statuses is None or target_status not in allowed_statuses:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Invalid state transition")

        previous_status = request.status
        request.status = target_status
        request.updated_at = datetime.now(timezone.utc)

        history = _create_history_entry(db=db, request=request, actor=admin, target_status=target_status, operational_note=body.operational_note)
        audit = _create_audit_log(
            db=db,
            request=request,
            actor=admin,
            previous_status=previous_status,
            target_status=target_status,
            operational_note=body.operational_note,
        )
        db.add(audit)
        db.commit()
        db.refresh(request)
        db.refresh(history)
        return _request_response(db, request, include_history=True)
    except HTTPException:
        raise
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Request transition failed")
