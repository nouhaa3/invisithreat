from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from app.schemas.user import UserWithRole


class Token(BaseModel):
    """JWT token response"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    """Data extracted from JWT token"""
    user_id: Optional[str] = None
    role: Optional[str] = None


class RefreshTokenRequest(BaseModel):
    """Request to refresh access token"""
    refresh_token: str


class ResendVerificationRequest(BaseModel):
    email: EmailStr


class RoleRequest(BaseModel):
    role_name: str = Field(..., min_length=3, max_length=100)


class LoginResponse(BaseModel):
    """Response after login — either full tokens or a pending 2FA challenge."""
    # Full login (no 2FA or 2FA already verified)
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    token_type: str = "bearer"
    user: Optional[UserWithRole] = None
    # 2FA challenge
    totp_required: bool = False
    totp_token: Optional[str] = None
