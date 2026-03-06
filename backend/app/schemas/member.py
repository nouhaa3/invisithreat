from pydantic import BaseModel, EmailStr, ConfigDict
from typing import Optional
from datetime import datetime
import uuid


class MemberInviteRequest(BaseModel):
    email: str
    role_projet: Optional[str] = "Viewer"


class MemberRoleUpdate(BaseModel):
    role_projet: str


class MemberResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    nom: str
    email: str
    role_projet: str
    joined_at: datetime

    model_config = ConfigDict(from_attributes=True)
