from pydantic import BaseModel
from datetime import datetime
from typing import Optional
import uuid


class NotificationOut(BaseModel):
    id: uuid.UUID
    type: str
    title: str
    message: Optional[str] = None
    link: Optional[str] = None
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


class UnreadCountOut(BaseModel):
    count: int
