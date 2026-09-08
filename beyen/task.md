# COMIS Backend — Task List

## Component 1 — Models
- [x] Modify seller.py — add seller_id, is_active, photo_path
- [x] Modify receipt.py — add loan_deduction, net_amount_paid, recorded_by, is_admin_override
- [x] Modify settings_model.py — add station_name
- [x] Modify user.py — add station_name field

## Component 2 — Schemas
- [x] Modify schemas/user.py — split UserCreate, add Me/List/Token claims
- [x] Modify schemas/seller.py — add seller_id, is_active, SellerEdit, SellerHistory
- [x] New schemas/coffee.py
- [x] New schemas/cola.py
- [x] New schemas/receipt.py
- [x] New schemas/settings.py
- [x] New schemas/audit_log.py
- [x] Modify schemas/loan.py — fix LoanOut balance, add LoanWithRepayments

## Component 3 — Core / Config
- [x] Modify core/config.py — add fields
- [x] Modify core/security.py — use config expiry, add user_name claim, robust bcrypt usage

## Component 4 — Alembic
- [x] Create alembic/env.py
- [x] Create alembic/script.py.mako
- [x] Create alembic/versions/0001_initial.py

## Component 5 — DB Seed
- [x] Create app/db/seed.py

## Component 6 — Services
- [x] Create services/report_export.py (PDF & Excel generation)

## Component 7 — Endpoints
- [x] Modify endpoints/users.py — me, list, get, fixes
- [x] Modify endpoints/sellers.py — auth, CRUD, deactivate, history
- [x] Modify endpoints/cocoa.py — fix approve flow, edit guards, 404s, settings from DB
- [x] Implement endpoints/coffee.py — full
- [x] Implement endpoints/cola.py — full
- [x] New endpoints/receipts.py — list, get
- [x] New endpoints/audit_logs.py — list, get
- [x] Implement endpoints/dashboard.py — role-aware summary
- [x] Implement endpoints/settings_routes.py — get/put
- [x] New endpoints/reports.py — produce, loans, seller statement, export
- [x] Modify endpoints/loans.py — fix LoanOut response, add get-by-id, overdue check

## Component 8 — Router
- [x] Modify router.py — add receipts, audit_logs, reports

## Component 9 — Infrastructure
- [x] Modify main.py — startup event (create tables + seed)
- [x] Modify requirements.txt — add pytest, httpx, bcrypt
- [x] Modify docker-compose.yml — fix build path, add healthcheck
- [x] Create .env from .env.example
- [x] End-to-end integration tests in tests/test_full_workflow.py

