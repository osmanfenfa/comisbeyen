import uuid
from datetime import date as dt_date, datetime as dt_datetime
from pydantic import BaseModel


class SupplyCreate(BaseModel):
    commodity: str = "cocoa"  # cocoa | coffee | cola
    total_kg: float
    total_bags: int
    water_percent: float = 0.0
    company_name: str
    company_address: str | None = None
    company_contact: str | None = None
    witness_name: str
    date: dt_date | None = None
    price_per_kg: float | None = None
    total_value: float | None = None
    notes: str | None = None


class SupplyOut(BaseModel):
    id: uuid.UUID
    produce_id: uuid.UUID | None = None
    station_name: str | None = None
    created_by: uuid.UUID
    date: dt_date
    commodity: str
    total_kg: float
    total_bags: int
    water_percent: float
    company_name: str
    company_address: str | None = None
    company_contact: str | None = None
    witness_name: str
    price_per_kg: float | None = None
    total_value: float | None = None
    notes: str | None = None
    created_at: dt_datetime
    creator_name: str | None = None

    class Config:
        from_attributes = True
