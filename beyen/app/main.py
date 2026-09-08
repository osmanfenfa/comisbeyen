"""
COMIS - Cocoa, Coffee, Cola & (future) Spice Management Information System
FastAPI application entrypoint.
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from app.core.config import settings
from app.api.v1.router import api_router
from app.db.session import SessionLocal
from app.db.base import Base
from app.db.session import engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.APP_ENV != "testing":
        try:
            # Create all tables (safe if they already exist)
            Base.metadata.create_all(bind=engine)
            try:
                with engine.connect() as conn:
                    conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS gender VARCHAR(20)"))
                    conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_password_token VARCHAR(255)"))
                    conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_password_expires_at TIMESTAMP"))
                    conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255)"))
                    conn.execute(text("ALTER TABLE sellers ADD COLUMN IF NOT EXISTS is_random BOOLEAN DEFAULT FALSE"))
                    conn.execute(text("ALTER TABLE receipts ADD COLUMN IF NOT EXISTS station_name VARCHAR(120)"))
                    conn.execute(text("ALTER TABLE receipts ADD COLUMN IF NOT EXISTS business_name VARCHAR(120)"))
                    conn.execute(text("ALTER TABLE receipts ADD COLUMN IF NOT EXISTS business_address VARCHAR(255)"))
                    conn.execute(text("ALTER TABLE receipts ADD COLUMN IF NOT EXISTS business_phone VARCHAR(50)"))
                    conn.execute(text("ALTER TABLE receipts ADD COLUMN IF NOT EXISTS weight_kg FLOAT"))
                    conn.execute(text("ALTER TABLE receipts ADD COLUMN IF NOT EXISTS water_percent FLOAT"))
                    conn.execute(text("ALTER TABLE receipts ADD COLUMN IF NOT EXISTS standard_percent FLOAT"))
                    conn.execute(text("ALTER TABLE receipts ADD COLUMN IF NOT EXISTS net_weight_kg FLOAT"))
                    conn.execute(text("ALTER TABLE receipts ADD COLUMN IF NOT EXISTS price_per_kg FLOAT"))
                    conn.execute(text("ALTER TABLE receipts ADD COLUMN IF NOT EXISTS seller_name_snapshot VARCHAR(120)"))
                    conn.execute(text("ALTER TABLE receipts ADD COLUMN IF NOT EXISTS seller_contact_snapshot VARCHAR(50)"))
                    conn.execute(text("ALTER TABLE receipts ADD COLUMN IF NOT EXISTS recorded_by_name VARCHAR(120)"))
                    conn.execute(text("ALTER TABLE receipts ADD COLUMN IF NOT EXISTS issued_by_name VARCHAR(120)"))
                    conn.commit()
            except Exception:
                pass
            # Seed default admin + settings row
            from app.db.seed import seed_database
            db = SessionLocal()
            try:
                seed_database(db)
            finally:
                db.close()
        except Exception as e:
            print(f"[STARTUP] Note: Database initialization skipped or failed: {e}")
    yield
    # Shutdown: nothing to clean up


app = FastAPI(
    title="COMIS API",
    version="2.0.0",
    description="Cocoa, Coffee & Cola Management Information System — three-role model",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")


@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "ok", "service": "COMIS API", "version": "2.0.0"}
