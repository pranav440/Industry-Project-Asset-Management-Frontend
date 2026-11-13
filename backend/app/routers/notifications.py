import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_authenticated_user
from app.models import (
    Asset,
    AuditLog,
    Consumable,
    GatePass,
    GatePassHistory,
    GatePassStatus,
    GatePassType,
    Maintenance,
    Notification,
    User,
)
from app.schemas import AlertEvaluationResult, NotificationListResponse, NotificationOut

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


def _generate_notification_id() -> str:
    return f"NTF-{uuid.uuid4().hex[:10].upper()}"


def evaluate_system_alerts(db: Session) -> AlertEvaluationResult:
    """Evaluates overdue returnable gate passes, consumable low stock, and maintenance schedules."""
    now_utc = datetime.now(timezone.utc)
    today = date.today()

    overdue_count = 0
    low_stock_count = 0
    maintenance_count = 0
    total_notifications = 0

    # 1. Overdue Gate Passes (GP-05, NOT-03)
    # Returnable gate passes with movement_date in the past that are active or approved and not yet escalated
    overdue_stmt = select(GatePass).where(
        GatePass.pass_type == GatePassType.returnable,
        GatePass.movement_date.is_not(None),
        GatePass.movement_date < today,
        GatePass.status.in_([GatePassStatus.active, GatePassStatus.approved]),
        GatePass.escalation_is_escalated.is_(False),
    )
    overdue_passes = list(db.scalars(overdue_stmt).all())

    for gp in overdue_passes:
        gp.status = GatePassStatus.escalated
        gp.escalation_is_escalated = True
        gp.escalation_reason = (
            f"Automated Alert: Returnable gate pass {gp.pass_id} exceeded movement/return date "
            f"({gp.movement_date.isoformat() if gp.movement_date else 'N/A'}) without recorded completion."
        )
        gp.escalation_action_required = "Immediate return required. Gate exit hold applied; admin review initiated."
        gp.escalation_timestamp = now_utc
        gp.escalation_escalated_by = "System Alert Monitor"

        # Gate pass history
        history_id = f"GPH-{uuid.uuid4().hex[:10].upper()}"
        history = GatePassHistory(
            history_id=history_id,
            pass_id=gp.pass_id,
            timestamp=now_utc,
            action="Escalated",
            performed_by="System Alert Monitor",
            note=gp.escalation_reason,
            status_snapshot="Escalated",
        )
        db.add(history)

        # Audit log
        audit = AuditLog(
            action="gate_pass_auto_escalated",
            gate_pass_id=gp.id,
            gate_pass_identifier=gp.pass_id,
            actor_user_id=1,  # System admin actor
            occurred_at=now_utc,
            after_state={"status": "Escalated", "reason": gp.escalation_reason},
            metadata_json={"pass_id": gp.pass_id, "trigger": "overdue_scheduled_job"},
        )
        db.add(audit)

        # In-app notification for Guards
        db.add(
            Notification(
                notification_id=_generate_notification_id(),
                target_role="guard",
                title=f"Overdue Returnable Gate Pass: {gp.pass_id}",
                message=f"Returnable asset '{gp.asset_or_item}' is overdue (due {gp.movement_date}). Hold on re-entry/exit.",
                category="gate_pass",
                priority="urgent",
                link=f"/guard/gate-passes?search={gp.pass_id}",
            )
        )
        # In-app notification for Admins
        db.add(
            Notification(
                notification_id=_generate_notification_id(),
                target_role="admin",
                title=f"Gate Pass Escalated: {gp.pass_id}",
                message=f"Returnable pass {gp.pass_id} for '{gp.asset_or_item}' (custodian: {gp.requester_name}) is overdue.",
                category="gate_pass",
                priority="high",
                link=f"/gate-passes/{gp.pass_id}",
            )
        )
        overdue_count += 1
        total_notifications += 2

    # 2. Consumable Low-Stock Alerts (CA-03, NOT-01)
    # Check consumables where available_stock <= threshold
    low_stock_stmt = select(Consumable).where(Consumable.available_stock <= Consumable.threshold)
    low_stock_items = list(db.scalars(low_stock_stmt).all())

    for item in low_stock_items:
        # Avoid duplicate unread notification for the same item within the last 24h
        existing_ntf = db.scalar(
            select(Notification).where(
                Notification.category == "consumable",
                Notification.message.like(f"%{item.consumable_id}%"),
                Notification.is_read.is_(False),
            )
        )
        if existing_ntf is None:
            db.add(
                Notification(
                    notification_id=_generate_notification_id(),
                    target_role="admin",
                    title=f"Low Stock Alert: {item.name}",
                    message=(
                        f"Consumable '{item.name}' ({item.consumable_id}) stock is critical: "
                        f"{item.available_stock} remaining (Threshold: {item.threshold}) at {item.location}."
                    ),
                    category="consumable",
                    priority="high",
                    link=f"/consumables?search={item.consumable_id}",
                )
            )
            low_stock_count += 1
            total_notifications += 1

    # 3. Upcoming Maintenance or Warranty Expiration (MNT-01, NOT-01)
    # Check assets with warranty or recent maintenance
    recent_maintenance_stmt = (
        select(Maintenance)
        .where(Maintenance.service_date >= (today - timedelta(days=30)))
        .order_by(Maintenance.service_date.desc())
        .limit(5)
    )
    for m in db.scalars(recent_maintenance_stmt).all():
        existing_m_ntf = db.scalar(
            select(Notification).where(
                Notification.category == "maintenance",
                Notification.message.like(f"%{m.maintenance_id}%"),
            )
        )
        if existing_m_ntf is None:
            db.add(
                Notification(
                    notification_id=_generate_notification_id(),
                    target_role="maintenance_vendor",
                    title=f"Maintenance Service Record: {m.maintenance_id}",
                    message=f"Service recorded for asset ID {m.asset_id} by {m.service_vendor}. Cost: ${float(m.maintenance_cost):,.2f}.",
                    category="maintenance",
                    priority="normal",
                    link=f"/asset-maintenance",
                )
            )
            maintenance_count += 1
            total_notifications += 1

    db.commit()

    return AlertEvaluationResult(
        overdue_gate_passes_escalated=overdue_count,
        low_stock_alerts_generated=low_stock_count,
        maintenance_alerts_generated=maintenance_count,
        total_notifications_created=total_notifications,
    )


