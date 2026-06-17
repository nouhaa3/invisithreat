import uuid
from datetime import datetime, UTC

from sqlalchemy import Column, DateTime, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.base import Base


class AIUsageLog(Base):
    """Tracks every 'Assist with AI' invocation for analytics."""

    __tablename__ = "ai_usage_logs"
    __table_args__ = (
        Index("ix_ai_usage_logs_user_id", "user_id"),
        Index("ix_ai_usage_logs_project_id", "project_id"),
        Index("ix_ai_usage_logs_created_at", "created_at"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    user_role = Column(String(50), nullable=True)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True)
    vulnerability_id = Column(UUID(as_uuid=True), nullable=True)
    vulnerability_type = Column(String(255), nullable=True)
    scan_type = Column(String(20), nullable=True)  # SAST / DAST / Secrets / etc.
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(UTC))

    user = relationship("User", foreign_keys=[user_id])
    project = relationship("Project", foreign_keys=[project_id])
