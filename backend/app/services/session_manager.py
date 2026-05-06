from __future__ import annotations

import hashlib
import uuid
from datetime import datetime, UTC

from jose import jwt
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.auth_token import AuthToken


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _decode_refresh_unverified(token: str) -> dict:
    # Signature is trusted here because caller already validated with decode_token().
    return jwt.get_unverified_claims(token)


def create_refresh_session(db: Session, user_id: uuid.UUID, refresh_token: str) -> AuthToken:
    payload = _decode_refresh_unverified(refresh_token)
    expires_ts = payload.get("exp")
    token_jti = (payload.get("jti") or "").strip()
    if not token_jti or not expires_ts:
        raise ValueError("refresh token missing jti/exp")

    session = AuthToken(
        user_id=user_id,
        token_jti=token_jti,
        refresh_token_hash=_token_hash(refresh_token),
        session_type="refresh",
        expires_at=datetime.fromtimestamp(int(expires_ts), tz=UTC),
        is_active=True,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def validate_refresh_session(db: Session, user_id: uuid.UUID, refresh_token: str) -> AuthToken | None:
    payload = _decode_refresh_unverified(refresh_token)
    token_jti = (payload.get("jti") or "").strip()
    if not token_jti:
        return None

    session = (
        db.query(AuthToken)
        .filter(
            AuthToken.user_id == user_id,
            AuthToken.token_jti == token_jti,
            AuthToken.session_type == "refresh",
            AuthToken.is_active == True,  # noqa: E712
        )
        .first()
    )
    if not session:
        return None

    if session.revoked_at is not None:
        return None
    if session.expires_at <= datetime.now(UTC):
        return None
    if session.refresh_token_hash != _token_hash(refresh_token):
        return None
    return session


def rotate_refresh_session(db: Session, old_session: AuthToken, new_refresh_token: str) -> AuthToken:
    old_session.is_active = False
    old_session.revoked_at = datetime.now(UTC)
    db.flush()
    return create_refresh_session(db, old_session.user_id, new_refresh_token)


def revoke_all_user_sessions(db: Session, user_id: uuid.UUID) -> int:
    now = datetime.now(UTC)
    sessions = (
        db.query(AuthToken)
        .filter(AuthToken.user_id == user_id, AuthToken.is_active == True)  # noqa: E712
        .all()
    )
    for session in sessions:
        session.is_active = False
        session.revoked_at = now
    db.commit()
    return len(sessions)
