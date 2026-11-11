import base64
import io
import math
import uuid
from collections import defaultdict
from datetime import date, datetime, time, timezone
from typing import Literal

import qrcode

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, case, distinct, func, or_, select
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
    GuardLogChecklistItemOut,
    GuardLogTimelineEventOut,
    GuardMovementLogRecordOut,
    GuardLogsKpisOut,
    GuardMovementLogListResponse,
    GuardEscalationTimelineEventOut,
    GuardEscalationRegisterItemOut,
    GuardEscalationKpisOut,
    GuardEscalationRegisterResponse,
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


@router.get("/movement-logs", response_model=GuardMovementLogListResponse)
def get_guard_movement_logs(
    search: str | None = Query(default=None),
    from_date: date | None = Query(default=None),
    to_date: date | None = Query(default=None),
    direction: str | None = Query(default=None),
    status: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=1000),
    _user: User = Depends(require_guard_or_admin),
    db: Session = Depends(get_db),
) -> GuardMovementLogListResponse:
    # SQL Expressions for authoritative classification:
    # 1. Exit Verification: actual outbound physical movement
    # 2. Entry Verification: actual inbound physical movement
    # 3. Escalated: recorded security escalation, not a physical movement
    # 4. Gate Pass Created / Decision Updated / Status Overridden: administrative lifecycle events
    is_exit_expr = GatePassHistory.action.ilike("%exit%")
    is_entry_expr = GatePassHistory.action.ilike("%entry%")
    is_escalation_expr = or_(
        GatePassHistory.action.ilike("%escalat%"),
        GatePassHistory.status_snapshot == "Escalated",
    )
    is_rejected_expr = or_(
        GatePassHistory.action.ilike("%reject%"),
        GatePassHistory.status_snapshot == "Rejected",
    )

    category_expr = case(
        (or_(is_exit_expr, is_entry_expr), "Physical Movement"),
        (is_escalation_expr, "Security Escalation"),
        else_="Administrative",
    )

    direction_expr = case(
        (is_exit_expr, "Outward"),
        (is_entry_expr, "Inward"),
        else_="N/A",
    )

    status_expr = case(
        (or_(is_exit_expr, is_entry_expr), "Cleared"),
        (or_(is_escalation_expr, is_rejected_expr), "Flagged"),
        (GatePassHistory.status_snapshot == "Approved", "Pending"),
        else_="Pending",
    )

    query = (
        select(GatePassHistory, GatePass)
        .join(GatePass, GatePassHistory.pass_id == GatePass.pass_id)
    )

    if search and search.strip():
        pattern = f"%{search.strip().lower()}%"
        query = query.where(
            or_(
                GatePass.pass_id.ilike(pattern),
                GatePass.asset_or_item.ilike(pattern),
                GatePass.requester_name.ilike(pattern),
                GatePass.department.ilike(pattern),
                GatePass.destination.ilike(pattern),
                GatePassHistory.history_id.ilike(pattern),
                GatePassHistory.performed_by.ilike(pattern),
                GatePassHistory.note.ilike(pattern),
            )
        )

    if from_date:
        dt_from = datetime.combine(from_date, time.min).replace(tzinfo=timezone.utc)
        query = query.where(GatePassHistory.timestamp >= dt_from)

    if to_date:
        dt_to = datetime.combine(to_date, time.max).replace(tzinfo=timezone.utc)
        query = query.where(GatePassHistory.timestamp <= dt_to)

    if direction and direction.strip().lower() in ("inward", "outward", "movements"):
        dir_clean = direction.strip().lower()
        if dir_clean == "inward":
            query = query.where(is_entry_expr)
        elif dir_clean == "outward":
            query = query.where(is_exit_expr)
        elif dir_clean == "movements":
            query = query.where(or_(is_exit_expr, is_entry_expr))

    if status and status.strip().lower() in ("cleared", "pending", "flagged"):
        req_status = status.strip().capitalize()
        query = query.where(status_case == req_status if "status_case" in locals() else status_expr == req_status)

    # Calculate summary KPIs strictly over matching filter scope:
    # Movement totals must count ONLY actual entry and exit verification events.
    # Administrative events and escalations do NOT inflate movement totals.
    total_movements_metric = func.count(case((or_(is_exit_expr, is_entry_expr), 1), else_=None))
    inbound_metric = func.count(case((is_entry_expr, 1), else_=None))
    outbound_metric = func.count(case((is_exit_expr, 1), else_=None))
    flagged_metric = func.count(case((status_expr == "Flagged", 1), else_=None))

    kpi_query = (
        select(
            func.count().label("total_records"),
            total_movements_metric.label("total_movements"),
            inbound_metric.label("inbound"),
            outbound_metric.label("outbound"),
            flagged_metric.label("flagged"),
        )
        .select_from(GatePassHistory)
        .join(GatePass, GatePassHistory.pass_id == GatePass.pass_id)
    )
    if query._where_criteria:
        kpi_query = kpi_query.where(*query._where_criteria)

    kpi_row = db.execute(kpi_query).one()

    total_records = int(kpi_row[0] or 0)
    total_movements = int(kpi_row[1] or 0)
    inbound_cnt = int(kpi_row[2] or 0)
    outbound_cnt = int(kpi_row[3] or 0)
    flagged_cnt = int(kpi_row[4] or 0)
    total_pages = max(1, math.ceil(total_records / page_size)) if total_records > 0 else 1

    ordered_query = query.order_by(GatePassHistory.timestamp.desc(), GatePassHistory.id.desc())
    rows = db.execute(
        ordered_query.offset((page - 1) * page_size).limit(page_size)
    ).all()

    # Pre-resolve assets for the current page
    item_refs = {gp.asset_or_item.strip() for _, gp in rows if gp.asset_or_item}
    matched_assets: dict[str, Asset] = {}
    if item_refs:
        assets = db.scalars(
            select(Asset).where(
                or_(
                    Asset.asset_id.in_(item_refs),
                    Asset.qr_code_value.in_(item_refs),
                )
            )
        ).all()
        for a in assets:
            matched_assets[a.asset_id] = a
            if a.qr_code_value:
                matched_assets[a.qr_code_value] = a
        for item_ref in item_refs:
            if item_ref not in matched_assets:
                sn_matches = db.scalars(
                    select(Asset).where(Asset.serial_number == item_ref).limit(2)
                ).all()
                if len(sn_matches) == 1:
                    matched_assets[item_ref] = sn_matches[0]

    # Pre-resolve chronological pass histories for station timelines on this page
    pass_ids_on_page = {gp.pass_id for _, gp in rows}
    histories_by_pass: dict[str, list[GatePassHistory]] = defaultdict(list)
    if pass_ids_on_page:
        all_hists = db.scalars(
            select(GatePassHistory)
            .where(GatePassHistory.pass_id.in_(pass_ids_on_page))
            .order_by(GatePassHistory.timestamp.asc(), GatePassHistory.id.asc())
        ).all()
        for h in all_hists:
            histories_by_pass[h.pass_id].append(h)

    items: list[GuardMovementLogRecordOut] = []
    for history, gp in rows:
        act_lower = history.action.lower()
        is_exit = "exit" in act_lower
        is_entry = "entry" in act_lower
        is_escalated = "escalat" in act_lower or history.status_snapshot == "Escalated"
        is_rejected = "reject" in act_lower or history.status_snapshot == "Rejected"

        if is_exit:
            cat_val = "Physical Movement"
            dir_val = "Outward"
            dir_label = "Outward / Exit"
            status_val: Literal["Cleared", "Pending", "Flagged"] = "Cleared"
        elif is_entry:
            cat_val = "Physical Movement"
            dir_val = "Inward"
            dir_label = "Inward / Entry"
            status_val = "Cleared"
        elif is_escalated:
            cat_val = "Security Escalation"
            dir_val = "N/A"
            dir_label = "Escalation Hold"
            status_val = "Flagged"
        elif is_rejected:
            cat_val = "Administrative"
            dir_val = "N/A"
            dir_label = "Admin Rejection"
            status_val = "Flagged"
        else:
            cat_val = "Administrative"
            dir_val = "N/A"
            dir_label = "Administrative"
            status_val = "Pending"

        asset = matched_assets.get((gp.asset_or_item or "").strip())
        asset_id = asset.asset_id if asset else (gp.asset_or_item or "N/A")
        asset_name = asset.name if asset else (gp.asset_or_item or "Item/Asset")
        serial_number = asset.serial_number if (asset and asset.serial_number) else "Unavailable"

        if is_exit:
            checkpoint_gate = gp.exit_gate or "Guard Console"
            checkpoint_full = f"{checkpoint_gate} (Outbound Barrier)"
        elif is_entry:
            checkpoint_gate = gp.entry_gate or "Guard Console"
            checkpoint_full = f"{checkpoint_gate} (Inbound Intake)"
        else:
            checkpoint_gate = gp.exit_gate or gp.entry_gate or "Guard Console"
            checkpoint_full = f"{checkpoint_gate} (Perimeter Station)"

        has_disc = status_val == "Flagged"
        disc_title = "Flagged Checkpoint Discrepancy" if has_disc else "None detected / Clean Pass"
        disc_details = (
            (history.note or gp.escalation_reason or "Escalated at checkpoint.")
            if has_disc
            else "Authoritative verification completed and logged at checkpoint."
        )

        ts = history.timestamp if history.timestamp.tzinfo else history.timestamp.replace(tzinfo=timezone.utc)
        date_str = ts.strftime("%Y-%m-%d")
        date_display = ts.strftime("%b %d, %Y")
        time_display = ts.strftime("%H:%M:%S UTC")

        # Checklist items are NOT individually persisted by the backend.
        # Do NOT fabricate individual checklist items with verified: true.
        # Leave checklist empty so UI honestly displays non-persisted status.
        checklist: list[GuardLogChecklistItemOut] = []

        # Chronological station timeline strictly uses actual recorded history events
        timeline = [
            GuardLogTimelineEventOut(
                time=(h.timestamp if h.timestamp.tzinfo else h.timestamp.replace(tzinfo=timezone.utc)).strftime("%H:%M:%S UTC"),
                title=h.action,
                desc=h.note or f"{h.action} recorded by {h.performed_by}",
                completed=True,
            )
            for h in histories_by_pass[gp.pass_id]
        ]

        remarks = history.note or (
            "Physical verification logged at checkpoint."
            if status_val == "Cleared"
            else "Audit action recorded."
        )

        items.append(
            GuardMovementLogRecordOut(
                id=history.history_id,
                passId=gp.pass_id,
                pass_id=gp.pass_id,
                assetId=asset_id,
                asset_id=asset_id,
                assetName=asset_name,
                asset_name=asset_name,
                serialNumber=serial_number,
                serial_number=serial_number,
                category=cat_val,
                direction=dir_val,
                directionLabel=dir_label,
                direction_label=dir_label,
                requesterName=gp.requester_name,
                requester_name=gp.requester_name,
                requesterBadge=gp.department or "Staff",
                requester_badge=gp.department or "Staff",
                department=gp.department or "Administration",
                date=date_str,
                dateDisplay=date_display,
                date_display=date_display,
                timeDisplay=time_display,
                time_display=time_display,
                status=status_val,
                guardName=history.performed_by,
                guard_name=history.performed_by,
                guardBadge="SEC-GUARD",
                guard_badge="SEC-GUARD",
                checkpoint=checkpoint_gate,
                checkpointFull=checkpoint_full,
                checkpoint_full=checkpoint_full,
                approvingAdmin=gp.decision_by or "Authorized by System",
                approving_admin=gp.decision_by or "Authorized by System",
                custodian=f"{gp.requester_name} ({gp.department or 'Staff'})",
                carrierVehicle=f"{gp.requester_name} • Destination: {gp.destination}",
                carrier_vehicle=f"{gp.requester_name} • Destination: {gp.destination}",
                manifestHash="Standard Manifest (No Hash Stored)",
                manifest_hash="Standard Manifest (No Hash Stored)",
                tamperSealId="N/A (Untracked)",
                tamper_seal_id="N/A (Untracked)",
                inspectedQty=gp.quantity,
                inspected_qty=gp.quantity,
                expectedQty=gp.quantity,
                expected_qty=gp.quantity,
                hasDiscrepancy=has_disc,
                has_discrepancy=has_disc,
                discrepancyStatusTitle=disc_title,
                discrepancy_status_title=disc_title,
                discrepancyDetails=disc_details,
                discrepancy_details=disc_details,
                guardRemarks=remarks,
                guard_remarks=remarks,
                checklist=checklist,
                timeline=timeline,
            )
        )

    kpis = GuardLogsKpisOut(
        totalMovements=total_movements,
        total_movements=total_movements,
        inboundEntries=inbound_cnt,
        inbound_entries=inbound_cnt,
        outboundExits=outbound_cnt,
        outbound_exits=outbound_cnt,
        flaggedMovements=flagged_cnt,
        flagged_movements=flagged_cnt,
        totalRecords=total_records,
        total_records=total_records,
    )

    return GuardMovementLogListResponse(
        items=items,
        total=total_records,
        page=page,
        pageSize=page_size,
        page_size=page_size,
        totalPages=total_pages,
        total_pages=total_pages,
        kpis=kpis,
    )


