"""
Cocoa purchase workflow. (spec sections 5, 8)

Transaction states:
  PENDING   — created by any staff; awaits Manager review
  APPROVED  — Manager has approved; brief intermediate before receipt
  REJECTED  — Manager rejected with a reason; Secretary corrects and resubmits
  FINALIZED — receipt issued; immutable (edits are logged)

Two-step approval:
  1. POST /{id}/approve  → status = APPROVED
  2. POST /{id}/issue-receipt → creates Receipt, status = FINALIZED
"""
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.permissions import require_role
from app.models.user import UserRole
from app.models.cocoa import CocoaTransaction
from app.models.transaction_status import TransactionStatus
from app.models.receipt import Receipt
from app.models.settings_model import AppSettings
from app.schemas.cocoa import CocoaTransactionCreate, CocoaTransactionEdit, CocoaTransactionOut, RejectPayload
from app.schemas.receipt import ReceiptOut
from app.services.pricing import calculate_moisture_deduction_price, calculate_loan_balance
from app.models.loan import Loan
from app.services.audit import log_action

router = APIRouter()

MANAGER_OR_ADMIN = require_role(UserRole.produce_manager, UserRole.system_admin)
ANY_STAFF = require_role(UserRole.produce_manager, UserRole.system_admin, UserRole.produce_secretary)


def _get_standard_percent(db: Session) -> float:
    """Always read from DB settings, not from config (admin can change it at runtime)."""
    row = db.query(AppSettings).filter(AppSettings.id == "singleton").first()
    return row.standard_moisture_percent if row else 7.0


