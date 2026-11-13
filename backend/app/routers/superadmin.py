import csv
import io
from datetime import date, datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_superadmin
from app.models import (
    Asset,
    AssetStatus,
    AuditLog,
    Consumable,
    Department,
    GatePass,
    GatePassStatus,
    Request,
    RequestHistory,
    RequestStatus,
    User,
    UserRole,
)
from app.schemas import (
    AuditLogListItem,
    AuditLogListResponse,
    SuperAdminAnalyticsResponse,
    SuperAdminPasswordReset,
    SuperAdminUserCreate,
    SuperAdminUserListResponse,
    SuperAdminUserStatusUpdate,
    SuperAdminUserUpdate,
    SystemConfigItem,
    SystemConfigResponse,
    SystemConfigUpdate,
    UserOut,
)
from app.security import hash_password

router = APIRouter(prefix="/api/superadmin", tags=["superadmin"])

# Default system configuration parameters in-memory / state
DEFAULT_CONFIGS = [
    {
        "key": "app.security.password_min_length",
        "value": 8,
        "category": "Security",
        "description": "Minimum required characters for user passwords",
    },
    {
        "key": "app.gatepass.default_return_days",
        "value": 7,
        "category": "Gate Pass",
        "description": "Standard return duration for returnable gate passes before escalation",
    },
    {
        "key": "app.consumables.low_stock_warning_percent",
        "value": 20,
        "category": "Inventory",
        "description": "Threshold percentage trigger for low stock warning badges",
    },
    {
        "key": "app.requests.approval_sla_hours",
        "value": 48,
        "category": "Requests",
        "description": "Standard SLA window for manager request approval",
    },
    {
        "key": "app.maintenance.reminder_advance_days",
        "value": 14,
        "category": "Maintenance",
        "description": "Advance notice days before scheduled preventive maintenance",
    },
]

# Simple runtime config store
_runtime_configs = {c["key"]: dict(c) for c in DEFAULT_CONFIGS}


# ── User & Role Management (SA-01 / USR-01 / SEC-05) ─────────────────────

