"""
Seller management. (spec sections 7, 2.4)

Registration and search: all roles.
Edit: all roles (Secretary cannot deactivate).
Deactivate (soft-delete): Manager / Admin only.
History / full profile: Manager / Admin.
Balance-only view: all roles (exposed on the seller lookup endpoint).
"""
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.permissions import require_role
from app.models.user import UserRole
from app.models.seller import Seller
from app.models.loan import Loan
from app.schemas.seller import SellerCreate, SellerEdit, SellerOut, SellerHistory, SellerBalanceOut
from app.schemas.seller import TransactionSummary, LoanSummary
from app.services.pricing import calculate_loan_balance
from app.services.audit import log_action

router = APIRouter()

MANAGER_OR_ADMIN = require_role(UserRole.produce_manager, UserRole.system_admin)
ANY_STAFF = require_role(UserRole.produce_manager, UserRole.system_admin, UserRole.produce_secretary)


def _generate_seller_id(db: Session) -> str:
    """Auto-generate a human-readable Seller ID: SL-000001, SL-000002, …"""
    count = db.query(Seller).count()
    return f"SL-{count + 1:06d}"


def _loan_balance(loan: Loan) -> float:
    total_paid = sum(r.amount_paid for r in loan.repayments)
    return calculate_loan_balance(loan.loan_taken, total_paid)


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------

@router.post("/", response_model=SellerOut, status_code=201)
def register_seller(
    payload: SellerCreate,
    db: Session = Depends(get_db),
    current=Depends(ANY_STAFF),
):
    """Any staff role can register a new seller under their Produce Business."""
    if current["role"] == UserRole.system_admin.value:
        raise HTTPException(
            status_code=403,
            detail="System Admin does not register sellers. Only Produce Managers and Secretaries can register sellers."
        )
    tenant_produce_id = current.get("produce_id") or current["id"]
    seller_id = _generate_seller_id(db)
    seller = Seller(
        **payload.model_dump(),
        seller_id=seller_id,
        produce_id=tenant_produce_id,
        created_by=current["id"],
    )
    db.add(seller)
    db.commit()
    db.refresh(seller)
    log_action(db, current["id"], current["role"], "register_seller", "Seller", seller.id,
               new_value={"name": payload.name, "seller_id": seller_id})
    return seller


@router.get("/", response_model=list[SellerOut])
def list_sellers(
    search: str | None = None,
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    current=Depends(ANY_STAFF),
):
    """Search sellers under this Produce Business. Active only by default."""
    query = db.query(Seller)
    if current["role"] != UserRole.system_admin.value:
        tenant_produce_id = current.get("produce_id") or current["id"]
        query = query.filter(Seller.produce_id == tenant_produce_id)
    if not include_inactive:
        query = query.filter(Seller.is_active == True)
    if search:
        query = query.filter(Seller.name.ilike(f"%{search}%"))
    return query.order_by(Seller.date_registered.desc()).all()


@router.get("/{seller_id}", response_model=SellerOut)
def get_seller(seller_id: uuid.UUID, db: Session = Depends(get_db), current=Depends(ANY_STAFF)):
    seller = db.query(Seller).filter(Seller.id == seller_id).first()
    if not seller:
        raise HTTPException(status_code=404, detail="Seller not found")
    if current["role"] != UserRole.system_admin.value:
        tenant_produce_id = current.get("produce_id") or current["id"]
        if seller.produce_id and seller.produce_id != tenant_produce_id:
            raise HTTPException(status_code=403, detail="Access denied")
    return seller


@router.put("/{seller_id}", response_model=SellerOut)
def edit_seller(
    seller_id: uuid.UUID,
    payload: SellerEdit,
    db: Session = Depends(get_db),
    current=Depends(ANY_STAFF),
):
    """Any staff can edit seller details. Secretary cannot deactivate. (spec section 2.4)"""
    seller = db.query(Seller).filter(Seller.id == seller_id).first()
    if not seller:
        raise HTTPException(status_code=404, detail="Seller not found")
    if current["role"] != UserRole.system_admin.value:
        tenant_produce_id = current.get("produce_id") or current["id"]
        if seller.produce_id and seller.produce_id != tenant_produce_id:
            raise HTTPException(status_code=403, detail="Access denied")

    old_values = {
        "name": seller.name, "gender": seller.gender,
        "address": seller.address, "contact": seller.contact,
    }
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(seller, field, value)

    db.commit()
    db.refresh(seller)
    log_action(db, current["id"], current["role"], "edit_seller", "Seller", seller.id,
               old_value=old_values, new_value=update_data)
    return seller


