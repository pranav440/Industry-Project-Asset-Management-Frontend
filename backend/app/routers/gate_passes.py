import uuid
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_admin
from app.models import AuditLog, GatePass, GatePassHistory, GatePassStatus, GatePassType, User
from app.schemas import (
    GatePassCreateRequest,
    GatePassDecisionRequest,
    GatePassEscalationRequest,
    GatePassListResponse,
    GatePassOut,
    GatePassOverrideRequest,
    GatePassVerificationRequest,
    GatePassHistoryOut,
)

router = APIRouter(prefix="/api/gate-passes", tags=["gate-passes"])

VALID_PASS_TYPES = {
    "Asset Movement": GatePassType.asset_movement,
    "Returnable": GatePassType.returnable,
    "Non-Returnable": GatePassType.non_returnable,
    "Maintenance": GatePassType.maintenance,
}
VALID_STATUS_VALUES = {
    "Pending": GatePassStatus.pending,
    "Approved": GatePassStatus.approved,
    "Rejected": GatePassStatus.rejected,
    "Active": GatePassStatus.active,
    "Completed": GatePassStatus.completed,
    "Escalated": GatePassStatus.escalated,
}
ALLOWED_TRANSITIONS = {
    GatePassStatus.pending: {GatePassStatus.approved, GatePassStatus.rejected, GatePassStatus.escalated},
    GatePassStatus.approved: {GatePassStatus.active, GatePassStatus.escalated},
    GatePassStatus.active: {GatePassStatus.completed},
    GatePassStatus.escalated: {GatePassStatus.approved},
}


def _pass_id(db: Session) -> str:
    year = date.today().year
    while True:
        candidate = f"GP-{year}-{uuid.uuid4().hex[:8].upper()}"
        if db.scalar(select(GatePass.id).where(GatePass.pass_id == candidate)) is None:
            return candidate


def _history_id(db: Session) -> str:
    year = date.today().year
    while True:
        candidate = f"GPH-{year}-{uuid.uuid4().hex[:8].upper()}"
        if db.scalar(select(GatePassHistory.id).where(GatePassHistory.history_id == candidate)) is None:
            return candidate


def _history_response(history: GatePassHistory) -> GatePassHistoryOut:
    return GatePassHistoryOut(
        history_id=history.history_id,
        timestamp=history.timestamp,
        action=history.action,
        performed_by=history.performed_by,
        note=history.note,
        status_snapshot=history.status_snapshot,
    )


def _serialize_gate_pass(gate_pass: GatePass) -> dict:
    return {
        "pass_id": gate_pass.pass_id,
        "pass_type": gate_pass.pass_type.value,
        "status": gate_pass.status.value,
        "request_date": gate_pass.request_date.isoformat() if gate_pass.request_date else None,
        "requester_name": gate_pass.requester_name,
        "department": gate_pass.department,
        "asset_or_item": gate_pass.asset_or_item,
        "quantity": gate_pass.quantity,
        "current_location": gate_pass.current_location,
        "destination": gate_pass.destination,
        "movement_date": gate_pass.movement_date.isoformat() if gate_pass.movement_date else None,
        "purpose": gate_pass.purpose,
        "authorization_state": gate_pass.authorization_state,
        "decision_status": gate_pass.decision_status,
        "decision_date": gate_pass.decision_date.isoformat() if gate_pass.decision_date else None,
        "decision_by": gate_pass.decision_by,
        "exit_status": gate_pass.exit_status,
        "exit_timestamp": gate_pass.exit_timestamp.isoformat() if gate_pass.exit_timestamp else None,
        "exit_gate": gate_pass.exit_gate,
        "exit_officer": gate_pass.exit_officer,
        "exit_notes": gate_pass.exit_notes,
        "entry_status": gate_pass.entry_status,
        "entry_timestamp": gate_pass.entry_timestamp.isoformat() if gate_pass.entry_timestamp else None,
        "entry_gate": gate_pass.entry_gate,
        "entry_officer": gate_pass.entry_officer,
        "entry_notes": gate_pass.entry_notes,
        "escalation_is_escalated": gate_pass.escalation_is_escalated,
        "escalation_reason": gate_pass.escalation_reason,
        "escalation_timestamp": gate_pass.escalation_timestamp.isoformat() if gate_pass.escalation_timestamp else None,
        "escalation_action_required": gate_pass.escalation_action_required,
        "escalation_escalated_by": gate_pass.escalation_escalated_by,
    }


