from pydantic import BaseModel
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


class LoginResponse(BaseModel):
    """Response after successful login"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserWithRole
