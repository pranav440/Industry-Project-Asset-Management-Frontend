from collections.abc import Generator

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings

engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    pool_recycle=3600,
)


def ensure_consumable_audit_schema() -> None:
    """Add additive nullable audit linkage columns to pre-existing audit tables."""
    if engine.dialect.name != "mysql":
        return
    columns = {column["name"] for column in inspect(engine).get_columns("audit_logs")}
    statements: list[str] = []
    if "asset_id" in columns:
        statements.append("ALTER TABLE audit_logs MODIFY COLUMN asset_id INT NULL")
    if "consumable_id" not in columns:
        statements.append("ALTER TABLE audit_logs ADD COLUMN consumable_id INT NULL")
    if "consumable_identifier" not in columns:
        statements.append("ALTER TABLE audit_logs ADD COLUMN consumable_identifier VARCHAR(64) NULL")
    if "request_id" not in columns:
        statements.append("ALTER TABLE audit_logs ADD COLUMN request_id INT NULL")
    if "request_identifier" not in columns:
        statements.append("ALTER TABLE audit_logs ADD COLUMN request_identifier VARCHAR(64) NULL")
    if "gate_pass_id" not in columns:
        statements.append("ALTER TABLE audit_logs ADD COLUMN gate_pass_id INT NULL")
    if "gate_pass_identifier" not in columns:
        statements.append("ALTER TABLE audit_logs ADD COLUMN gate_pass_identifier VARCHAR(64) NULL")
    if not statements:
        return
    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))


def ensure_request_metadata_schema() -> None:
    """Add additive nullable external request metadata columns to pre-existing requests table."""
    if engine.dialect.name != "mysql":
        return
    inspector = inspect(engine)
    if "requests" not in inspector.get_table_names():
        return
    columns = {column["name"] for column in inspector.get_columns("requests")}
    statements: list[str] = []
    if "request_source" not in columns:
        statements.append("ALTER TABLE requests ADD COLUMN request_source VARCHAR(64) NULL DEFAULT 'Internal'")
    if "date_received" not in columns:
        statements.append("ALTER TABLE requests ADD COLUMN date_received DATE NULL")
    if "external_reference" not in columns:
        statements.append("ALTER TABLE requests ADD COLUMN external_reference VARCHAR(255) NULL")
    if "contact_info" not in columns:
        statements.append("ALTER TABLE requests ADD COLUMN contact_info VARCHAR(255) NULL")
    if "estimated_cost" not in columns:
        statements.append("ALTER TABLE requests ADD COLUMN estimated_cost VARCHAR(64) NULL")
    if "procurement_reference" not in columns:
        statements.append("ALTER TABLE requests ADD COLUMN procurement_reference VARCHAR(255) NULL")
    if not statements:
        return
    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))


def ensure_request_attachment_schema() -> None:
    """Ensure request_attachments table and columns are consistent on MySQL."""
    if engine.dialect.name != "mysql":
        return
    inspector = inspect(engine)
    if "request_attachments" not in inspector.get_table_names():
        return


def ensure_asset_valuation_schema() -> None:
    """Ensure asset_valuations table and columns are consistent on MySQL."""
    if engine.dialect.name != "mysql":
        return
    inspector = inspect(engine)
    if "asset_valuations" not in inspector.get_table_names():
        return


SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