def _create_history_entry(*, db: Session, gate_pass: GatePass, actor: User, action: str, note: str | None, status_snapshot: str | None = None) -> GatePassHistory:
    history = GatePassHistory(
        history_id=_history_id(db),
        pass_id=gate_pass.pass_id,
        action=action,
        performed_by=actor.full_name,
        note=note,
        status_snapshot=status_snapshot or gate_pass.status.value,
    )
    db.add(history)
    return history


def _create_audit_log(*, db: Session, gate_pass: GatePass, actor: User, action: str, before_state: dict | None, after_state: dict | None, metadata: dict | None) -> AuditLog:
    audit = AuditLog(
        action=action,
        asset_id=None,
        asset_identifier="",
        consumable_id=None,
        consumable_identifier=None,
        request_id=None,
        request_identifier=None,
        gate_pass_id=gate_pass.id,
        gate_pass_identifier=gate_pass.pass_id,
        actor_user_id=actor.id,
        before_state=before_state,
        after_state=after_state,
        metadata_json=metadata,
    )
    db.add(audit)
    return audit


def _find_gate_pass(db: Session, pass_id: str, *, lock: bool = False) -> GatePass | None:
    query = select(GatePass).where(GatePass.pass_id == pass_id)
    if lock:
        query = query.with_for_update()
    return db.scalar(query)


def _gate_pass_response(db: Session, gate_pass: GatePass, *, include_history: bool = False) -> GatePassOut:
    history = []
    if include_history:
        history = [
            _history_response(row)
            for row in db.scalars(
                select(GatePassHistory)
                .where(GatePassHistory.pass_id == gate_pass.pass_id)
                .order_by(GatePassHistory.timestamp.asc(), GatePassHistory.id.asc())
            ).all()
        ]
    return GatePassOut(
        pass_id=gate_pass.pass_id,
        pass_type=gate_pass.pass_type.value,
        request_date=gate_pass.request_date,
        status=gate_pass.status.value,
        requester_name=gate_pass.requester_name,
        department=gate_pass.department,
        asset_or_item=gate_pass.asset_or_item,
        quantity=gate_pass.quantity,
        current_location=gate_pass.current_location,
        destination=gate_pass.destination,
        movement_date=gate_pass.movement_date,
        purpose=gate_pass.purpose,
        authorization_state=gate_pass.authorization_state,
        decision_status=gate_pass.decision_status,
        decision_date=gate_pass.decision_date,
        decision_by=gate_pass.decision_by,
        exit_status=gate_pass.exit_status,
        exit_timestamp=gate_pass.exit_timestamp,
        exit_gate=gate_pass.exit_gate,
        exit_officer=gate_pass.exit_officer,
        exit_notes=gate_pass.exit_notes,
        entry_status=gate_pass.entry_status,
        entry_timestamp=gate_pass.entry_timestamp,
        entry_gate=gate_pass.entry_gate,
        entry_officer=gate_pass.entry_officer,
        entry_notes=gate_pass.entry_notes,
        escalation_is_escalated=gate_pass.escalation_is_escalated,
        escalation_reason=gate_pass.escalation_reason,
        escalation_timestamp=gate_pass.escalation_timestamp,
        escalation_action_required=gate_pass.escalation_action_required,
        escalation_escalated_by=gate_pass.escalation_escalated_by,
        created_at=gate_pass.created_at,
        updated_at=gate_pass.updated_at,
        history=history,
    )