@router.get("", response_model=NotificationListResponse)
def get_notifications(
    unread_only: bool = Query(default=False),
    category: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    current_user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
) -> NotificationListResponse:
    user_filter = or_(
        Notification.user_id == current_user.id,
        Notification.recipient_email == current_user.email,
        Notification.target_role == current_user.role.value,
        Notification.target_role.is_(None),
    )

    query = select(Notification).where(user_filter)
    if unread_only:
        query = query.where(Notification.is_read.is_(False))
    if category:
        query = query.where(Notification.category == category)

    query = query.order_by(Notification.created_at.desc()).limit(limit)
    items = list(db.scalars(query).all())

    # Total unread count for current user
    unread_query = select(func.count(Notification.id)).where(user_filter, Notification.is_read.is_(False))
    unread_count = db.scalar(unread_query) or 0

    return NotificationListResponse(
        items=[NotificationOut.model_validate(n) for n in items],
        total=len(items),
        unread_count=unread_count,
    )


@router.patch("/{notification_id}/read", response_model=NotificationOut)
@router.post("/{notification_id}/read", response_model=NotificationOut)
def mark_notification_as_read(
    notification_id: str,
    current_user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
) -> NotificationOut:
    ntf = db.scalar(
        select(Notification).where(
            Notification.notification_id == notification_id,
        )
    )
    if ntf is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")

    ntf.is_read = True
    ntf.read_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(ntf)
    return NotificationOut.model_validate(ntf)


@router.post("/read-all", response_model=dict[str, Any])
def mark_all_notifications_as_read(
    current_user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    user_filter = or_(
        Notification.user_id == current_user.id,
        Notification.recipient_email == current_user.email,
        Notification.target_role == current_user.role.value,
        Notification.target_role.is_(None),
    )
    unreads = list(db.scalars(select(Notification).where(user_filter, Notification.is_read.is_(False))).all())
    now_utc = datetime.now(timezone.utc)
    for n in unreads:
        n.is_read = True
        n.read_at = now_utc
    db.commit()
    return {"updated_count": len(unreads), "status": "success"}


@router.post("/check-alerts", response_model=AlertEvaluationResult)
def trigger_alert_evaluation(
    current_user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
) -> AlertEvaluationResult:
    """Manually or periodically trigger background alert evaluation."""
    return evaluate_system_alerts(db)