def _compute(payload, standard_percent: float):
    try:
        return calculate_moisture_deduction_price(
            weight_kg=payload.weight_kg,
            water_percent=payload.water_percent,
            standard_percent=standard_percent,
            price_per_kg=payload.price_per_kg,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


def _get_outstanding_balance(seller_id, db: Session) -> float:
    loans = db.query(Loan).filter(Loan.seller_id == seller_id, Loan.status != "cleared").all()
    return sum(
        calculate_loan_balance(loan.loan_taken, sum(r.amount_paid for r in loan.repayments))
        for loan in loans
    )


# ---------------------------------------------------------------------------
# Create
# ---------------------------------------------------------------------------

@router.post("/", response_model=CocoaTransactionOut, status_code=201)
def record_cocoa_purchase(
    payload: CocoaTransactionCreate,
    db: Session = Depends(get_db),
    current=Depends(ANY_STAFF),
):
    """
    Any staff role can record a purchase; it always starts as PENDING.
    Even a Manager-recorded purchase is PENDING — the audit principle requires
    a deliberate approval step. (spec section 5, business rule 4)
    """
    standard_percent = _get_standard_percent(db)
    result = _compute(payload, standard_percent)

    tenant_produce_id = current.get("produce_id") or current["id"]

    seller_id = payload.seller_id
    if not seller_id:
        if payload.random_seller_name:
            from app.models.seller import Seller, GenderEnum
            from app.api.v1.endpoints.sellers import _generate_seller_id
            seller_code = _generate_seller_id(db)
            rnd_seller = Seller(
                seller_id=seller_code,
                name=payload.random_seller_name.strip(),
                contact=payload.random_seller_contact.strip() if payload.random_seller_contact else None,
                address="Walk-in / Random",
                gender=GenderEnum.other,
                is_random=True,
                produce_id=tenant_produce_id,
                created_by=current["id"],
            )
            db.add(rnd_seller)
            db.commit()
            db.refresh(rnd_seller)
            seller_id = rnd_seller.id
        else:
            raise HTTPException(status_code=400, detail="Either a seller_id or random_seller_name must be provided.")

    txn_data = payload.model_dump(exclude={"random_seller_name", "random_seller_contact", "seller_id"})
    txn = CocoaTransaction(
        seller_id=seller_id,
        **txn_data,
        standard_percent=standard_percent,
        net_weight_kg=result["net_weight_kg"],
        total_price=result["total_price"],
        status=TransactionStatus.pending,
        produce_id=tenant_produce_id,
        station_name=current.get("station_name"),
        created_by=current["id"],
    )
    db.add(txn)
    db.commit()
    db.refresh(txn)
    log_action(db, current["id"], current["role"], "create", "CocoaTransaction", txn.id,
               new_value=payload.model_dump())
    return txn


# ---------------------------------------------------------------------------
# Edit (PENDING own, or REJECTED)
# ---------------------------------------------------------------------------

@router.put("/{txn_id}", response_model=CocoaTransactionOut)
def edit_purchase(
    txn_id: uuid.UUID,
    payload: CocoaTransactionEdit,
    db: Session = Depends(get_db),
    current=Depends(ANY_STAFF),
):
    """
    Secretary: edit own PENDING or REJECTED transactions and resubmit.
    Manager/Admin: edit any PENDING or REJECTED transaction.
    FINALIZED transactions can only be edited by Manager/Admin (logged as correction).
    (spec section 2.4, 5)
    """
    txn = db.query(CocoaTransaction).filter(CocoaTransaction.id == txn_id).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")

    if current["role"] != UserRole.system_admin.value:
        tenant_produce_id = current.get("produce_id") or current["id"]
        if txn.produce_id and txn.produce_id != tenant_produce_id:
            raise HTTPException(status_code=403, detail="Access denied")

    is_secretary = current["role"] == UserRole.produce_secretary.value

    # Secretary ownership check
    if is_secretary and txn.created_by != current["id"]:
        raise HTTPException(status_code=403, detail="You can only edit your own submissions.")

    # Secretary cannot touch finalized transactions
    if is_secretary and txn.status == TransactionStatus.finalized:
        raise HTTPException(status_code=403, detail="Secretary cannot edit a finalized transaction.")

    # Manager/Admin editing a finalized transaction — log as correction
    if txn.status == TransactionStatus.finalized:
        old_snap = {
            "weight_kg": txn.weight_kg, "water_percent": txn.water_percent,
            "price_per_kg": txn.price_per_kg, "net_weight_kg": txn.net_weight_kg,
            "total_price": txn.total_price,
        }
        standard_percent = _get_standard_percent(db)
        result = _compute(payload, standard_percent)
        txn.weight_kg = payload.weight_kg
        if payload.bags is not None:
            txn.bags = payload.bags
        txn.water_percent = payload.water_percent
        txn.price_per_kg = payload.price_per_kg
        txn.net_weight_kg = result["net_weight_kg"]
        txn.total_price = result["total_price"]
        db.commit()
        db.refresh(txn)
        log_action(db, current["id"], current["role"], "correct_finalized", "CocoaTransaction",
                   txn.id, old_value=old_snap, new_value=payload.model_dump())
        return txn

    # Normal edit of PENDING / REJECTED
    if txn.status not in (TransactionStatus.pending, TransactionStatus.rejected):
        raise HTTPException(status_code=400, detail="Only PENDING or REJECTED transactions can be edited.")

    old_snap = {
        "weight_kg": txn.weight_kg, "bags": txn.bags, "water_percent": txn.water_percent,
        "price_per_kg": txn.price_per_kg,
    }
    standard_percent = _get_standard_percent(db)
    result = _compute(payload, standard_percent)
    txn.weight_kg = payload.weight_kg
    if payload.bags is not None:
        txn.bags = payload.bags
    txn.water_percent = payload.water_percent
    txn.price_per_kg = payload.price_per_kg
    txn.net_weight_kg = result["net_weight_kg"]
    txn.total_price = result["total_price"]
    txn.status = TransactionStatus.pending   # resubmit — flip back to pending
    txn.rejection_reason = None
    db.commit()
    db.refresh(txn)
    log_action(db, current["id"], current["role"], "resubmit", "CocoaTransaction",
               txn.id, old_value=old_snap, new_value=payload.model_dump())
    return txn


# ---------------------------------------------------------------------------
# Approve / Reject (Manager / Admin)
# ---------------------------------------------------------------------------

@router.post("/{txn_id}/approve", response_model=CocoaTransactionOut)
def approve_purchase(
    txn_id: uuid.UUID,
    db: Session = Depends(get_db),
    current=Depends(ANY_STAFF),
):
    """
    Step 1 of 2 in the approval flow.
    Sets status = APPROVED (brief intermediate). A receipt must then be issued
    (step 2) which sets status = FINALIZED. (spec section 5)
    """
    txn = db.query(CocoaTransaction).filter(CocoaTransaction.id == txn_id).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if current["role"] != UserRole.system_admin.value:
        tenant_produce_id = current.get("produce_id") or current["id"]
        if txn.produce_id and txn.produce_id != tenant_produce_id:
            raise HTTPException(status_code=403, detail="Access denied")
    if txn.status != TransactionStatus.pending:
        raise HTTPException(status_code=400, detail="Only PENDING transactions can be approved.")

    txn.status = TransactionStatus.approved
    txn.reviewed_by = current["id"]
    txn.approved_at = datetime.utcnow()
    db.commit()
    db.refresh(txn)
    log_action(db, current["id"], current["role"], "approve", "CocoaTransaction", txn.id)
    return txn


@router.post("/{txn_id}/reject", response_model=CocoaTransactionOut)
def reject_purchase(
    txn_id: uuid.UUID,
    payload: RejectPayload,
    db: Session = Depends(get_db),
    current=Depends(ANY_STAFF),
):
    """
    Rejected transactions are NOT deleted — they stay with status=REJECTED and
    the reason attached. The Secretary corrects and resubmits. (spec section 5)
    """
    txn = db.query(CocoaTransaction).filter(CocoaTransaction.id == txn_id).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if current["role"] != UserRole.system_admin.value:
        tenant_produce_id = current.get("produce_id") or current["id"]
        if txn.produce_id and txn.produce_id != tenant_produce_id:
            raise HTTPException(status_code=403, detail="Access denied")
    if txn.status not in (TransactionStatus.pending, TransactionStatus.approved):
        raise HTTPException(status_code=400, detail="Only PENDING or APPROVED transactions can be rejected.")

    txn.status = TransactionStatus.rejected
    txn.rejection_reason = payload.reason
    txn.reviewed_by = current["id"]
    db.commit()
    db.refresh(txn)
    log_action(db, current["id"], current["role"], "reject", "CocoaTransaction", txn.id,
               new_value={"reason": payload.reason})
    return txn


# ---------------------------------------------------------------------------
# Issue Receipt (step 2 — Manager / Secretary / Admin)
# ---------------------------------------------------------------------------

@router.post("/{txn_id}/issue-receipt", response_model=ReceiptOut)
def issue_receipt(
    txn_id: uuid.UUID,
    loan_deduction: float = 0.0,
    db: Session = Depends(get_db),
    current=Depends(ANY_STAFF),
):
    """
    Step 2 of 2.  Creates the Receipt and sets status = FINALIZED.
    Only the Manager issues a receipt; Admin use is an emergency override (logged). (spec section 11)
    loan_deduction — optional amount deducted from gross if the seller has an active loan.
    """
    txn = db.query(CocoaTransaction).filter(CocoaTransaction.id == txn_id).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if current["role"] != UserRole.system_admin.value:
        tenant_produce_id = current.get("produce_id") or current["id"]
        if txn.produce_id and txn.produce_id != tenant_produce_id:
            raise HTTPException(status_code=403, detail="Access denied")
    if txn.status != TransactionStatus.approved:
        raise HTTPException(
            status_code=400,
            detail="Transaction must be in APPROVED state before a receipt can be issued. "
                   "Approve the transaction first.",
        )

    # Deduction must not exceed the gross amount
    if loan_deduction > txn.total_price:
        raise HTTPException(status_code=400, detail="Loan deduction cannot exceed the gross amount.")

    txn.status = TransactionStatus.finalized
    db.commit()

    from app.services.receipt_helper import issue_and_create_receipt
    receipt_out = issue_and_create_receipt(
        db=db,
        txn=txn,
        transaction_type="cocoa",
        prefix="COC",
        current=current,
        loan_deduction=loan_deduction,
    )
    action = "issue_receipt_admin_override" if current["role"] == UserRole.system_admin.value else "issue_receipt"
    log_action(db, current["id"], current["role"], action, "Receipt", receipt_out.id,
               new_value={"transaction_id": str(txn.id), "net_amount_paid": receipt_out.net_amount_paid})
    return receipt_out



# ---------------------------------------------------------------------------
# Reads
# ---------------------------------------------------------------------------

@router.get("/", response_model=list[CocoaTransactionOut])
def list_cocoa_purchases(
    status: TransactionStatus | None = None,
    seller_id: uuid.UUID | None = None,
    station: str | None = None,
    db: Session = Depends(get_db),
    current=Depends(ANY_STAFF),
):
    query = db.query(CocoaTransaction)

    # Tenant isolation: Only Admin can see across different Produce accounts
    if current["role"] != UserRole.system_admin.value:
        tenant_produce_id = current.get("produce_id") or current["id"]
        query = query.filter(CocoaTransaction.produce_id == tenant_produce_id)

        # Secretary sees their assigned station or their own submissions
        if current["role"] == UserRole.produce_secretary.value:
            if current.get("station_name"):
                query = query.filter(
                    (CocoaTransaction.station_name == current["station_name"]) |
                    (CocoaTransaction.created_by == current["id"])
                )
            else:
                query = query.filter(CocoaTransaction.created_by == current["id"])

    if station:
        query = query.filter(CocoaTransaction.station_name == station)
    if status:
        query = query.filter(CocoaTransaction.status == status)
    if seller_id:
        query = query.filter(CocoaTransaction.seller_id == seller_id)
    return query.order_by(CocoaTransaction.date.desc()).all()


@router.get("/{txn_id}", response_model=CocoaTransactionOut)
def get_cocoa_purchase(txn_id: uuid.UUID, db: Session = Depends(get_db), current=Depends(ANY_STAFF)):
    txn = db.query(CocoaTransaction).filter(CocoaTransaction.id == txn_id).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if current["role"] != UserRole.system_admin.value:
        tenant_produce_id = current.get("produce_id") or current["id"]
        if txn.produce_id and txn.produce_id != tenant_produce_id:
            raise HTTPException(status_code=403, detail="Access denied")
    if current["role"] == UserRole.produce_secretary.value:
        if current.get("station_name") and txn.station_name != current["station_name"] and txn.created_by != current["id"]:
            raise HTTPException(status_code=403, detail="Access denied")
    return txn
