"""
User management endpoints.
Approval chain (spec section 2):
  - System Admin approves Produce Manager accounts (created as PENDING).
  - Produce Manager creates Secretary accounts (active immediately — Manager is accountable).
"""
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.permissions import require_role, get_current_user
from app.core.security import hash_password, verify_password
from app.models.user import User, UserRole, UserStatus
from app.schemas.user import (
    ManagerRegister, SecretaryCreate, UserOut, UserListOut, 
    UserProfileUpdate, ChangePasswordRequest
)
from app.services.audit import log_action

router = APIRouter()

ADMIN_ONLY = require_role(UserRole.system_admin)
MANAGER_OR_ADMIN = require_role(UserRole.produce_manager, UserRole.system_admin)
ANY_STAFF = require_role(UserRole.produce_manager, UserRole.system_admin, UserRole.produce_secretary)


# ---------------------------------------------------------------------------
# Registration
# ---------------------------------------------------------------------------

@router.post("/managers", response_model=UserOut, status_code=201)
def register_manager(payload: ManagerRegister, db: Session = Depends(get_db)):
    """
    Public endpoint — no auth needed.
    Creates a Produce Manager account as PENDING; a System Admin must approve it
    before the manager can log in. (spec section 2.1 / 4.1)
    """
    contact_val = payload.email or payload.contact or payload.phone_number
    if not contact_val:
        raise HTTPException(status_code=400, detail="An email or phone number is required.")

    # Check if contact or email already registered
    existing_query = db.query(User).filter(User.contact == contact_val)
    if payload.email:
        existing_query = db.query(User).filter((User.contact == contact_val) | (User.email == payload.email))
    if existing_query.first():
        raise HTTPException(status_code=409, detail="A user with that contact or email already exists.")

    name_val = payload.business_name or payload.name or "Produce Manager"
    station_val = payload.business_name or payload.name or "Buying Station"

    user = User(
        name=name_val,
        contact=contact_val,
        password_hash=hash_password(payload.password),
        role=UserRole.produce_manager,
        status=UserStatus.pending,
        station_name=station_val,
        business_name=payload.business_name,
        address=payload.address,
        email=payload.email,
        phone_number=payload.phone_number,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/secretaries", response_model=UserOut, status_code=201)
def create_secretary(
    payload: SecretaryCreate,
    db: Session = Depends(get_db),
    current=Depends(MANAGER_OR_ADMIN),
):
    """
    Manager (or Admin) creates a Secretary account — active immediately.
    The Manager is directly accountable for who they hire. (spec section 2.2)
    """
    effective_contact = payload.contact or payload.phone_number or payload.email
    if not effective_contact:
        raise HTTPException(status_code=422, detail="Contact, phone number, or email must be provided.")
    
    existing = db.query(User).filter(
        (User.contact == effective_contact) |
        (User.email != None) & (User.email == payload.email)
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="A user with that contact or email already exists.")
    user = User(
        name=payload.name,
        contact=effective_contact,
        email=payload.email,
        phone_number=payload.phone_number or payload.contact,
        address=payload.address,
        password_hash=hash_password(payload.password),
        role=UserRole.produce_secretary,
        status=UserStatus.active,
        station_name=payload.station_name,
        created_by=current["id"],
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    log_action(db, current["id"], current["role"], "create_secretary", "User", user.id,
               new_value={"name": payload.name, "contact": payload.contact})
    return user


# ---------------------------------------------------------------------------
# Reads
# ---------------------------------------------------------------------------

@router.get("/me", response_model=UserOut)
def get_me(db: Session = Depends(get_db), current=Depends(ANY_STAFF)):
    """Returns the profile of the currently authenticated user."""
    user = db.query(User).filter(User.id == current["id"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.put("/me", response_model=UserOut)
def update_me(
    payload: UserProfileUpdate,
    db: Session = Depends(get_db),
    current=Depends(MANAGER_OR_ADMIN),
):
    """Update profile information for Produce Manager and System Admin."""
    user = db.query(User).filter(User.id == current["id"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    old_data = {
        "name": user.name,
        "contact": user.contact,
        "business_name": user.business_name,
        "station_name": user.station_name,
    }

    if payload.name is not None:
        user.name = payload.name
    if payload.business_name is not None:
        user.business_name = payload.business_name
        if user.role == UserRole.produce_manager:
            user.station_name = payload.business_name
    if payload.station_name is not None:
        user.station_name = payload.station_name
    if payload.address is not None:
        user.address = payload.address
    if payload.phone_number is not None:
        user.phone_number = payload.phone_number
    if payload.email is not None:
        user.email = payload.email
    if payload.gender is not None:
        user.gender = payload.gender
    if payload.contact is not None:
        if payload.contact != user.contact:
            existing = db.query(User).filter(User.contact == payload.contact, User.id != user.id).first()
            if existing:
                raise HTTPException(status_code=409, detail="That contact/phone number is already in use by another user.")
            user.contact = payload.contact

    db.commit()
    db.refresh(user)
    log_action(db, current["id"], current["role"], "update_profile", "User", user.id,
               old_value=old_data, new_value={"name": user.name, "business_name": user.business_name})
    return user


@router.post("/me/change-password")
def change_my_password(
    payload: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current=Depends(ANY_STAFF),
):
    """Change password for authenticated user."""
    user = db.query(User).filter(User.id == current["id"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password does not match.")

    if len(payload.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters long.")

    user.password_hash = hash_password(payload.new_password)
    db.commit()
    log_action(db, current["id"], current["role"], "change_password", "User", user.id)
    return {"message": "Password updated successfully"}



@router.get("/", response_model=list[UserListOut])
def list_users(
    role: UserRole | None = None,
    status: UserStatus | None = None,
    db: Session = Depends(get_db),
    current=Depends(ADMIN_ONLY),
):
    """Admin only — list all users with optional filters."""
    query = db.query(User)
    if role:
        query = query.filter(User.role == role)
    if status:
        query = query.filter(User.status == status)
    return query.order_by(User.created_at.desc()).all()


@router.get("/{user_id}", response_model=UserOut)
def get_user(user_id: uuid.UUID, db: Session = Depends(get_db), current=Depends(ADMIN_ONLY)):
    """Admin only — get a single user by ID."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


# ---------------------------------------------------------------------------
# Admin actions
# ---------------------------------------------------------------------------

@router.post("/{user_id}/approve", response_model=UserOut)
def approve_manager(
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    current=Depends(ADMIN_ONLY),
):
    """Admin approves a pending Manager account. (spec section 2.1)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.role != UserRole.produce_manager:
        raise HTTPException(status_code=400, detail="Only Produce Manager accounts require approval.")
    if user.status == UserStatus.active:
        raise HTTPException(status_code=400, detail="Account is already active.")

    user.status = UserStatus.active
    user.approved_by = current["id"]
    user.approved_at = datetime.utcnow()
    db.commit()
    db.refresh(user)
    log_action(db, current["id"], current["role"], "approve_manager", "User", user.id)
    return user


@router.post("/{user_id}/suspend", response_model=UserOut)
def suspend_user(
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    current=Depends(ADMIN_ONLY),
):
    """Admin suspends any user account. (spec section 2.1)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.status == UserStatus.suspended:
        raise HTTPException(status_code=400, detail="Account is already suspended.")
    if str(user.id) == str(current["id"]):
        raise HTTPException(status_code=400, detail="You cannot suspend your own account.")

    user.status = UserStatus.suspended
    db.commit()
    db.refresh(user)
    log_action(db, current["id"], current["role"], "suspend_user", "User", user.id)
    return user


@router.post("/{user_id}/reactivate", response_model=UserOut)
def reactivate_user(
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    current=Depends(ADMIN_ONLY),
):
    """Admin reactivates a suspended account."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.status == UserStatus.active:
        raise HTTPException(status_code=400, detail="Account is already active.")

    user.status = UserStatus.active
    db.commit()
    db.refresh(user)
    log_action(db, current["id"], current["role"], "reactivate_user", "User", user.id)
    return user
