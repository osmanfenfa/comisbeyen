"""
Coffee purchase workflow — mirrors cocoa.py exactly.
Same moisture-deduction pricing, same two-step approve → issue-receipt flow.
Receipt prefix: COF-
"""
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.permissions import require_role
from app.models.user import UserRole
from app.models.coffee import CoffeeTransaction
from app.models.transaction_status import TransactionStatus
from app.models.receipt import Receipt
from app.models.settings_model import AppSettings
from app.models.loan import Loan
from app.schemas.coffee import (
    CoffeeTransactionCreate, CoffeeTransactionEdit,
    CoffeeTransactionOut, RejectPayload,
)
from app.schemas.receipt import ReceiptOut
from app.services.pricing import calculate_moisture_deduction_price, calculate_loan_balance
from app.services.audit import log_action

router = APIRouter()

MANAGER_OR_ADMIN = require_role(UserRole.produce_manager, UserRole.system_admin)
ANY_STAFF = require_role(UserRole.produce_manager, UserRole.system_admin, UserRole.produce_secretary)


def _get_standard_percent(db: Session) -> float:
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


@router.post("/", response_model=CoffeeTransactionOut, status_code=201)
def record_coffee_purchase(
    payload: CoffeeTransactionCreate,
    db: Session = Depends(get_db),
    current=Depends(ANY_STAFF),
):
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
    txn = CoffeeTransaction(
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
    log_action(db, current["id"], current["role"], "create", "CoffeeTransaction", txn.id,
               new_value=payload.model_dump())
    return txn


@router.put("/{txn_id}", response_model=CoffeeTransactionOut)
def edit_purchase(
    txn_id: uuid.UUID,
    payload: CoffeeTransactionEdit,
    db: Session = Depends(get_db),
    current=Depends(ANY_STAFF),
):
    txn = db.query(CoffeeTransaction).filter(CoffeeTransaction.id == txn_id).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")

    if current["role"] != UserRole.system_admin.value:
        tenant_produce_id = current.get("produce_id") or current["id"]
        if txn.produce_id and txn.produce_id != tenant_produce_id:
            raise HTTPException(status_code=403, detail="Access denied")

    is_secretary = current["role"] == UserRole.produce_secretary.value
    if is_secretary and txn.created_by != current["id"]:
        raise HTTPException(status_code=403, detail="You can only edit your own submissions.")
    if is_secretary and txn.status == TransactionStatus.finalized:
        raise HTTPException(status_code=403, detail="Secretary cannot edit a finalized transaction.")

    if txn.status == TransactionStatus.finalized:
        old_snap = {"weight_kg": txn.weight_kg, "water_percent": txn.water_percent,
                    "price_per_kg": txn.price_per_kg, "net_weight_kg": txn.net_weight_kg,
                    "total_price": txn.total_price}
        standard_percent = _get_standard_percent(db)
        result = _compute(payload, standard_percent)
        txn.weight_kg = payload.weight_kg
        txn.water_percent = payload.water_percent
        txn.price_per_kg = payload.price_per_kg
        txn.net_weight_kg = result["net_weight_kg"]
        txn.total_price = result["total_price"]
        db.commit()
        db.refresh(txn)
        log_action(db, current["id"], current["role"], "correct_finalized", "CoffeeTransaction",
                   txn.id, old_value=old_snap, new_value=payload.model_dump())
        return txn

    if txn.status not in (TransactionStatus.pending, TransactionStatus.rejected):
        raise HTTPException(status_code=400, detail="Only PENDING or REJECTED transactions can be edited.")

    old_snap = {"weight_kg": txn.weight_kg, "water_percent": txn.water_percent, "price_per_kg": txn.price_per_kg}
    standard_percent = _get_standard_percent(db)
    result = _compute(payload, standard_percent)
    txn.weight_kg = payload.weight_kg
    txn.water_percent = payload.water_percent
    txn.price_per_kg = payload.price_per_kg
    txn.net_weight_kg = result["net_weight_kg"]
    txn.total_price = result["total_price"]
    txn.status = TransactionStatus.pending
    txn.rejection_reason = None
    db.commit()
    db.refresh(txn)
    log_action(db, current["id"], current["role"], "resubmit", "CoffeeTransaction",
               txn.id, old_value=old_snap, new_value=payload.model_dump())
    return txn


@router.post("/{txn_id}/approve", response_model=CoffeeTransactionOut)
def approve_purchase(
    txn_id: uuid.UUID,
    db: Session = Depends(get_db),
    current=Depends(ANY_STAFF),
):
    txn = db.query(CoffeeTransaction).filter(CoffeeTransaction.id == txn_id).first()
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
    log_action(db, current["id"], current["role"], "approve", "CoffeeTransaction", txn.id)
    return txn


@router.post("/{txn_id}/reject", response_model=CoffeeTransactionOut)
def reject_purchase(
    txn_id: uuid.UUID,
    payload: RejectPayload,
    db: Session = Depends(get_db),
    current=Depends(ANY_STAFF),
):
    txn = db.query(CoffeeTransaction).filter(CoffeeTransaction.id == txn_id).first()
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
    log_action(db, current["id"], current["role"], "reject", "CoffeeTransaction", txn.id,
               new_value={"reason": payload.reason})
    return txn


@router.post("/{txn_id}/issue-receipt", response_model=ReceiptOut)
def issue_receipt(
    txn_id: uuid.UUID,
    loan_deduction: float = 0.0,
    db: Session = Depends(get_db),
    current=Depends(ANY_STAFF),
):
    txn = db.query(CoffeeTransaction).filter(CoffeeTransaction.id == txn_id).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if current["role"] != UserRole.system_admin.value:
        tenant_produce_id = current.get("produce_id") or current["id"]
        if txn.produce_id and txn.produce_id != tenant_produce_id:
            raise HTTPException(status_code=403, detail="Access denied")
    if txn.status != TransactionStatus.approved:
        raise HTTPException(status_code=400,
                            detail="Transaction must be APPROVED before a receipt can be issued.")
    if loan_deduction > txn.total_price:
        raise HTTPException(status_code=400, detail="Loan deduction cannot exceed the gross amount.")

    txn.status = TransactionStatus.finalized
    db.commit()

    from app.services.receipt_helper import issue_and_create_receipt
    receipt_out = issue_and_create_receipt(
        db=db,
        txn=txn,
        transaction_type="coffee",
        prefix="COF",
        current=current,
        loan_deduction=loan_deduction,
    )
    action = "issue_receipt_admin_override" if current["role"] == UserRole.system_admin.value else "issue_receipt"
    log_action(db, current["id"], current["role"], action, "Receipt", receipt_out.id,
               new_value={"transaction_id": str(txn.id), "net_amount_paid": receipt_out.net_amount_paid})
    return receipt_out



@router.get("/", response_model=list[CoffeeTransactionOut])
def list_coffee_purchases(
    status: TransactionStatus | None = None,
    seller_id: uuid.UUID | None = None,
    station: str | None = None,
    db: Session = Depends(get_db),
    current=Depends(ANY_STAFF),
):
    query = db.query(CoffeeTransaction)

    # Tenant isolation
    if current["role"] != UserRole.system_admin.value:
        tenant_produce_id = current.get("produce_id") or current["id"]
        query = query.filter(CoffeeTransaction.produce_id == tenant_produce_id)

        # Secretary sees their station or own submissions
        if current["role"] == UserRole.produce_secretary.value:
            if current.get("station_name"):
                query = query.filter(
                    (CoffeeTransaction.station_name == current["station_name"]) |
                    (CoffeeTransaction.created_by == current["id"])
                )
            else:
                query = query.filter(CoffeeTransaction.created_by == current["id"])

    if station:
        query = query.filter(CoffeeTransaction.station_name == station)
    if status:
        query = query.filter(CoffeeTransaction.status == status)
    if seller_id:
        query = query.filter(CoffeeTransaction.seller_id == seller_id)
    return query.order_by(CoffeeTransaction.date.desc()).all()


@router.get("/{txn_id}", response_model=CoffeeTransactionOut)
def get_coffee_purchase(txn_id: uuid.UUID, db: Session = Depends(get_db), current=Depends(ANY_STAFF)):
    txn = db.query(CoffeeTransaction).filter(CoffeeTransaction.id == txn_id).first()
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
