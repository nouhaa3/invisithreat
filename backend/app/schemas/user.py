from pydantic import BaseModel, EmailStr, Field, ConfigDict, field_validator
from typing import Optional
from datetime import datetime
import uuid


class UserBase(BaseModel):
    """Base user schema with common attributes"""
    email: EmailStr
    nom: str = Field(..., min_length=2, max_length=100)


class UserCreate(BaseModel):
    """Schema for user registration - user automatically gets VIEWER role"""
    email: EmailStr
    nom: str = Field(..., min_length=2, max_length=100)
    prenomsecond: Optional[str] = Field(None, min_length=2, max_length=100)
    password: str = Field(..., min_length=8, max_length=100)
    password_confirm: str = Field(..., min_length=8, max_length=100)
    # role_name removed - users always start as VIEWER
    
    @field_validator("password_confirm")
    @classmethod
    def passwords_match(cls, v, info):
        """Validate that password and password_confirm match"""
        if "password" in info.data and v != info.data["password"]:
            raise ValueError("Passwords do not match")
        return v


class UserLogin(BaseModel):
    """Schema for user login"""
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    """Schema for user data in API responses"""
    id: uuid.UUID
    email: str
    nom: str
    profile_picture: Optional[str] = None
    date_creation: datetime
    is_active: bool
    is_pending: bool = True
    is_verified: bool = False  # email verification status
    trial_scans_remaining: int = 2
    requested_role_id: Optional[uuid.UUID] = None
    requested_role_name: Optional[str] = None
    role_id: uuid.UUID
    
    model_config = ConfigDict(from_attributes=True)


class UserWithRole(UserResponse):
    """User response with role information"""
    role_name: str
    role_description: Optional[str] = None


class RoleUpdateRequest(BaseModel):
    """Payload to change a user's role (admin only)"""
    role_name: str


class UserProfileUpdateRequest(BaseModel):
    """Payload to update a user's name or email (admin only)"""
    nom: Optional[str] = Field(None, min_length=2, max_length=100)
    email: Optional[EmailStr] = None


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class VerifyResetCodeRequest(BaseModel):
    email: EmailStr
    code: str = Field(..., min_length=6, max_length=6)


class ResetPasswordRequest(BaseModel):
    reset_token: str
    new_password: str = Field(..., min_length=8, max_length=100)


class UserAdminResponse(UserWithRole):
    """Extended user info for admin views"""


class SelfProfileUpdateRequest(BaseModel):
    """Payload for a user updating their own name, email, or profile picture"""
    nom: Optional[str] = Field(None, min_length=2, max_length=100)
    email: Optional[EmailStr] = None
    profile_picture: Optional[str] = Field(None, description="Base64 encoded profile picture data")


class ChangePasswordRequest(BaseModel):
    """Payload to change own password"""
    current_password: str
    new_password: str = Field(..., min_length=8, max_length=100)


class BulkUserActionRequest(BaseModel):
    """Payload for bulk user operations"""
    user_ids: list[uuid.UUID] = Field(..., min_items=1, max_items=1000)


class BulkUserActionResponse(BaseModel):
    """Response for bulk user operations"""
    success_count: int
    failed_count: int
    errors: dict[str, str] = {}  # user_id -> error message
