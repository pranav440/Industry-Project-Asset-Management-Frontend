from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Asset, AssetStatus, User, UserRole
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
