import uuid
from datetime import date, datetime
from typing import Optional, List
from pydantic import BaseModel
from app.models.seller import GenderEnum
from app.models.transaction_status import TransactionStatus


class SellerBase(BaseModel):
    name: str
    gender: GenderEnum
    address: str
    gender: GenderEnum = GenderEnum.other
    address: str = "Walk-in"
    contact: str | None = None
    is_random: bool = False


class SellerCreate(SellerBase):
    pass


class SellerEdit(BaseModel):
    """All fields optional for partial update. Secretary cannot set is_active=False."""
    name: str | None = None
    gender: GenderEnum | None = None
    address: str | None = None
    contact: str | None = None
    is_random: bool | None = None


class SellerOut(SellerBase):
    id: uuid.UUID
    seller_id: str | None
    date_registered: date
    is_active: bool
    is_random: bool = False
    created_by: uuid.UUID | None
    produce_id: uuid.UUID | None = None

    class Config:
        from_attributes = True


class TransactionSummary(BaseModel):
    id: uuid.UUID
    date: date
    weight_kg: float
    total_price: float
    status: TransactionStatus

    class Config:
        from_attributes = True


class LoanSummary(BaseModel):
    id: uuid.UUID
    date: date
    loan_taken: float
    balance: float
    status: str

    class Config:
        from_attributes = True


class SellerHistory(BaseModel):
    """Full seller profile — Manager/Admin only."""
    seller: SellerOut
    cocoa_transactions: List[TransactionSummary]
    coffee_transactions: List[TransactionSummary]
    cola_transactions: List[TransactionSummary]
    loans: List[LoanSummary]
    outstanding_loan_balance: float
    total_produce_value: float


class SellerBalanceOut(BaseModel):
    """Secretary-accessible — outstanding balance only (spec section 2.3)."""
    seller_id: str
    outstanding_balance: float
