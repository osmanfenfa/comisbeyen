"""
Auth endpoint.
Login returns a JWT with role, name, and produce_name claims.
Includes password reset via email and Google OAuth authentication.
"""
import base64
import json
import secrets
import uuid
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.user import User, UserRole, UserStatus
from app.core.security import verify_password, hash_password, create_access_token
from app.schemas.user import UserLogin, Token, ForgotPasswordRequest, ResetPasswordRequest, GoogleAuthRequest
from app.services.email import send_password_reset_email

router = APIRouter()


@router.post("/login", response_model=Token)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    identifier = payload.email or payload.contact
    if not identifier:
        raise HTTPException(status_code=400, detail="Email or contact is required.")

    user = db.query(User).filter(
        (User.contact == identifier) | (User.email == identifier)
    ).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if user.status != UserStatus.active:
        raise HTTPException(status_code=403, detail=f"Account is {user.status.value}. Contact a System Admin.")

    # Ensure produce_id is populated for Manager if missing
    if not user.produce_id and user.role == UserRole.produce_manager:
        user.produce_id = user.id
        db.commit()
        db.refresh(user)

    token = create_access_token(
        user.id,
        user.role.value,
        name=user.name,
        produce_id=user.produce_id,
        station_name=user.station_name,
        business_name=user.business_name,
    )
    return Token(
        access_token=token,
        role=user.role,
        name=user.name,
        user_id=user.id,
        station_name=user.station_name,
        business_name=user.business_name,
        produce_name=user.business_name or user.station_name,
        produce_id=user.produce_id,
    )


@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """
    Sends a 6-digit reset code and password reset link to user's email.
    Supports Produce Managers, Secretaries, and System Admins.
    """
    email_or_contact = (payload.email or "").strip()
    if not email_or_contact:
        raise HTTPException(status_code=400, detail="Email is required.")

    user = db.query(User).filter(
        (User.email.ilike(email_or_contact)) | (User.contact.ilike(email_or_contact))
    ).first()

    if user:
        code = f"{secrets.randbelow(900000) + 100000}"
        raw_token = secrets.token_urlsafe(32)
        user.reset_password_token = f"{code}:{raw_token}"
        user.reset_password_expires_at = datetime.utcnow() + timedelta(hours=1)
        db.commit()

        recipient_email = user.email or (user.contact if "@" in user.contact else None) or email_or_contact
        send_password_reset_email(
            to_email=recipient_email,
            user_name=user.name,
            reset_token=raw_token,
            reset_code=code,
        )

    return {
        "message": "If an account exists with this email, password reset instructions have been sent."
    }


@router.post("/reset-password")
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    """
    Verifies reset token or 6-digit code and sets a new password.
    """
    if not payload.token or not payload.new_password:
        raise HTTPException(status_code=400, detail="Reset token/code and new password are required.")

    if len(payload.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters long.")

    req_token = payload.token.strip()
    now = datetime.utcnow()

    # Match active reset requests within 1 hour expiry
    users = db.query(User).filter(
        User.reset_password_token.isnot(None),
        User.reset_password_expires_at > now
    ).all()

    matched_user = None
    for u in users:
        stored = u.reset_password_token or ""
        parts = stored.split(":")
        if req_token == stored or req_token in parts:
            matched_user = u
            break

    if not matched_user:
        raise HTTPException(status_code=400, detail="Invalid or expired password reset token or code.")

    matched_user.password_hash = hash_password(payload.new_password)
    matched_user.reset_password_token = None
    matched_user.reset_password_expires_at = None
    db.commit()

    return {
        "message": "Password has been successfully reset. You can now log in."
    }


@router.post("/google", response_model=Token)
def google_auth(payload: GoogleAuthRequest, db: Session = Depends(get_db)):
    """
    Authenticates or registers a user via Google Sign-In.
    - If user exists and is active: returns auth JWT.
    - If user exists and pending: returns 403 approval notice.
    - If user does not exist: auto-registers as Produce Manager (pending approval).
    """
    email = (payload.email or "").strip().lower()
    name = (payload.name or "").strip()
    google_id = payload.google_id
    produce_name = (payload.produce_name or "").strip()

    # Attempt decoding from Google JWT credential if present
    if payload.credential:
        try:
            parts = payload.credential.split(".")
            if len(parts) >= 2:
                padding = "=" * ((4 - len(parts[1]) % 4) % 4)
                claims_str = base64.urlsafe_b64decode(parts[1] + padding).decode("utf-8")
                claims = json.loads(claims_str)
                email = email or claims.get("email", "").lower()
                name = name or claims.get("name") or claims.get("given_name")
                google_id = google_id or claims.get("sub")
        except Exception:
            pass

    if not email:
        raise HTTPException(status_code=400, detail="Google authentication failed: Email address is required.")

    # Search for user by google_id or email or contact
    user = None
    if google_id:
        user = db.query(User).filter(User.google_id == google_id).first()
    if not user:
        user = db.query(User).filter(
            (User.email.ilike(email)) | (User.contact.ilike(email))
        ).first()

    mode = (payload.mode or "signin").strip().lower()
    terms_accepted = bool(payload.terms_accepted)

    if user:
        # Link google_id and email if missing
        if google_id and not user.google_id:
            user.google_id = google_id
        if not user.email:
            user.email = email
        db.commit()

        if user.status == UserStatus.pending:
            raise HTTPException(status_code=403, detail="Your account is pending System Admin approval.")
        if user.status != UserStatus.active:
            raise HTTPException(status_code=403, detail=f"Account is {user.status.value}. Contact a System Admin.")

        # Ensure produce_id is populated for Manager if missing
        if not user.produce_id and user.role == UserRole.produce_manager:
            user.produce_id = user.id
            db.commit()
            db.refresh(user)

        token = create_access_token(
            user.id,
            user.role.value,
            name=user.name,
            produce_id=user.produce_id,
            station_name=user.station_name,
            business_name=user.business_name,
        )
        return Token(
            access_token=token,
            role=user.role,
            name=user.name,
            user_id=user.id,
            station_name=user.station_name,
            business_name=user.business_name,
            produce_name=user.business_name or user.station_name,
            produce_id=user.produce_id,
        )

    # User does NOT exist in the database
    if mode == "signin":
        raise HTTPException(
            status_code=404,
            detail="Account does not exist. Signup to continue."
        )

    # mode == "signup" -> Verify user confirmed terms agreement
    if not terms_accepted:
        raise HTTPException(
            status_code=400,
            detail="You must agree to the Terms of Service, User Agreement, and Privacy Policy to continue."
        )

    # Auto-register Produce Manager as PENDING
    resolved_name = name or email.split("@")[0].capitalize()
    resolved_produce = produce_name or f"{resolved_name}'s Produce"
    new_user_id = uuid.uuid4()

    new_user = User(
        id=new_user_id,
        name=resolved_name,
        contact=email,
        email=email,
        google_id=google_id,
        password_hash=hash_password(secrets.token_urlsafe(24)),
        role=UserRole.produce_manager,
        status=UserStatus.pending,
        station_name=resolved_produce,
        business_name=resolved_produce,
        produce_id=new_user_id,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    raise HTTPException(
        status_code=403,
        detail="Account registered successfully with Google! It is currently pending System Admin approval."
    )