@router.get("", response_model=GatePassListResponse)
def list_gate_passes(
    search: str | None = Query(default=None),
    pass_type: str | None = Query(default=None),
    status: str | None = Query(default=None),
    date: str | None = Query(default=None),
    location: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> GatePassListResponse:
    query = select(GatePass)
    if search:
        pattern = f"%{search}%"
        query = query.where(or_(
            GatePass.pass_id.ilike(pattern),
            GatePass.requester_name.ilike(pattern),
            GatePass.asset_or_item.ilike(pattern),
            GatePass.destination.ilike(pattern),
        ))
    if pass_type:
        pass_type_key = VALID_PASS_TYPES.get(pass_type)
        if pass_type_key is None:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid pass type filter")
        query = query.where(GatePass.pass_type == pass_type_key)
    if status:
        status_key = VALID_STATUS_VALUES.get(status)
        if status_key is None:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid status filter")
        query = query.where(GatePass.status == status_key)
    if date:
        try:
            parsed_date = datetime.strptime(date, "%Y-%m-%d").date()
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid date filter") from exc
        query = query.where(GatePass.request_date == parsed_date)
    if location:
        query = query.where(GatePass.current_location == location)

    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = db.scalars(
        query.order_by(GatePass.request_date.desc(), GatePass.created_at.desc(), GatePass.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return GatePassListResponse(
        items=[_gate_pass_response(db, row) for row in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("", response_model=GatePassOut, status_code=status.HTTP_201_CREATED)
def create_gate_pass(
    body: GatePassCreateRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> GatePassOut:
    try:
        gate_pass = GatePass(
            pass_id=_pass_id(db),
            pass_type=VALID_PASS_TYPES[body.pass_type],
            request_date=date.today(),
            status=GatePassStatus.pending,
            requester_name=admin.full_name,
            department="Administration",
            asset_or_item=body.asset_or_item,
            quantity=body.quantity,
            current_location=None,
            destination=body.destination,
            movement_date=body.movement_date,
            purpose=body.purpose,
            authorization_state="Pending Review",
            decision_status="Awaiting Review",
            decision_date=None,
            decision_by=None,
            escalation_is_escalated=False,
            escalation_reason=None,
            escalation_timestamp=None,
            escalation_action_required=None,
            escalation_escalated_by=None,
        )
        db.add(gate_pass)
        db.flush()

        history = _create_history_entry(
            db=db,
            gate_pass=gate_pass,
            actor=admin,
            action="Gate Pass Created",
            note="Gate pass created by administrator.",
            status_snapshot=GatePassStatus.pending.value,
        )
        audit = _create_audit_log(
            db=db,
            gate_pass=gate_pass,
            actor=admin,
            action="gate_pass_created",
            before_state={"status": "New"},
            after_state=_serialize_gate_pass(gate_pass),
            metadata={
                "pass_id": gate_pass.pass_id,
                "created_by": admin.full_name,
                "pass_type": gate_pass.pass_type.value,
            },
        )
        db.add(audit)
        db.commit()
        db.refresh(gate_pass)
        db.refresh(history)
        return _gate_pass_response(db, gate_pass, include_history=True)
    except HTTPException:
        db.rollback()
        raise
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Gate pass creation failed")


@router.get("/{pass_id}", response_model=GatePassOut)
def get_gate_pass(
    pass_id: str,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> GatePassOut:
    gate_pass = _find_gate_pass(db, pass_id)
    if gate_pass is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gate pass not found")
    return _gate_pass_response(db, gate_pass, include_history=True)


@router.post("/{pass_id}/decision", response_model=GatePassOut)
def decide_gate_pass(
    pass_id: str,
    body: GatePassDecisionRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> GatePassOut:
    target_status = VALID_STATUS_VALUES.get(body.target_status)
    if target_status is None:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid target status")
    try:
        gate_pass = _find_gate_pass(db, pass_id, lock=True)
        if gate_pass is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gate pass not found")

        before_state = _serialize_gate_pass(gate_pass)
        if gate_pass.status not in ALLOWED_TRANSITIONS or target_status not in ALLOWED_TRANSITIONS[gate_pass.status]:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Invalid state transition")

        gate_pass.status = target_status
        gate_pass.authorization_state = "Approved by Admin" if target_status == GatePassStatus.approved else "Rejected by Admin"
        gate_pass.decision_status = target_status.value
        gate_pass.decision_date = datetime.now(timezone.utc)
        gate_pass.decision_by = admin.full_name

        history = _create_history_entry(
            db=db,
            gate_pass=gate_pass,
            actor=admin,
            action="Decision Updated",
            note=body.note or "Decision recorded by administrator.",
            status_snapshot=gate_pass.status.value,
        )
        audit = _create_audit_log(
            db=db,
            gate_pass=gate_pass,
            actor=admin,
            action="gate_pass_decision_updated",
            before_state=before_state,
            after_state=_serialize_gate_pass(gate_pass),
            metadata={
                "pass_id": gate_pass.pass_id,
                "target_status": target_status.value,
                "note": body.note,
            },
        )
        db.add(audit)
        db.commit()
        db.refresh(gate_pass)
        db.refresh(history)
        return _gate_pass_response(db, gate_pass, include_history=True)
    except HTTPException:
        db.rollback()
        raise
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Gate pass decision failed")


@router.post("/{pass_id}/exit-verification", response_model=GatePassOut)
def verify_exit_gate_pass(
    pass_id: str,
    body: GatePassVerificationRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> GatePassOut:
    if body.exit_gate is None or not body.exit_gate.strip():
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="exit_gate is required")
    try:
        gate_pass = _find_gate_pass(db, pass_id, lock=True)
        if gate_pass is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gate pass not found")
        if gate_pass.status != GatePassStatus.approved:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Invalid state transition")

        before_state = _serialize_gate_pass(gate_pass)
        gate_pass.status = GatePassStatus.active
        gate_pass.exit_status = "Verified"
        gate_pass.exit_timestamp = datetime.now(timezone.utc)
        gate_pass.exit_gate = body.exit_gate.strip()
        gate_pass.exit_notes = body.exit_notes.strip() if body.exit_notes else None
        gate_pass.exit_officer = admin.full_name
        gate_pass.authorization_state = "Active in Transit"

        history = _create_history_entry(
            db=db,
            gate_pass=gate_pass,
            actor=admin,
            action="Exit Verification",
            note=body.exit_notes or "Exit verification completed.",
            status_snapshot=gate_pass.status.value,
        )
        audit = _create_audit_log(
            db=db,
            gate_pass=gate_pass,
            actor=admin,
            action="gate_pass_exit_verified",
            before_state=before_state,
            after_state=_serialize_gate_pass(gate_pass),
            metadata={"pass_id": gate_pass.pass_id, "exit_gate": gate_pass.exit_gate, "exit_officer": gate_pass.exit_officer},
        )
        db.add(audit)
        db.commit()
        db.refresh(gate_pass)
        db.refresh(history)
        return _gate_pass_response(db, gate_pass, include_history=True)
    except HTTPException:
        db.rollback()
        raise
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Exit verification failed")


@router.post("/{pass_id}/entry-verification", response_model=GatePassOut)
def verify_entry_gate_pass(
    pass_id: str,
    body: GatePassVerificationRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> GatePassOut:
    if body.entry_gate is None or not body.entry_gate.strip():
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="entry_gate is required")
    try:
        gate_pass = _find_gate_pass(db, pass_id, lock=True)
        if gate_pass is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gate pass not found")
        if gate_pass.status != GatePassStatus.active:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Invalid state transition")

        before_state = _serialize_gate_pass(gate_pass)
        gate_pass.status = GatePassStatus.completed
        gate_pass.entry_status = "Verified"
        gate_pass.entry_timestamp = datetime.now(timezone.utc)
        gate_pass.entry_gate = body.entry_gate.strip()
        gate_pass.entry_notes = body.entry_notes.strip() if body.entry_notes else None
        gate_pass.entry_officer = admin.full_name
        gate_pass.authorization_state = "Completed"

        history = _create_history_entry(
            db=db,
            gate_pass=gate_pass,
            actor=admin,
            action="Entry Verification",
            note=body.entry_notes or "Entry verification completed.",
            status_snapshot=gate_pass.status.value,
        )
        audit = _create_audit_log(
            db=db,
            gate_pass=gate_pass,
            actor=admin,
            action="gate_pass_entry_verified",
            before_state=before_state,
            after_state=_serialize_gate_pass(gate_pass),
            metadata={"pass_id": gate_pass.pass_id, "entry_gate": gate_pass.entry_gate, "entry_officer": gate_pass.entry_officer},
        )
        db.add(audit)
        db.commit()
        db.refresh(gate_pass)
        db.refresh(history)
        return _gate_pass_response(db, gate_pass, include_history=True)
    except HTTPException:
        db.rollback()
        raise
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Entry verification failed")


@router.post("/{pass_id}/escalate", response_model=GatePassOut)
def escalate_gate_pass(
    pass_id: str,
    body: GatePassEscalationRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> GatePassOut:
    try:
        gate_pass = _find_gate_pass(db, pass_id, lock=True)
        if gate_pass is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gate pass not found")
        if gate_pass.status not in {GatePassStatus.pending, GatePassStatus.approved}:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Invalid state transition")

        before_state = _serialize_gate_pass(gate_pass)
        gate_pass.status = GatePassStatus.escalated
        gate_pass.authorization_state = "Escalated — Gate Exception"
        gate_pass.escalation_is_escalated = True
        gate_pass.escalation_reason = body.reason
        gate_pass.escalation_timestamp = datetime.now(timezone.utc)
        gate_pass.escalation_action_required = body.action_required
        gate_pass.escalation_escalated_by = admin.full_name

        history = _create_history_entry(
            db=db,
            gate_pass=gate_pass,
            actor=admin,
            action="Escalated",
            note=body.reason,
            status_snapshot=gate_pass.status.value,
        )
        audit = _create_audit_log(
            db=db,
            gate_pass=gate_pass,
            actor=admin,
            action="gate_pass_escalated",
            before_state=before_state,
            after_state=_serialize_gate_pass(gate_pass),
            metadata={"pass_id": gate_pass.pass_id, "reason": body.reason, "action_required": body.action_required},
        )
        db.add(audit)
        db.commit()
        db.refresh(gate_pass)
        db.refresh(history)
        return _gate_pass_response(db, gate_pass, include_history=True)
    except HTTPException:
        db.rollback()
        raise
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Escalation failed")


@router.post("/{pass_id}/override", response_model=GatePassOut)
def override_gate_pass(
    pass_id: str,
    body: GatePassOverrideRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> GatePassOut:
    try:
        gate_pass = _find_gate_pass(db, pass_id, lock=True)
        if gate_pass is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gate pass not found")
        if gate_pass.status != GatePassStatus.escalated:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Invalid state transition")

        before_state = _serialize_gate_pass(gate_pass)
        gate_pass.status = GatePassStatus.approved
        gate_pass.authorization_state = "Administrative Override Clearance"
        gate_pass.decision_status = "Override Granted by Administrator"
        gate_pass.decision_date = datetime.now(timezone.utc)
        gate_pass.decision_by = admin.full_name

        history = _create_history_entry(
            db=db,
            gate_pass=gate_pass,
            actor=admin,
            action="Override Granted",
            note=body.note or "Administrative override granted.",
            status_snapshot=gate_pass.status.value,
        )
        audit = _create_audit_log(
            db=db,
            gate_pass=gate_pass,
            actor=admin,
            action="gate_pass_override",
            before_state=before_state,
            after_state=_serialize_gate_pass(gate_pass),
            metadata={"pass_id": gate_pass.pass_id, "note": body.note},
        )
        db.add(audit)
        db.commit()
        db.refresh(gate_pass)
        db.refresh(history)
        return _gate_pass_response(db, gate_pass, include_history=True)
    except HTTPException:
        db.rollback()
        raise
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Override failed")
