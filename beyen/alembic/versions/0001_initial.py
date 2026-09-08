"""Initial schema — all COMIS tables.

Revision ID: 0001
Revises: 
Create Date: 2026-09-05

"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- users ---
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("contact", sa.String(120), unique=True, nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("role", sa.Enum("system_admin", "produce_manager", "produce_secretary", name="userrole"), nullable=False),
        sa.Column("status", sa.Enum("pending", "active", "suspended", "inactive", name="userstatus"), default="pending"),
        sa.Column("station_name", sa.String(120), nullable=True),
        sa.Column("is_active", sa.Boolean(), default=True),
        sa.Column("created_by", sa.Uuid(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("approved_by", sa.Uuid(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(), default=sa.func.now()),
        sa.Column("approved_at", sa.DateTime(), nullable=True),
    )

    # --- sellers ---
    op.create_table(
        "sellers",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("seller_id", sa.String(20), unique=True, nullable=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("gender", sa.Enum("male", "female", "other", name="genderenum"), nullable=False),
        sa.Column("address", sa.String(255), nullable=False),
        sa.Column("contact", sa.String(30), nullable=True),
        sa.Column("photo_path", sa.String(255), nullable=True),
        sa.Column("date_registered", sa.Date()),
        sa.Column("is_active", sa.Boolean(), default=True),
        sa.Column("created_by", sa.Uuid(), sa.ForeignKey("users.id"), nullable=True),
    )

    # --- app_settings ---
    op.create_table(
        "app_settings",
        sa.Column("id", sa.String(10), primary_key=True),
        sa.Column("station_name", sa.String(120), default="COMIS Buying Station"),
        sa.Column("standard_moisture_percent", sa.Float(), default=7.0),
        sa.Column("cocoa_price_per_kg", sa.Float(), default=0.0),
        sa.Column("coffee_price_per_kg", sa.Float(), default=0.0),
        sa.Column("cola_price_per_kg", sa.Float(), default=0.0),
    )

    # --- cocoa_transactions ---
    op.create_table(
        "cocoa_transactions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("seller_id", sa.Uuid(), sa.ForeignKey("sellers.id"), nullable=False),
        sa.Column("date", sa.Date()),
        sa.Column("weight_kg", sa.Float(), nullable=False),
        sa.Column("water_percent", sa.Float(), nullable=False),
        sa.Column("standard_percent", sa.Float(), default=7.0),
        sa.Column("price_per_kg", sa.Float(), nullable=False),
        sa.Column("net_weight_kg", sa.Float(), nullable=False),
        sa.Column("total_price", sa.Float(), nullable=False),
        sa.Column("status", sa.Enum("pending", "approved", "rejected", "finalized", name="transactionstatus"), default="pending"),
        sa.Column("rejection_reason", sa.String(255), nullable=True),
        sa.Column("created_by", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("reviewed_by", sa.Uuid(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("approved_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), default=sa.func.now()),
    )

    # --- coffee_transactions ---
    op.create_table(
        "coffee_transactions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("seller_id", sa.Uuid(), sa.ForeignKey("sellers.id"), nullable=False),
        sa.Column("date", sa.Date()),
        sa.Column("weight_kg", sa.Float(), nullable=False),
        sa.Column("water_percent", sa.Float(), nullable=False),
        sa.Column("standard_percent", sa.Float(), default=7.0),
        sa.Column("price_per_kg", sa.Float(), nullable=False),
        sa.Column("net_weight_kg", sa.Float(), nullable=False),
        sa.Column("total_price", sa.Float(), nullable=False),
        sa.Column("status", sa.Enum("pending", "approved", "rejected", "finalized", name="transactionstatus"), create_constraint=False),
        sa.Column("rejection_reason", sa.String(255), nullable=True),
        sa.Column("created_by", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("reviewed_by", sa.Uuid(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("approved_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), default=sa.func.now()),
    )

    # --- cola_transactions ---
    op.create_table(
        "cola_transactions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("seller_id", sa.Uuid(), sa.ForeignKey("sellers.id"), nullable=False),
        sa.Column("date", sa.Date()),
        sa.Column("weight_kg", sa.Float(), nullable=False),
        sa.Column("price_per_kg", sa.Float(), nullable=False),
        sa.Column("total_price", sa.Float(), nullable=False),
        sa.Column("status", sa.Enum("pending", "approved", "rejected", "finalized", name="transactionstatus"), create_constraint=False),
        sa.Column("rejection_reason", sa.String(255), nullable=True),
        sa.Column("created_by", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("reviewed_by", sa.Uuid(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("approved_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), default=sa.func.now()),
    )

    # --- loans ---
    op.create_table(
        "loans",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("seller_id", sa.Uuid(), sa.ForeignKey("sellers.id"), nullable=False),
        sa.Column("date", sa.Date()),
        sa.Column("loan_taken", sa.Float(), nullable=False),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("status", sa.String(20), default="active"),
        sa.Column("notes", sa.String(255), nullable=True),
        sa.Column("created_by", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("approved_by", sa.Uuid(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(), default=sa.func.now()),
    )

    # --- loan_repayments ---
    op.create_table(
        "loan_repayments",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("loan_id", sa.Uuid(), sa.ForeignKey("loans.id"), nullable=False),
        sa.Column("date", sa.Date()),
        sa.Column("amount_paid", sa.Float(), nullable=False),
        sa.Column("recorded_by", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
    )

    # --- receipts ---
    op.create_table(
        "receipts",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("receipt_number", sa.String(30), unique=True, nullable=False),
        sa.Column("transaction_type", sa.String(20), nullable=False),
        sa.Column("transaction_id", sa.Uuid(), nullable=False),
        sa.Column("seller_id", sa.Uuid(), sa.ForeignKey("sellers.id"), nullable=False),
        sa.Column("gross_amount", sa.Float(), nullable=False),
        sa.Column("loan_deduction", sa.Float(), default=0.0),
        sa.Column("net_amount_paid", sa.Float(), nullable=False),
        sa.Column("recorded_by", sa.Uuid(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("issued_by", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("issued_at", sa.DateTime(), default=sa.func.now()),
        sa.Column("is_admin_override", sa.Boolean(), default=False),
    )

    # --- audit_logs ---
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("user_role", sa.String(30), nullable=False),
        sa.Column("action", sa.String(50), nullable=False),
        sa.Column("entity_type", sa.String(50), nullable=False),
        sa.Column("entity_id", sa.Uuid(), nullable=True),
        sa.Column("old_value", sa.Text(), nullable=True),
        sa.Column("new_value", sa.Text(), nullable=True),
        sa.Column("timestamp", sa.DateTime(), default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("audit_logs")
    op.drop_table("receipts")
    op.drop_table("loan_repayments")
    op.drop_table("loans")
    op.drop_table("cola_transactions")
    op.drop_table("coffee_transactions")
    op.drop_table("cocoa_transactions")
    op.drop_table("app_settings")
    op.drop_table("sellers")
    op.drop_table("users")