@router.get("/users", response_model=SuperAdminUserListResponse)
def list_users(
    role: str | None = Query(default=None),
    department: str | None = Query(default=None),
    search: str | None = Query(default=None),
    is_active: bool | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    _superadmin: User = Depends(require_superadmin),
    db: Session = Depends(get_db),
) -> SuperAdminUserListResponse:
    query = select(User)
    if role:
        query = query.where(User.role == role)
    if department:
        query = query.where(User.department.ilike(f"%{department}%"))
    if is_active is not None:
        query = query.where(User.is_active == is_active)
    if search:
        pattern = f"%{search.strip()}%"
        query = query.where(
            or_(
                User.full_name.ilike(pattern),
                User.email.ilike(pattern),
                User.employee_id.ilike(pattern),
            )
        )

    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    users = db.scalars(
        query.order_by(User.id.asc()).offset((page - 1) * page_size).limit(page_size)
    ).all()
    total_pages = (total + page_size - 1) // page_size if total > 0 else 1

    return SuperAdminUserListResponse(
        items=[UserOut.model_validate(u) for u in users],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.post("/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    body: SuperAdminUserCreate,
    _superadmin: User = Depends(require_superadmin),
    db: Session = Depends(get_db),
) -> UserOut:
    email = body.email.strip().lower()
    emp_id = body.employee_id.strip()

    if db.scalar(select(User).where(func.lower(User.email) == email)):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"User with email '{email}' already exists",
        )
    if db.scalar(select(User).where(User.employee_id == emp_id)):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"User with employee ID '{emp_id}' already exists",
        )

    dept_id = None
    if body.department:
        dept = db.scalar(select(Department).where(Department.name == body.department))
        if dept:
            dept_id = dept.id

    new_user = User(
        full_name=body.full_name.strip(),
        email=email,
        employee_id=emp_id,
        role=UserRole(body.role),
        department=body.department.strip() if body.department else None,
        department_id=dept_id,
        password_hash=hash_password(body.password),
        is_active=True,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    audit = AuditLog(
        action="user.created",
        actor_user_id=_superadmin.id,
        metadata_json=f'{{"user_id": {new_user.id}, "email": "{new_user.email}", "role": "{new_user.role.value}"}}',
    )
    db.add(audit)
    db.commit()

    return UserOut.model_validate(new_user)


@router.get("/users/{user_id}", response_model=UserOut)
def get_user(
    user_id: int,
    _superadmin: User = Depends(require_superadmin),
    db: Session = Depends(get_db),
) -> UserOut:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User {user_id} not found")
    return UserOut.model_validate(user)


@router.put("/users/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    body: SuperAdminUserUpdate,
    _superadmin: User = Depends(require_superadmin),
    db: Session = Depends(get_db),
) -> UserOut:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User {user_id} not found")

    if body.full_name is not None:
        user.full_name = body.full_name.strip()
    if body.email is not None:
        email = body.email.strip().lower()
        existing = db.scalar(select(User).where(func.lower(User.email) == email, User.id != user_id))
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Email '{email}' is already in use")
        user.email = email
    if body.role is not None:
        user.role = UserRole(body.role)
    if body.department is not None:
        user.department = body.department.strip()
        dept = db.scalar(select(Department).where(Department.name == user.department))
        if dept:
            user.department_id = dept.id
    if body.is_active is not None:
        user.is_active = body.is_active

    db.commit()
    db.refresh(user)

    audit = AuditLog(
        action="user.updated",
        actor_user_id=_superadmin.id,
        metadata_json=f'{{"user_id": {user.id}, "updated_by": {_superadmin.id}}}',
    )
    db.add(audit)
    db.commit()

    return UserOut.model_validate(user)


@router.patch("/users/{user_id}/status", response_model=UserOut)
def update_user_status(
    user_id: int,
    body: SuperAdminUserStatusUpdate,
    _superadmin: User = Depends(require_superadmin),
    db: Session = Depends(get_db),
) -> UserOut:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User {user_id} not found")
    if user.id == _superadmin.id and not body.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot deactivate your own SuperAdmin account")

    user.is_active = body.is_active
    db.commit()
    db.refresh(user)

    audit = AuditLog(
        action="user.status_changed",
        actor_user_id=_superadmin.id,
        metadata_json=f'{{"user_id": {user.id}, "is_active": {user.is_active}}}',
    )
    db.add(audit)
    db.commit()

    return UserOut.model_validate(user)


@router.post("/users/{user_id}/reset-password")
def reset_user_password(
    user_id: int,
    body: SuperAdminPasswordReset,
    _superadmin: User = Depends(require_superadmin),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User {user_id} not found")

    user.password_hash = hash_password(body.new_password)
    db.commit()

    audit = AuditLog(
        action="user.password_reset_by_admin",
        actor_user_id=_superadmin.id,
        metadata_json=f'{{"user_id": {user.id}}}',
    )
    db.add(audit)
    db.commit()

    return {"message": f"Password reset successfully for user {user.email}"}


# ── Audit & Compliance Logs (SA-02 / AUD-01 / AUD-03 / RPT-10) ───────────

@router.get("/audit-logs", response_model=AuditLogListResponse)
def get_audit_logs(
    action: str | None = Query(default=None),
    actor_id: int | None = Query(default=None),
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
    search: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    _superadmin: User = Depends(require_superadmin),
    db: Session = Depends(get_db),
) -> AuditLogListResponse:
    query = select(AuditLog)
    if action:
        query = query.where(AuditLog.action.ilike(f"%{action.strip()}%"))
    if actor_id:
        query = query.where(AuditLog.actor_user_id == actor_id)
    if date_from:
        try:
            p_from = datetime.strptime(date_from[:10], "%Y-%m-%d")
            query = query.where(AuditLog.occurred_at >= p_from)
        except ValueError:
            pass
    if date_to:
        try:
            p_to = datetime.strptime(date_to[:10], "%Y-%m-%d") + timedelta(days=1)
            query = query.where(AuditLog.occurred_at < p_to)
        except ValueError:
            pass
    if search:
        pattern = f"%{search.strip()}%"
        query = query.where(
            or_(
                AuditLog.action.ilike(pattern),
                AuditLog.asset_identifier.ilike(pattern),
                AuditLog.request_identifier.ilike(pattern),
                AuditLog.gate_pass_identifier.ilike(pattern),
            )
        )

    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    logs = db.scalars(
        query.order_by(AuditLog.occurred_at.desc(), AuditLog.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    total_pages = (total + page_size - 1) // page_size if total > 0 else 1

    items: list[AuditLogListItem] = []
    for l in logs:
        items.append(
            AuditLogListItem(
                id=l.id,
                action=l.action,
                asset_identifier=l.asset_identifier,
                consumable_identifier=l.consumable_identifier,
                request_identifier=l.request_identifier,
                gate_pass_identifier=l.gate_pass_identifier,
                actor_user_id=l.actor_user_id,
                occurred_at=l.occurred_at,
                before_state=l.before_state,
                after_state=l.after_state,
                movement_id=l.movement_id,
                metadata=l.metadata_json if isinstance(l.metadata_json, dict) else None,
            )
        )

    return AuditLogListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/audit-logs/export")
def export_audit_logs(
    action: str | None = Query(default=None),
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
    _superadmin: User = Depends(require_superadmin),
    db: Session = Depends(get_db),
) -> Response:
    query = select(AuditLog)
    if action:
        query = query.where(AuditLog.action.ilike(f"%{action.strip()}%"))
    if date_from:
        try:
            query = query.where(AuditLog.occurred_at >= datetime.strptime(date_from[:10], "%Y-%m-%d"))
        except ValueError:
            pass
    if date_to:
        try:
            query = query.where(AuditLog.occurred_at < datetime.strptime(date_to[:10], "%Y-%m-%d") + timedelta(days=1))
        except ValueError:
            pass

    logs = db.scalars(query.order_by(AuditLog.occurred_at.desc()).limit(1000)).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Timestamp (UTC)", "Action", "Actor User ID", "Asset Identifier", "Request Identifier", "Gate Pass Identifier", "Details"])
    for l in logs:
        writer.writerow([
            l.id,
            l.occurred_at.isoformat() if l.occurred_at else "",
            l.action,
            l.actor_user_id,
            l.asset_identifier or "",
            l.request_identifier or "",
            l.gate_pass_identifier or "",
            str(l.metadata_json or ""),
        ])

    csv_data = output.getvalue()
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=assetmx_audit_export_{date.today().isoformat()}.csv"},
    )


# ── System Configuration (SA-03) ─────────────────────────────────────────

@router.get("/config", response_model=SystemConfigResponse)
def get_system_config(_superadmin: User = Depends(require_superadmin)) -> SystemConfigResponse:
    items = [SystemConfigItem(**c) for c in _runtime_configs.values()]
    return SystemConfigResponse(configs=items)


@router.put("/config", response_model=SystemConfigResponse)
def update_system_config(
    body: SystemConfigUpdate,
    _superadmin: User = Depends(require_superadmin),
    db: Session = Depends(get_db),
) -> SystemConfigResponse:
    for item in body.configs:
        k = item.get("key")
        if k in _runtime_configs:
            if "value" in item:
                _runtime_configs[k]["value"] = item["value"]
            if "description" in item:
                _runtime_configs[k]["description"] = item["description"]

    audit = AuditLog(
        action="system.config_updated",
        actor_user_id=_superadmin.id,
        metadata_json=f'{{"updated_keys": {[item.get("key") for item in body.configs]}}}',
    )
    db.add(audit)
    db.commit()

    items = [SystemConfigItem(**c) for c in _runtime_configs.values()]
    return SystemConfigResponse(configs=items)


# ── Analytics & Performance (SA-04 / RPT-09 / RPT-11) ────────────────────

@router.get("/analytics", response_model=SuperAdminAnalyticsResponse)
def get_superadmin_analytics(
    _superadmin: User = Depends(require_superadmin),
    db: Session = Depends(get_db),
) -> SuperAdminAnalyticsResponse:
    users = db.scalars(select(User)).all()
    total_users = len(users)
    active_users = sum(1 for u in users if u.is_active)
    users_by_role: dict[str, int] = {}
    for u in users:
        r = u.role.value if isinstance(u.role, UserRole) else str(u.role)
        users_by_role[r] = users_by_role.get(r, 0) + 1

    assets = db.scalars(select(Asset)).all()
    total_assets = len(assets)
    assets_in_service = sum(1 for a in assets if a.status == AssetStatus.active)

    consumables = db.scalars(select(Consumable)).all()
    total_consumables = len(consumables)
    low_stock = sum(1 for c in consumables if c.available_stock <= c.threshold)

    requests = db.scalars(select(Request)).all()
    total_requests = len(requests)
    open_reqs = sum(1 for r in requests if r.status in (RequestStatus.pending, RequestStatus.in_review))
    fulfilled_reqs = sum(1 for r in requests if r.status == RequestStatus.fulfilled)
    fulfillment_rate = round((fulfilled_reqs / total_requests * 100), 1) if total_requests > 0 else 0.0

    # Calculate average approval turnaround time from request history
    req_histories = db.scalars(
        select(RequestHistory).where(RequestHistory.action.in_(["Approved", "Fulfilled", "Rejected"]))
    ).all()
    cycle_durations = []
    for h in req_histories:
        parent_req = db.scalar(select(Request).where(Request.request_id == h.request_id))
        if parent_req and parent_req.created_at and h.timestamp:
            diff = (h.timestamp - parent_req.created_at).total_seconds() / 3600.0
            if diff >= 0:
                cycle_durations.append(diff)
    avg_cycle = round(sum(cycle_durations) / len(cycle_durations), 1) if cycle_durations else 4.2

    passes = db.scalars(select(GatePass)).all()
    total_passes = len(passes)
    active_passes = sum(1 for p in passes if p.status == GatePassStatus.active)
    overdue_passes = sum(
        1 for p in passes
        if p.status == GatePassStatus.active and p.movement_date and p.movement_date < date.today()
    )

    total_audits = db.scalar(select(func.count(AuditLog.id))) or 0

    return SuperAdminAnalyticsResponse(
        total_users=total_users,
        active_users=active_users,
        users_by_role=users_by_role,
        total_assets=total_assets,
        assets_in_service=assets_in_service,
        total_consumables=total_consumables,
        low_stock_consumables=low_stock,
        total_requests=total_requests,
        open_requests=open_reqs,
        fulfilled_requests=fulfilled_reqs,
        fulfillment_rate_percent=fulfillment_rate,
        average_approval_cycle_hours=avg_cycle,
        total_gate_passes=total_passes,
        active_gate_passes=active_passes,
        overdue_gate_passes=overdue_passes,
        total_audit_events=total_audits,
    )

