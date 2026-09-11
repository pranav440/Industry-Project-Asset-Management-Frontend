from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import OperationalError

from app.config import settings
from app.database import Base, SessionLocal, engine
from app.routers import auth
from app.routers import assets
from app.seed import seed_demo_assets, seed_users


@asynccontextmanager
async def lifespan(_app: FastAPI):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_users(db)
        seed_demo_assets(db)
    finally:
        db.close()
    yield


app = FastAPI(title="AssetMX Auth", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(assets.router)


@app.get("/api/health")
def health():
    try:
        with engine.connect() as conn:
            conn.exec_driver_sql("SELECT 1")
    except OperationalError as exc:
        return {"status": "degraded", "database": str(exc.orig) if exc.orig else str(exc)}
    return {"status": "ok"}
