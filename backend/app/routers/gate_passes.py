import base64
import io
import uuid
from datetime import date, datetime, timezone

import qrcode

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import (
    require_admin,
    require_admin_or_superadmin,
    require_gate_pass_creator,
    require_gate_staff,
    require_guard_or_admin,
    require_roles,
)
from app.models import (
    Asset,
    AuditLog,
    GatePass,
    GatePassHistory,
    GatePassStatus,
    GatePassType,
    User,
    UserRole,
)
from app.schemas import (
    GatePassCreateRequest,
    GatePassQRValidateRequest,
    GatePassQRValidationOut,
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


def _qr_data_url(value: str) -> str:
    image = qrcode.make(value)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    return f"data:image/png;base64,{encoded}"


def _resolve_and_validate_qr(
    db: Session,
    qr_code: str,
    expected_pass_id: str | None = None,
    target_action: str = "inspect",
) -> tuple[bool, GatePass | None, str, bool, str, str | None]:
    """
    Resolves a scanned QR code payload to a legitimate GatePass record.
    Returns: (is_valid, gate_pass, message, is_action_eligible, eligibility_reason, resolved_format)
    """
    qr_str = (qr_code or "").strip()
    if not qr_str:
        return False, None, "Empty QR code payload", False, "Missing QR data", None

    gp: GatePass | None = None
    resolved_format: str | None = None

    if qr_str.startswith("assetmx:pass:") or qr_str.startswith("assetmx:gate-pass:"):
        extracted_id = qr_str.split(":", 2)[2].strip()
        gp = _find_gate_pass(db, extracted_id)
        resolved_format = "pass_urn"
    elif qr_str.startswith("GP-"):
        gp = _find_gate_pass(db, qr_str)
        resolved_format = "pass_id"
    elif qr_str.startswith("assetmx:"):
        asset = db.scalar(select(Asset).where(Asset.qr_code_value == qr_str))
        if asset is None:
            parts = qr_str.split(":")
            if len(parts) >= 2:
                candidate_asset_id = parts[1]
                asset = db.scalar(select(Asset).where(Asset.asset_id == candidate_asset_id))
        if asset is not None:
            resolved_format = "asset_tag"
            gp_query = select(GatePass).where(
                or_(
                    GatePass.asset_or_item.ilike(f"%{asset.asset_id}%"),
                    GatePass.asset_or_item.ilike(f"%{asset.name}%"),
                )
            )
            if expected_pass_id:
                gp_query = gp_query.where(GatePass.pass_id == expected_pass_id.strip())
            gp = db.scalar(gp_query.order_by(GatePass.created_at.desc()).limit(1))
    else:
        gp = _find_gate_pass(db, qr_str)
        resolved_format = "pass_id" if gp else None

    if gp is None:
        return False, None, "Invalid QR code: No matching gate pass or asset found", False, "No corresponding record", None

    if expected_pass_id and expected_pass_id.strip():
        if gp.pass_id != expected_pass_id.strip():
            return False, gp, f"Mismatched QR code: Scanned code belongs to {gp.pass_id}, expected {expected_pass_id.strip()}", False, "Mismatched gate pass record", resolved_format

    if target_action == "exit":
        if gp.status == GatePassStatus.approved:
            eligible = True
            reason = "Gate pass is Approved and eligible for exit verification."
        elif gp.status == GatePassStatus.active:
            eligible = False
            reason = "Gate pass is already Active (exit already verified)."
        elif gp.status == GatePassStatus.completed:
            eligible = False
            reason = "Gate pass is already Completed."
        elif gp.status == GatePassStatus.escalated:
            eligible = False
            reason = "Gate pass is Escalated. Administrative clearance required before exit."
        else:
            eligible = False
            reason = f"Gate pass is currently in '{gp.status.value}' status. Exit verification requires 'Approved' status."
    elif target_action == "entry":
        if gp.pass_type == GatePassType.non_returnable:
            eligible = False
            reason = "Non-returnable gate pass: Inbound entry verification is not permitted."
        elif gp.status == GatePassStatus.active:
            eligible = True
            reason = "Gate pass is Active in Transit and eligible for inbound entry verification."
        elif gp.status in (GatePassStatus.pending, GatePassStatus.approved):
            eligible = False
            reason = f"Gate pass has not exited facility yet (status: {gp.status.value})."
        elif gp.status == GatePassStatus.completed:
            eligible = False
            reason = "Gate pass is already Completed (entry already verified)."
        else:
            eligible = False
            reason = f"Gate pass is currently in '{gp.status.value}' status. Entry verification requires 'Active' status."
    else:
        eligible = True
        reason = f"Gate pass is valid (Status: {gp.status.value})"

    return True, gp, f"QR validated successfully ({resolved_format})", eligible, reason, resolved_format


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
        qr_code_value=f"assetmx:pass:{gate_pass.pass_id}",
        qr_code_data_url=_qr_data_url(f"assetmx:pass:{gate_pass.pass_id}"),
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
    _user: User = Depends(require_gate_staff),
    db: Session = Depends(get_db),
) -> GatePassListResponse:
    query = select(GatePass)
    if _user.role == UserRole.host:
        created_pass_ids = select(AuditLog.gate_pass_id).where(
            AuditLog.actor_user_id == _user.id,
            AuditLog.action == "gate_pass_created",
        )
        query = query.where(
            or_(
                GatePass.requester_name == _user.full_name,
                GatePass.id.in_(created_pass_ids),
            )
        )
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
    current_user: User = Depends(require_gate_pass_creator),
    db: Session = Depends(get_db),
) -> GatePassOut:
    try:
        dept = getattr(current_user, "department", None)
        if not dept:
            dept = "Operations" if current_user.role == UserRole.host else "Administration"

        gate_pass = GatePass(
            pass_id=_pass_id(db),
            pass_type=VALID_PASS_TYPES[body.pass_type],
            request_date=date.today(),
            status=GatePassStatus.pending,
            requester_name=current_user.full_name,
            department=dept,
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
            actor=current_user,
            action="Gate Pass Created",
            note=f"Gate pass created by {current_user.full_name}.",
            status_snapshot=GatePassStatus.pending.value,
        )
        audit = _create_audit_log(
            db=db,
            gate_pass=gate_pass,
            actor=current_user,
            action="gate_pass_created",
            before_state={"status": "New"},
            after_state=_serialize_gate_pass(gate_pass),
            metadata={
                "pass_id": gate_pass.pass_id,
                "created_by": current_user.full_name,
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
    _user: User = Depends(require_gate_staff),
    db: Session = Depends(get_db),
) -> GatePassOut:
    gate_pass = _find_gate_pass(db, pass_id)
    if gate_pass is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gate pass not found")

    if _user.role == UserRole.host:
        is_creator = gate_pass.requester_name == _user.full_name
        if not is_creator:
            has_audit = db.scalar(
                select(AuditLog.id).where(
                    AuditLog.gate_pass_id == gate_pass.id,
                    AuditLog.actor_user_id == _user.id,
                    AuditLog.action == "gate_pass_created",
                )
            )
            if not has_audit:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to access this gate pass",
                )

    return _gate_pass_response(db, gate_pass, include_history=True)


