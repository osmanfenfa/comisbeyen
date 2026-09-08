import uuid
from sqlalchemy.orm import Session
from app.models.receipt import Receipt
from app.models.seller import Seller
from app.models.user import User, UserRole
from app.models.settings_model import AppSettings
from app.models.cocoa import CocoaTransaction
from app.models.coffee import CoffeeTransaction
from app.models.cola import ColaTransaction
from app.schemas.receipt import ReceiptOut


def format_receipt_out(receipt: Receipt, db: Session) -> ReceiptOut:
    """
    Format a Receipt ORM instance into the full detailed ReceiptOut schema,
    hydrating produce account details, seller details (especially random seller name & number),
    and produce item details from snapshot columns or dynamic fallback joins.
    """
    seller = db.query(Seller).filter(Seller.id == receipt.seller_id).first()
    issuer = db.query(User).filter(User.id == receipt.issued_by).first() if receipt.issued_by else None
    recorder = db.query(User).filter(User.id == receipt.recorded_by).first() if receipt.recorded_by else None
    settings = db.query(AppSettings).filter(AppSettings.id == "singleton").first()

    # Produce Account
    st_name = (
        receipt.station_name
        or (issuer.station_name if issuer else None)
        or (settings.station_name if settings else None)
        or "COMIS Produce Station"
    )
    biz_name = (
        receipt.business_name
        or (issuer.business_name if issuer else None)
        or st_name
    )
    biz_addr = (
        receipt.business_address
        or (issuer.address if issuer else None)
        or ""
    )
    biz_phone = (
        receipt.business_phone
        or (issuer.phone_number if issuer else None)
        or (issuer.contact if issuer else "")
    )

    # Seller Info
    seller_name = receipt.seller_name_snapshot or (seller.name if seller else "Unknown Seller")
    seller_contact = receipt.seller_contact_snapshot or (seller.contact if seller else None)
    seller_code = seller.seller_id if seller else None
    is_random = getattr(seller, "is_random", False) if seller else False

    # Item Details
    weight_kg = receipt.weight_kg
    water_percent = receipt.water_percent
    standard_percent = receipt.standard_percent
    net_weight_kg = receipt.net_weight_kg
    price_per_kg = receipt.price_per_kg

    # Fallback to transaction if snapshot fields weren't populated
    if weight_kg is None or net_weight_kg is None:
        ttype = receipt.transaction_type.lower()
        txn = None
        if ttype == "cocoa":
            txn = db.query(CocoaTransaction).filter(CocoaTransaction.id == receipt.transaction_id).first()
        elif ttype == "coffee":
            txn = db.query(CoffeeTransaction).filter(CoffeeTransaction.id == receipt.transaction_id).first()
        elif ttype == "cola":
            txn = db.query(ColaTransaction).filter(ColaTransaction.id == receipt.transaction_id).first()

        if txn:
            weight_kg = weight_kg or txn.weight_kg
            water_percent = water_percent or getattr(txn, "water_percent", None)
            standard_percent = standard_percent or getattr(txn, "standard_percent", None)
            net_weight_kg = net_weight_kg or getattr(txn, "net_weight_kg", txn.weight_kg)
            price_per_kg = price_per_kg or txn.price_per_kg

    # Calculate deduction in kg if cocoa/coffee
    moisture_ded = 0.0
    if weight_kg is not None and net_weight_kg is not None:
        moisture_ded = round(max(0.0, weight_kg - net_weight_kg), 2)

    return ReceiptOut(
        id=receipt.id,
        receipt_number=receipt.receipt_number,
        transaction_type=receipt.transaction_type,
        transaction_id=receipt.transaction_id,
        seller_id=receipt.seller_id,
        gross_amount=receipt.gross_amount,
        loan_deduction=receipt.loan_deduction or 0.0,
        net_amount_paid=receipt.net_amount_paid,
        recorded_by=receipt.recorded_by,
        issued_by=receipt.issued_by,
        issued_at=receipt.issued_at,
        is_admin_override=receipt.is_admin_override,
        station_name=st_name,
        business_name=biz_name,
        business_address=biz_addr,
        business_phone=biz_phone,
        seller_name=seller_name,
        seller_contact=seller_contact,
        seller_code=seller_code,
        is_random_seller=is_random,
        weight_kg=weight_kg,
        water_percent=water_percent,
        standard_percent=standard_percent,
        moisture_deduction_kg=moisture_ded,
        net_weight_kg=net_weight_kg,
        price_per_kg=price_per_kg,
        recorded_by_name=receipt.recorded_by_name or (recorder.name if recorder else None),
        issued_by_name=receipt.issued_by_name or (issuer.name if issuer else None),
    )


def issue_and_create_receipt(
    db: Session,
    txn,
    transaction_type: str,
    prefix: str,
    current: dict,
    loan_deduction: float,
) -> ReceiptOut:
    """
    Issue a new official receipt with complete produce account, seller, and item detail snapshots.
    """
    is_admin_override = current["role"] == UserRole.system_admin.value
    net_paid = round(txn.total_price - loan_deduction, 2)

    issuer = db.query(User).filter(User.id == current["id"]).first()
    recorder = db.query(User).filter(User.id == txn.created_by).first() if txn.created_by else None
    seller = db.query(Seller).filter(Seller.id == txn.seller_id).first()
    settings = db.query(AppSettings).filter(AppSettings.id == "singleton").first()

    st_name = (
        (issuer.station_name if issuer else None)
        or (settings.station_name if settings else None)
        or "COMIS Produce Station"
    )
    biz_name = (issuer.business_name if issuer else None) or st_name
    biz_addr = (issuer.address if issuer else None) or ""
    biz_phone = (issuer.phone_number if issuer else None) or (issuer.contact if issuer else "")

    receipt = Receipt(
        receipt_number=f"{prefix}-{str(txn.id)[:8].upper()}",
        transaction_type=transaction_type,
        transaction_id=txn.id,
        seller_id=txn.seller_id,
        gross_amount=txn.total_price,
        loan_deduction=loan_deduction,
        net_amount_paid=net_paid,
        recorded_by=txn.created_by,
        issued_by=current["id"],
        is_admin_override=is_admin_override,
        station_name=st_name,
        business_name=biz_name,
        business_address=biz_addr,
        business_phone=biz_phone,
        weight_kg=txn.weight_kg,
        water_percent=getattr(txn, "water_percent", None),
        standard_percent=getattr(txn, "standard_percent", None),
        net_weight_kg=getattr(txn, "net_weight_kg", txn.weight_kg),
        price_per_kg=txn.price_per_kg,
        seller_name_snapshot=seller.name if seller else "Unknown Seller",
        seller_contact_snapshot=seller.contact if seller else None,
        recorded_by_name=recorder.name if recorder else None,
        issued_by_name=issuer.name if issuer else None,
    )
    db.add(receipt)
    db.commit()
    db.refresh(receipt)

    return format_receipt_out(receipt, db)

