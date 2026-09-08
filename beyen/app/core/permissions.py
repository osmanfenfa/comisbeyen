"""
Server-side role enforcement. Every protected endpoint depends on
require_role(...) — the frontend hiding a button is NOT a security boundary,
this is: see requirements section 15.

get_current_user returns a dict with: id, role, name
"""
import uuid
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from app.core.security import decode_access_token
from app.models.user import UserRole

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    try:
        payload = decode_access_token(token)
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    produce_id_str = payload.get("produce_id")
    return {
        "id": uuid.UUID(payload["sub"]),
        "role": payload["role"],
        "name": payload.get("name", ""),
        "produce_id": uuid.UUID(produce_id_str) if produce_id_str else None,
        "station_name": payload.get("station_name"),
        "business_name": payload.get("business_name"),
    }


def require_role(*allowed_roles: UserRole):
    """Usage: Depends(require_role(UserRole.produce_manager, UserRole.system_admin))"""
    def checker(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] not in [r.value for r in allowed_roles]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{user['role']}' is not permitted to perform this action.",
            )
        return user
    return checker
