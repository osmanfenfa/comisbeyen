"""
Reports endpoint. (spec section 12)

Role restrictions:
  Secretary — their own submitted transactions only.
  Manager   — all transactions (own station).
  Admin     — everything across all stations.

Supports JSON response and PDF/Excel export.
"""
import uuid
from datetime import date
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.permissions import require_role
from app.models.user import UserRole
from app.models.cocoa import CocoaTransaction
from app.models.coffee import CoffeeTransaction
from app.models.cola import ColaTransaction
from app.models.loan import Loan
from app.models.receipt import Receipt
from app.models.transaction_status import TransactionStatus
from app.services.pricing import calculate_loan_balance
from app.services.report_export import export_to_pdf, export_to_excel

router = APIRouter()

ANY_STAFF = require_role(UserRole.produce_manager, UserRole.system_admin, UserRole.produce_secretary)
MANAGER_OR_ADMIN = require_role(UserRole.produce_manager, UserRole.system_admin)


def _filter_produce(model, db, current, status=None, seller_id=None,
                    date_from=None, date_to=None):
    query = db.query(model)
    if current["role"] == UserRole.produce_secretary.value:
        query = query.filter(model.created_by == current["id"])
    if seller_id:
        query = query.filter(model.seller_id == seller_id)
    if status:
        query = query.filter(model.status == status)
    if date_from:
        query = query.filter(model.date >= date_from)
    if date_to:
        query = query.filter(model.date <= date_to)
    return query.order_by(model.date.desc()).all()


def _txn_to_dict(txn, commodity: str) -> dict:
    d = {
        "commodity": commodity,
        "id": str(txn.id),
        "seller_id": str(txn.seller_id),
        "date": str(txn.date),
        "weight_kg": txn.weight_kg,
        "total_price": txn.total_price,
        "status": txn.status.value,
        "created_by": str(txn.created_by),
    }
    if hasattr(txn, "water_percent"):
        d["water_percent"] = txn.water_percent
        d["net_weight_kg"] = txn.net_weight_kg
    return d


# ---------------------------------------------------------------------------
# Produce report
# ---------------------------------------------------------------------------

@router.get("/produce")
def produce_report(
    commodity: str | None = None,      # cocoa | coffee | cola | None (all)
    status: TransactionStatus | None = None,
    seller_id: uuid.UUID | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    db: Session = Depends(get_db),
    current=Depends(ANY_STAFF),
):
    """JSON produce report, filterable by commodity, status, seller, date range."""
    rows = []
    if not commodity or commodity == "cocoa":
        rows += [_txn_to_dict(t, "cocoa") for t in
                 _filter_produce(CocoaTransaction, db, current, status, seller_id, date_from, date_to)]
    if not commodity or commodity == "coffee":
        rows += [_txn_to_dict(t, "coffee") for t in
                 _filter_produce(CoffeeTransaction, db, current, status, seller_id, date_from, date_to)]
    if not commodity or commodity == "cola":
        rows += [_txn_to_dict(t, "cola") for t in
                 _filter_produce(ColaTransaction, db, current, status, seller_id, date_from, date_to)]

    total_value = round(sum(r["total_price"] for r in rows), 2)
    total_weight = round(sum(r["weight_kg"] for r in rows), 2)
    return {
        "count": len(rows),
        "total_weight_kg": total_weight,
        "total_value_nle": total_value,
        "transactions": rows,
    }


@router.get("/produce/export")
def produce_report_export(
    format: Literal["pdf", "excel"] = Query("pdf"),
    commodity: str | None = None,
    status: TransactionStatus | None = None,
    seller_id: uuid.UUID | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    db: Session = Depends(get_db),
    current=Depends(MANAGER_OR_ADMIN),
):
    """Export produce report as PDF or Excel. Manager/Admin only. (spec section 12)"""
    rows = []
    if not commodity or commodity == "cocoa":
        rows += [_txn_to_dict(t, "cocoa") for t in
                 _filter_produce(CocoaTransaction, db, current, status, seller_id, date_from, date_to)]
    if not commodity or commodity == "coffee":
        rows += [_txn_to_dict(t, "coffee") for t in
                 _filter_produce(CoffeeTransaction, db, current, status, seller_id, date_from, date_to)]
    if not commodity or commodity == "cola":
        rows += [_txn_to_dict(t, "cola") for t in
                 _filter_produce(ColaTransaction, db, current, status, seller_id, date_from, date_to)]

    title = "COMIS Produce Report"
    columns = ["commodity", "date", "seller_id", "weight_kg", "total_price", "status", "created_by"]

    if format == "pdf":
        data = export_to_pdf(rows, title, columns)
        return Response(
            content=data,
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=produce_report.pdf"},
        )
    else:
        data = export_to_excel(rows, title, columns)
        return Response(
            content=data,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=produce_report.xlsx"},
        )


