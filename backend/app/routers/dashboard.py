from datetime import date, datetime, time, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, distinct, func, or_, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import (
    require_admin,
    require_authenticated_user,
    require_guard_or_admin,
    require_host,
    require_roles,
)
from app.models import (
    Asset,
    AssetMovement,
    AssetMovementStatus,
    AssetStatus,
    AuditLog,
    Consumable,
    ConsumableIssue,
    GatePass,
    GatePassHistory,
    GatePassStatus,
    GatePassType,
    Request,
    RequestHistory,
    RequestStatus,
    User,
    UserRole,
)
from app.routers.assets import _is_custodian_match, _to_response_with_history
from app.routers.consumables import (
    CATEGORY_COLOR_CLASSES,
    CATEGORY_COLORS,
    _category_icon,
    _normalize_category_key,
)
from app.schemas import (
    AdminDashboardResponse,
    AssetOut,
    EmployeeConsumableIssueOut,
    EmployeeConsumptionCategoryMetric,
    EmployeeConsumptionSummaryOut,
    EmployeeDashboardResponse,
    EmployeeDashboardSummaryMetrics,
    GuardCheckpointAlertItemOut,
    GuardDashboardKpiItem,
    GuardDashboardKpis,
    GuardDashboardResponse,
    GuardRecentActivityItemOut,
    GuardUpcomingMovementItemOut,
    GuardVerificationQueueItemOut,
    HostAlertListResponse,
    HostDashboardKpis,
    HostDashboardResponse,
    HostGatePassActivityItemOut,
    HostKpiActiveGatePasses,
    HostKpiEscalated,
    HostKpiMovement,
    HostKpiPendingActions,
    HostMovementListResponse,
    HostMovementScanItemOut,
    HostOperationalAlertItemOut,
    HostPendingActionItemOut,
    RequestListItemOut,
)

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


def _stock_status(available: int, threshold: int) -> str:
    if available <= 0:
        return "Out of Stock"
    if available <= threshold:
        return "Low Stock"
    return "In Stock"


def _history_by_stage(db: Session, request_id: str) -> dict[str, date | str]:
    history = db.scalars(
        select(RequestHistory)
        .where(RequestHistory.request_id == request_id)
        .order_by(RequestHistory.timestamp.asc(), RequestHistory.id.asc())
    ).all()
    result: dict[str, date | str] = {}
    for record in history:
        if record.stage == RequestStatus.in_review.value and "approval_date" not in result:
            result["approval_date"] = record.timestamp
        if record.stage == RequestStatus.fulfilled.value and "fulfillment_date" not in result:
            result["fulfillment_date"] = record.timestamp
    return result


def _format_date(val: object) -> str | None:
    if val is None:
        return None
    if isinstance(val, (datetime, date)):
        return val.isoformat()
    return str(val)


