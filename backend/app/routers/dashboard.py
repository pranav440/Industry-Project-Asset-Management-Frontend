from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_admin
from app.models import Asset, AssetStatus, Consumable, Request, RequestHistory, RequestStatus, User

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


@router.get("/admin")
def get_admin_dashboard(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
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
    for request in db.scalars(
        select(Request)
        .where(Request.requester_name == current_user.full_name)
        .order_by(Request.request_date.desc(), Request.id.desc())
    ).all():
        history_dates = _history_by_stage(db, request.request_id)
        my_requests.append({
            "request_id": request.request_id,
            "requested_item": request.requested_item,
            "status": request.status.value,
            "request_date": request.request_date.isoformat(),
            "approval_date": history_dates.get("approval_date").isoformat() if history_dates.get("approval_date") else None,
            "fulfillment_date": history_dates.get("fulfillment_date").isoformat() if history_dates.get("fulfillment_date") else None,
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