@router.get("/escalation-register", response_model=GuardEscalationRegisterResponse)
def get_guard_escalation_register(
    search: str | None = Query(default=None),
    status: str | None = Query(default=None),
    from_date: date | None = Query(default=None),
    to_date: date | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=1000),
    _user: User = Depends(require_guard_or_admin),
    db: Session = Depends(get_db),
) -> GuardEscalationRegisterResponse:
    # 1. Subquery of distinct pass_ids with a recorded escalation event in GatePassHistory
    escalated_history_subquery = (
        select(distinct(GatePassHistory.pass_id))
        .where(
            or_(
                GatePassHistory.action == "Escalated",
                GatePassHistory.action.ilike("%escalat%"),
            )
        )
    )

    # 2. Subquery of distinct pass_ids with the exact "Override Granted" action in GatePassHistory.
    # Excludes generic "Decision Updated" events and does not infer an override from status.
    override_history_subquery = (
        select(distinct(GatePassHistory.pass_id))
        .where(GatePassHistory.action == "Override Granted")
    )

    # Base filter: Strictly unique GatePass records with a recorded escalation event in GatePassHistory.
    # Do not count a pass solely because status is Escalated or boolean is true if no recorded escalation exists.
    is_escalated_pass = GatePass.pass_id.in_(escalated_history_subquery)

    query = select(GatePass).where(is_escalated_pass)

    if search and search.strip():
        p = f"%{search.strip().lower()}%"
        query = query.where(
            or_(
                GatePass.pass_id.ilike(p),
                GatePass.asset_or_item.ilike(p),
                GatePass.requester_name.ilike(p),
                GatePass.department.ilike(p),
                GatePass.destination.ilike(p),
                GatePass.escalation_reason.ilike(p),
                GatePass.escalation_escalated_by.ilike(p),
            )
        )

    if status and status.strip():
        st_clean = status.strip().lower()
        if st_clean == "active":
            query = query.where(GatePass.status == GatePassStatus.escalated)
        elif st_clean in ("cleared", "overridden"):
            query = query.where(GatePass.pass_id.in_(override_history_subquery))

    effective_date = func.coalesce(GatePass.escalation_timestamp, GatePass.created_at)
    if from_date:
        dt_from = datetime.combine(from_date, time.min).replace(tzinfo=timezone.utc)
        query = query.where(effective_date >= dt_from)
    if to_date:
        dt_to = datetime.combine(to_date, time.max).replace(tzinfo=timezone.utc)
        query = query.where(effective_date <= dt_to)

    # Compute KPIs across the matching filter criteria without duplicate counting
    total_holds = db.scalar(
        select(func.count(distinct(GatePass.id))).where(*query._where_criteria)
    ) or 0

    active_holds = db.scalar(
        select(func.count(distinct(GatePass.id)))
        .where(*query._where_criteria)
        .where(GatePass.status == GatePassStatus.escalated)
    ) or 0

    cleared_overridden = db.scalar(
        select(func.count(distinct(GatePass.id)))
        .where(*query._where_criteria)
        .where(GatePass.pass_id.in_(override_history_subquery))
    ) or 0

    kpis = GuardEscalationKpisOut(
        totalHolds=total_holds,
        total_holds=total_holds,
        activeHolds=active_holds,
        active_holds=active_holds,
        clearedOverridden=cleared_overridden,
        cleared_overridden=cleared_overridden,
    )

    total_pages = max(1, math.ceil(total_holds / page_size))
    offset = (page - 1) * page_size

    passes = db.scalars(
        query.order_by(effective_date.desc()).offset(offset).limit(page_size)
    ).all()

    # Query all history for these passes to construct chronological timelines and resolve override details
    pass_ids = [p.pass_id for p in passes]
    history_map: dict[str, list[GatePassHistory]] = {pid: [] for pid in pass_ids}
    if pass_ids:
        hist_rows = db.scalars(
            select(GatePassHistory)
            .where(GatePassHistory.pass_id.in_(pass_ids))
            .order_by(GatePassHistory.timestamp.asc())
        ).all()
        for h in hist_rows:
            history_map[h.pass_id].append(h)

    items: list[GuardEscalationRegisterItemOut] = []
    for gp in passes:
        pass_hist = history_map.get(gp.pass_id, [])
        # Locate escalation event in history
        esc_hist = next(
            (h for h in reversed(pass_hist) if "escalat" in h.action.lower() or h.status_snapshot == "Escalated"),
            None,
        )
        # Locate exact override event in history
        override_hist = next(
            (h for h in reversed(pass_hist) if h.action == "Override Granted"),
            None,
        )

        esc_by = gp.escalation_escalated_by or (esc_hist.performed_by if esc_hist else None) or "Security Officer"
        esc_reason = gp.escalation_reason or (esc_hist.note if esc_hist else None) or "Checkpoint discrepancy flagged"
        esc_ts = gp.escalation_timestamp or (esc_hist.timestamp if esc_hist else None) or gp.created_at
        if esc_ts and esc_ts.tzinfo is None:
            esc_ts = esc_ts.replace(tzinfo=timezone.utc)

        action_req = gp.escalation_action_required or "Administrative clearance required before movement"

        is_currently_escalated = gp.status == GatePassStatus.escalated
        has_override_record = override_hist is not None

        if is_currently_escalated:
            hold_status = "Active"
            hold_status_title = "Active Escalation Hold"
        elif has_override_record:
            hold_status = "Cleared"
            hold_status_title = "Cleared by Administrative Override"
        else:
            hold_status = "Cleared"
            hold_status_title = f"Cleared ({gp.status.value})"

        # Format timeline using real recorded GatePassHistory events
        timeline_events = [
            GuardEscalationTimelineEventOut(
                id=h.history_id,
                timestamp=(h.timestamp if h.timestamp.tzinfo else h.timestamp.replace(tzinfo=timezone.utc)).strftime("%b %d, %Y, %I:%M %p"),
                event=h.action,
                actor=h.performed_by,
                actorRole="Administrator" if "override" in h.action.lower() or "decision" in h.action.lower() else "Security Officer",
                actor_role="Administrator" if "override" in h.action.lower() or "decision" in h.action.lower() else "Security Officer",
                note=h.note,
            )
            for h in pass_hist
        ]

        checkpoint_name = gp.exit_gate or gp.entry_gate or "Gate-01A Main Gate"

        ov_ts = None
        if override_hist and override_hist.timestamp:
            ov_ts = override_hist.timestamp if override_hist.timestamp.tzinfo else override_hist.timestamp.replace(tzinfo=timezone.utc)

        items.append(
            GuardEscalationRegisterItemOut(
                id=f"ESC-{gp.pass_id}",
                passId=gp.pass_id,
                pass_id=gp.pass_id,
                assetId=gp.asset_or_item,
                asset_id=gp.asset_or_item,
                assetName=gp.asset_or_item,
                asset_name=gp.asset_or_item,
                requesterName=gp.requester_name,
                requester_name=gp.requester_name,
                department=gp.department,
                destination=gp.destination,
                passType=gp.pass_type.value,
                pass_type=gp.pass_type.value,
                gatePassStatus=gp.status.value,
                gate_pass_status=gp.status.value,
                holdStatus=hold_status,
                hold_status=hold_status,
                holdStatusTitle=hold_status_title,
                hold_status_title=hold_status_title,
                escalationReason=esc_reason,
                escalation_reason=esc_reason,
                actionRequired=action_req,
                action_required=action_req,
                escalatedBy=esc_by,
                escalated_by=esc_by,
                escalationTimestamp=esc_ts,
                escalation_timestamp=esc_ts,
                dateDisplay=esc_ts.strftime("%b %d, %Y"),
                date_display=esc_ts.strftime("%b %d, %Y"),
                timeDisplay=esc_ts.strftime("%I:%M %p"),
                time_display=esc_ts.strftime("%I:%M %p"),
                checkpoint=checkpoint_name,
                overrideBy=override_hist.performed_by if override_hist else None,
                override_by=override_hist.performed_by if override_hist else None,
                overrideTimestamp=ov_ts,
                override_timestamp=ov_ts,
                overrideNote=override_hist.note if override_hist else None,
                override_note=override_hist.note if override_hist else None,
                timeline=timeline_events,
            )
        )

    return GuardEscalationRegisterResponse(
        items=items,
        total=total_holds,
        page=page,
        pageSize=page_size,
        page_size=page_size,
        totalPages=total_pages,
        total_pages=total_pages,
        kpis=kpis,
    )


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
