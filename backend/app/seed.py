from datetime import date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    Asset,
    AssetMovement,
    AssetMovementStatus,
    AssetStatus,
    AuditLog,
    Consumable,
    ConsumableIssue,
    ConsumableOperationType,
    ConsumableStockMovement,
    GatePass,
    GatePassHistory,
    GatePassStatus,
    GatePassType,
    Maintenance,
    MaintenanceType,
    Request,
    RequestHistory,
    RequestPriority,
    RequestStatus,
    RequestType,
    User,
    UserRole,
)
from app.routers.assets import _asset_id, _qr_data_url
from app.security import hash_password

SEED_PASSWORD = "AssetMX@123"

SEED_USERS = [
    {
        "full_name": "Employee",
        "email": "employee@assetmx.local",
        "employee_id": "EMP001",
        "role": UserRole.employee,
    },
    {
        "full_name": "Host",
        "email": "host@assetmx.local",
        "employee_id": "HST001",
        "role": UserRole.host,
    },
    {
        "full_name": "Admin",
        "email": "admin@assetmx.local",
        "employee_id": "ADM001",
        "role": UserRole.admin,
    },
    {
        "full_name": "Guard",
        "email": "guard@assetmx.local",
        "employee_id": "GRD001",
        "role": UserRole.guard,
    },
    {
        "full_name": "SuperAdmin",
        "email": "superadmin@assetmx.local",
        "employee_id": "SAD001",
        "role": UserRole.superadmin,
    },
]

DEMO_ASSETS = [
    {
        "name": "Dell Latitude 5440 Laptop",
        "category": "Hardware",
        "subcategory": "Laptop",
        "specification": "Intel Core i5, 16GB RAM, 512GB SSD",
        "location": "Lab - Building A",
        "custodian": "Operations",
        "purchase_date": date(2026, 7, 15),
        "vendor_name": "Dell Technologies",
        "purchase_order": "PO-2026-0045",
        "total_cost": "78500",
        "warranty_end": date(2029, 7, 14),
        "status": AssetStatus.active,
        "seed_key": "assetmx-demo-001",
    },
    {
        "name": "HP LaserJet Pro Printer",
        "category": "Hardware",
        "subcategory": "Printer",
        "specification": "Color Laser, Network Enabled",
        "location": "Admin Office",
        "custodian": "Admin",
        "purchase_date": date(2026, 6, 20),
        "vendor_name": "HP",
        "purchase_order": "PO-2026-0046",
        "total_cost": "42000",
        "warranty_end": date(2028, 6, 19),
        "status": AssetStatus.active,
        "seed_key": "assetmx-demo-002",
    },
    {
        "name": "Epson EB-X06 Projector",
        "category": "Electronics",
        "subcategory": "Projector",
        "specification": "3600 Lumens, XGA",
        "location": "Conference Room A",
        "custodian": "Operations",
        "purchase_date": date(2026, 5, 10),
        "vendor_name": "Epson",
        "purchase_order": "PO-2026-0038",
        "total_cost": "56000",
        "warranty_end": date(2029, 5, 9),
        "status": AssetStatus.active,
        "seed_key": "assetmx-demo-003",
    },
    {
        "name": "Lenovo ThinkPad E14",
        "category": "Hardware",
        "subcategory": "Laptop",
        "specification": "Intel Core i5, 16GB RAM, 512GB SSD",
        "location": "IT Office",
        "custodian": "IT Operations",
        "purchase_date": date(2026, 4, 18),
        "vendor_name": "Lenovo",
        "purchase_order": "PO-2026-0031",
        "total_cost": "72000",
        "warranty_end": date(2029, 4, 17),
        "status": AssetStatus.active,
        "seed_key": "assetmx-demo-004",
    },
    {
        "name": "Samsung 55-inch Display",
        "category": "Electronics",
        "subcategory": "Display",
        "specification": "4K UHD Smart Display",
        "location": "Conference Room B",
        "custodian": "Operations",
        "purchase_date": date(2026, 3, 25),
        "vendor_name": "Samsung",
        "purchase_order": "PO-2026-0027",
        "total_cost": "68000",
        "warranty_end": date(2028, 3, 24),
        "status": AssetStatus.active,
        "seed_key": "assetmx-demo-005",
    },
    {
        "name": "Canon ImageRUNNER Copier",
        "category": "Hardware",
        "subcategory": "Copier",
        "specification": "Multifunction Network Copier",
        "location": "Finance Office",
        "custodian": "Finance",
        "purchase_date": date(2026, 2, 12),
        "vendor_name": "Canon",
        "purchase_order": "PO-2026-0019",
        "total_cost": "125000",
        "warranty_end": date(2029, 2, 11),
        "status": AssetStatus.in_maintenance,
        "seed_key": "assetmx-demo-006",
    },
    {
        "name": "APC Smart-UPS 1500VA",
        "category": "Electrical",
        "subcategory": "UPS",
        "specification": "1500VA Rack/Office UPS",
        "location": "Server Room",
        "custodian": "IT Operations",
        "purchase_date": date(2026, 1, 28),
        "vendor_name": "APC",
        "purchase_order": "PO-2026-0012",
        "total_cost": "48000",
        "warranty_end": date(2029, 1, 27),
        "status": AssetStatus.active,
        "seed_key": "assetmx-demo-007",
    },
    {
        "name": "Apple MacBook Air M3",
        "category": "Hardware",
        "subcategory": "Laptop",
        "specification": "M3, 16GB RAM, 512GB SSD",
        "location": "Design Studio",
        "custodian": "Operations",
        "purchase_date": date(2025, 12, 15),
        "vendor_name": "Apple",
        "purchase_order": "PO-2025-0098",
        "total_cost": "115000",
        "warranty_end": date(2028, 12, 14),
        "status": AssetStatus.active,
        "seed_key": "assetmx-demo-008",
    },
    {
        "name": "Bosch Cordless Drill",
        "category": "Equipment",
        "subcategory": "Power Tool",
        "specification": "18V Professional Cordless Drill",
        "location": "Maintenance Workshop",
        "custodian": "Maintenance",
        "purchase_date": date(2025, 11, 5),
        "vendor_name": "Bosch",
        "purchase_order": "PO-2025-0087",
        "total_cost": "18500",
        "warranty_end": date(2027, 11, 4),
        "status": AssetStatus.in_maintenance,
        "seed_key": "assetmx-demo-009",
    },
    {
        "name": "Dell PowerEdge Server",
        "category": "IT Infrastructure",
        "subcategory": "Server",
        "specification": "Rack Server, 64GB RAM, 2TB Storage",
        "location": "Server Room",
        "custodian": "IT Operations",
        "purchase_date": date(2025, 10, 10),
        "vendor_name": "Dell Technologies",
        "purchase_order": "PO-2025-0075",
        "total_cost": "285000",
        "warranty_end": date(2030, 10, 9),
        "status": AssetStatus.active,
        "seed_key": "assetmx-demo-010",
    },
]


