"""Every significant action writes one row here. Called from endpoint handlers."""
import json
import uuid
from sqlalchemy.orm import Session
from app.models.audit_log import AuditLog


def log_action(db: Session, user_id: uuid.UUID, user_role: str, action: str,
                entity_type: str, entity_id: uuid.UUID | None = None,
                old_value: dict | None = None, new_value: dict | None = None):
    entry = AuditLog(
        user_id=user_id,
        user_role=user_role,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        old_value=json.dumps(old_value, default=str) if old_value else None,
        new_value=json.dumps(new_value, default=str) if new_value else None,
    )
    db.add(entry)
    db.commit()
