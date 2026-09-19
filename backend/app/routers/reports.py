from __future__ import annotations

from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_admin
from app.models import (
    Asset,
    AssetMovement,
    AssetStatus,
    Maintenance,
    Request,
    RequestHistory,
    RequestStatus,
    User,
)

router = APIRouter(prefix="/api/reports", tags=["reports"])


def _parse_iso_date(value: str | None, *, field_name: str) -> date | None:
    if value is None or value == "":
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid {field_name} filter",
        ) from exc


def _as_float(value):
    if value is None:
        return 0.0
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _normalize_none(value):
    return value if value not in (None, "") else None


@router.get("/admin")
def get_admin_reports(
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
    location: str | None = Query(default=None),
    category: str | None = Query(default=None),
    department: str | None = Query(default=None),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    _ = current_user
    parsed_date_from = _parse_iso_date(date_from, field_name="date_from")
    parsed_date_to = _parse_iso_date(date_to, field_name="date_to")

    if parsed_date_from and parsed_date_to and parsed_date_from > parsed_date_to:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="date_from cannot be after date_to",
        )

    asset_query = select(Asset)
    if location:
        asset_query = asset_query.where(Asset.location == location)
    if category:
        asset_query = asset_query.where(Asset.category == category)

    assets = db.scalars(asset_query.order_by(Asset.created_at.desc(), Asset.id.desc())).all()
    filtered_assets = list(assets)

    total_assets = len(filtered_assets)
    active_asset_status = AssetStatus.active.value
    assets_in_use = sum(1 for asset in filtered_assets if asset.status.value == active_asset_status)

    request_query = select(Request)
    if department:
        request_query = request_query.where(Request.department == department)
    if category:
        request_query = request_query.where(Request.category == category)
    if parsed_date_from:
        request_query = request_query.where(Request.request_date >= parsed_date_from)
    if parsed_date_to:
        request_query = request_query.where(Request.request_date <= parsed_date_to)

    requests = db.scalars(request_query.order_by(Request.request_date.desc(), Request.id.desc())).all()
    total_requests = len(requests)
    open_requests = sum(
        1 for request in requests if request.status in (RequestStatus.pending, RequestStatus.in_review)
    )
    request_status_counts = {status.value: 0 for status in RequestStatus}
    for request in requests:
        request_status_counts[request.status.value] = request_status_counts.get(request.status.value, 0) + 1

    department_counts = {}
    for request in requests:
        department_counts[request.department] = department_counts.get(request.department, 0) + 1

    request_type_counts = {}
    for request in requests:
        request_type_counts[request.request_type.value] = request_type_counts.get(request.request_type.value, 0) + 1

    priority_counts = {}
    for request in requests:
        priority_counts[request.priority.value] = priority_counts.get(request.priority.value, 0) + 1

    asset_movement_query = select(AssetMovement)
    if location:
        asset_movement_query = asset_movement_query.where(
            (AssetMovement.from_location == location) | (AssetMovement.to_location == location)
        )
    if parsed_date_from:
        asset_movement_query = asset_movement_query.where(AssetMovement.initiated_at >= datetime.combine(parsed_date_from, datetime.min.time()))
    if parsed_date_to:
        asset_movement_query = asset_movement_query.where(AssetMovement.initiated_at <= datetime.combine(parsed_date_to, datetime.max.time()))

    movements = db.scalars(asset_movement_query.order_by(AssetMovement.initiated_at.asc(), AssetMovement.id.asc())).all()
    movement_records = []
    for movement in movements:
        asset = db.get(Asset, movement.asset_id)
        if asset is None:
            continue
        if category and asset.category != category:
            continue
        if location and asset.location != location and movement.from_location != location and movement.to_location != location:
            continue
        movement_records.append({
            "movement_id": movement.movement_id,
            "asset_id": asset.asset_id,
            "asset_name": asset.name,
            "category": asset.category,
            "from_location": movement.from_location,
            "to_location": movement.to_location,
            "from_custodian": movement.from_custodian,
            "to_custodian": movement.to_custodian,
            "reason": movement.reason,
            "status": movement.status.value,
            "initiated_at": movement.initiated_at.isoformat() if movement.initiated_at else None,
            "completed_at": movement.completed_at.isoformat() if movement.completed_at else None,
        })

    maintenance_query = select(Maintenance)
    if parsed_date_from:
        maintenance_query = maintenance_query.where(Maintenance.service_date >= datetime.combine(parsed_date_from, datetime.min.time()))
    if parsed_date_to:
        maintenance_query = maintenance_query.where(Maintenance.service_date <= datetime.combine(parsed_date_to, datetime.max.time()))

    maintenance_records = db.scalars(maintenance_query.order_by(Maintenance.service_date.asc(), Maintenance.id.asc())).all()
    maintenance_cost = sum(_as_float(record.maintenance_cost) for record in maintenance_records)
    maintenance_asset_ids = {record.asset_id for record in maintenance_records}
    maintenance_asset_value = 0.0
    for asset_id in maintenance_asset_ids:
        asset = db.get(Asset, asset_id)
        if asset is not None:
            maintenance_asset_value += _as_float(asset.total_cost)

    total_asset_value = sum(_as_float(asset.total_cost) for asset in filtered_assets)

    lifecycle_status_counts = {status.value: 0 for status in AssetStatus}
    if filtered_assets:
        for asset in filtered_assets:
            lifecycle_status_counts[asset.status.value] = lifecycle_status_counts.get(asset.status.value, 0) + 1
    lifecycle_forecast = None

    history_by_request = {}
    for request in requests:
        history_rows = db.scalars(
            select(RequestHistory)
            .where(RequestHistory.request_id == request.request_id)
            .order_by(RequestHistory.timestamp.asc(), RequestHistory.id.asc())
        ).all()
        history_by_request[request.request_id] = [
            {"history_id": row.history_id, "timestamp": row.timestamp.isoformat(), "stage": row.stage, "action": row.action}
            for row in history_rows
        ]

    return {
        "overview": {
            "total_assets": total_assets,
            "assets_in_use": assets_in_use,
            "open_requests": open_requests,
            "maintenance_cost": float(round(maintenance_cost, 2)),
        },
        "asset_utilization": {
            "total_assets": total_assets,
            "status_counts": {
                status.value: sum(1 for asset in filtered_assets if asset.status.value == status.value)
                for status in AssetStatus
            },
            "by_category": {
                category_name: sum(1 for asset in filtered_assets if asset.category == category_name)
                for category_name in sorted({asset.category for asset in filtered_assets})
            },
            "by_location": {
                location_name: sum(1 for asset in filtered_assets if asset.location == location_name)
                for location_name in sorted({asset.location for asset in filtered_assets})
            },
            "utilization_rate": (
                round((assets_in_use / total_assets) * 100, 2) if total_assets else 0.0
            ),
        },
        "requests": {
            "total_requests": total_requests,
            "status_counts": request_status_counts,
            "department_counts": department_counts,
            "request_type_counts": request_type_counts,
            "priority_counts": priority_counts,
            "history": history_by_request,
        },
        "reassignment": {
            "total_movements": len(movement_records),
            "records": movement_records,
            "by_location": {
                key: len([record for record in movement_records if record["from_location"] == key or record["to_location"] == key])
                for key in sorted({record["from_location"] for record in movement_records} | {record["to_location"] for record in movement_records})
            },
        },
        "maintenance_vs_asset_value": {
            "total_maintenance_cost": float(round(maintenance_cost, 2)),
            "total_asset_value": float(round(total_asset_value, 2)),
            "maintenance_by_asset": {
                db.get(Asset, record.asset_id).asset_id if db.get(Asset, record.asset_id) else str(record.asset_id): _as_float(record.maintenance_cost)
                for record in maintenance_records
            },
            "maintenance_cost_ratio": (
                round((maintenance_cost / total_asset_value) * 100, 2) if total_asset_value else 0.0
            ),
            "asset_value_by_category": {
                category_name: round(
                    sum(_as_float(asset.total_cost) for asset in filtered_assets if asset.category == category_name),
                    2,
                )
                for category_name in sorted({asset.category for asset in filtered_assets})
            },
            "maintenance_cost_by_category": {
                category_name: round(
                    sum(_as_float(record.maintenance_cost) for record in maintenance_records if db.get(Asset, record.asset_id) and db.get(Asset, record.asset_id).category == category_name),
                    2,
                )
                for category_name in sorted({db.get(Asset, record.asset_id).category for record in maintenance_records if db.get(Asset, record.asset_id)})
            },
        },
        "lifecycle": {
            "status_distribution": lifecycle_status_counts,
            "disposed_assets": sum(1 for asset in filtered_assets if asset.status == AssetStatus.disposed),
            "forecast": lifecycle_forecast,
            "age_summary": {
                "average_asset_age_days": (
                    round(
                        sum((date.today() - asset.purchase_date.date()).days for asset in filtered_assets) / total_assets,
                        2,
                    ) if total_assets else 0.0
                )
            },
        },
        "unsupported": {
            "monthly_spend": None,
            "budget_utilized": None,
            "department_consumption": None,
            "recent_purchase_orders": None,
            "procurement_registry": None,
            "wastage": None,
        },
    }
