from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

db_url = settings.DATABASE_URL
# Supabase and other cloud providers sometimes provide URLs starting with postgres://
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

# Fallback to pure-Python pg8000 driver if psycopg2 DLL is blocked by Windows Application Control
if db_url.startswith("postgresql://") and "+pg8000" not in db_url:
    try:
        import psycopg2  # noqa: F401
    except Exception:
        db_url = db_url.replace("postgresql://", "postgresql+pg8000://", 1)

# pool_pre_ping handles dropped connections common with remote hosted databases (e.g. Supabase)
engine = create_engine(db_url, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
