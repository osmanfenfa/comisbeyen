from sqlalchemy import String, Float
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base


class AppSettings(Base):
    """Single-row table holding current prices and the standard moisture %.
    Access via GET /settings/ — never hard-coded in config.
    """
    __tablename__ = "app_settings"

    id: Mapped[str] = mapped_column(String(10), primary_key=True, default="singleton")
    station_name: Mapped[str] = mapped_column(String(120), default="COMIS Buying Station")
    standard_moisture_percent: Mapped[float] = mapped_column(Float, default=7.0)
    cocoa_price_per_kg: Mapped[float] = mapped_column(Float, default=0.0)
    coffee_price_per_kg: Mapped[float] = mapped_column(Float, default=0.0)
    cola_price_per_kg: Mapped[float] = mapped_column(Float, default=0.0)
