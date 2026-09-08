import uuid
from datetime import date, datetime
from pydantic import BaseModel
from app.models.transaction_status import TransactionStatus


class ColaTransactionCreate(BaseModel):
    seller_id: uuid.UUID
    seller_id: uuid.UUID | None = None
    random_seller_name: str | None = None
    random_seller_contact: str | None = None
    date: date
    weight_kg: float
    price_per_kg: float
    manual_total_override: float | None = None  # if set, overrides calculated total


class ColaTransactionEdit(BaseModel):
    """Used to correct a REJECTED or PENDING transaction before (re)submitting."""
    weight_kg: float
    price_per_kg: float
    manual_total_override: float | None = None


class RejectPayload(BaseModel):
    reason: str


class ColaTransactionOut(BaseModel):
    id: uuid.UUID
    seller_id: uuid.UUID
    date: date
    weight_kg: float
    price_per_kg: float
    total_price: float
    status: TransactionStatus
    rejection_reason: str | None
    created_by: uuid.UUID
    reviewed_by: uuid.UUID | None
    approved_at: datetime | None
    created_at: datetime
    # Seller info
    seller_name: str | None = None
    seller_contact: str | None = None
    seller_code: str | None = None
    is_random_seller: bool = False
    produce_id: uuid.UUID | None = None
    station_name: str | None = None

    class Config:
        from_attributes = True
