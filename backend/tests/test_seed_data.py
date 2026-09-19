from datetime import date

from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.models import (
    Asset,
    AuditLog,
    Consumable,
    ConsumableIssue,
    ConsumableStockMovement,
    GatePass,
    GatePassHistory,
    Maintenance,
    Request,
    RequestHistory,
    User,
)
from app.seed import seed_demo_assets, seed_development_demo_data, seed_users


def make_session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    session_factory = sessionmaker(bind=engine)
    Base.metadata.create_all(engine)
    return session_factory


def test_development_seed_is_idempotent_and_reuses_existing_assets():
    session_factory = make_session()
    with session_factory() as db:
        seed_users(db)
        seed_demo_assets(db)
        seed_development_demo_data(db)
        seed_development_demo_data(db)

        asset_names = {asset.name for asset in db.scalars(select(Asset)).all()}
        assert len(asset_names) == 10
        assert "Dell Latitude 5440 Laptop" in asset_names
        assert "HP LaserJet Pro Printer" in asset_names

        assert db.query(Maintenance).count() > 0
        assert db.query(Consumable).count() >= 4
        assert db.query(ConsumableStockMovement).count() > 0
        assert db.query(ConsumableIssue).count() > 0
        assert db.query(Request).count() > 0
        assert db.query(RequestHistory).count() > 0
        assert db.query(GatePass).count() > 0
        assert db.query(GatePassHistory).count() > 0
        assert db.query(AuditLog).count() > 0

        assert db.query(Maintenance).count() == db.query(Maintenance).count()
        assert db.query(Consumable).count() == db.query(Consumable).count()
        assert db.query(Request).count() == db.query(Request).count()
        assert db.query(GatePass).count() == db.query(GatePass).count()

        request_count = db.query(Request).count()
        request_history_count = db.query(RequestHistory).count()
        gate_pass_count = db.query(GatePass).count()
        gate_history_count = db.query(GatePassHistory).count()
        audit_count = db.query(AuditLog).count()

        # Re-run with same seeding should not create new records
        seed_development_demo_data(db)
        assert db.query(Request).count() == request_count
        assert db.query(RequestHistory).count() == request_history_count
        assert db.query(GatePass).count() == gate_pass_count
        assert db.query(GatePassHistory).count() == gate_history_count
        assert db.query(AuditLog).count() == audit_count

        user_count = db.query(User).count()
        assert user_count >= 5
