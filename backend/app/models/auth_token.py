import uuid
from datetime import datetime, UTC

from sqlalchemy import Column, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.base import Base


class AuthToken(Base):
    __tablename__ = "auth_tokens"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    access_token = Column(Text, nullable=False)
    refresh_token = Column(Text, nullable=False)
    expiration = Column(DateTime, nullable=False)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(UTC))

    user = relationship("User", back_populates="auth_tokens")
