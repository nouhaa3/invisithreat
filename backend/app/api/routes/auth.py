from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import HTMLResponse
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session, joinedload
from typing import List
from datetime import timedelta
from app.db.session import get_db
from app.schemas.auth import LoginResponse, Token, RefreshTokenRequest, ResendVerificationRequest, RoleRequest
from app.schemas.user import UserCreate, UserWithRole, RoleUpdateRequest, UserProfileUpdateRequest, UserAdminResponse, ForgotPasswordRequest, VerifyResetCodeRequest, ResetPasswordRequest, SelfProfileUpdateRequest, ChangePasswordRequest, BulkUserActionRequest, BulkUserActionResponse
from app.services.auth import authenticate_user, register_user, get_user_with_role
from app.core.jwt import create_access_token, create_refresh_token, decode_token, get_current_user, require_admin, create_action_token, decode_action_token, create_totp_token
from app.core.api_key_auth import get_user_from_api_key
from app.core.rate_limit import limiter
from app.core.config import settings
from app.core.email import (
    notify_user_approved,
    notify_user_rejected,
    notify_admin_reset_code,
    notify_user_verify_email,
    notify_admin_role_request,
    notify_user_role_request_received,
    notify_user_role_request_approved,
    notify_user_role_changed,
    notify_user_account_activated,
    notify_user_account_deactivated,
    email_is_configured,
)
from app.models.user import User
from app.models.role import Role
from app.services.notification import create_notification
from app.services.audit_log import create_audit_log
from app.services.socketio_service import SocketIOManager
import uuid as _uuid
import random
import string
from datetime import datetime, UTC
from passlib.context import CryptContext as _CryptContext

_pwd_ctx = _CryptContext(schemes=["bcrypt"], deprecated="auto")

router = APIRouter(prefix="/auth", tags=["Authentication"])
PRIMARY_ADMIN_EMAIL = (settings.PRIMARY_ADMIN_EMAIL or "invisithreat@gmail.com").strip().lower()


def _is_primary_admin(user: User) -> bool:
    return (user.email or "").strip().lower() == PRIMARY_ADMIN_EMAIL


def _ensure_not_primary_admin_target(user: User, action: str) -> None:
    if _is_primary_admin(user):
        raise HTTPException(
            status_code=403,
            detail=f"Primary admin account is protected and cannot be {action}"
        )


