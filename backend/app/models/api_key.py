from sqlalchemy import Column, String, Boolean, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime, UTC
import uuid
from app.db.base import Base


class UserAPIKey(Base):
    """
    Personal API keys for CLI authentication.
    Format: ivt_<random 32 chars>
    Only the SHA-256 hash is stored; the plaintext is shown once on creation.
    """
    __tablename__ = "user_api_keys"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id     = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name        = Column(String(100), nullable=False)           # "My Laptop"
    key_prefix  = Column(String(12), nullable=False)            # "ivt_xxxxxxxx" — visible in UI
    key_hash    = Column(String(64), nullable=False, unique=True)  # SHA-256
    is_active   = Column(Boolean, default=True, nullable=False)
    created_at  = Column(DateTime, default=lambda: datetime.now(UTC))
    last_used_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="api_keys")