def seed_users(db: Session) -> None:
    existing = db.scalar(select(User.id).limit(1))
    if existing is not None:
        return

    password_hash = hash_password(SEED_PASSWORD)
    for row in SEED_USERS:
        db.add(User(**row, password_hash=password_hash, is_active=True))
    db.commit()


def seed_demo_assets(db: Session) -> None:
    existing_keys = {
        (asset.name, asset.invoice_reference)
        for asset in db.scalars(select(Asset)).all()
    }
    assets_to_add = []
    for demo in DEMO_ASSETS:
        if (demo["name"], demo["purchase_order"]) in existing_keys:
            continue
        asset_id = _asset_id(db)
        qr_value = f"assetmx:{asset_id}"
        assets_to_add.append(Asset(
            asset_id=asset_id,
            name=demo["name"],
            category=demo["category"],
            specification=f'{demo["subcategory"]}: {demo["specification"]}',
            location=demo["location"],
            custodian=demo["custodian"],
            purchase_date=demo["purchase_date"],
            vendor_name=demo["vendor_name"],
            total_cost=demo["total_cost"],
            warranty_period=f'Until {demo["warranty_end"].isoformat()}',
            invoice_reference=demo["purchase_order"],
            status=demo["status"],
            qr_code_value=qr_value,
            qr_code_data_url=_qr_data_url(qr_value),
        ))
    if assets_to_add:
        db.add_all(assets_to_add)
        db.commit()


def _get_user_by_role(db: Session, role: UserRole) -> User | None:
    return db.scalar(select(User).where(User.role == role).order_by(User.id.asc()))


def _get_asset_by_name(db: Session, name: str) -> Asset | None:
    return db.scalar(select(Asset).where(Asset.name == name))


def _status_exists(db: Session, model, field_name: str, value: str) -> bool:
    return db.scalar(select(model.id).where(getattr(model, field_name) == value)) is not None


def _add_if_missing(db: Session, model, unique_field_name: str, unique_value: str, **kwargs):
    if db.scalar(select(model.id).where(getattr(model, unique_field_name) == unique_value)) is not None:
        return None
    record = model(**kwargs)
    db.add(record)
    return record