@router.post("/register", status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def register(
    user_data: UserCreate,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Register a new user with VIEWER role and email verification.
    User receives email verification link and must verify before login.
    """
    _ = request
    user = register_user(db, user_data)

    # Create email verification token (valid for 24 hours)
    verification_token = create_action_token(str(user.id), "verify_email")

    # Send verification email to user (not admin notification)
    email_sent = notify_user_verify_email(user.nom, user.email, verification_token, settings.FRONTEND_URL)

    # Create database notifications for all active admins
    print(f"[SEARCH] [REGISTER] Creating notifications for new user: {user.nom} ({user.email})")
    admin_users = (
        db.query(User)
        .join(Role, User.role_id == Role.id)
        .filter(Role.name == "Admin", User.is_active == True)
        .all()
    )
    print(f"[SEARCH] [REGISTER] Found {len(admin_users)} active admins")
    
    for admin_user in admin_users:
        print(f"[SEARCH] [REGISTER] Creating notification for admin {admin_user.id}")
        notif = create_notification(
            db,
            admin_user.id,
            "system",
            "New User Registration",
            f"{user.nom} ({user.email}) has registered and is pending verification.",
            "/admin",
        )
        print(f"[OK] [REGISTER] Notification created: {notif.id}")

    # Emit WebSocket notification to admins that a new user registered
    print(f"[SEARCH] [REGISTER] Emitting Socket.IO event for new user")
    try:
        await SocketIOManager.notify_user_created({
            'id': user.id,
            'nom': user.nom,
            'email': user.email,
            'role_name': user.role.name if user.role else 'Viewer',
            'is_pending': user.is_pending,
            'date_creation': user.date_creation,
        })
        print(f"[OK] [REGISTER] Socket.IO event sent successfully")
    except Exception as e:
        print(f"[ERROR] [REGISTER] Error sending WebSocket notification: {e}")
        import traceback
        traceback.print_exc()

    return {
        "status": "email_verification_required",
        "message": "Account created! Please verify your email to continue.",
        "email": user.email,
        "nom": user.nom,
        "email_sent": email_sent,
        "verification_url": f"{settings.FRONTEND_URL}/verify-email?token={verification_token}",
    }


@router.post("/resend-verification", tags=["Authentication"])
@limiter.limit("3/minute")
async def resend_verification_email(
    payload: ResendVerificationRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """Resend email verification link for non-verified users."""
    _ = request
    email = payload.email.strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="email is required")

    user = db.query(User).filter(User.email == email).first()
    # Do not leak user existence in production-like flows.
    if not user:
        return {"message": "If this account exists, a verification email has been sent."}

    if getattr(user, "is_verified", False):
        return {"message": "This email is already verified."}

    verification_token = create_action_token(str(user.id), "verify_email")
    sent = notify_user_verify_email(user.nom, user.email, verification_token, settings.FRONTEND_URL)
    if not sent:
        raise HTTPException(
            status_code=503,
            detail="Email service unavailable. Please contact administrator.",
        )

    return {"message": "Verification email sent successfully."}


@router.post("/login", response_model=LoginResponse)
@limiter.limit("10/minute")
async def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """
    Login with email and password
    
    OAuth2 compatible endpoint that returns JWT tokens
    """
    # Authenticate user
    user = authenticate_user(db, form_data.username, form_data.password)
    
    # Get user with role information
    user_with_role = get_user_with_role(db, user)
    
    # Create tokens
    access_token = create_access_token(
        data={"sub": str(user.id), "role": user_with_role["role_name"]}
    )
    refresh_tok = create_refresh_token(
        data={"sub": str(user.id)}
    )

    # If 2FA is enabled, return an intermediate token instead of full access
    if getattr(user, 'totp_enabled', False):
        return LoginResponse(totp_required=True, totp_token=create_totp_token(str(user.id)))

    ip = request.client.host if request.client else None
    create_audit_log(db, user.id, "login", f"Login from {ip or 'unknown'}", ip)

    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_tok,
        token_type="bearer",
        user=UserWithRole(**user_with_role)
    )


@router.post("/refresh", response_model=Token)
@limiter.limit("30/minute")
async def refresh_token(
    refresh_request: RefreshTokenRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Refresh access token using refresh token
    
    Returns new access and refresh tokens
    """
    _ = request
    try:
        # Decode refresh token
        payload = decode_token(refresh_request.refresh_token)
        
        # Verify it's a refresh token
        if payload.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type"
            )
        
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            )
        
        # Get user to verify they still exist and are active
        user = db.query(User).filter(User.id == user_id).first()
        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found or inactive"
            )
        
        # Get role for new access token
        user_with_role = get_user_with_role(db, user)
        
        # Create new tokens
        new_access_token = create_access_token(
            data={"sub": str(user.id), "role": user_with_role["role_name"]}
        )
        new_refresh_token = create_refresh_token(
            data={"sub": str(user.id)}
        )
        
        return Token(
            access_token=new_access_token,
            refresh_token=new_refresh_token,
            token_type="bearer"
        )
        
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate token"
        ) from exc


