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

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