# ---------------------------------------------------------------------------
# Loans report
# ---------------------------------------------------------------------------

@router.get("/loans")
def loans_report(
    status: str | None = None,
    seller_id: uuid.UUID | None = None,
    db: Session = Depends(get_db),
    current=Depends(MANAGER_OR_ADMIN),
):
    """Loan status report."""
    query = db.query(Loan)
    if seller_id:
        query = query.filter(Loan.seller_id == seller_id)
    if status:
        query = query.filter(Loan.status == status)
    loans = query.all()

    rows = []
    for loan in loans:
        total_paid = sum(r.amount_paid for r in loan.repayments)
        balance = calculate_loan_balance(loan.loan_taken, total_paid)
        rows.append({
            "id": str(loan.id),
            "seller_id": str(loan.seller_id),
            "date": str(loan.date),
            "loan_taken": loan.loan_taken,
            "total_paid": round(total_paid, 2),
            "balance": balance,
            "status": loan.status,
            "due_date": str(loan.due_date) if loan.due_date else None,
        })

    return {
        "count": len(rows),
        "total_loaned": round(sum(r["loan_taken"] for r in rows), 2),
        "total_outstanding": round(sum(r["balance"] for r in rows), 2),
        "loans": rows,
    }


# ---------------------------------------------------------------------------
# Seller statement
# ---------------------------------------------------------------------------

@router.get("/seller/{seller_id}")
def seller_statement(
    seller_id: uuid.UUID,
    date_from: date | None = None,
    date_to: date | None = None,
    db: Session = Depends(get_db),
    current=Depends(MANAGER_OR_ADMIN),
):
    """Per-seller statement: all produce transactions, all loans, receipts."""
    cocoa = _filter_produce(CocoaTransaction, db, current, seller_id=seller_id,
                            date_from=date_from, date_to=date_to)
    coffee = _filter_produce(CoffeeTransaction, db, current, seller_id=seller_id,
                             date_from=date_from, date_to=date_to)
    cola = _filter_produce(ColaTransaction, db, current, seller_id=seller_id,
                           date_from=date_from, date_to=date_to)

    loans = db.query(Loan).filter(Loan.seller_id == seller_id).all()
    loan_rows = []
    for loan in loans:
        total_paid = sum(r.amount_paid for r in loan.repayments)
        balance = calculate_loan_balance(loan.loan_taken, total_paid)
        loan_rows.append({
            "id": str(loan.id), "date": str(loan.date),
            "loan_taken": loan.loan_taken, "total_paid": round(total_paid, 2),
            "balance": balance, "status": loan.status,
        })

    receipts = db.query(Receipt).filter(Receipt.seller_id == seller_id).all()

    return {
        "seller_id": str(seller_id),
        "cocoa_transactions": [_txn_to_dict(t, "cocoa") for t in cocoa],
        "coffee_transactions": [_txn_to_dict(t, "coffee") for t in coffee],
        "cola_transactions": [_txn_to_dict(t, "cola") for t in cola],
        "loans": loan_rows,
        "receipts": [
            {"id": str(r.id), "receipt_number": r.receipt_number,
             "type": r.transaction_type, "net_amount_paid": r.net_amount_paid,
             "issued_at": str(r.issued_at)}
            for r in receipts
        ],
        "total_produce_value": round(
            sum(t.total_price for t in cocoa + coffee + cola), 2
        ),
        "total_outstanding_loans": round(
            sum(row["balance"] for row in loan_rows if row["status"] != "cleared"), 2
        ),
    }
