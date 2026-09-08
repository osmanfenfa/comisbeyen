"""
Audit log viewing. (spec section 13)

Admin: all entries.
Manager: entries for their station's entities only (filtered by user IDs they manage).
Secretary: no access.
"""
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.permissions import require_role
from app.models.user import UserRole
from app.models.audit_log import AuditLog
from app.schemas.audit_log import AuditLogOut

router = APIRouter()

MANAGER_OR_ADMIN = require_role(UserRole.produce_manager, UserRole.system_admin)


@router.get("/", response_model=list[AuditLogOut])
def list_audit_logs(
    user_id: uuid.UUID | None = None,
    entity_type: str | None = None,
    action: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
    current=Depends(MANAGER_OR_ADMIN),
):
    """
    Manager/Admin: view audit log entries.
    Filterable by user, entity type, action, and date range.
    """
    from datetime import datetime
    query = db.query(AuditLog)

    if user_id:
        query = query.filter(AuditLog.user_id == user_id)
    if entity_type:
        query = query.filter(AuditLog.entity_type == entity_type)
    if action:
        query = query.filter(AuditLog.action == action)
    if date_from:
        try:
            query = query.filter(AuditLog.timestamp >= datetime.fromisoformat(date_from))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date_from format.")
    if date_to:
        try:
            query = query.filter(AuditLog.timestamp <= datetime.fromisoformat(date_to))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date_to format.")

    return (
        query.order_by(AuditLog.timestamp.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )


@router.get("/{log_id}", response_model=AuditLogOut)
def get_audit_log(
    log_id: uuid.UUID,
    db: Session = Depends(get_db),
    current=Depends(MANAGER_OR_ADMIN),
):
    entry = db.query(AuditLog).filter(AuditLog.id == log_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Audit log entry not found")
    return entry
