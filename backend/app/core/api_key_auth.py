"""
API Key authentication dependency.
Accepts:  Authorization: ApiKey ivt_xxxxx...
Returns the authenticated User, or raises 401.
"""
import hashlib
from fastapi import Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from datetime import datetime, UTC

from app.db.session import get_db
from app.models.user import User
from app.models.api_key import UserAPIKey


def _hash_key(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


async def get_user_from_api_key(
    request: Request,
    db: Session = Depends(get_db),
) -> User:
    """
    FastAPI dependency: validates an API key and returns the associated User.
    Raises HTTP 401 if missing, invalid, or inactive.
    """
    auth_header = request.headers.get("authorization")
    
    if not auth_header:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header. Use: Authorization: ApiKey ivt_...",
        )
    
    # Parse "ApiKey TOKEN" format
    parts = auth_header.split(" ", 1)
    
    if len(parts) != 2 or parts[0].lower() != "apikey":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid auth format. Use: Authorization: ApiKey ivt_...",
        )
    
    raw = parts[1]
    key_hash = _hash_key(raw)

    api_key = (
        db.query(UserAPIKey)
        .filter(UserAPIKey.key_hash == key_hash, UserAPIKey.is_active == True)
        .first()
    )
    
    if not api_key:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or revoked API key")

    # Update last_used
    api_key.last_used_at = datetime.now(UTC)
    db.commit()

    user = db.query(User).filter(User.id == api_key.user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User account inactive")
    return user
