import enum


class TransactionStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"      # brief intermediate state before finalization/receipt
    rejected = "rejected"
    finalized = "finalized"    # receipt issued