@router.post("/{pass_id}/decision", response_model=GatePassOut)
def decide_gate_pass(
    pass_id: str,
    body: GatePassDecisionRequest,
    admin: User = Depends(require_admin_or_superadmin),
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
    officer: User = Depends(require_guard_or_admin),
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

        qr_str = (body.qr_code or "").strip()
        if not qr_str:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="qr_code is mandatory for gate-pass exit verification under SRS QR-03",
            )
        valid, _gp, msg, eligible, reason, _fmt = _resolve_and_validate_qr(
            db=db,
            qr_code=qr_str,
            expected_pass_id=pass_id,
            target_action="exit",
        )
        if not valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"QR validation failed: {msg}",
            )
        if not eligible:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"QR validation ineligible: {reason}",
            )

        before_state = _serialize_gate_pass(gate_pass)
        gate_pass.status = GatePassStatus.active
        gate_pass.exit_status = "Verified"
        gate_pass.exit_timestamp = datetime.now(timezone.utc)
        gate_pass.exit_gate = body.exit_gate.strip()
        gate_pass.exit_notes = body.exit_notes.strip() if body.exit_notes else None
        gate_pass.exit_officer = officer.full_name
        gate_pass.authorization_state = "Active in Transit"

        history_note = (body.exit_notes or "Exit verification completed.") + " [QR Validated]"

        history = _create_history_entry(
            db=db,
            gate_pass=gate_pass,
            actor=officer,
            action="Exit Verification",
            note=history_note,
            status_snapshot=gate_pass.status.value,
        )
        audit = _create_audit_log(
            db=db,
            gate_pass=gate_pass,
            actor=officer,
            action="gate_pass_exit_verified",
            before_state=before_state,
            after_state=_serialize_gate_pass(gate_pass),
            metadata={
                "pass_id": gate_pass.pass_id,
                "exit_gate": gate_pass.exit_gate,
                "exit_officer": gate_pass.exit_officer,
                "qr_validated": True,
                "qr_code": qr_str,
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
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Exit verification failed")


@router.post("/{pass_id}/entry-verification", response_model=GatePassOut)
def verify_entry_gate_pass(
    pass_id: str,
    body: GatePassVerificationRequest,
    officer: User = Depends(require_guard_or_admin),
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
        if gate_pass.pass_type == GatePassType.non_returnable:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Non-returnable gate passes cannot undergo entry verification",
            )

        qr_str = (body.qr_code or "").strip()
        if not qr_str:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="qr_code is mandatory for gate-pass entry verification under SRS QR-03",
            )
        valid, _gp, msg, eligible, reason, _fmt = _resolve_and_validate_qr(
            db=db,
            qr_code=qr_str,
            expected_pass_id=pass_id,
            target_action="entry",
        )
        if not valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"QR validation failed: {msg}",
            )
        if not eligible:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"QR validation ineligible: {reason}",
            )

        before_state = _serialize_gate_pass(gate_pass)
        gate_pass.status = GatePassStatus.completed
        gate_pass.entry_status = "Verified"
        gate_pass.entry_timestamp = datetime.now(timezone.utc)
        gate_pass.entry_gate = body.entry_gate.strip()
        gate_pass.entry_notes = body.entry_notes.strip() if body.entry_notes else None
        gate_pass.entry_officer = officer.full_name
        gate_pass.authorization_state = "Completed"

        history_note = (body.entry_notes or "Entry verification completed.") + " [QR Validated]"

        history = _create_history_entry(
            db=db,
            gate_pass=gate_pass,
            actor=officer,
            action="Entry Verification",
            note=history_note,
            status_snapshot=gate_pass.status.value,
        )
        audit = _create_audit_log(
            db=db,
            gate_pass=gate_pass,
            actor=officer,
            action="gate_pass_entry_verified",
            before_state=before_state,
            after_state=_serialize_gate_pass(gate_pass),
            metadata={
                "pass_id": gate_pass.pass_id,
                "entry_gate": gate_pass.entry_gate,
                "entry_officer": gate_pass.entry_officer,
                "qr_validated": True,
                "qr_code": qr_str,
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
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Entry verification failed")


@router.post("/{pass_id}/escalate", response_model=GatePassOut)
def escalate_gate_pass(
    pass_id: str,
    body: GatePassEscalationRequest,
    officer: User = Depends(require_guard_or_admin),
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
        gate_pass.escalation_escalated_by = officer.full_name

        history = _create_history_entry(
            db=db,
            gate_pass=gate_pass,
            actor=officer,
            action="Escalated",
            note=body.reason,
            status_snapshot=gate_pass.status.value,
        )
        audit = _create_audit_log(
            db=db,
            gate_pass=gate_pass,
            actor=officer,
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


@router.post("/validate-qr", response_model=GatePassQRValidationOut)
def validate_gate_pass_qr(
    body: GatePassQRValidateRequest,
    _user: User = Depends(require_gate_staff),
    db: Session = Depends(get_db),
) -> GatePassQRValidationOut:
    valid, gp, msg, eligible, reason, fmt = _resolve_and_validate_qr(
        db=db,
        qr_code=body.qr_code,
        expected_pass_id=body.expected_pass_id,
        target_action=body.target_action,
    )
    if not valid or gp is None:
        return GatePassQRValidationOut(
            valid=False,
            pass_id=gp.pass_id if gp else None,
            pass_type=gp.pass_type.value if gp else None,
            status=gp.status.value if gp else None,
            asset_or_item=gp.asset_or_item if gp else None,
            quantity=gp.quantity if gp else None,
            destination=gp.destination if gp else None,
            requester_name=gp.requester_name if gp else None,
            action_eligible=False,
            eligibility_reason=reason,
            resolved_format=fmt,
            message=msg,
        )

    return GatePassQRValidationOut(
        valid=True,
        pass_id=gp.pass_id,
        pass_type=gp.pass_type.value,
        status=gp.status.value,
        asset_or_item=gp.asset_or_item,
        quantity=gp.quantity,
        destination=gp.destination,
        requester_name=gp.requester_name,
        action_eligible=eligible,
        eligibility_reason=reason,
        resolved_format=fmt,
        message=msg,
    )


@router.post("/{pass_id}/override", response_model=GatePassOut)
def override_gate_pass(
    pass_id: str,
    body: GatePassOverrideRequest,
    admin: User = Depends(require_admin_or_superadmin),
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
