"""
Dashboard summary endpoint. (spec section 6)

Role-aware aggregation:
  Manager  — today's station totals, pending transactions, overdue loans, receipts today
  Secretary — today's own submissions with status breakdown
  Admin    — system-wide totals, pending approvals, all-station overview
"""
from datetime import date, datetime, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.permissions import require_role
from app.models.user import User, UserRole, UserStatus
from app.models.seller import Seller
from app.models.cocoa import CocoaTransaction
from app.models.coffee import CoffeeTransaction
from app.models.cola import ColaTransaction
from app.models.loan import Loan
from app.models.receipt import Receipt
from app.models.transaction_status import TransactionStatus

router = APIRouter()

ANY_STAFF = require_role(UserRole.produce_manager, UserRole.system_admin, UserRole.produce_secretary)


def _txn_today_stats(model, db: Session, created_by_filter=None):
    """Count and sum today's transactions for a commodity model."""
    today = date.today()
    query = db.query(model).filter(func.date(model.created_at) == today)
    if created_by_filter:
        query = query.filter(model.created_by == created_by_filter)
    txns = query.all()
    return {
        "count": len(txns),
        "total_weight_kg": round(sum(t.weight_kg for t in txns), 2),
        "total_value": round(sum(t.total_price for t in txns), 2),
        "pending": sum(1 for t in txns if t.status == TransactionStatus.pending),
        "approved": sum(1 for t in txns if t.status == TransactionStatus.approved),
        "rejected": sum(1 for t in txns if t.status == TransactionStatus.rejected),
        "finalized": sum(1 for t in txns if t.status == TransactionStatus.finalized),
    }


@router.get("/summary")
def dashboard_summary(db: Session = Depends(get_db), current=Depends(ANY_STAFF)):
    today = date.today()
    role = current["role"]

    if role == UserRole.produce_secretary.value:
        # Secretary sees only their own today's submissions
        uid = current["id"]
        return {
            "role": role,
            "date": str(today),
            "cocoa": _txn_today_stats(CocoaTransaction, db, created_by_filter=uid),
            "coffee": _txn_today_stats(CoffeeTransaction, db, created_by_filter=uid),
            "cola": _txn_today_stats(ColaTransaction, db, created_by_filter=uid),
        }

    if role == UserRole.produce_manager.value:
        cocoa = _txn_today_stats(CocoaTransaction, db)
        coffee = _txn_today_stats(CoffeeTransaction, db)
        cola = _txn_today_stats(ColaTransaction, db)

        pending_total = (cocoa["pending"] + coffee["pending"] + cola["pending"])
        receipts_today = (
            db.query(Receipt)
            .filter(func.date(Receipt.issued_at) == today)
            .count()
        )
        cash_out_today = round(
            db.query(func.sum(Receipt.net_amount_paid))
            .filter(func.date(Receipt.issued_at) == today)
            .scalar() or 0.0, 2
        )
        outstanding_loans = (
            db.query(Loan)
            .filter(Loan.status.in_(["active", "overdue"]))
            .count()
        )
        overdue_loans = db.query(Loan).filter(Loan.status == "overdue").count()

        return {
            "role": role,
            "date": str(today),
            "cocoa": cocoa,
            "coffee": coffee,
            "cola": cola,
            "pending_transactions_total": pending_total,
            "receipts_issued_today": receipts_today,
            "cash_paid_out_today": cash_out_today,
            "outstanding_loans": outstanding_loans,
            "overdue_loans": overdue_loans,
        }

    # System Admin — system-wide
    total_managers = db.query(User).filter(User.role == UserRole.produce_manager).count()
    total_secretaries = db.query(User).filter(User.role == UserRole.produce_secretary).count()
    pending_account_approvals = (
        db.query(User)
        .filter(User.role == UserRole.produce_manager, User.status == UserStatus.pending)
        .count()
    )
    total_sellers = db.query(Seller).filter(Seller.is_active == True).count()

    cocoa = _txn_today_stats(CocoaTransaction, db)
    coffee = _txn_today_stats(CoffeeTransaction, db)
    cola = _txn_today_stats(ColaTransaction, db)
    pending_txns = cocoa["pending"] + coffee["pending"] + cola["pending"]

    total_outstanding_loans = db.query(Loan).filter(Loan.status.in_(["active", "overdue"])).count()

    return {
        "role": role,
        "date": str(today),
        "total_managers": total_managers,
        "total_secretaries": total_secretaries,
        "pending_account_approvals": pending_account_approvals,
        "total_active_sellers": total_sellers,
        "today_cocoa": cocoa,
        "today_coffee": coffee,
        "today_cola": cola,
        "pending_transactions_all_stations": pending_txns,
        "outstanding_loans": total_outstanding_loans,
    }
