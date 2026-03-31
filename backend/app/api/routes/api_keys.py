"""
API Key management routes — users create/list/revoke personal CLI tokens.
"""
import hashlib, secrets, uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session
from typing import Optional

from app.db.session import get_db
from app.core.jwt import get_current_user
from app.core.rate_limit import limiter
from app.models.user import User
from app.models.api_key import UserAPIKey
from app.services.audit_log import create_audit_log

router = APIRouter(prefix="/auth/api-keys", tags=["API Keys"])

KEY_PREFIX = "ivt_"


def _hash(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


# ── Schemas ───────────────────────────────────────────────────────────────────

class APIKeyCreate(BaseModel):
    name: str = "My Key"


class APIKeyCreatedResponse(BaseModel):
    id: uuid.UUID
    name: str
    key_prefix: str
    plaintext: str          # shown ONCE — not stored
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class APIKeyResponse(BaseModel):
    id: uuid.UUID
    name: str
    key_prefix: str
    is_active: bool
    created_at: datetime
    last_used_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("", response_model=APIKeyCreatedResponse, status_code=201)
@limiter.limit("10/hour")
async def create_api_key(
    body: APIKeyCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate a new personal API key. The plaintext is returned once and never stored."""
    _ = request
    raw   = KEY_PREFIX + secrets.token_urlsafe(32)
    prefix = raw[:12]          # "ivt_xxxxxxxx"
    record = UserAPIKey(
        id=uuid.uuid4(),
        user_id=current_user.id,
        name=body.name,
        key_prefix=prefix,
        key_hash=_hash(raw),
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    create_audit_log(db, current_user.id, "api_key_created", f'API key "{body.name}" created')
    return APIKeyCreatedResponse(
        id=record.id,
        name=record.name,
        key_prefix=record.key_prefix,
        plaintext=raw,
        created_at=record.created_at,
    )


@router.get("", response_model=list[APIKeyResponse])
async def list_api_keys(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    keys = db.query(UserAPIKey).filter(
        UserAPIKey.user_id == current_user.id,
        UserAPIKey.is_active == True,
    ).order_by(UserAPIKey.created_at.desc()).all()
    return keys


@router.delete("/{key_id}", status_code=204)
async def revoke_api_key(
    key_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    key = db.query(UserAPIKey).filter(
        UserAPIKey.id == key_id,
        UserAPIKey.user_id == current_user.id,
    ).first()
    if not key:
        raise HTTPException(status_code=404, detail="API key not found")
    key.is_active = False
    db.commit()
    create_audit_log(db, current_user.id, "api_key_revoked", f'API key "{key.name}" revoked')
