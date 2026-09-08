"""
Full end-to-end integration tests for COMIS backend.
Tests the 3-role permission model, produce transactions (cocoa, coffee, cola),
loans, receipts, reports, settings, and audit trails.
"""
import pytest
from app.db.seed import ADMIN_CONTACT, ADMIN_PASSWORD


def test_full_comis_workflow(client):
    # -----------------------------------------------------------------------
    # 1. Admin Login & Manager Registration / Approval
    # -----------------------------------------------------------------------
    # Seeded Admin logs in
    resp = client.post("/api/v1/auth/login", json={
        "contact": ADMIN_CONTACT,
        "password": ADMIN_PASSWORD,
    })
    assert resp.status_code == 200, resp.text
    admin_token = resp.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Public manager registration (starts as PENDING)
    mgr_contact = "manager1@station.sl"
    mgr_pwd = "ManagerPass123!"
    resp = client.post("/api/v1/users/managers", json={
        "name": "Produce Manager One",
        "contact": mgr_contact,
        "password": mgr_pwd,
    })
    assert resp.status_code == 201, resp.text
    mgr_id = resp.json()["id"]
    assert resp.json()["status"] == "pending"

    # Manager cannot log in yet
    resp = client.post("/api/v1/auth/login", json={
        "contact": mgr_contact,
        "password": mgr_pwd,
    })
    assert resp.status_code == 403, "Pending manager should not be allowed to log in"

    # Admin approves manager
    resp = client.post(f"/api/v1/users/{mgr_id}/approve", headers=admin_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "active"

    # Now Manager can log in
    resp = client.post("/api/v1/auth/login", json={
        "contact": mgr_contact,
        "password": mgr_pwd,
    })
    assert resp.status_code == 200
    mgr_token = resp.json()["access_token"]
    mgr_headers = {"Authorization": f"Bearer {mgr_token}"}

    # Manager creates Secretary (active immediately)
    sec_contact = "secretary1@station.sl"
    sec_pwd = "SecretaryPass123!"
    resp = client.post("/api/v1/users/secretaries", headers=mgr_headers, json={
        "name": "Produce Secretary One",
        "contact": sec_contact,
        "password": sec_pwd,
        "station_name": "Kenema Buying Station",
    })
    assert resp.status_code == 201
    assert resp.json()["status"] == "active"

    # Secretary logs in
    resp = client.post("/api/v1/auth/login", json={
        "contact": sec_contact,
        "password": sec_pwd,
    })
    assert resp.status_code == 200
    sec_token = resp.json()["access_token"]
    sec_headers = {"Authorization": f"Bearer {sec_token}"}

    # -----------------------------------------------------------------------
    # 2. Seller Registration & Permissions
    # -----------------------------------------------------------------------
    # Secretary registers a seller
    resp = client.post("/api/v1/sellers/", headers=sec_headers, json={
        "name": "Amara Kamara",
        "gender": "male",
        "address": "Kailahun Road, Kenema",
        "contact": "+23276123456",
    })
    assert resp.status_code == 201
    seller_data = resp.json()
    seller_id = seller_data["id"]
    assert seller_data["seller_id"].startswith("SL-")

    # Secretary checks seller's balance (should be 0)
    resp = client.get(f"/api/v1/sellers/{seller_id}/balance", headers=sec_headers)
    assert resp.status_code == 200
    assert resp.json()["outstanding_balance"] == 0.0

    # Secretary tries to deactivate seller -> 403 Forbidden
    resp = client.post(f"/api/v1/sellers/{seller_id}/deactivate", headers=sec_headers)
    assert resp.status_code == 403

    # Secretary edits seller address -> allowed
    resp = client.put(f"/api/v1/sellers/{seller_id}", headers=sec_headers, json={
        "address": "Hangha Road, Kenema",
    })
    assert resp.status_code == 200
    assert resp.json()["address"] == "Hangha Road, Kenema"

    # -----------------------------------------------------------------------
    # 3. Cocoa Purchase Workflow (Pending -> Reject -> Edit/Resubmit -> Approve -> Receipt)
    # -----------------------------------------------------------------------
    # Secretary records a cocoa purchase (spec example: 40kg, 13.7% water, 7% std, price 40)
    resp = client.post("/api/v1/cocoa/", headers=sec_headers, json={
        "seller_id": seller_id,
        "date": "2026-09-05",
        "weight_kg": 40.0,
        "water_percent": 13.7,
        "price_per_kg": 40.0,
    })
    assert resp.status_code == 201
    cocoa_txn = resp.json()
    cocoa_id = cocoa_txn["id"]
    assert cocoa_txn["status"] == "pending"
    assert cocoa_txn["net_weight_kg"] == 33.3
    assert cocoa_txn["total_price"] == 1332.0

    # Secretary rejects cocoa transaction with reason (Secretary has staff permissions)
    resp = client.post(f"/api/v1/cocoa/{cocoa_id}/reject", headers=sec_headers, json={
        "reason": "Water percentage needs re-testing on sample B",
    })
    assert resp.status_code == 200
    assert resp.json()["status"] == "rejected"
    assert resp.json()["rejection_reason"] == "Water percentage needs re-testing on sample B"

    # Secretary edits and resubmits transaction (water was actually 12.0%)
    resp = client.put(f"/api/v1/cocoa/{cocoa_id}", headers=sec_headers, json={
        "weight_kg": 40.0,
        "water_percent": 12.0,
        "price_per_kg": 40.0,
    })
    assert resp.status_code == 200
    assert resp.json()["status"] == "pending"
    assert resp.json()["rejection_reason"] is None
    # 12.0 - 7.0 = 5.0 deduction; 40 - 5 = 35.0 net; 35 * 40 = 1400.0 total
    assert resp.json()["net_weight_kg"] == 35.0
    assert resp.json()["total_price"] == 1400.0

    # Secretary approves (Secretary can approve and issue out receipt)
    resp = client.post(f"/api/v1/cocoa/{cocoa_id}/approve", headers=sec_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "approved"

    # Secretary issues receipt
    resp = client.post(f"/api/v1/cocoa/{cocoa_id}/issue-receipt", headers=sec_headers)
    assert resp.status_code == 200
    receipt = resp.json()
    assert receipt["receipt_number"].startswith("COC-")
    assert receipt["gross_amount"] == 1400.0
    assert receipt["net_amount_paid"] == 1400.0

    # Verify transaction is now finalized
    resp = client.get(f"/api/v1/cocoa/{cocoa_id}", headers=mgr_headers)
    assert resp.json()["status"] == "finalized"

    # -----------------------------------------------------------------------
    # 4. Coffee & Cola Workflows
    # -----------------------------------------------------------------------
    # Coffee transaction
    resp = client.post("/api/v1/coffee/", headers=sec_headers, json={
        "seller_id": seller_id,
        "date": "2026-09-05",
        "weight_kg": 50.0,
        "water_percent": 10.0,
        "price_per_kg": 30.0,
    })
    assert resp.status_code == 201
    coffee_id = resp.json()["id"]
    # Manager approves & issues receipt
    client.post(f"/api/v1/coffee/{coffee_id}/approve", headers=mgr_headers)
    resp = client.post(f"/api/v1/coffee/{coffee_id}/issue-receipt", headers=mgr_headers)
    assert resp.status_code == 200
    assert resp.json()["receipt_number"].startswith("COF-")

    # Cola nut transaction (direct pricing, manual override test)
    resp = client.post("/api/v1/cola/", headers=sec_headers, json={
        "seller_id": seller_id,
        "date": "2026-09-05",
        "weight_kg": 20.0,
        "price_per_kg": 15.0,
        "manual_total_override": 320.0,
    })
    assert resp.status_code == 201
    cola_txn = resp.json()
    assert cola_txn["total_price"] == 320.0
    cola_id = cola_txn["id"]

    client.post(f"/api/v1/cola/{cola_id}/approve", headers=mgr_headers)
    resp = client.post(f"/api/v1/cola/{cola_id}/issue-receipt", headers=mgr_headers)
    assert resp.status_code == 200
    assert resp.json()["receipt_number"].startswith("COL-")

    # -----------------------------------------------------------------------
    # 5. Loan Lifecycle & Deduction
    # -----------------------------------------------------------------------
    # Secretary cannot create loan -> 403
    resp = client.post("/api/v1/loans/", headers=sec_headers, json={
        "seller_id": seller_id,
        "date": "2026-09-05",
        "loan_taken": 500.0,
    })
    assert resp.status_code == 403

    # Manager creates loan
    resp = client.post("/api/v1/loans/", headers=mgr_headers, json={
        "seller_id": seller_id,
        "date": "2026-09-05",
        "loan_taken": 500.0,
        "notes": "Advance for fertilizer",
    })
    assert resp.status_code == 201
    loan_id = resp.json()["id"]
    assert resp.json()["balance"] == 500.0

    # Secretary can see updated seller balance
    resp = client.get(f"/api/v1/sellers/{seller_id}/balance", headers=sec_headers)
    assert resp.status_code == 200
    assert resp.json()["outstanding_balance"] == 500.0

    # Record partial repayment of 200
    resp = client.post("/api/v1/loans/repayments", headers=mgr_headers, json={
        "loan_id": loan_id,
        "date": "2026-09-05",
        "amount_paid": 200.0,
    })
    assert resp.status_code == 200
    assert resp.json()["balance"] == 300.0

    # -----------------------------------------------------------------------
    # 6. Settings RBAC (Admin vs Manager)
    # -----------------------------------------------------------------------
    # Manager changes operational prices
    resp = client.put("/api/v1/settings/", headers=mgr_headers, json={
        "cocoa_price_per_kg": 45.0,
    })
    assert resp.status_code == 200
    assert resp.json()["cocoa_price_per_kg"] == 45.0

    # Manager tries to change standard_moisture_percent -> 403
    resp = client.put("/api/v1/settings/", headers=mgr_headers, json={
        "standard_moisture_percent": 8.0,
    })
    assert resp.status_code == 403

    # Admin changes standard_moisture_percent -> allowed
    resp = client.put("/api/v1/settings/", headers=admin_headers, json={
        "standard_moisture_percent": 7.5,
    })
    assert resp.status_code == 200
    assert resp.json()["standard_moisture_percent"] == 7.5

    # -----------------------------------------------------------------------
    # 7. Dashboard Summaries
    # -----------------------------------------------------------------------
    resp = client.get("/api/v1/dashboard/summary", headers=mgr_headers)
    assert resp.status_code == 200
    mgr_dash = resp.json()
    assert mgr_dash["role"] == "produce_manager"
    assert mgr_dash["receipts_issued_today"] >= 3

    resp = client.get("/api/v1/dashboard/summary", headers=sec_headers)
    assert resp.status_code == 200
    assert resp.json()["role"] == "produce_secretary"

    resp = client.get("/api/v1/dashboard/summary", headers=admin_headers)
    assert resp.status_code == 200
    assert resp.json()["role"] == "system_admin"

    # -----------------------------------------------------------------------
    # 8. Reports & Exports
    # -----------------------------------------------------------------------
    # JSON produce report
    resp = client.get("/api/v1/reports/produce", headers=mgr_headers)
    assert resp.status_code == 200
    assert resp.json()["count"] >= 3

    # PDF export
    resp = client.get("/api/v1/reports/produce/export?format=pdf", headers=mgr_headers)
    assert resp.status_code == 200
    assert resp.content.startswith(b"%PDF")

    # Excel export
    resp = client.get("/api/v1/reports/produce/export?format=excel", headers=mgr_headers)
    assert resp.status_code == 200
    assert resp.content.startswith(b"PK")  # ZIP signature for xlsx

    # Seller statement
    resp = client.get(f"/api/v1/reports/seller/{seller_id}", headers=mgr_headers)
    assert resp.status_code == 200
    assert len(resp.json()["receipts"]) >= 3

    # -----------------------------------------------------------------------
    # 9. Audit Logs
    # -----------------------------------------------------------------------
    resp = client.get("/api/v1/audit-logs/", headers=admin_headers)
    assert resp.status_code == 200
    logs = resp.json()
    assert len(logs) > 0
    actions = [l["action"] for l in logs]
    assert "create" in actions
    assert "approve" in actions
    assert "issue_receipt" in actions

