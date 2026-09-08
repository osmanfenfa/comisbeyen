import uuid
from datetime import datetime
from pydantic import BaseModel


class AuditLogOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    user_role: str
    action: str
    entity_type: str
    entity_id: uuid.UUID | None
    old_value: str | None   # JSON string snapshot
    new_value: str | None   # JSON string snapshot
    timestamp: datetime

    class Config:
        from_attributes = True
