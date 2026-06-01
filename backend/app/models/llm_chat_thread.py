from datetime import datetime, UTC
import uuid

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import UUID

from app.db.base import Base


class LLMChatThread(Base):
    __tablename__ = "llm_chat_threads"
    __table_args__ = (
        Index("ix_llm_threads_project_user_last", "project_id", "user_id", "last_message_at"),
        Index("ix_llm_threads_user_updated", "user_id", "updated_at"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    title = Column(String(180), nullable=False, default="New chat")
    target_payload = Column(Text, nullable=True)
    messages = Column(Text, nullable=False, default="[]")

    archived = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(UTC))
    updated_at = Column(DateTime, nullable=False, default=lambda: datetime.now(UTC))
    last_message_at = Column(DateTime, nullable=False, default=lambda: datetime.now(UTC), index=True)