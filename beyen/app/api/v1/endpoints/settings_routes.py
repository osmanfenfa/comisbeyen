"""
App settings management. (spec sections 2.1, 2.2, 15)

Admin: can change all fields including standard_moisture_percent.
Manager: can change operational prices only (NOT standard_moisture_percent).
Both see the current settings.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.permissions import require_role, get_current_user
from app.models.user import UserRole
from app.models.settings_model import AppSettings
from app.schemas.settings import SettingsOut, SettingsUpdate
from app.services.audit import log_action

router = APIRouter()

MANAGER_OR_ADMIN = require_role(UserRole.produce_manager, UserRole.system_admin)


def _get_or_create_settings(db: Session) -> AppSettings:
    row = db.query(AppSettings).filter(AppSettings.id == "singleton").first()
    if not row:
        row = AppSettings(id="singleton")
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


@router.get("/", response_model=SettingsOut)
def get_settings(db: Session = Depends(get_db), current=Depends(MANAGER_OR_ADMIN)):
    return _get_or_create_settings(db)


@router.put("/", response_model=SettingsOut)
def update_settings(
    payload: SettingsUpdate,
    db: Session = Depends(get_db),
    current=Depends(MANAGER_OR_ADMIN),
):
    """
    Admin can update all fields.
    Manager can update operational prices (cocoa/coffee/cola price_per_kg, station_name)
    but NOT standard_moisture_percent — that's an admin-level global setting. (spec section 2.4)
    """
    is_admin = current["role"] == UserRole.system_admin.value

    if not is_admin and payload.standard_moisture_percent is not None:
        raise HTTPException(
            status_code=403,
            detail="Only a System Admin can change the standard moisture percentage.",
        )

    row = _get_or_create_settings(db)
    old_snap = {
        "station_name": row.station_name,
        "standard_moisture_percent": row.standard_moisture_percent,
        "cocoa_price_per_kg": row.cocoa_price_per_kg,
        "coffee_price_per_kg": row.coffee_price_per_kg,
        "cola_price_per_kg": row.cola_price_per_kg,
    }

    update_data = payload.model_dump(exclude_unset=True, exclude_none=True)
    for field, value in update_data.items():
        setattr(row, field, value)

    db.commit()
    db.refresh(row)
    log_action(db, current["id"], current["role"], "update_settings", "AppSettings",
               None, old_value=old_snap, new_value=update_data)
    return row
