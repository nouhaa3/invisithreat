from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.jwt import get_current_user, create_access_token, create_refresh_token, decode_token
from app.core.rate_limit import limiter
from app.models.user import User
from app.services.totp import generate_secret, get_totp_uri, generate_qr_base64, verify_totp

router = APIRouter(prefix="/auth/2fa", tags=["Two-Factor Auth"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class SetupResponse(BaseModel):
    secret: str
    otpauth_uri: str
    qr_image: str  # base64 PNG data URL


class CodeRequest(BaseModel):
    code: str


class VerifyLoginRequest(BaseModel):
    totp_token: str
    code: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/status")
async def get_2fa_status(
    current_user: User = Depends(get_current_user),
):
    return {"totp_enabled": bool(current_user.totp_enabled)}


@router.post("/setup", response_model=SetupResponse)
@limiter.limit("5/minute")
async def setup_2fa(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate (or regenerate) a TOTP secret — not active until /enable is called."""
    _ = request
    if current_user.totp_enabled:
        raise HTTPException(status_code=400, detail="2FA is already enabled. Disable it first.")
    secret = generate_secret()
    current_user.totp_secret = secret
    db.commit()
    return SetupResponse(
        secret=secret,
        otpauth_uri=get_totp_uri(secret, current_user.email),
        qr_image=generate_qr_base64(secret, current_user.email),
    )


@router.post("/enable")
@limiter.limit("5/minute")
async def enable_2fa(
    body: CodeRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Confirm the setup by verifying the first TOTP code."""
    _ = request
    if current_user.totp_enabled:
        raise HTTPException(status_code=400, detail="2FA is already enabled.")
    if not current_user.totp_secret:
        raise HTTPException(status_code=400, detail="Run /setup first.")
    if not verify_totp(current_user.totp_secret, body.code):
        raise HTTPException(status_code=400, detail="Invalid code. Please try again.")
    current_user.totp_enabled = True
    db.commit()
    return {"message": "2FA has been enabled."}


@router.post("/disable")
@limiter.limit("5/minute")
async def disable_2fa(
    body: CodeRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Disable 2FA after confirming with a valid TOTP code."""
    _ = request
    if not current_user.totp_enabled:
        raise HTTPException(status_code=400, detail="2FA is not enabled.")
    if not verify_totp(current_user.totp_secret, body.code):
        raise HTTPException(status_code=400, detail="Invalid code. Please try again.")
    current_user.totp_enabled = False
    current_user.totp_secret = None
    db.commit()
    return {"message": "2FA has been disabled."}


@router.post("/verify-login")
@limiter.limit("10/minute")
async def verify_login_totp(
    body: VerifyLoginRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """Complete a login that required 2FA: verify code and return full tokens."""
    _ = request
    from app.services.auth import get_user_with_role
    from app.schemas.auth import LoginResponse
    from app.schemas.user import UserWithRole

    payload = decode_token(body.totp_token)
    if payload.get("type") != "totp_pending":
        raise HTTPException(status_code=400, detail="Invalid token type.")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=400, detail="Invalid token payload.")

    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive.")

    if not user.totp_secret or not verify_totp(user.totp_secret, body.code):
        raise HTTPException(status_code=400, detail="Invalid authenticator code.")

    user_with_role = get_user_with_role(db, user)
    access_token = create_access_token(data={"sub": str(user.id), "role": user_with_role["role_name"]})
    refresh_tok = create_refresh_token(data={"sub": str(user.id)})

    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_tok,
        token_type="bearer",
        user=UserWithRole(**user_with_role),
    )