@router.get("/admin", response_model=AdminDashboardResponse)
def get_admin_dashboard(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AdminDashboardResponse:
    summary = {
        "open_requests": db.scalar(
            select(func.count(Request.id)).where(
                Request.status.in_([RequestStatus.pending, RequestStatus.in_review])
            )
        )
        or 0,
        "pending_approvals": db.scalar(
            select(func.count(Request.id)).where(Request.status == RequestStatus.in_review)
        )
        or 0,
        "low_stock_alerts": db.scalar(
            select(func.count(Consumable.id)).where(Consumable.available_stock <= Consumable.threshold)
        )
        or 0,
        "monthly_spend": None,
        "budget_utilized": None,
    }

    asset_status_counts = {status.value: 0 for status in AssetStatus}
    for asset in db.scalars(select(Asset)).all():
        asset_status_counts[asset.status.value] = asset_status_counts.get(asset.status.value, 0) + 1

    my_requests = []
    user_email = (current_user.email or "").strip().lower()
    for request in db.scalars(
        select(Request)
        .where(
            or_(
                Request.requester_name == current_user.full_name,
                func.lower(func.trim(Request.requester_email)) == user_email,
            )
        )
        .order_by(Request.request_date.desc(), Request.id.desc())
    ).all():
        history_dates = _history_by_stage(db, request.request_id)
        my_requests.append({
            "request_id": request.request_id,
            "requested_item": request.requested_item,
            "status": request.status.value,
            "request_date": request.request_date.isoformat(),
            "approval_date": _format_date(history_dates.get("approval_date")),
            "fulfillment_date": _format_date(history_dates.get("fulfillment_date")),
        })

    today = date.today()
    expiry_alerts = []
    for consumable in db.scalars(
        select(Consumable)
        .where(Consumable.expiry_date.is_not(None))
        .order_by(Consumable.expiry_date.asc(), Consumable.id.asc())
    ).all():
        expiry_date = consumable.expiry_date
        if expiry_date <= today:
            severity = "urgent"
        elif expiry_date <= today + timedelta(days=45):
            severity = "upcoming"
        else:
            continue
        expiry_alerts.append({
            "item_id": consumable.consumable_id,
            "name": consumable.name,
            "expiry_date": expiry_date.isoformat(),
            "severity": severity,
            "days_remaining": (expiry_date - today).days,
        })

    stock_levels = []
    category_rows = db.execute(
        select(
            Consumable.category,
            func.sum(Consumable.available_stock).label("available_stock"),
            func.sum(Consumable.threshold).label("threshold"),
        )
        .where(Consumable.expiry_date.is_not(None))
        .group_by(Consumable.category)
        .order_by(Consumable.category.asc())
    ).all()
    for category, available_stock, threshold in category_rows:
        total_available = int(available_stock or 0)
        total_threshold = int(threshold or 0)
        stock_levels.append({
            "category": category,
            "available_stock": total_available,
            "threshold": total_threshold,
            "status": _stock_status(total_available, total_threshold),
        })

    return {
        "summary": summary,
        "asset_inventory": {
            "total_assets": db.scalar(select(func.count(Asset.id))) or 0,
            "by_status": asset_status_counts,
        },
        "my_requests": my_requests,
        "expiry_alerts": expiry_alerts,
        "stock_levels": stock_levels,
        "department_consumption": None,
        "recent_pos": None,
    }


@router.get("/employee", response_model=EmployeeDashboardResponse)
def get_employee_dashboard(
    current_user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
) -> EmployeeDashboardResponse:
    now = datetime.now(timezone.utc)
    user_email = (current_user.email or "").strip().lower()

    # 1. Request Statistics
    if user_email:
        email_filter = func.lower(func.trim(Request.requester_email)) == user_email
        open_requests_count = (
            db.scalar(
                select(func.count(Request.id)).where(
                    email_filter,
                    Request.status.in_([RequestStatus.pending, RequestStatus.in_review]),
                )
            )
            or 0
        )
        awaiting_approval_count = (
            db.scalar(
                select(func.count(Request.id)).where(
                    email_filter,
                    Request.status == RequestStatus.pending,
                )
            )
            or 0
        )
        closed_requests_count = (
            db.scalar(
                select(func.count(Request.id)).where(
                    email_filter,
                    Request.status.in_([RequestStatus.fulfilled, RequestStatus.rejected]),
                )
            )
            or 0
        )
        total_requests_count = (
            db.scalar(
                select(func.count(Request.id)).where(email_filter)
            )
            or 0
        )

        recent_requests_rows = db.scalars(
            select(Request)
            .where(email_filter)
            .order_by(Request.request_date.desc(), Request.id.desc())
            .limit(10)
        ).all()
        recent_requests = [
            RequestListItemOut(
                request_id=r.request_id,
                requester_name=r.requester_name,
                requester_email=r.requester_email,
                department=r.department,
                request_type=r.request_type.value if hasattr(r.request_type, "value") else str(r.request_type),
                requested_item=r.requested_item,
                category=r.category,
                quantity=r.quantity,
                priority=r.priority.value if hasattr(r.priority, "value") else str(r.priority),
                request_date=r.request_date,
                status=r.status.value if hasattr(r.status, "value") else str(r.status),
                justification=r.justification,
                processing_guidelines=r.processing_guidelines,
                request_source=r.request_source or "Internal",
                date_received=r.date_received,
                external_reference=r.external_reference,
                contact_info=r.contact_info,
                estimated_cost=r.estimated_cost,
                procurement_reference=r.procurement_reference,
                created_at=r.created_at,
                updated_at=r.updated_at,
            )
            for r in recent_requests_rows
        ]
    else:
        open_requests_count = 0
        awaiting_approval_count = 0
        closed_requests_count = 0
        total_requests_count = 0
        recent_requests = []

    # 2. Assigned Assets
    candidate_assets = db.scalars(
        select(Asset)
        .where(Asset.custodian.isnot(None))
        .order_by(Asset.created_at.desc(), Asset.id.desc())
    ).all()

    assigned_assets_list: list[Asset] = []
    seen_ids = set()
    for a in candidate_assets:
        if a.id not in seen_ids and _is_custodian_match(a.custodian, current_user):
            seen_ids.add(a.id)
            assigned_assets_list.append(a)

    assigned_assets_count = len(assigned_assets_list)
    assets_in_maintenance_count = sum(
        1 for a in assigned_assets_list if a.status == AssetStatus.in_maintenance
    )

    # Preview assigned assets (up to 5 items)
    preview_assigned_assets: list[AssetOut] = []
    for a in assigned_assets_list[:5]:
        movements = db.scalars(
            select(AssetMovement)
            .where(AssetMovement.asset_id == a.id)
            .order_by(AssetMovement.initiated_at.asc(), AssetMovement.id.asc())
        ).all()
        preview_assigned_assets.append(_to_response_with_history(a, movements, [], []))

    # 3. Consumable Issues & Consumption Summary (Current Month)
    recent_consumable_issues: list[EmployeeConsumableIssueOut] = []
    cat_metrics: list[EmployeeConsumptionCategoryMetric] = []
    current_month_total_units = 0

    if user_email:
        consumable_stmt = (
            select(ConsumableIssue, Consumable, Request)
            .join(Consumable, ConsumableIssue.consumable_id == Consumable.id)
            .join(Request, func.trim(ConsumableIssue.request_reference) == func.trim(Request.request_id))
            .where(
                ConsumableIssue.request_reference.isnot(None),
                func.lower(func.trim(Request.requester_email)) == user_email,
            )
            .order_by(ConsumableIssue.issue_date.desc(), ConsumableIssue.id.desc())
        )
        my_consumable_rows = db.execute(consumable_stmt).all()

        # Recent consumable issues (up to 5)
        for issue, consumable, req in my_consumable_rows[:5]:
            is_curr_m = (issue.issue_date.year == now.year and issue.issue_date.month == now.month)
            ckey = _normalize_category_key(consumable.category)
            icon = _category_icon(consumable.category, consumable.name)
            fulfillment_date_str = issue.issue_date.strftime("%d %b %Y")
            raw_date_str = issue.issue_date.strftime("%Y-%m-%d")
            req_id = issue.request_reference or ""

            recent_consumable_issues.append(EmployeeConsumableIssueOut(
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

        # Current month consumption summary
        curr_month_rows = [
            (issue, consumable, req)
            for issue, consumable, req in my_consumable_rows
            if issue.issue_date.year == now.year and issue.issue_date.month == now.month
        ]
        current_month_total_units = sum(issue.quantity for issue, _con, _req in curr_month_rows)

        cat_units: dict[str, int] = {}
        cat_keys: dict[str, str] = {}
        for issue, consumable, req in curr_month_rows:
            c_name = consumable.category or "Other"
            cat_units[c_name] = cat_units.get(c_name, 0) + issue.quantity
            if c_name not in cat_keys:
                cat_keys[c_name] = _normalize_category_key(c_name)

        for c_name, units in cat_units.items():
            ckey = cat_keys[c_name]
            pct = round((units / current_month_total_units) * 100, 1) if current_month_total_units > 0 else 0.0
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

    cycle_ref = f"REC-{now.year}-M{now.month:02d}"
    consumption_summary = EmployeeConsumptionSummaryOut(
        period="This Month",
        cycle_reference=cycle_ref,
        cycleReference=cycle_ref,
        total_issued=current_month_total_units,
        totalIssued=current_month_total_units,
        active_categories_count=len(cat_metrics),
        activeCategoriesCount=len(cat_metrics),
        distinct_categories_count=len(cat_metrics),
        distinctCategoriesCount=len(cat_metrics),
        categories=cat_metrics,
    )

    summary_metrics = EmployeeDashboardSummaryMetrics(
        open_requests=open_requests_count,
        openRequests=open_requests_count,
        awaiting_approval=awaiting_approval_count,
        awaitingApproval=awaiting_approval_count,
        closed_requests=closed_requests_count,
        closedRequests=closed_requests_count,
        total_requests=total_requests_count,
        totalRequests=total_requests_count,
        assigned_assets_count=assigned_assets_count,
        assignedAssetsCount=assigned_assets_count,
        assets_in_maintenance_count=assets_in_maintenance_count,
        assetsInMaintenanceCount=assets_in_maintenance_count,
        consumables_received=current_month_total_units,
        consumablesReceived=current_month_total_units,
    )

    return EmployeeDashboardResponse(
        summary=summary_metrics,
        open_requests=open_requests_count,
        openRequests=open_requests_count,
        awaiting_approval=awaiting_approval_count,
        awaitingApproval=awaiting_approval_count,
        assigned_assets_count=assigned_assets_count,
        assignedAssetsCount=assigned_assets_count,
        assets_in_maintenance_count=assets_in_maintenance_count,
        assetsInMaintenanceCount=assets_in_maintenance_count,
        consumables_received=current_month_total_units,
        consumablesReceived=current_month_total_units,
        recent_requests=recent_requests,
        recentRequests=recent_requests,
        assigned_assets=preview_assigned_assets,
        assignedAssets=preview_assigned_assets,
        consumption=consumption_summary,
        consumption_summary=consumption_summary,
        consumptionSummary=consumption_summary,
        recent_consumable_issues=recent_consumable_issues,
        recentConsumableIssues=recent_consumable_issues,
    )


def _format_time_ago(dt: datetime | date | None) -> str:
    if dt is None:
        return "Just now"
    if isinstance(dt, date) and not isinstance(dt, datetime):
        dt = datetime.combine(dt, time.min)
    now = datetime.now(timezone.utc)
    if dt.tzinfo is None:
        dt_utc = dt.replace(tzinfo=timezone.utc)
    else:
        dt_utc = dt
    diff = now - dt_utc
    seconds = int(diff.total_seconds())
    if seconds < 0:
        return "Scheduled"
    if seconds < 60:
        return "Just now"
    minutes = seconds // 60
    if minutes < 60:
        return f"{minutes}m ago"
    hours = minutes // 60
    if hours < 24:
        return f"{hours}h ago"
    days = hours // 24
    if days == 1:
        return "Yesterday"
    if days < 7:
        return f"{days}d ago"
    return dt.strftime("%d %b %Y")


IST = timezone(timedelta(hours=5, minutes=30), name="IST")


def get_ist_reporting_day_boundaries(ref_dt: datetime | None = None) -> tuple[datetime, datetime]:
    """
    Calculates (start_utc, end_utc) for the IST reporting day.
    Persisted timestamps are kept in UTC convention.
    IST day boundaries (00:00:00 to 24:00:00 IST) are converted to UTC for database queries.
    """
    if ref_dt is None:
        now_utc = datetime.now(timezone.utc)
    elif ref_dt.tzinfo is None:
        now_utc = ref_dt.replace(tzinfo=timezone.utc)
    else:
        now_utc = ref_dt.astimezone(timezone.utc)

    now_ist = now_utc.astimezone(IST)
    ist_date = now_ist.date()

    start_ist = datetime.combine(ist_date, time.min, tzinfo=IST)
    end_ist = start_ist + timedelta(days=1)

    start_utc = start_ist.astimezone(timezone.utc)
    end_utc = end_ist.astimezone(timezone.utc)
    return start_utc, end_utc


def _get_host_alerts(db: Session, today: date, host_user: User | None = None) -> list[HostOperationalAlertItemOut]:
    alert_list: list[HostOperationalAlertItemOut] = []

    # 1. Escalated gate passes from actual database records
    esc_query = select(GatePass).where(
        or_(
            GatePass.status == GatePassStatus.escalated,
            GatePass.escalation_is_escalated.is_(True),
        )
    )
    if host_user and host_user.role == UserRole.host:
        created_pass_ids = select(AuditLog.gate_pass_id).where(
            AuditLog.actor_user_id == host_user.id,
            AuditLog.action == "gate_pass_created",
        )
        esc_query = esc_query.where(
            or_(
                GatePass.requester_name == host_user.full_name,
                GatePass.id.in_(created_pass_ids),
            )
        )
    esc_passes = db.scalars(
        esc_query.order_by(GatePass.escalation_timestamp.desc(), GatePass.updated_at.desc(), GatePass.id.desc()).limit(10)
    ).all()

    for gp in esc_passes:
        time_str = _format_time_ago(gp.escalation_timestamp or gp.updated_at)
        alert_list.append(
            HostOperationalAlertItemOut(
                id=f"ALT-ESC-{gp.pass_id}",
                title=f"Gate Pass Discrepancy Escalated: {gp.pass_id}",
                description=gp.escalation_reason or f"Gate pass {gp.pass_id} ({gp.asset_or_item}) has been flagged for administrative escalation.",
                location=gp.current_location or gp.destination or "Gate Checkpoint",
                timeAgo=time_str,
                time_ago=time_str,
                severity="warning",
                icon="error_outline",
                dotColor="#e06d53",
                dot_color="#e06d53",
            )
        )

    # 2. Overdue passes scheduled for movement on or before today
    overdue_query = select(GatePass).where(
        GatePass.movement_date.isnot(None),
        GatePass.movement_date <= today,
        GatePass.status.in_([GatePassStatus.pending, GatePassStatus.approved, GatePassStatus.active]),
        or_(
            and_(
                GatePass.status == GatePassStatus.active,
                GatePass.entry_status != "Verified",
                GatePass.pass_type.in_([GatePassType.returnable, GatePassType.maintenance]),
            ),
            and_(
                GatePass.status.in_([GatePassStatus.pending, GatePassStatus.approved]),
                or_(GatePass.exit_status.is_(None), GatePass.exit_status != "Verified"),
            ),
        ),
    )
    if host_user and host_user.role == UserRole.host:
        created_pass_ids = select(AuditLog.gate_pass_id).where(
            AuditLog.actor_user_id == host_user.id,
            AuditLog.action == "gate_pass_created",
        )
        overdue_query = overdue_query.where(
            or_(
                GatePass.requester_name == host_user.full_name,
                GatePass.id.in_(created_pass_ids),
            )
        )
    overdue_passes = db.scalars(
        overdue_query.order_by(GatePass.movement_date.asc(), GatePass.id.asc()).limit(10)
    ).all()

    for gp in overdue_passes:
        is_crit = bool(gp.movement_date and gp.movement_date < today)
        time_str = _format_time_ago(datetime.combine(gp.movement_date, time.min)) if gp.movement_date else "Today"
        alert_list.append(
            HostOperationalAlertItemOut(
                id=f"ALT-OVD-{gp.pass_id}",
                title=f"Overdue Gate Pass Schedule: {gp.pass_id}",
                description=f"Asset {gp.asset_or_item} on pass {gp.pass_id} was scheduled for movement by {gp.movement_date.isoformat()}. Pending physical clearance.",
                location=gp.current_location or gp.destination or "Perimeter Checkpoint",
                timeAgo=time_str,
                time_ago=time_str,
                severity="critical" if is_crit else "info",
                icon="warning" if is_crit else "info",
                dotColor="#ba1a1a" if is_crit else "#00687a",
                dot_color="#ba1a1a" if is_crit else "#00687a",
            )
        )

    return alert_list


@router.get("/host", response_model=HostDashboardResponse)
def get_host_dashboard(
    current_user: User = Depends(require_host),
    db: Session = Depends(get_db),
) -> HostDashboardResponse:
    today_start, today_end = get_ist_reporting_day_boundaries()
    today_ist = datetime.now(timezone.utc).astimezone(IST).date()

    created_pass_ids = select(AuditLog.gate_pass_id).where(
        AuditLog.actor_user_id == current_user.id,
        AuditLog.action == "gate_pass_created",
    )
    host_pass_scope = or_(
        GatePass.requester_name == current_user.full_name,
        GatePass.id.in_(created_pass_ids),
    )

    # 1. Active gate passes initiated by this host
    active_passes_count = db.scalar(
        select(func.count(distinct(GatePass.id))).where(
            host_pass_scope,
            GatePass.status == GatePassStatus.active,
        )
    ) or 0

    active_inbound = db.scalar(
        select(func.count(distinct(GatePass.id))).where(
            host_pass_scope,
            GatePass.status == GatePassStatus.active,
            GatePass.pass_type.in_([GatePassType.returnable, GatePassType.maintenance]),
        )
    ) or 0

    active_outbound = max(0, active_passes_count - active_inbound)

    active_kpi = HostKpiActiveGatePasses(
        total=active_passes_count,
        outbound=active_outbound,
        inboundScheduled=active_inbound,
        inbound_scheduled=active_inbound,
        badgeText="Live",
        badge_text="Live",
    )

    # 2. Pending host actions / requests initiated by host
    pending_actions_count = db.scalar(
        select(func.count(distinct(GatePass.id))).where(
            host_pass_scope,
            or_(
                GatePass.status == GatePassStatus.pending,
                and_(
                    GatePass.status == GatePassStatus.active,
                    GatePass.pass_type.in_([GatePassType.returnable, GatePassType.maintenance]),
                    or_(GatePass.entry_status.is_(None), GatePass.entry_status != "Verified"),
                ),
            ),
        )
    ) or 0

    pending_kpi = HostKpiPendingActions(
        total=pending_actions_count,
        subtext="Requests awaiting review or return intake",
        badgeText="Priority",
        badge_text="Priority",
    )

    # 3. Today's movements (evaluated on IST reporting-day boundary)
    todays_movements_count = db.scalar(
        select(func.count(distinct(AssetMovement.id))).where(
            AssetMovement.initiated_at >= today_start,
            AssetMovement.initiated_at < today_end,
        )
    ) or 0

    completed_today = db.scalar(
        select(func.count(distinct(AssetMovement.id))).where(
            AssetMovement.initiated_at >= today_start,
            AssetMovement.initiated_at < today_end,
            AssetMovement.status == AssetMovementStatus.completed,
        )
    ) or 0

    in_transit_today = db.scalar(
        select(func.count(distinct(AssetMovement.id))).where(
            AssetMovement.initiated_at >= today_start,
            AssetMovement.initiated_at < today_end,
            AssetMovement.status.in_([AssetMovementStatus.in_transit, AssetMovementStatus.initiated]),
        )
    ) or 0

    yesterday_start = today_start - timedelta(days=1)
    yesterday_end = today_start
    yesterday_count = db.scalar(
        select(func.count(distinct(AssetMovement.id))).where(
            AssetMovement.initiated_at >= yesterday_start,
            AssetMovement.initiated_at < yesterday_end,
        )
    ) or 0

    if yesterday_count > 0:
        diff = todays_movements_count - yesterday_count
        pct = round((diff / yesterday_count) * 100)
        trend_str = f"+{pct}%" if pct >= 0 else f"{pct}%"
    elif todays_movements_count > 0:
        trend_str = f"+{todays_movements_count * 100}%"
    else:
        trend_str = "+0%"

    movement_kpi = HostKpiMovement(
        total=todays_movements_count,
        completed=completed_today,
        inTransit=in_transit_today,
        in_transit=in_transit_today,
        trend=trend_str,
    )

    # 4. Escalated gate passes initiated by host
    escalated_count = db.scalar(
        select(func.count(distinct(GatePass.id))).where(
            host_pass_scope,
            or_(
                GatePass.status == GatePassStatus.escalated,
                GatePass.escalation_is_escalated.is_(True),
            ),
        )
    ) or 0

    escalated_kpi = HostKpiEscalated(
        total=escalated_count,
        subtext="Security officer review queue",
        badgeText="Review",
        badge_text="Review",
    )

    # Combined KPIs
    kpis = HostDashboardKpis(
        activeGatePasses=active_kpi,
        active_gate_passes=active_kpi,
        pendingHostActions=pending_kpi,
        pending_host_actions=pending_kpi,
        todaysMovement=movement_kpi,
        todays_movement=movement_kpi,
        escalatedGatePasses=escalated_kpi,
        escalated_gate_passes=escalated_kpi,
    )

    # Recent Gate Pass Activity (initiated by this host, up to 10)
    recent_passes = db.scalars(
        select(GatePass)
        .where(host_pass_scope)
        .order_by(GatePass.request_date.desc(), GatePass.created_at.desc(), GatePass.id.desc())
        .limit(10)
    ).all()

    activity_list = [
        HostGatePassActivityItemOut(
            id=gp.pass_id,
            pass_id=gp.pass_id,
            passType=gp.pass_type.value,
            pass_type=gp.pass_type.value,
            assetName=gp.asset_or_item,
            asset_name=gp.asset_or_item,
            serialNumber=gp.asset_or_item,
            serial_number=gp.asset_or_item,
            requesterName=gp.requester_name,
            requester_name=gp.requester_name,
            department=gp.department or "Operations",
            schedule=gp.movement_date.strftime("%d %b %Y") if gp.movement_date else gp.request_date.strftime("%d %b %Y"),
            status=gp.status.value,
            destination=gp.destination,
            gateLocation=gp.current_location or gp.exit_gate or "Main Gate Checkpoint",
            gate_location=gp.current_location or gp.exit_gate or "Main Gate Checkpoint",
        )
        for gp in recent_passes
    ]

    # Live Movement Overview (ordered by initiated_at desc, up to 10)
    recent_movements = db.execute(
        select(AssetMovement, Asset)
        .outerjoin(Asset, AssetMovement.asset_id == Asset.id)
        .order_by(AssetMovement.initiated_at.desc(), AssetMovement.id.desc())
        .limit(10)
    ).all()

    movement_list = []
    for mov, ast in recent_movements:
        if mov.status == AssetMovementStatus.in_transit:
            lbl = "Verified In-Transit"
        elif mov.status == AssetMovementStatus.completed:
            lbl = "Return Check-In"
        else:
            lbl = mov.status.value

        asset_tag = ast.asset_id if ast else f"AST-{mov.asset_id}"
        asset_name = ast.name if ast else "Asset Hardware"
        time_str = _format_time_ago(mov.initiated_at)

        movement_list.append(
            HostMovementScanItemOut(
                id=mov.movement_id,
                movement_id=mov.movement_id,
                status=lbl,
                assetTag=asset_tag,
                asset_tag=asset_tag,
                assetName=asset_name,
                asset_name=asset_name,
                route=f"{mov.from_location} → {mov.to_location}",
                station=f"Station: {mov.from_location}",
                timeAgo=time_str,
                time_ago=time_str,
                initiated_at=mov.initiated_at.isoformat() if mov.initiated_at else None,
            )
        )

    # Pending Host Actions / Requests (ordered by request_date asc)
    pending_pass_rows = db.scalars(
        select(GatePass)
        .where(
            host_pass_scope,
            or_(
                GatePass.status == GatePassStatus.pending,
                and_(
                    GatePass.status == GatePassStatus.active,
                    GatePass.pass_type.in_([GatePassType.returnable, GatePassType.maintenance]),
                    or_(GatePass.entry_status.is_(None), GatePass.entry_status != "Verified"),
                ),
            ),
        )
        .order_by(GatePass.request_date.asc(), GatePass.id.asc())
        .limit(10)
    ).all()

    pending_action_list = []
    for gp in pending_pass_rows:
        is_pending_review = (gp.status == GatePassStatus.pending)
        act_id = f"ACT-{gp.pass_id}"
        if is_pending_review:
            title = f"Gate Pass Request Awaiting Approval — {gp.pass_type.value}"
            act_text = "Action: Pending review and decision by authorized approver"
            act_type = "verify"
            icon = "pending_actions"
            is_primary = True
            btn_text = "Track Request"
            dest = gp.destination
            carrier = f"Requester: {gp.requester_name}"
            instructions = "Your gate pass request has been submitted and is currently in the review queue awaiting authorized approval."
        else:
            title = f"Active Returnable Dispatch — {gp.pass_type.value}"
            act_text = "Action: Return intake confirmation required upon re-entry"
            act_type = "inspect"
            icon = "inventory_2"
            is_primary = False
            btn_text = "View Details"
            dest = gp.current_location or "Hardware Depot"
            carrier = f"Custodian: {gp.requester_name}"
            instructions = "Asset dispatched on returnable gate pass. System-confirmed return required upon re-entry at checkpoint."

        pending_action_list.append(
            HostPendingActionItemOut(
                id=act_id,
                passId=gp.pass_id,
                pass_id=gp.pass_id,
                title=title,
                requester=f"{gp.requester_name} ({gp.department or 'Operations'})",
                actionText=act_text,
                action_text=act_text,
                actionType=act_type,
                action_type=act_type,
                icon=icon,
                isPrimary=is_primary,
                is_primary=is_primary,
                buttonText=btn_text,
                button_text=btn_text,
                assetName=gp.asset_or_item,
                asset_name=gp.asset_or_item,
                serialNumber=gp.asset_or_item,
                serial_number=gp.asset_or_item,
                destination=dest,
                carrier=carrier,
                instructions=instructions,
            )
        )

    # Operational Alerts for this host's passes
    alert_list = _get_host_alerts(db, today_ist, host_user=current_user)

    return HostDashboardResponse(
        kpis=kpis,
        summary=kpis,
        activeGatePasses=active_kpi,
        active_gate_passes=active_kpi,
        pendingHostActions=pending_kpi,
        pending_host_actions=pending_kpi,
        todaysMovement=movement_kpi,
        todays_movement=movement_kpi,
        escalatedGatePasses=escalated_kpi,
        escalated_gate_passes=escalated_kpi,
        gatePassActivity=activity_list,
        gate_pass_activity=activity_list,
        movementOverview=movement_list,
        movement_overview=movement_list,
        pendingActions=pending_action_list,
        pending_actions=pending_action_list,
        operationalAlerts=alert_list,
        operational_alerts=alert_list,
    )


@router.get("/host/movements", response_model=HostMovementListResponse)
def get_host_movements(
    search: str | None = Query(default=None),
    status: str | None = Query(default=None),
    date: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    _user: User = Depends(
        require_roles(
            [UserRole.host, UserRole.guard, UserRole.admin, UserRole.superadmin],
            detail="Host, guard, or admin role required",
        )
    ),
    db: Session = Depends(get_db),
) -> HostMovementListResponse:
    query = (
        select(AssetMovement, Asset)
        .outerjoin(Asset, AssetMovement.asset_id == Asset.id)
    )

    if search:
        pattern = f"%{search.strip()}%"
        query = query.where(
            or_(
                AssetMovement.movement_id.ilike(pattern),
                AssetMovement.from_location.ilike(pattern),
                AssetMovement.to_location.ilike(pattern),
                Asset.name.ilike(pattern),
                Asset.asset_id.ilike(pattern),
            )
        )

    if status:
        st = status.strip().lower()
        if st in ("in-transit", "in transit", "verified in-transit"):
            query = query.where(AssetMovement.status == AssetMovementStatus.in_transit)
        elif st in ("completed", "return check-in", "gate clearance"):
            query = query.where(AssetMovement.status == AssetMovementStatus.completed)
        elif st in ("initiated",):
            query = query.where(AssetMovement.status == AssetMovementStatus.initiated)
        elif st in ("cancelled",):
            query = query.where(AssetMovement.status == AssetMovementStatus.cancelled)

    if date:
        try:
            parsed_d = datetime.strptime(date.strip(), "%Y-%m-%d").date()
            start_ist = datetime.combine(parsed_d, time.min, tzinfo=IST)
            end_ist = start_ist + timedelta(days=1)
            d_start = start_ist.astimezone(timezone.utc)
            d_end = end_ist.astimezone(timezone.utc)
            query = query.where(
                AssetMovement.initiated_at >= d_start,
                AssetMovement.initiated_at < d_end,
            )
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Invalid date filter, expected YYYY-MM-DD",
            ) from exc

    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = db.execute(
        query.order_by(AssetMovement.initiated_at.desc(), AssetMovement.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()

    items = []
    for mov, ast in rows:
        if mov.status == AssetMovementStatus.in_transit:
            lbl = "Verified In-Transit"
        elif mov.status == AssetMovementStatus.completed:
            lbl = "Return Check-In"
        else:
            lbl = mov.status.value

        asset_tag = ast.asset_id if ast else f"AST-{mov.asset_id}"
        asset_name = ast.name if ast else "Asset Hardware"
        time_str = _format_time_ago(mov.initiated_at)

        items.append(
            HostMovementScanItemOut(
                id=mov.movement_id,
                movement_id=mov.movement_id,
                status=lbl,
                assetTag=asset_tag,
                asset_tag=asset_tag,
                assetName=asset_name,
                asset_name=asset_name,
                route=f"{mov.from_location} → {mov.to_location}",
                station=f"Station: {mov.from_location}",
                timeAgo=time_str,
                time_ago=time_str,
                initiated_at=mov.initiated_at.isoformat() if mov.initiated_at else None,
            )
        )

    total_pages = max(1, (total + page_size - 1) // page_size) if total > 0 else 1
    return HostMovementListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/host/alerts", response_model=HostAlertListResponse)
def get_host_alerts(
    _user: User = Depends(
        require_roles(
            [UserRole.host, UserRole.guard, UserRole.admin, UserRole.superadmin],
            detail="Host, guard, or admin role required",
        )
    ),
    db: Session = Depends(get_db),
) -> HostAlertListResponse:
    today_ist = datetime.now(timezone.utc).astimezone(IST).date()
    alert_list = _get_host_alerts(db, today_ist, host_user=_user)
    return HostAlertListResponse(items=alert_list, total=len(alert_list))


@router.get("/guard", response_model=GuardDashboardResponse)
def get_guard_dashboard(
    _user: User = Depends(require_guard_or_admin),
    db: Session = Depends(get_db),
) -> GuardDashboardResponse:
    today_start, today_end = get_ist_reporting_day_boundaries()
    today_ist = datetime.now(timezone.utc).astimezone(IST).date()

    # 1. Expected Inbound (Active Returnable passes that have exited and are awaiting inbound return)
    inbound_count = (
        db.scalar(
            select(func.count(distinct(GatePass.id))).where(
                GatePass.pass_type == GatePassType.returnable,
                GatePass.status == GatePassStatus.active,
                GatePass.exit_timestamp.isnot(None),
                GatePass.entry_timestamp.is_(None),
            )
        )
        or 0
    )
    kpi_inbound = GuardDashboardKpiItem(
        total=inbound_count,
        badgeText=f"{inbound_count} awaiting return" if inbound_count > 0 else "0 awaiting return",
        badge_text=f"{inbound_count} awaiting return" if inbound_count > 0 else "0 awaiting return",
        subtext="Active returnable dispatches awaiting return",
    )

    # 2. Expected Outbound (Approved passes authorized for exit clearance awaiting exit)
    outbound_count = (
        db.scalar(
            select(func.count(distinct(GatePass.id))).where(
                GatePass.status == GatePassStatus.approved,
                GatePass.exit_timestamp.is_(None),
            )
        )
        or 0
    )
    kpi_outbound = GuardDashboardKpiItem(
        total=outbound_count,
        badgeText=f"{outbound_count} pending clearance" if outbound_count > 0 else "0 pending clearance",
        badge_text=f"{outbound_count} pending clearance" if outbound_count > 0 else "0 pending clearance",
        subtext="Authorized dispatches awaiting exit",
    )

    # 3. Pending Gate Verification (Strictly actionable passes requiring Guard verification:
    #    Approved passes awaiting exit verification + Active returnable passes awaiting entry verification.
    #    Escalated passes are excluded because they require administrative exception handling, not gate clearance.)
    pending_count = (
        db.scalar(
            select(func.count(distinct(GatePass.id))).where(
                or_(
                    and_(
                        GatePass.status == GatePassStatus.approved,
                        GatePass.exit_timestamp.is_(None),
                    ),
                    and_(
                        GatePass.status == GatePassStatus.active,
                        GatePass.pass_type == GatePassType.returnable,
                        GatePass.exit_timestamp.isnot(None),
                        GatePass.entry_timestamp.is_(None),
                    ),
                )
            )
        )
        or 0
    )
    kpi_pending = GuardDashboardKpiItem(
        total=pending_count,
        badgeText="Priority Action" if pending_count > 0 else "Queue Clear",
        badge_text="Priority Action" if pending_count > 0 else "Queue Clear",
        subtext="Actionable exit & return queue",
    )

    # 4. Today's Completed Entries (Strictly counting qualifying inbound entry verifications
    #    completed within today's IST reporting day boundary)
    completed_entries_count = (
        db.scalar(
            select(func.count(distinct(GatePass.id))).where(
                GatePass.entry_status == "Verified",
                GatePass.entry_timestamp >= today_start,
                GatePass.entry_timestamp < today_end,
            )
        )
        or 0
    )
    kpi_completed = GuardDashboardKpiItem(
        total=completed_entries_count,
        badgeText=f"{completed_entries_count} Verified" if completed_entries_count > 0 else "Verified Today",
        badge_text=f"{completed_entries_count} Verified" if completed_entries_count > 0 else "Verified Today",
        subtext="Verified inbound returns today",
    )

    kpis = GuardDashboardKpis(
        expectedInbound=kpi_inbound,
        expected_inbound=kpi_inbound,
        expectedOutbound=kpi_outbound,
        expected_outbound=kpi_outbound,
        pendingVerification=kpi_pending,
        pending_verification=kpi_pending,
        todaysCompletedEntries=kpi_completed,
        todays_completed_entries=kpi_completed,
    )

    # 5. Gate Verification Queue
    queue_passes = db.scalars(
        select(GatePass)
        .where(GatePass.status.in_([GatePassStatus.approved, GatePassStatus.active, GatePassStatus.escalated]))
        .order_by(GatePass.request_date.desc(), GatePass.id.desc())
        .limit(50)
    ).all()

    verification_queue: list[GuardVerificationQueueItemOut] = []
    for gp in queue_passes:
        if gp.status == GatePassStatus.approved:
            type_str = "Outbound"
        elif gp.status == GatePassStatus.active:
            if gp.pass_type in [GatePassType.returnable, GatePassType.maintenance]:
                type_str = "Inbound Return"
            else:
                type_str = "In Transit"
        elif gp.status == GatePassStatus.escalated:
            type_str = "Outbound" if gp.exit_timestamp is None else "Inbound Return"
        else:
            type_str = "Outbound"

        if gp.status == GatePassStatus.escalated or gp.escalation_is_escalated:
            status_str = "Flagged"
            action_str = "flagged"
        elif gp.status == GatePassStatus.approved:
            status_str = "Awaiting Exit"
            action_str = "verify"
        elif gp.status == GatePassStatus.active:
            if gp.pass_type == GatePassType.returnable and gp.entry_timestamp is None:
                status_str = "Awaiting Entry"
                action_str = "verify"
            else:
                status_str = "In Transit"
                action_str = "verify"
        else:
            status_str = "Cleared"
            action_str = "cleared"

        # Unambiguous exact match against authoritative stored unique keys (asset_id or qr_code_value)
        item_ref = (gp.asset_or_item or "").strip()
        asset_rec = None
        if item_ref:
            asset_rec = db.scalar(
                select(Asset).where(
                    or_(
                        Asset.asset_id == item_ref,
                        Asset.qr_code_value == item_ref,
                    )
                )
            )
            if asset_rec is None:
                exact_sn_matches = db.scalars(
                    select(Asset).where(Asset.serial_number == item_ref).limit(2)
                ).all()
                if len(exact_sn_matches) == 1:
                    asset_rec = exact_sn_matches[0]

        serial_no = (asset_rec.serial_number if asset_rec and asset_rec.serial_number else None) or "Unavailable"

        verification_queue.append(
            GuardVerificationQueueItemOut(
                id=gp.pass_id,
                requesterName=gp.requester_name,
                requester_name=gp.requester_name,
                requesterBadge=gp.department or "Staff",
                requester_badge=gp.department or "Staff",
                department=gp.department or "Administration",
                assetName=gp.asset_or_item,
                asset_name=gp.asset_or_item,
                serialNumber=serial_no,
                serial_number=serial_no,
                type=type_str,
                status=status_str,
                action=action_str,
                carrier=gp.destination or gp.current_location,
                destination=gp.destination,
                origin=gp.current_location,
                flagReason=gp.escalation_reason,
                flag_reason=gp.escalation_reason,
            )
        )

    # 6. Recent Gate Activity (From GatePassHistory)
    recent_history_rows = db.execute(
        select(GatePassHistory, GatePass)
        .join(GatePass, GatePassHistory.pass_id == GatePass.pass_id)
        .where(
            GatePassHistory.action.in_([
                "Exit Verification",
                "Entry Verification",
                "Escalated",
                "Decision Updated",
                "Gate Pass Created",
            ])
        )
        .order_by(GatePassHistory.timestamp.desc(), GatePassHistory.id.desc())
        .limit(10)
    ).all()

    recent_activity: list[GuardRecentActivityItemOut] = []
    for h, gp in recent_history_rows:
        if h.action == "Exit Verification":
            title = "Record Exit / Cleared"
            b_text = "Barrier Cleared"
            act_type = "exit"
            is_flg = False
        elif h.action == "Entry Verification":
            title = "Record Entry / Cleared"
            b_text = "Barrier Cleared"
            act_type = "entry"
            is_flg = False
        elif h.action == "Escalated":
            title = "Discrepancy Flagged"
            b_text = "Discrepancy"
            act_type = "flagged"
            is_flg = True
        else:
            title = h.action
            b_text = "Logged Entry"
            act_type = "entry"
            is_flg = False

        recent_activity.append(
            GuardRecentActivityItemOut(
                id=h.history_id,
                title=title,
                time=_format_time_ago(h.timestamp),
                passId=gp.pass_id,
                pass_id=gp.pass_id,
                plateOrBadge=h.performed_by or "Officer on Duty",
                plate_or_badge=h.performed_by or "Officer on Duty",
                assetName=gp.asset_or_item,
                asset_name=gp.asset_or_item,
                notes=h.note or "Checkpoint observation recorded.",
                badgeText=b_text,
                badge_text=b_text,
                isFlagged=is_flg,
                is_flagged=is_flg,
                type=act_type,
            )
        )

    # 7. Upcoming Movements (Movements scheduled for today that have not yet been completed.
    #    Excludes completed passes and passes whose outbound movement already finished.
    #    Uses scheduled movement_date, falling back to request_date only if movement_date is not set.
    #    Date-level precision only: backend stores Date without hours/minutes.)
    scheduled_date_col = func.coalesce(GatePass.movement_date, GatePass.request_date)
    upcoming_passes = db.scalars(
        select(GatePass)
        .where(
            scheduled_date_col == today_ist,
            GatePass.status.in_([GatePassStatus.pending, GatePassStatus.approved, GatePassStatus.active]),
            or_(
                # Approved pass awaiting exit
                and_(
                    GatePass.status == GatePassStatus.approved,
                    GatePass.exit_timestamp.is_(None),
                ),
                # Active returnable pass awaiting return
                and_(
                    GatePass.status == GatePassStatus.active,
                    GatePass.pass_type == GatePassType.returnable,
                    GatePass.entry_timestamp.is_(None),
                ),
                # Pending pass awaiting approval
                GatePass.status == GatePassStatus.pending,
            ),
        )
        .order_by(GatePass.id.asc())
        .limit(10)
    ).all()

    upcoming_movements: list[GuardUpcomingMovementItemOut] = []
    for gp in upcoming_passes:
        upcoming_movements.append(
            GuardUpcomingMovementItemOut(
                id=gp.pass_id,
                time="Today",
                title=gp.asset_or_item,
                type="Outbound" if gp.status != GatePassStatus.active else "Inbound",
                personLabel="Requester",
                person_label="Requester",
                personName=gp.requester_name,
                person_name=gp.requester_name,
                details=f"{gp.pass_type.value} • Dest: {gp.destination}",
                statusBadge=gp.status.value,
                status_badge=gp.status.value,
            )
        )

    # 8. Checkpoint Alerts (Recorded escalations requiring administrative exception resolution)
    escalated_passes = db.scalars(
        select(GatePass)
        .where(
            or_(
                GatePass.status == GatePassStatus.escalated,
                GatePass.escalation_is_escalated.is_(True),
            )
        )
        .order_by(GatePass.escalation_timestamp.desc().nullslast(), GatePass.id.desc())
        .limit(10)
    ).all()

    checkpoint_alerts: list[GuardCheckpointAlertItemOut] = []
    for gp in escalated_passes:
        checkpoint_alerts.append(
            GuardCheckpointAlertItemOut(
                id=f"ALT-ESC-{gp.pass_id}",
                title=f"Recorded Escalation: {gp.pass_id}",
                severity="critical",
                badgeText="Unresolved",
                badge_text="Unresolved",
                icon="gpp_maybe",
                description=gp.escalation_reason or f"Discrepancy recorded for {gp.pass_id} ({gp.asset_or_item}). Clearance on hold.",
                passId=gp.pass_id,
                pass_id=gp.pass_id,
                serialNumber=gp.asset_or_item,
                serial_number=gp.asset_or_item,
                acknowledged=False,
            )
        )

    return GuardDashboardResponse(
        kpis=kpis,
        verificationQueue=verification_queue,
        verification_queue=verification_queue,
        recentActivity=recent_activity,
        recent_activity=recent_activity,
        upcomingMovements=upcoming_movements,
        upcoming_movements=upcoming_movements,
        checkpointAlerts=checkpoint_alerts,
        checkpoint_alerts=checkpoint_alerts,
    )