@router.post("/{seller_id}/deactivate", response_model=SellerOut)
def deactivate_seller(
    seller_id: uuid.UUID,
    db: Session = Depends(get_db),
    current=Depends(MANAGER_OR_ADMIN),
):
    """Soft-delete: Manager / Admin only. (spec section 2.4)"""
    seller = db.query(Seller).filter(Seller.id == seller_id).first()
    if not seller:
        raise HTTPException(status_code=404, detail="Seller not found")
    if current["role"] != UserRole.system_admin.value:
        tenant_produce_id = current.get("produce_id") or current["id"]
        if seller.produce_id and seller.produce_id != tenant_produce_id:
            raise HTTPException(status_code=403, detail="Access denied")
    if not seller.is_active:
        raise HTTPException(status_code=400, detail="Seller is already inactive.")

    seller.is_active = False
    db.commit()
    db.refresh(seller)
    log_action(db, current["id"], current["role"], "deactivate_seller", "Seller", seller.id)
    return seller


@router.post("/{seller_id}/reactivate", response_model=SellerOut)
def reactivate_seller(
    seller_id: uuid.UUID,
    db: Session = Depends(get_db),
    current=Depends(MANAGER_OR_ADMIN),
):
    seller = db.query(Seller).filter(Seller.id == seller_id).first()
    if not seller:
        raise HTTPException(status_code=404, detail="Seller not found")
    if current["role"] != UserRole.system_admin.value:
        tenant_produce_id = current.get("produce_id") or current["id"]
        if seller.produce_id and seller.produce_id != tenant_produce_id:
            raise HTTPException(status_code=403, detail="Access denied")
    seller.is_active = True
    db.commit()
    db.refresh(seller)
    log_action(db, current["id"], current["role"], "reactivate_seller", "Seller", seller.id)
    return seller


# ---------------------------------------------------------------------------
# Profile history (Manager / Admin)
# ---------------------------------------------------------------------------

@router.get("/{seller_id}/history", response_model=SellerHistory)
def seller_history(
    seller_id: uuid.UUID,
    db: Session = Depends(get_db),
    current=Depends(MANAGER_OR_ADMIN),
):
    """Full seller profile — all transactions, loans, balance. (spec section 7)"""
    seller = db.query(Seller).filter(Seller.id == seller_id).first()
    if not seller:
        raise HTTPException(status_code=404, detail="Seller not found")
    if current["role"] != UserRole.system_admin.value:
        tenant_produce_id = current.get("produce_id") or current["id"]
        if seller.produce_id and seller.produce_id != tenant_produce_id:
            raise HTTPException(status_code=403, detail="Access denied")

    # Build loan summaries with computed balance
    loan_summaries = []
    total_outstanding = 0.0
    for loan in seller.loans:
        bal = _loan_balance(loan)
        if loan.status != "cleared":
            total_outstanding += bal
        loan_summaries.append(LoanSummary(
            id=loan.id, date=loan.date,
            loan_taken=loan.loan_taken, balance=bal, status=loan.status,
        ))

    total_produce = sum(t.total_price for t in seller.cocoa_transactions if t.status.value == "finalized")
    total_produce += sum(t.total_price for t in seller.coffee_transactions if t.status.value == "finalized")
    total_produce += sum(t.total_price for t in seller.cola_transactions if t.status.value == "finalized")

    return SellerHistory(
        seller=SellerOut.model_validate(seller),
        cocoa_transactions=[TransactionSummary.model_validate(t) for t in seller.cocoa_transactions],
        coffee_transactions=[TransactionSummary.model_validate(t) for t in seller.coffee_transactions],
        cola_transactions=[TransactionSummary.model_validate(t) for t in seller.cola_transactions],
        loans=loan_summaries,
        outstanding_loan_balance=round(total_outstanding, 2),
        total_produce_value=round(total_produce, 2),
    )


@router.get("/{seller_id}/balance", response_model=SellerBalanceOut)
def seller_balance(
    seller_id: uuid.UUID,
    db: Session = Depends(get_db),
    current=Depends(ANY_STAFF),
):
    """
    Secretary-accessible — returns the outstanding loan balance ONLY.
    The Secretary sees this number on the seller lookup screen while recording a sale.
    No other loan detail is exposed. (spec section 2.3, 2.4)
    """
    seller = db.query(Seller).filter(Seller.id == seller_id).first()
    if not seller:
        raise HTTPException(status_code=404, detail="Seller not found")
    if current["role"] != UserRole.system_admin.value:
        tenant_produce_id = current.get("produce_id") or current["id"]
        if seller.produce_id and seller.produce_id != tenant_produce_id:
            raise HTTPException(status_code=403, detail="Access denied")

    outstanding = sum(
        _loan_balance(loan) for loan in seller.loans if loan.status != "cleared"
    )
    return SellerBalanceOut(seller_id=str(seller.id), outstanding_balance=round(outstanding, 2))