def seed_development_demo_data(db: Session) -> None:
    seed_users(db)

    admin_user = _get_user_by_role(db, UserRole.admin)
    if admin_user is None:
        return

    target_asset_statuses = {
        "Dell Latitude 5440 Laptop": AssetStatus.active,
        "HP LaserJet Pro Printer": AssetStatus.in_transit,
        "Epson EB-X06 Projector": AssetStatus.active,
        "Lenovo ThinkPad E14": AssetStatus.active,
        "Samsung 55-inch Display": AssetStatus.disposed,
        "Canon ImageRUNNER Copier": AssetStatus.in_maintenance,
        "APC Smart-UPS 1500VA": AssetStatus.active,
        "Apple MacBook Air M3": AssetStatus.active,
        "Bosch Cordless Drill": AssetStatus.in_maintenance,
        "Dell PowerEdge Server": AssetStatus.active,
    }
    for asset_name, target_status in target_asset_statuses.items():
        asset = _get_asset_by_name(db, asset_name)
        if asset is not None and asset.status != target_status:
            asset.status = target_status
    db.flush()

    maintenance_rows = [
        {
            "maintenance_id": "MNT-DEV-001",
            "asset_name": "Canon ImageRUNNER Copier",
            "service_date": datetime(2026, 8, 12, 9, 30),
            "maintenance_type": MaintenanceType.preventive,
            "service_vendor": "Canon Service Desk",
            "technician": "Ramesh Nair",
            "maintenance_cost": 4200.00,
            "service_notes": "Scheduled preventive service for network copier and paper path calibration.",
        },
        {
            "maintenance_id": "MNT-DEV-002",
            "asset_name": "Bosch Cordless Drill",
            "service_date": datetime(2026, 9, 2, 14, 0),
            "maintenance_type": MaintenanceType.corrective,
            "service_vendor": "Bosch Field Support",
            "technician": "Aisha Khan",
            "maintenance_cost": 1850.00,
            "service_notes": "Battery pack fault corrected and torque calibration adjusted.",
        },
        {
            "maintenance_id": "MNT-DEV-003",
            "asset_name": "Dell Latitude 5440 Laptop",
            "service_date": datetime(2026, 9, 11, 11, 15),
            "maintenance_type": MaintenanceType.preventive,
            "service_vendor": "Dell Care Services",
            "technician": "Samir Malik",
            "maintenance_cost": 2600.00,
            "service_notes": "Endpoint health review and SSD diagnostics.",
        },
    ]
    for row in maintenance_rows:
        asset = _get_asset_by_name(db, row["asset_name"])
        if asset is None:
            continue
        if db.scalar(select(Maintenance.id).where(Maintenance.maintenance_id == row["maintenance_id"])) is not None:
            continue
        db.add(Maintenance(
            maintenance_id=row["maintenance_id"],
            asset_id=asset.id,
            service_date=row["service_date"],
            maintenance_type=row["maintenance_type"],
            service_vendor=row["service_vendor"],
            technician=row["technician"],
            maintenance_cost=row["maintenance_cost"],
            status="Completed",
            service_notes=row["service_notes"],
            created_by_user_id=admin_user.id,
        ))

    movement_rows = [
        {
            "movement_id": "TRF-DEV-001",
            "asset_name": "HP LaserJet Pro Printer",
            "from_location": "Admin Office",
            "to_location": "Procurement Room",
            "from_custodian": "Admin",
            "to_custodian": "Procurement",
            "reason": "Service relocation for quarterly print audit",
            "status": AssetMovementStatus.in_transit,
            "initiated_at": datetime(2026, 8, 20, 9, 15),
        },
        {
            "movement_id": "TRF-DEV-002",
            "asset_name": "Dell PowerEdge Server",
            "from_location": "Server Room",
            "to_location": "Secondary Data Center",
            "from_custodian": "IT Operations",
            "to_custodian": "Infrastructure",
            "reason": "Hardware migration before maintenance window",
            "status": AssetMovementStatus.completed,
            "initiated_at": datetime(2026, 9, 8, 11, 0),
            "completed_at": datetime(2026, 9, 8, 14, 30),
        },
        {
            "movement_id": "TRF-DEV-003",
            "asset_name": "Epson EB-X06 Projector",
            "from_location": "Conference Room A",
            "to_location": "Training Hall",
            "from_custodian": "Operations",
            "to_custodian": "Learning",
            "reason": "Training equipment handoff",
            "status": AssetMovementStatus.completed,
            "initiated_at": datetime(2026, 9, 10, 8, 0),
            "completed_at": datetime(2026, 9, 10, 10, 15),
        },
    ]
    for row in movement_rows:
        asset = _get_asset_by_name(db, row["asset_name"])
        if asset is None:
            continue
        if db.scalar(select(AssetMovement.id).where(AssetMovement.movement_id == row["movement_id"])) is not None:
            continue
        db.add(AssetMovement(
            asset_id=asset.id,
            movement_id=row["movement_id"],
            from_location=row["from_location"],
            to_location=row["to_location"],
            from_custodian=row["from_custodian"],
            to_custodian=row["to_custodian"],
            reason=row["reason"],
            status=row["status"],
            initiated_by_user_id=admin_user.id,
            initiated_at=row["initiated_at"],
            completed_at=row.get("completed_at"),
        ))

    consumable_rows = [
        {
            "consumable_id": "CON-DEV-001",
            "name": "Laser Toner Cartridge",
            "category": "Office Supplies",
            "batch_id": "LOT-LT-001",
            "location": "Procurement Room",
            "initial_stock": 90,
            "threshold": 25,
            "expiry_date": date(2027, 6, 30),
        },
        {
            "consumable_id": "CON-DEV-002",
            "name": "A4 Printer Paper",
            "category": "Office Supplies",
            "batch_id": "LOT-PAP-104",
            "location": "Admin Office",
            "initial_stock": 18,
            "threshold": 30,
            "expiry_date": None,
        },
        {
            "consumable_id": "CON-DEV-003",
            "name": "Network Patch Cable",
            "category": "IT Accessories",
            "batch_id": "LOT-NET-022",
            "location": "Server Room",
            "initial_stock": 120,
            "threshold": 40,
            "expiry_date": date(2026, 10, 5),
        },
        {
            "consumable_id": "CON-DEV-004",
            "name": "Safety Gloves",
            "category": "Safety",
            "batch_id": "LOT-SAF-118",
            "location": "Maintenance Workshop",
            "initial_stock": 10,
            "threshold": 12,
            "expiry_date": date(2026, 7, 19),
        },
        {
            "consumable_id": "CON-DEV-005",
            "name": "Cleaning Solvent",
            "category": "Facilities",
            "batch_id": "LOT-CLN-008",
            "location": "Facilities Store",
            "initial_stock": 40,
            "threshold": 15,
            "expiry_date": date(2027, 2, 10),
        },
    ]
    for item in consumable_rows:
        if db.scalar(select(Consumable.id).where(Consumable.consumable_id == item["consumable_id"])) is not None:
            continue
        db.add(Consumable(
            consumable_id=item["consumable_id"],
            name=item["name"],
            category=item["category"],
            batch_id=item["batch_id"],
            location=item["location"],
            available_stock=item["initial_stock"],
            threshold=item["threshold"],
            batch_quantity=item["initial_stock"],
            expiry_date=item["expiry_date"],
        ))
    db.flush()

    stock_movements = {
        "CON-DEV-001": [
            {"movement_id": "MOV-DEV-001", "op": ConsumableOperationType.initial_inward, "delta": 90, "post": 90, "ref": "Initial batch receipt - toner cartridge"},
            {"movement_id": "MOV-DEV-002", "op": ConsumableOperationType.adjustment, "delta": -12, "post": 78, "ref": "Adjusted after stock count audit"},
            {"movement_id": "MOV-DEV-003", "op": ConsumableOperationType.issue, "delta": -15, "post": 63, "ref": "Issued to IT support desk"},
        ],
        "CON-DEV-002": [
            {"movement_id": "MOV-DEV-004", "op": ConsumableOperationType.initial_inward, "delta": 18, "post": 18, "ref": "Initial batch receipt - plain paper"},
            {"movement_id": "MOV-DEV-005", "op": ConsumableOperationType.issue, "delta": -8, "post": 10, "ref": "Issued for finance printing"},
        ],
        "CON-DEV-003": [
            {"movement_id": "MOV-DEV-006", "op": ConsumableOperationType.initial_inward, "delta": 120, "post": 120, "ref": "Initial cable stock receipt"},
            {"movement_id": "MOV-DEV-007", "op": ConsumableOperationType.issue, "delta": -24, "post": 96, "ref": "Network upgrade and office move"},
            {"movement_id": "MOV-DEV-008", "op": ConsumableOperationType.adjustment, "delta": 10, "post": 106, "ref": "Corrected stock count after audit"},
        ],
        "CON-DEV-004": [
            {"movement_id": "MOV-DEV-009", "op": ConsumableOperationType.initial_inward, "delta": 10, "post": 10, "ref": "Safety gloves intake"},
            {"movement_id": "MOV-DEV-010", "op": ConsumableOperationType.issue, "delta": -6, "post": 4, "ref": "Issued to maintenance workshop"},
        ],
        "CON-DEV-005": [
            {"movement_id": "MOV-DEV-011", "op": ConsumableOperationType.initial_inward, "delta": 40, "post": 40, "ref": "Initial facilities cleaning stock"},
            {"movement_id": "MOV-DEV-012", "op": ConsumableOperationType.issue, "delta": -12, "post": 28, "ref": "Used across routine cleaning tasks"},
        ],
    }
    for consumable_id, entries in stock_movements.items():
        consumable = db.scalar(select(Consumable).where(Consumable.consumable_id == consumable_id))
        if consumable is None:
            continue
        for entry in entries:
            if db.scalar(select(ConsumableStockMovement.id).where(ConsumableStockMovement.movement_id == entry["movement_id"])) is not None:
                continue
            db.add(ConsumableStockMovement(
                movement_id=entry["movement_id"],
                consumable_id=consumable.id,
                operation_type=entry["op"],
                delta_quantity=entry["delta"],
                post_balance=entry["post"],
                reference=entry["ref"],
                created_by_user_id=admin_user.id,
            ))
        latest_post = entries[-1]["post"]
        consumable.available_stock = latest_post
        consumable.batch_quantity = latest_post
    db.flush()

    issue_rows = [
        {"issue_id": "ISS-DEV-001", "consumable_id": "CON-DEV-001", "quantity": 15, "request_reference": "TR-0001", "issued_by_user_id": admin_user.id, "remaining_stock": 63},
        {"issue_id": "ISS-DEV-002", "consumable_id": "CON-DEV-002", "quantity": 8, "request_reference": "TR-0002", "issued_by_user_id": admin_user.id, "remaining_stock": 10},
        {"issue_id": "ISS-DEV-003", "consumable_id": "CON-DEV-003", "quantity": 24, "request_reference": "NET-UPGRADE-01", "issued_by_user_id": admin_user.id, "remaining_stock": 96},
        {"issue_id": "ISS-DEV-004", "consumable_id": "CON-DEV-004", "quantity": 6, "request_reference": "MNT-WORKSHOP-18", "issued_by_user_id": admin_user.id, "remaining_stock": 4},
        {"issue_id": "ISS-DEV-005", "consumable_id": "CON-DEV-005", "quantity": 12, "request_reference": "FAC-016", "issued_by_user_id": admin_user.id, "remaining_stock": 28},
    ]
    for issue in issue_rows:
        consumable = db.scalar(select(Consumable).where(Consumable.consumable_id == issue["consumable_id"]))
        if consumable is None:
            continue
        if db.scalar(select(ConsumableIssue.id).where(ConsumableIssue.issue_id == issue["issue_id"])) is not None:
            continue
        db.add(ConsumableIssue(
            issue_id=issue["issue_id"],
            consumable_id=consumable.id,
            issue_date=datetime(2026, 9, 11, 10, 0),
            quantity=issue["quantity"],
            request_reference=issue["request_reference"],
            issued_by_user_id=issue["issued_by_user_id"],
            remaining_stock=issue["remaining_stock"],
        ))

    request_rows = [
        {
            "request_id": "REQ-DEV-0001",
            "requester_name": "Alice Green",
            "requester_email": "alice@assetmx.local",
            "department": "Operations",
            "request_type": RequestType.asset_request,
            "requested_item": "Laptop",
            "category": "Hardware",
            "quantity": 2,
            "priority": RequestPriority.high,
            "request_date": date(2026, 9, 10),
            "status": RequestStatus.pending,
            "justification": "New onboarding requires two additional laptops for field operations.",
            "processing_guidelines": "Approve after asset availability confirmation.",
            "history": [
                {"history_id": "RH-DEV-001", "timestamp": datetime(2026, 9, 10, 8, 30), "stage": "Pending", "action": "Request created", "performed_by": "Alice Green", "note": "Submitted by operations lead."},
            ],
        },
        {
            "request_id": "REQ-DEV-0002",
            "requester_name": "Bob Brown",
            "requester_email": "bob@assetmx.local",
            "department": "IT",
            "request_type": RequestType.consumable_request,
            "requested_item": "Network Patch Cable",
            "category": "IT Accessories",
            "quantity": 20,
            "priority": RequestPriority.medium,
            "request_date": date(2026, 9, 11),
            "status": RequestStatus.in_review,
            "justification": "Office relocation requires additional patch cables for new workstations.",
            "processing_guidelines": "Validate current stock before approval.",
            "history": [
                {"history_id": "RH-DEV-002", "timestamp": datetime(2026, 9, 11, 9, 0), "stage": "Pending", "action": "Request created", "performed_by": "Bob Brown", "note": "Requested by IT support."},
                {"history_id": "RH-DEV-003", "timestamp": datetime(2026, 9, 11, 11, 20), "stage": "In Review", "action": "Status Updated", "performed_by": admin_user.full_name, "note": "Request moved to review for stock validation."},
            ],
        },
        {
            "request_id": "REQ-DEV-0003",
            "requester_name": "Carol White",
            "requester_email": "carol@assetmx.local",
            "department": "Finance",
            "request_type": RequestType.asset_request,
            "requested_item": "Monitor",
            "category": "Hardware",
            "quantity": 3,
            "priority": RequestPriority.low,
            "request_date": date(2026, 9, 12),
            "status": RequestStatus.fulfilled,
            "justification": "Workstation refresh and extension of finance desk capacity.",
            "processing_guidelines": "Coordinate delivery to finance office.",
            "history": [
                {"history_id": "RH-DEV-004", "timestamp": datetime(2026, 9, 12, 8, 0), "stage": "Pending", "action": "Request created", "performed_by": "Carol White", "note": "Submitted request for marking equipment."},
                {"history_id": "RH-DEV-005", "timestamp": datetime(2026, 9, 12, 9, 15), "stage": "In Review", "action": "Status Updated", "performed_by": admin_user.full_name, "note": "Reviewed and accepted."},
                {"history_id": "RH-DEV-006", "timestamp": datetime(2026, 9, 12, 10, 45), "stage": "Fulfilled", "action": "Status Updated", "performed_by": admin_user.full_name, "note": "Delivery completed to finance desk."},
            ],
        },
        {
            "request_id": "REQ-DEV-0004",
            "requester_name": "Dana Cole",
            "requester_email": "dana@assetmx.local",
            "department": "Operations",
            "request_type": RequestType.consumable_request,
            "requested_item": "Safety Gloves",
            "category": "Safety",
            "quantity": 15,
            "priority": RequestPriority.high,
            "request_date": date(2026, 9, 13),
            "status": RequestStatus.rejected,
            "justification": "Workshop team needs additional gloves for upcoming maintenance work.",
            "processing_guidelines": "Review stock baseline and item substitution before approval.",
            "history": [
                {"history_id": "RH-DEV-007", "timestamp": datetime(2026, 9, 13, 7, 0), "stage": "Pending", "action": "Request created", "performed_by": "Dana Cole", "note": "Submitted by warehouse supervisor."},
                {"history_id": "RH-DEV-008", "timestamp": datetime(2026, 9, 13, 9, 10), "stage": "Rejected", "action": "Status Updated", "performed_by": admin_user.full_name, "note": "Rejected due to over-allocation and safety stock review."},
            ],
        },
    ]
    for row in request_rows:
        if db.scalar(select(Request.id).where(Request.request_id == row["request_id"])) is not None:
            continue
        db.add(Request(
            request_id=row["request_id"],
            requester_name=row["requester_name"],
            requester_email=row["requester_email"],
            department=row["department"],
            request_type=row["request_type"],
            requested_item=row["requested_item"],
            category=row["category"],
            quantity=row["quantity"],
            priority=row["priority"],
            request_date=row["request_date"],
            status=row["status"],
            justification=row["justification"],
            processing_guidelines=row["processing_guidelines"],
        ))
    db.flush()
    for row in request_rows:
        for history in row["history"]:
            if db.scalar(select(RequestHistory.id).where(RequestHistory.history_id == history["history_id"])) is not None:
                continue
            request = db.scalar(select(Request).where(Request.request_id == row["request_id"]))
            if request is None:
                continue
            db.add(RequestHistory(
                history_id=history["history_id"],
                request_id=request.request_id,
                timestamp=history["timestamp"],
                stage=history["stage"],
                action=history["action"],
                performed_by=history["performed_by"],
                note=history["note"],
            ))

    gate_pass_rows = [
        {
            "pass_id": "GP-DEV-0001",
            "pass_type": GatePassType.asset_movement,
            "request_date": date(2026, 9, 9),
            "status": GatePassStatus.pending,
            "requester_name": "Alicia Green",
            "department": "Operations",
            "asset_or_item": "Dell Latitude 5440 Laptop",
            "quantity": 1,
            "current_location": "Lab - Building A",
            "destination": "Regional Branch",
            "movement_date": date(2026, 9, 10),
            "purpose": "Laptop handoff to field support team.",
            "authorization_state": "Pending Review",
            "decision_status": "Awaiting Review",
            "history": [
                {"history_id": "GPH-DEV-001", "timestamp": datetime(2026, 9, 9, 8, 30), "action": "Gate Pass Created", "performed_by": "Alicia Green", "note": "Created for regional assignment", "status_snapshot": "Pending"},
            ],
        },
        {
            "pass_id": "GP-DEV-0002",
            "pass_type": GatePassType.returnable,
            "request_date": date(2026, 9, 10),
            "status": GatePassStatus.approved,
            "requester_name": "Bob Brown",
            "department": "IT",
            "asset_or_item": "Lenovo ThinkPad E14",
            "quantity": 1,
            "current_location": "IT Office",
            "destination": "Service Center",
            "movement_date": date(2026, 9, 12),
            "purpose": "Returnable equipment pickup for diagnostics.",
            "authorization_state": "Approved by Admin",
            "decision_status": "Approved",
            "history": [
                {"history_id": "GPH-DEV-002", "timestamp": datetime(2026, 9, 10, 9, 0), "action": "Gate Pass Created", "performed_by": "Bob Brown", "note": "Submitted for authorized transfer", "status_snapshot": "Pending"},
                {"history_id": "GPH-DEV-003", "timestamp": datetime(2026, 9, 10, 12, 0), "action": "Gate Pass Approved", "performed_by": admin_user.full_name, "note": "Approved by asset admin.", "status_snapshot": "Approved"},
            ],
        },
        {
            "pass_id": "GP-DEV-0003",
            "pass_type": GatePassType.asset_movement,
            "request_date": date(2026, 9, 11),
            "status": GatePassStatus.active,
            "requester_name": "Carol White",
            "department": "Finance",
            "asset_or_item": "Samsung 55-inch Display",
            "quantity": 1,
            "current_location": "Conference Room B",
            "destination": "Finance Office",
            "movement_date": date(2026, 9, 12),
            "purpose": "Display relocation for finance boardroom setup.",
            "authorization_state": "Approved by Admin",
            "decision_status": "Approved",
            "history": [
                {"history_id": "GPH-DEV-004", "timestamp": datetime(2026, 9, 11, 8, 15), "action": "Gate Pass Created", "performed_by": "Carol White", "note": "Initial request submitted", "status_snapshot": "Pending"},
                {"history_id": "GPH-DEV-005", "timestamp": datetime(2026, 9, 11, 10, 45), "action": "Gate Pass Approved", "performed_by": admin_user.full_name, "note": "Approved and dispatched", "status_snapshot": "Approved"},
                {"history_id": "GPH-DEV-006", "timestamp": datetime(2026, 9, 12, 14, 20), "action": "Exit verified / Active", "performed_by": "Guard", "note": "Asset cleared at exit gate", "status_snapshot": "Active"},
            ],
        },
        {
            "pass_id": "GP-DEV-0004",
            "pass_type": GatePassType.maintenance,
            "request_date": date(2026, 9, 13),
            "status": GatePassStatus.completed,
            "requester_name": "Dana Cole",
            "department": "Operations",
            "asset_or_item": "Bosch Cordless Drill",
            "quantity": 1,
            "current_location": "Maintenance Workshop",
            "destination": "Warehouse",
            "movement_date": date(2026, 9, 14),
            "purpose": "Return of repaired power tool after maintenance cycle.",
            "authorization_state": "Approved by Admin",
            "decision_status": "Approved",
            "history": [
                {"history_id": "GPH-DEV-007", "timestamp": datetime(2026, 9, 13, 9, 0), "action": "Gate Pass Created", "performed_by": "Dana Cole", "note": "Created after maintenance turnaround", "status_snapshot": "Pending"},
                {"history_id": "GPH-DEV-008", "timestamp": datetime(2026, 9, 13, 10, 30), "action": "Gate Pass Approved", "performed_by": admin_user.full_name, "note": "Approved and tracked for workshop return", "status_snapshot": "Approved"},
                {"history_id": "GPH-DEV-009", "timestamp": datetime(2026, 9, 14, 8, 0), "action": "Exit verified", "performed_by": "Guard", "note": "Release approved at gate", "status_snapshot": "Active"},
                {"history_id": "GPH-DEV-010", "timestamp": datetime(2026, 9, 14, 15, 5), "action": "Entry verified / Completed", "performed_by": "Guard", "note": "Asset recorded at final destination", "status_snapshot": "Completed"},
            ],
        },
        {
            "pass_id": "GP-DEV-0005",
            "pass_type": GatePassType.asset_movement,
            "request_date": date(2026, 9, 15),
            "status": GatePassStatus.rejected,
            "requester_name": "Eve Hall",
            "department": "Engineering",
            "asset_or_item": "APC Smart-UPS 1500VA",
            "quantity": 1,
            "current_location": "Server Room",
            "destination": "Branch Office",
            "movement_date": date(2026, 9, 16),
            "purpose": "Move UPS unit to branch support room.",
            "authorization_state": "Rejected by Admin",
            "decision_status": "Rejected",
            "history": [
                {"history_id": "GPH-DEV-011", "timestamp": datetime(2026, 9, 15, 8, 0), "action": "Gate Pass Created", "performed_by": "Eve Hall", "note": "Created for equipment deployment", "status_snapshot": "Pending"},
                {"history_id": "GPH-DEV-012", "timestamp": datetime(2026, 9, 15, 11, 20), "action": "Gate Pass Rejected", "performed_by": admin_user.full_name, "note": "Rejected due to duplicate equipment allocation.", "status_snapshot": "Rejected"},
            ],
        },
        {
            "pass_id": "GP-DEV-0006",
            "pass_type": GatePassType.non_returnable,
            "request_date": date(2026, 9, 16),
            "status": GatePassStatus.escalated,
            "requester_name": "Frank Grant",
            "department": "Facilities",
            "asset_or_item": "Printer Consumables",
            "quantity": 6,
            "current_location": "Facilities Store",
            "destination": "Regional Site",
            "movement_date": date(2026, 9, 17),
            "purpose": "Urgent consumables transfer for site restoration.",
            "authorization_state": "Escalated for compliance review",
            "decision_status": "Escalated",
            "history": [
                {"history_id": "GPH-DEV-013", "timestamp": datetime(2026, 9, 16, 9, 10), "action": "Gate Pass Created", "performed_by": "Frank Grant", "note": "Created for emergency site dispatch", "status_snapshot": "Pending"},
                {"history_id": "GPH-DEV-014", "timestamp": datetime(2026, 9, 16, 12, 5), "action": "Gate Pass Escalated", "performed_by": admin_user.full_name, "note": "Escalated for compliance review", "status_snapshot": "Escalated"},
            ],
        },
    ]
    for row in gate_pass_rows:
        if db.scalar(select(GatePass.id).where(GatePass.pass_id == row["pass_id"])) is not None:
            continue
        db.add(GatePass(
            pass_id=row["pass_id"],
            pass_type=row["pass_type"],
            request_date=row["request_date"],
            status=row["status"],
            requester_name=row["requester_name"],
            department=row["department"],
            asset_or_item=row["asset_or_item"],
            quantity=row["quantity"],
            current_location=row["current_location"],
            destination=row["destination"],
            movement_date=row["movement_date"],
            purpose=row["purpose"],
            authorization_state=row["authorization_state"],
            decision_status=row["decision_status"],
            decision_date=datetime.combine(row["movement_date"], datetime.min.time()) if row["status"] in {GatePassStatus.approved, GatePassStatus.active, GatePassStatus.completed} else None,
            decision_by=admin_user.full_name if row["status"] in {GatePassStatus.approved, GatePassStatus.active, GatePassStatus.completed} else None,
            exit_status="Verified" if row["status"] in {GatePassStatus.active, GatePassStatus.completed} else None,
            exit_timestamp=datetime(2026, 9, 12, 14, 20) if row["status"] == GatePassStatus.active else None,
            exit_gate="Gate 02" if row["status"] in {GatePassStatus.active, GatePassStatus.completed} else None,
            exit_officer="Guard" if row["status"] in {GatePassStatus.active, GatePassStatus.completed} else None,
            entry_status="Verified" if row["status"] == GatePassStatus.completed else None,
            entry_timestamp=datetime(2026, 9, 14, 15, 5) if row["status"] == GatePassStatus.completed else None,
            entry_gate="Gate 04" if row["status"] == GatePassStatus.completed else None,
            entry_officer="Guard" if row["status"] == GatePassStatus.completed else None,
            escalation_is_escalated=row["status"] == GatePassStatus.escalated,
            escalation_reason="Compliance escalation review required" if row["status"] == GatePassStatus.escalated else None,
            escalation_timestamp=datetime(2026, 9, 16, 12, 5) if row["status"] == GatePassStatus.escalated else None,
            escalation_action_required="Review security exception" if row["status"] == GatePassStatus.escalated else None,
            escalation_escalated_by=admin_user.full_name if row["status"] == GatePassStatus.escalated else None,
        ))
    db.flush()
    for row in gate_pass_rows:
        for history in row["history"]:
            if db.scalar(select(GatePassHistory.id).where(GatePassHistory.history_id == history["history_id"])) is not None:
                continue
            gate_pass = db.scalar(select(GatePass).where(GatePass.pass_id == row["pass_id"]))
            if gate_pass is None:
                continue
            db.add(GatePassHistory(
                history_id=history["history_id"],
                pass_id=gate_pass.pass_id,
                timestamp=history["timestamp"],
                action=history["action"],
                performed_by=history["performed_by"],
                note=history["note"],
                status_snapshot=history["status_snapshot"],
            ))

    audit_targets = [
        {
            "action": "Asset transfer recorded",
            "asset_name": "HP LaserJet Pro Printer",
            "movement_id": "TRF-DEV-001",
            "before_state": {"location": "Admin Office", "custodian": "Admin"},
            "after_state": {"location": "Procurement Room", "custodian": "Procurement"},
            "metadata": {"movement_id": "TRF-DEV-001", "asset_name": "HP LaserJet Pro Printer"},
        },
        {
            "action": "Maintenance record created",
            "asset_name": "Canon ImageRUNNER Copier",
            "movement_id": None,
            "before_state": {"status": "Active"},
            "after_state": {"status": "In Maintenance"},
            "metadata": {"maintenance_id": "MNT-DEV-001"},
        },
        {
            "action": "Consumable stock adjusted",
            "consumable_id": "CON-DEV-003",
            "movement_id": "MOV-DEV-008",
            "before_state": {"available_stock": 96},
            "after_state": {"available_stock": 106},
            "metadata": {"movement_id": "MOV-DEV-008", "consumable_id": "CON-DEV-003"},
        },
        {
            "action": "Request status transition",
            "request_id": "REQ-DEV-0002",
            "movement_id": None,
            "before_state": {"status": "Pending"},
            "after_state": {"status": "In Review"},
            "metadata": {"request_id": "REQ-DEV-0002", "new_status": "In Review"},
        },
        {
            "action": "Gate pass approved",
            "gate_pass_id": "GP-DEV-0002",
            "movement_id": None,
            "before_state": {"status": "Pending"},
            "after_state": {"status": "Approved"},
            "metadata": {"pass_id": "GP-DEV-0002"},
        },
    ]
    for target in audit_targets:
        query = select(AuditLog.id)
        if target.get("asset_name"):
            asset = _get_asset_by_name(db, target["asset_name"])
            if asset is None:
                continue
            query = query.where(AuditLog.asset_id == asset.id, AuditLog.action == target["action"])
        elif target.get("consumable_id"):
            consumable = db.scalar(select(Consumable).where(Consumable.consumable_id == target["consumable_id"]))
            if consumable is None:
                continue
            query = query.where(AuditLog.consumable_id == consumable.id, AuditLog.action == target["action"])
        elif target.get("request_id"):
            request = db.scalar(select(Request).where(Request.request_id == target["request_id"]))
            if request is None:
                continue
            query = query.where(AuditLog.request_id == request.id, AuditLog.action == target["action"])
        elif target.get("gate_pass_id"):
            gate_pass = db.scalar(select(GatePass).where(GatePass.pass_id == target["gate_pass_id"]))
            if gate_pass is None:
                continue
            query = query.where(AuditLog.gate_pass_id == gate_pass.id, AuditLog.action == target["action"])
        else:
            continue
        if db.scalar(query) is not None:
            continue
        if target.get("asset_name"):
            asset = _get_asset_by_name(db, target["asset_name"])
            db.add(AuditLog(
                action=target["action"],
                asset_id=asset.id,
                asset_identifier=asset.asset_id,
                consumable_id=None,
                consumable_identifier=None,
                request_id=None,
                request_identifier=None,
                gate_pass_id=None,
                gate_pass_identifier=None,
                actor_user_id=admin_user.id,
                before_state=target["before_state"],
                after_state=target["after_state"],
                movement_id=target["movement_id"],
                metadata_json=target["metadata"],
            ))
        elif target.get("consumable_id"):
            consumable = db.scalar(select(Consumable).where(Consumable.consumable_id == target["consumable_id"]))
            db.add(AuditLog(
                action=target["action"],
                asset_id=None,
                asset_identifier="",
                consumable_id=consumable.id,
                consumable_identifier=consumable.consumable_id,
                request_id=None,
                request_identifier=None,
                gate_pass_id=None,
                gate_pass_identifier=None,
                actor_user_id=admin_user.id,
                before_state=target["before_state"],
                after_state=target["after_state"],
                movement_id=target["movement_id"],
                metadata_json=target["metadata"],
            ))
        elif target.get("request_id"):
            request = db.scalar(select(Request).where(Request.request_id == target["request_id"]))
            db.add(AuditLog(
                action=target["action"],
                asset_id=None,
                asset_identifier="",
                consumable_id=None,
                consumable_identifier=None,
                request_id=request.id,
                request_identifier=request.request_id,
                gate_pass_id=None,
                gate_pass_identifier=None,
                actor_user_id=admin_user.id,
                before_state=target["before_state"],
                after_state=target["after_state"],
                movement_id=target["movement_id"],
                metadata_json=target["metadata"],
            ))
        elif target.get("gate_pass_id"):
            gate_pass = db.scalar(select(GatePass).where(GatePass.pass_id == target["gate_pass_id"]))
            db.add(AuditLog(
                action=target["action"],
                asset_id=None,
                asset_identifier="",
                consumable_id=None,
                consumable_identifier=None,
                request_id=None,
                request_identifier=None,
                gate_pass_id=gate_pass.id,
                gate_pass_identifier=gate_pass.pass_id,
                actor_user_id=admin_user.id,
                before_state=target["before_state"],
                after_state=target["after_state"],
                movement_id=target["movement_id"],
                metadata_json=target["metadata"],
            ))
    db.commit()


if __name__ == "__main__":
    from app.database import SessionLocal, Base, engine

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_users(db)
        seed_demo_assets(db)
        seed_development_demo_data(db)
        db.commit()
    finally:
        db.close()