@router.post("/logout")
async def logout(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Logout current user
    
    Note: JWT tokens are stateless, so logout is handled client-side
    by deleting the tokens. This endpoint confirms the token is valid.
    """
    create_audit_log(db, current_user.id, "logout", "User logged out")
    return {
        "message": "Successfully logged out",
        "detail": "Please delete tokens from client storage"
    }


@router.get("/me", response_model=UserWithRole)
async def get_current_user_info(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get current authenticated user information (JWT auth)
    """
    user_with_role = get_user_with_role(db, current_user)
    return UserWithRole(**user_with_role)


@router.patch("/me", response_model=UserWithRole)
async def update_my_profile(
    payload: SelfProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Authenticated user updates their own name, email, or profile picture."""
    if payload.nom is not None:
        current_user.nom = payload.nom
    if payload.email is not None:
        if _is_primary_admin(current_user) and payload.email.strip().lower() != PRIMARY_ADMIN_EMAIL:
            raise HTTPException(status_code=403, detail="Primary admin email cannot be changed")
        existing = db.query(User).filter(User.email == payload.email, User.id != current_user.id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already in use")
        current_user.email = payload.email
    
    # Handle profile picture update or deletion
    if payload.profile_picture is not None:
        # Allow clearing the profile picture with empty string
        if payload.profile_picture == "":
            current_user.profile_picture = None
        else:
            # Validate base64 image size (max 5MB)
            import base64
            try:
                # Check if it's a valid base64 data URI
                if payload.profile_picture.startswith('data:image/'):
                    # Data URI format: data:image/png;base64,xxxxx
                    parts = payload.profile_picture.split(',', 1)
                    if len(parts) == 2:
                        image_data = parts[1]
                    else:
                        image_data = payload.profile_picture
                else:
                    image_data = payload.profile_picture
                
                # Estimate decoded size (base64 is ~33% larger than original)
                decoded_size = len(base64.b64decode(image_data))
                if decoded_size > 5 * 1024 * 1024:  # 5MB limit
                    raise HTTPException(status_code=400, detail="Profile picture must be smaller than 5MB")
            except Exception as e:
                if isinstance(e, HTTPException):
                    raise
                raise HTTPException(status_code=400, detail="Invalid image format")
            current_user.profile_picture = payload.profile_picture
    
    db.commit()
    db.refresh(current_user)
    create_audit_log(db, current_user.id, "profile_updated", "Profile updated")
    return UserWithRole(**get_user_with_role(db, current_user))


@router.post("/me/change-password", status_code=status.HTTP_204_NO_CONTENT)
async def change_my_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Authenticated user changes their own password (must supply current password)."""
    if not _pwd_ctx.verify(payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    current_user.hashed_password = _pwd_ctx.hash(payload.new_password)
    db.commit()
    create_audit_log(db, current_user.id, "password_changed", "Password changed via settings")


@router.get("/cli/me", response_model=UserWithRole)
async def get_current_cli_user_info(
    current_user: User = Depends(get_user_from_api_key),
    db: Session = Depends(get_db)
):
    """
    Get current authenticated user information (API Key auth for CLI)
    """
    user_with_role = get_user_with_role(db, current_user)
    return UserWithRole(**user_with_role)


# ─── Forgot password flow ────────────────────────────────────────────────────

@router.post("/forgot-password", tags=["Authentication"])
@limiter.limit("5/minute")
async def forgot_password(
    payload: ForgotPasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """Step 1 — request a reset code. A 6-digit code is emailed to the admin who relays it."""
    _ = request
    user = db.query(User).filter(User.email == payload.email).first()
    # Always return the same response to not leak whether the email exists
    if not user or not user.is_active:
        return {"message": "If this email is registered and active, the administrator has been notified."}
    code = ''.join(random.choices(string.digits, k=6))
    user.reset_code = code
    user.reset_code_expires = datetime.now(UTC) + timedelta(minutes=30)
    db.commit()
    notify_admin_reset_code(user.nom, user.email, code)
    return {"message": "If this email is registered and active, the administrator has been notified."}


@router.post("/verify-reset-code", tags=["Authentication"])
@limiter.limit("10/minute")
async def verify_reset_code(
    payload: VerifyResetCodeRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """Step 2 — verify the 6-digit code and get a short-lived reset token."""
    _ = request
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not user.reset_code or not user.reset_code_expires:
        raise HTTPException(status_code=400, detail="Invalid code or request expired")
    if datetime.now(UTC) > user.reset_code_expires.replace(tzinfo=UTC):
        raise HTTPException(status_code=400, detail="Code has expired. Please request a new one.")
    if payload.code != user.reset_code:
        raise HTTPException(status_code=400, detail="Incorrect code")
    # Issue a short-lived reset token (10 min)
    reset_token = create_action_token(str(user.id), "reset_password", expires_days=0)
    # We override with a 10-minute token using timedelta directly
    from jose import jwt as _jose_jwt
    reset_token = _jose_jwt.encode(
        {"sub": str(user.id), "type": "admin_action", "action": "reset_password",
         "exp": datetime.now(UTC) + timedelta(minutes=10)},
        settings.SECRET_KEY, algorithm="HS256"
    )
    # Invalidate the code immediately
    user.reset_code = None
    user.reset_code_expires = None
    db.commit()
    return {"reset_token": reset_token}


@router.post("/reset-password", tags=["Authentication"])
@limiter.limit("5/minute")
async def reset_password(
    payload: ResetPasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """Step 3 — set a new password using the reset token."""
    _ = request
    user_id = decode_action_token(payload.reset_token, "reset_password")
    user = db.query(User).filter(User.id == _uuid.UUID(user_id)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.hashed_password = _pwd_ctx.hash(payload.new_password)
    db.commit()
    return {"message": "Password updated successfully"}


# ─── Public one-click admin action links (embedded in emails) ────────────────
def _html_page(title: str, icon: str, heading: str, body: str, color: str) -> str:
    return f"""<!DOCTYPE html>
<html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>
<title>{title} — InvisiThreat</title>
<style>*{{box-sizing:border-box;margin:0;padding:0}}body{{background:#080808;font-family:'Segoe UI',Arial,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}}.card{{background:#111;border:1px solid rgba(255,255,255,.06);border-radius:20px;max-width:480px;width:100%;padding:48px 40px;text-align:center}}.icon{{font-size:48px;margin-bottom:20px}}.heading{{color:#fff;font-size:24px;font-weight:700;margin-bottom:12px}}.body{{color:rgba(255,255,255,.4);font-size:14px;line-height:1.7;margin-bottom:32px}}.btn{{display:inline-block;background:{color};color:#fff;font-weight:700;font-size:14px;text-decoration:none;padding:12px 28px;border-radius:10px}}.brand{{margin-top:32px;color:rgba(255,255,255,.15);font-size:12px}}</style></head>
<body><div class='card'><div class='icon'>{icon}</div><div class='heading'>{heading}</div><div class='body'>{body}</div><a class='btn' href='{settings.FRONTEND_URL}/login'>Go to platform</a><div class='brand'>InvisiThreat · DevSecOps Platform</div></div></body></html>"""


@router.get("/action/verify-email/{token}", response_class=HTMLResponse, tags=["Auth"], include_in_schema=False)
async def email_verify_user(token: str, db: Session = Depends(get_db)):
    """Public link — verify user email (called from signup confirmation email)."""
    user_id = decode_action_token(token, "verify_email")
    user = db.query(User).filter(User.id == _uuid.UUID(user_id)).first()
    if not user:
        return HTMLResponse(_html_page("Error", "❌", "User not found",
            "This user no longer exists in the platform.", "#ef4444"), status_code=404)
    if getattr(user, 'is_verified', False):
        return HTMLResponse(_html_page("Already Verified", "ℹ️", "Email already verified",
            f"Your email <strong style='color:#fff'>{user.email}</strong> is already verified.<br>You can now log in.", "#3b82f6"))
    user.is_verified = True
    db.commit()
    db.refresh(user)
    return HTMLResponse(_html_page("Verified", "[OK]", "Email verified!",
        f"Your email <strong style='color:#fff'>{user.email}</strong> is now verified.<br>You can now log in and access your dashboard.",
        "#16a34a"))


@router.post("/request-role", tags=["Authentication"])
@limiter.limit("5/minute")
async def request_role(
    payload: RoleRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Authenticated user requests a role upgrade.
    Sets requested_role_id and notifies admins via dashboard.
    Only VIEWER role with no pending request can request.
    """
    _ = request
    if str(current_user.role.name) != "Viewer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Viewer role users can request role changes"
        )
    if current_user.requested_role_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You already have a pending role request"
        )
    
    role_name = payload.role_name

    allowed_requests = {"Developer", "Security Manager"}
    if role_name not in allowed_requests:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only Developer or Security Manager roles can be requested",
        )
    
    requested_role = db.query(Role).filter(Role.name == role_name).first()
    if not requested_role:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Role '{role_name}' not found"
        )
    if role_name == "Viewer":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot request Viewer role (you already have it)"
        )
    
    current_user.requested_role_id = requested_role.id
    db.commit()
    db.refresh(current_user)
    create_audit_log(db, current_user.id, "role_request", f"Requested role: {role_name}")

    admin_users = (
        db.query(User)
        .join(Role, User.role_id == Role.id)
        .filter(Role.name == "Admin", User.is_active == True)
        .all()
    )
    for admin_user in admin_users:
        create_notification(
            db,
            admin_user.id,
            "system",
            "New Role Request",
            f"{current_user.nom} requested {role_name} role.",
            "/admin",
        )

    create_notification(
        db,
        current_user.id,
        "system",
        "Role Request Submitted",
        f"Your request for {role_name} role was sent to administrators.",
        "/dashboard",
    )

    notify_admin_role_request(current_user.nom, current_user.email, role_name)
    notify_user_role_request_received(current_user.nom, current_user.email, role_name)
    
    return {
        "status": "pending",
        "message": f"Your request for {role_name} role has been submitted to the administrators.",
        "requested_role": role_name
    }


@router.get("/action/approve/{token}", response_class=HTMLResponse, tags=["Admin"], include_in_schema=False)
async def email_approve_user(token: str, db: Session = Depends(get_db)):
    """Public one-click link — approve a pending user (called from admin email)."""
    user_id = decode_action_token(token, "approve")
    user = db.query(User).filter(User.id == _uuid.UUID(user_id)).first()
    if not user:
        return HTMLResponse(_html_page("Error", "❌", "User not found",
            "This user no longer exists in the platform.", "#ef4444"), status_code=404)
    if not user.is_pending:
        already = "active" if user.is_active else "already rejected"
        return HTMLResponse(_html_page("Already processed", "ℹ️", "Already processed",
            f"This account has already been reviewed ({already}).", "#6b7280"))
    user.is_active  = True
    user.is_pending = False
    db.commit()
    db.refresh(user)
    notify_user_approved(user.nom, user.email)
    return HTMLResponse(_html_page("Approved", "[OK]", f"{user.nom} has been approved!",
        f"The account for <strong style='color:#fff'>{user.email}</strong> is now active.<br>They received a confirmation email.",
        "#16a34a"))


@router.get("/action/reject/{token}", response_class=HTMLResponse, tags=["Admin"], include_in_schema=False)
async def email_reject_user(token: str, db: Session = Depends(get_db)):
    """Public one-click link — reject a pending user (called from admin email)."""
    user_id = decode_action_token(token, "reject")
    user = db.query(User).filter(User.id == _uuid.UUID(user_id)).first()
    if not user:
        return HTMLResponse(_html_page("Error", "❌", "User not found",
            "This user no longer exists in the platform.", "#ef4444"), status_code=404)
    if not user.is_pending:
        already = "active" if user.is_active else "already rejected"
        return HTMLResponse(_html_page("Already processed", "ℹ️", "Already processed",
            f"This account has already been reviewed ({already}).", "#6b7280"))
    user.is_active  = False
    user.is_pending = False
    db.commit()
    db.refresh(user)
    notify_user_rejected(user.nom, user.email)
    return HTMLResponse(_html_page("Rejected", "🚫", f"{user.nom}'s request has been rejected",
        f"The account request for <strong style='color:#fff'>{user.email}</strong> has been declined.<br>They received a notification email.",
        "#dc2626"))


# ─── Admin routes ─────────────────────────────────────────────────────────────

@router.get("/admin/users", response_model=List[UserAdminResponse], tags=["Admin"])
async def admin_list_users(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Admin only — list every user with their role."""
    # Use joinedload to eagerly fetch roles - prevents N+1 query problem (1 query instead of 54)
    users = db.query(User).options(joinedload(User.role)).order_by(User.date_creation.desc()).all()
    return [UserAdminResponse(**get_user_with_role(db, u)) for u in users]


@router.patch("/admin/users/{user_id}/role", response_model=UserAdminResponse, tags=["Admin"])
async def admin_change_role(
    user_id: str,
    payload: RoleUpdateRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Admin only — change a user's role."""
    if not email_is_configured():
        raise HTTPException(status_code=503, detail="Email service is not configured. Contact an administrator.")

    user = db.query(User).filter(User.id == _uuid.UUID(user_id)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    _ensure_not_primary_admin_target(user, "modified")
    if str(user.id) == str(admin.id):
        raise HTTPException(status_code=400, detail="Cannot change your own role")
    old_role = user.role.name if user.role else "Unknown"
    role = db.query(Role).filter(Role.name == payload.role_name).first()
    if not role:
        raise HTTPException(status_code=400, detail=f"Role '{payload.role_name}' not found")
    user.role_id = role.id
    # If the user had a pending request, resolve it when admin applies a role manually.
    if user.requested_role_id:
        user.requested_role_id = None
    db.commit()
    db.refresh(user)
    
    # Notify user that their role was changed
    create_notification(
        db,
        user_id=user.id,
        type="system",
        title="Your role has been updated",
        message=f"{admin.nom} changed your role to {payload.role_name}.",
        link="/settings",
    )

    notify_user_role_changed(user.nom, user.email, old_role, payload.role_name, admin.nom, settings.FRONTEND_URL)
    
    return UserAdminResponse(**get_user_with_role(db, user))


@router.patch("/admin/users/{user_id}/toggle-active", response_model=UserAdminResponse, tags=["Admin"])
async def admin_toggle_active(
    user_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Admin only — activate or deactivate a user account (sends email to user)."""
    if not email_is_configured():
        raise HTTPException(status_code=503, detail="Email service is not configured. Contact an administrator.")

    user = db.query(User).filter(User.id == _uuid.UUID(user_id)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    _ensure_not_primary_admin_target(user, "deactivated")
    if str(user.id) == str(admin.id):
        raise HTTPException(status_code=400, detail="Cannot deactivate your own account")
    user.is_active = not user.is_active
    if user.is_active:
        user.is_pending = False   # clear pending flag when manually activated
    db.commit()
    db.refresh(user)
    if user.is_active:
        notify_user_account_activated(user.nom, user.email, admin.nom, settings.FRONTEND_URL)
    else:
        notify_user_account_deactivated(user.nom, user.email, admin.nom, settings.FRONTEND_URL)
    
    # Emit WebSocket notification to admins
    try:
        await SocketIOManager.notify_user_status_changed(str(user.id), user.is_active)
    except Exception as e:
        print(f"Error sending WebSocket notification: {e}")
    
    return UserAdminResponse(**get_user_with_role(db, user))


@router.post("/admin/users/{user_id}/approve-role-request", response_model=UserAdminResponse, tags=["Admin"])
async def admin_approve_role_request(
    user_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Admin only — approve a user's role request and grant the role."""
    user = db.query(User).filter(User.id == _uuid.UUID(user_id)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    _ensure_not_primary_admin_target(user, "modified")
    if not user.requested_role_id:
        raise HTTPException(status_code=400, detail="User has no pending role request")
    
    # Grant the requested role and expire trial banner/scans
    user.role_id = user.requested_role_id
    user.requested_role_id = None
    user.trial_scans_remaining = 0
    db.commit()
    db.refresh(user)
    
    requested_role = db.query(Role).filter(Role.id == user.role_id).first()
    role_name = requested_role.name if requested_role else "Unknown"
    create_audit_log(db, admin.id, "role_approved", f"Approved {user.email} for {role_name} role")

    create_notification(
        db,
        user.id,
        "system",
        "Role Request Approved",
        f"Your role has been upgraded to {role_name}.",
        "/dashboard",
    )
    notify_user_role_request_approved(user.nom, user.email, role_name)

    create_notification(
        db,
        admin.id,
        "system",
        "Role Approval Completed",
        f"You approved {user.email} for {role_name} role.",
        "/admin",
    )
    
    return UserAdminResponse(**get_user_with_role(db, user))


@router.post("/admin/users/{user_id}/approve", response_model=UserAdminResponse, tags=["Admin"])
async def admin_approve_user(
    user_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Admin only — approve a pending user request (sends approval email)."""
    user = db.query(User).filter(User.id == _uuid.UUID(user_id)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    _ensure_not_primary_admin_target(user, "modified")
    if str(user.id) == str(admin.id):
        raise HTTPException(status_code=400, detail="Cannot approve your own account")
    user.is_active = True
    user.is_pending = False
    db.commit()
    db.refresh(user)
    notify_user_approved(user.nom, user.email)
    return UserAdminResponse(**get_user_with_role(db, user))


@router.post("/admin/users/{user_id}/reject", response_model=UserAdminResponse, tags=["Admin"])
async def admin_reject_user(
    user_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Admin only — reject a pending user request (sends rejection email)."""
    user = db.query(User).filter(User.id == _uuid.UUID(user_id)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    _ensure_not_primary_admin_target(user, "modified")
    if str(user.id) == str(admin.id):
        raise HTTPException(status_code=400, detail="Cannot reject your own account")
    user.is_active = False
    user.is_pending = False
    db.commit()
    db.refresh(user)
    notify_user_rejected(user.nom, user.email)
    return UserAdminResponse(**get_user_with_role(db, user))


@router.patch("/admin/users/{user_id}/profile", response_model=UserAdminResponse, tags=["Admin"])
async def admin_update_profile(
    user_id: str,
    payload: UserProfileUpdateRequest,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Admin only — update a user's name or email."""
    user = db.query(User).filter(User.id == _uuid.UUID(user_id)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    _ensure_not_primary_admin_target(user, "modified")
    if payload.nom is not None:
        user.nom = payload.nom
    if payload.email is not None:
        existing = db.query(User).filter(User.email == payload.email, User.id != user.id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already in use")
        user.email = payload.email
    db.commit()
    db.refresh(user)
    return UserAdminResponse(**get_user_with_role(db, user))


@router.delete("/admin/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Admin"])
async def admin_delete_user(
    user_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Admin only — permanently delete a user account."""
    user = db.query(User).filter(User.id == _uuid.UUID(user_id)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    _ensure_not_primary_admin_target(user, "deleted")
    if str(user.id) == str(admin.id):
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    # Store user_id before deletion for notification
    deleted_user_id = str(user.id)
    db.delete(user)
    db.commit()
    
    # Emit WebSocket notification to admins
    try:
        await SocketIOManager.notify_user_deleted(deleted_user_id)
    except Exception as e:
        print(f"Error sending WebSocket notification: {e}")


# ─── Bulk user operations ─────────────────────────────────────────────────────

@router.post("/admin/users/bulk/delete", response_model=BulkUserActionResponse, tags=["Admin"])
async def admin_bulk_delete_users(
    payload: BulkUserActionRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Admin only — bulk delete multiple user accounts."""
    success_count = 0
    failed_count = 0
    errors = {}
    
    for user_id in payload.user_ids:
        try:
            user = db.query(User).filter(User.id == user_id).first()
            if not user:
                failed_count += 1
                errors[str(user_id)] = "User not found"
                continue
            
            # Check if it's the primary admin
            if _is_primary_admin(user):
                failed_count += 1
                errors[str(user_id)] = "Primary admin account is protected and cannot be deleted"
                continue
            
            # Check if user is trying to delete themselves
            if str(user.id) == str(admin.id):
                failed_count += 1
                errors[str(user_id)] = "Cannot delete your own account"
                continue
            
            db.delete(user)
            success_count += 1
        except HTTPException as e:
            failed_count += 1
            errors[str(user_id)] = e.detail
        except Exception as e:
            failed_count += 1
            errors[str(user_id)] = "An unexpected error occurred"
    
    db.commit()
    
    # Emit WebSocket notifications to admins for each deleted user
    try:
        for user_id in payload.user_ids:
            if str(user_id) not in [k for k in errors.keys()]:
                await SocketIOManager.notify_user_deleted(str(user_id))
    except Exception as e:
        print(f"Error sending WebSocket notification: {e}")
    
    # Create audit log for bulk deletion
    if success_count > 0:
        create_audit_log(db, admin.id, "bulk_delete_users", f"Deleted {success_count} user(s)")
    
    return BulkUserActionResponse(success_count=success_count, failed_count=failed_count, errors=errors)


@router.patch("/admin/users/bulk/activate", response_model=BulkUserActionResponse, tags=["Admin"])
async def admin_bulk_activate_users(
    payload: BulkUserActionRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Admin only — bulk activate multiple user accounts."""
    if not email_is_configured():
        raise HTTPException(status_code=503, detail="Email service is not configured. Contact an administrator.")
    
    success_count = 0
    failed_count = 0
    errors = {}
    
    for user_id in payload.user_ids:
        try:
            user = db.query(User).filter(User.id == user_id).first()
            if not user:
                failed_count += 1
                errors[str(user_id)] = "User not found"
                continue
            
            # Check if it's the primary admin
            if _is_primary_admin(user):
                failed_count += 1
                errors[str(user_id)] = "Primary admin account is protected and cannot be modified"
                continue
            
            # Check if user is trying to activate themselves
            if str(user.id) == str(admin.id):
                failed_count += 1
                errors[str(user_id)] = "Cannot deactivate your own account"
                continue
            
            # Only activate if not already active
            if not user.is_active:
                user.is_active = True
                user.is_pending = False
                db.flush()
                notify_user_account_activated(user.nom, user.email, admin.nom, settings.FRONTEND_URL)
            
            success_count += 1
        except HTTPException as e:
            failed_count += 1
            errors[str(user_id)] = e.detail
        except Exception as e:
            failed_count += 1
            errors[str(user_id)] = "An unexpected error occurred"
    
    db.commit()
    
    # Emit WebSocket notifications to admins for each activated user
    try:
        for user_id in payload.user_ids:
            if str(user_id) not in [k for k in errors.keys()]:
                await SocketIOManager.notify_user_status_changed(str(user_id), True)
    except Exception as e:
        print(f"Error sending WebSocket notification: {e}")
    
    # Create audit log for bulk activation
    if success_count > 0:
        create_audit_log(db, admin.id, "bulk_activate_users", f"Activated {success_count} user(s)")
    
    return BulkUserActionResponse(success_count=success_count, failed_count=failed_count, errors=errors)


@router.patch("/admin/users/bulk/deactivate", response_model=BulkUserActionResponse, tags=["Admin"])
async def admin_bulk_deactivate_users(
    payload: BulkUserActionRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Admin only — bulk deactivate multiple user accounts."""
    if not email_is_configured():
        raise HTTPException(status_code=503, detail="Email service is not configured. Contact an administrator.")
    
    success_count = 0
    failed_count = 0
    errors = {}
    
    for user_id in payload.user_ids:
        try:
            user = db.query(User).filter(User.id == user_id).first()
            if not user:
                failed_count += 1
                errors[str(user_id)] = "User not found"
                continue
            
            # Check if it's the primary admin
            if _is_primary_admin(user):
                failed_count += 1
                errors[str(user_id)] = "Primary admin account is protected and cannot be modified"
                continue
            
            # Check if user is trying to deactivate themselves
            if str(user.id) == str(admin.id):
                failed_count += 1
                errors[str(user_id)] = "Cannot deactivate your own account"
                continue
            
            # Only deactivate if active
            if user.is_active:
                user.is_active = False
                db.flush()
                notify_user_account_deactivated(user.nom, user.email, admin.nom, settings.FRONTEND_URL)
            
            success_count += 1
        except HTTPException as e:
            failed_count += 1
            errors[str(user_id)] = e.detail
        except Exception as e:
            failed_count += 1
            errors[str(user_id)] = "An unexpected error occurred"
    
    db.commit()
    
    # Emit WebSocket notifications to admins for each deactivated user
    try:
        for user_id in payload.user_ids:
            if str(user_id) not in [k for k in errors.keys()]:
                await SocketIOManager.notify_user_status_changed(str(user_id), False)
    except Exception as e:
        print(f"Error sending WebSocket notification: {e}")
    
    # Create audit log for bulk deactivation
    if success_count > 0:
        create_audit_log(db, admin.id, "bulk_deactivate_users", f"Deactivated {success_count} user(s)")
    
    return BulkUserActionResponse(success_count=success_count, failed_count=failed_count, errors=errors)
