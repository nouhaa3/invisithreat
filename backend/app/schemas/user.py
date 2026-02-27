from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional
from datetime import datetime
import uuid


class UserBase(BaseModel):
    """Base user schema with common attributes"""
    email: EmailStr
    nom: str = Field(..., min_length=2, max_length=100)


class UserCreate(BaseModel):
    """Schema for user registration"""
    email: EmailStr
    nom: str = Field(..., min_length=2, max_length=100)
    password: str = Field(..., min_length=8, max_length=100)
    role_name: str = Field(
        default="Viewer", 
        description="Role name: Admin, Developer, Security Manager, or Viewer"
    )


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
    role_id: uuid.UUID
    
    model_config = ConfigDict(from_attributes=True)


class UserWithRole(UserResponse):
    """User response with role information"""
    role_name: str
    role_description: Optional[str] = None
