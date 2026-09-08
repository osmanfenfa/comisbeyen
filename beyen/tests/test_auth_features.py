import pytest
from app.models.user import User, UserStatus, UserRole
from app.core.security import hash_password
from app.services.email import SENT_EMAILS_BUFFER

def test_login_returns_produce_name(client):
    # Admin login with seeded credentials
    res = client.post("/api/v1/auth/login", json={"contact": "admin@comis.local", "password": "ComisAdmin2024!"})
    assert res.status_code == 200, res.text
    data = res.json()
    assert "access_token" in data
    assert "produce_name" in data

def test_forgot_password_flow(client, db):
    SENT_EMAILS_BUFFER.clear()
    
    # Create dedicated user for forgot password testing
    test_user = User(
        name="Reset Test User",
        contact="resetuser@comis.org",
        email="resetuser@comis.org",
        password_hash=hash_password("OldPassword123!"),
        role=UserRole.produce_manager,
        status=UserStatus.active,
        station_name="Reset Station",
        business_name="Reset Produce"
    )
    db.add(test_user)
    db.commit()

    # Request forgot password
    res = client.post("/api/v1/auth/forgot-password", json={"email": "resetuser@comis.org"})
    assert res.status_code == 200
    assert "password reset instructions have been sent" in res.json()["message"]
    
    # Check that email was sent to buffer
    assert len(SENT_EMAILS_BUFFER) == 1
    sent = SENT_EMAILS_BUFFER[0]
    assert sent["to"] == "resetuser@comis.org"
    code = sent["reset_code"]
    token = sent["reset_token"]
    assert len(code) == 6

    # Test resetting with code
    reset_res = client.post("/api/v1/auth/reset-password", json={"token": code, "new_password": "newpassword123"})
    assert reset_res.status_code == 200
    assert "successfully reset" in reset_res.json()["message"]

    # Verify user can log in with new password
    login_res = client.post("/api/v1/auth/login", json={"contact": "resetuser@comis.org", "password": "newpassword123"})
    assert login_res.status_code == 200

    # verify invalid token fails
    fail_res = client.post("/api/v1/auth/reset-password", json={"token": "999999", "new_password": "short"})
    assert fail_res.status_code == 400

def test_google_auth_flow(client, db):
    # Register new user via Google auth
    res = client.post("/api/v1/auth/google", json={
        "email": "newmanager@example.com",
        "name": "Jane Doe",
        "google_id": "google-123456",
        "produce_name": "Doe Organic Produce"
    })
    # Lands as pending approval -> 403
    assert res.status_code == 403
    assert "pending System Admin approval" in res.json()["detail"]

    # System admin approves user
    new_user = db.query(User).filter(User.google_id == "google-123456").first()
    assert new_user is not None
    assert new_user.business_name == "Doe Organic Produce"
    new_user.status = UserStatus.active
    db.commit()

    # Login again with Google
    login_res = client.post("/api/v1/auth/google", json={
        "email": "newmanager@example.com",
        "google_id": "google-123456"
    })
    assert login_res.status_code == 200
    data = login_res.json()
    assert data["produce_name"] == "Doe Organic Produce"
    assert data["role"] == "produce_manager"
