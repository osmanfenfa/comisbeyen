from pydantic import BaseModel


class SettingsOut(BaseModel):
    id: str
    station_name: str
    standard_moisture_percent: float
    cocoa_price_per_kg: float
    coffee_price_per_kg: float
    cola_price_per_kg: float

    class Config:
        from_attributes = True


class SettingsUpdate(BaseModel):
    """
    Admin can update all fields.
    Manager can update operational prices only (standard_moisture_percent is admin-only).
    The endpoint enforces this distinction server-side.
    """
    station_name: str | None = None
    standard_moisture_percent: float | None = None  # Admin only
    cocoa_price_per_kg: float | None = None
    coffee_price_per_kg: float | None = None
    cola_price_per_kg: float | None = None
