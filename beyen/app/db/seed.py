"""
DB seed — runs at application startup.
Creates the singleton AppSettings row and the initial System Admin account
if they don't already exist. Safe to call repeatedly (idempotent).
"""
import uuid
from sqlalchemy.orm import Session
from app.models.user import User, UserRole, UserStatus
from app.models.settings_model import AppSettings
from app.core.security import hash_password
from app.core.config import settings


ADMIN_CONTACT = "admin@comis.local"
ADMIN_PASSWORD = "ComisAdmin2024!"   # Should be changed immediately after first login


def seed_database(db: Session) -> None:
    _seed_settings(db)
    _seed_admin(db)


def _seed_settings(db: Session) -> None:
    row = db.query(AppSettings).filter(AppSettings.id == "singleton").first()
    if not row:
        db.add(AppSettings(
            id="singleton",
            station_name=settings.STATION_NAME,
            standard_moisture_percent=settings.STANDARD_MOISTURE_PERCENT,
        ))
        db.commit()


def _seed_admin(db: Session) -> None:
    existing = db.query(User).filter(User.contact == ADMIN_CONTACT).first()
    if not existing:
        admin = User(
            id=uuid.uuid4(),
            name="System Administrator",
            contact=ADMIN_CONTACT,
            password_hash=hash_password(ADMIN_PASSWORD),
            role=UserRole.system_admin,
            status=UserStatus.active,
            is_active=True,
        )
        db.add(admin)
        db.commit()
        print(f"[SEED] Default admin created — contact: {ADMIN_CONTACT} / password: {ADMIN_PASSWORD}")
        print("[SEED] ⚠️  Change the default admin password immediately after first login!")
