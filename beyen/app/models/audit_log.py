import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base


class AuditLog(Base):
    """Append-only. Every significant create/approve/reject/edit/delete writes one row here."""
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    produce_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True, index=True)
    user_role: Mapped[str] = mapped_column(String(30))
    action: Mapped[str] = mapped_column(String(50))          # e.g. "approve", "reject", "issue_receipt", "edit"
    entity_type: Mapped[str] = mapped_column(String(50))     # e.g. "CocoaTransaction", "Loan"
    entity_id: Mapped[uuid.UUID] = mapped_column(nullable=True)
    old_value: Mapped[str] = mapped_column(Text, nullable=True)   # JSON snapshot
    new_value: Mapped[str] = mapped_column(Text, nullable=True)   # JSON snapshot
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
