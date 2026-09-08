import uuid
from datetime import date, datetime
from sqlalchemy import ForeignKey, Float, Date, DateTime, Enum, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base
from app.models.transaction_status import TransactionStatus


class CocoaTransaction(Base):
    """Moisture-deduction priced commodity. See app/services/pricing.py"""
    __tablename__ = "cocoa_transactions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    seller_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sellers.id"))
    date: Mapped[date] = mapped_column(Date, default=date.today)
    weight_kg: Mapped[float] = mapped_column(Float, nullable=False)
    water_percent: Mapped[float] = mapped_column(Float, nullable=False)
    standard_percent: Mapped[float] = mapped_column(Float, default=7.0)
    price_per_kg: Mapped[float] = mapped_column(Float, nullable=False)
    net_weight_kg: Mapped[float] = mapped_column(Float, nullable=False)
    total_price: Mapped[float] = mapped_column(Float, nullable=False)

    status: Mapped[TransactionStatus] = mapped_column(Enum(TransactionStatus), default=TransactionStatus.pending)
    rejection_reason: Mapped[str] = mapped_column(String(255), nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    produce_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True, index=True)
    station_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    reviewed_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=True)
    approved_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    seller = relationship("Seller", back_populates="cocoa_transactions")

    @property
    def seller_name(self) -> str | None:
        return self.seller.name if self.seller else None

    @property
    def seller_contact(self) -> str | None:
        return self.seller.contact if self.seller else None

    @property
    def seller_code(self) -> str | None:
        return self.seller.seller_id if self.seller else None

    @property
    def is_random_seller(self) -> bool:
        return getattr(self.seller, "is_random", False) if self.seller else False
