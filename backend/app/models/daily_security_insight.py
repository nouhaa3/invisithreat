from __future__ import annotations

import uuid
from datetime import datetime, UTC

from sqlalchemy import Column, Date, DateTime, Enum, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.base import Base


class TrendStatus(str):
    improving = "Improving"
    stable = "Stable"
    worsening = "Worsening"


class DailySecurityInsight(Base):
    __tablename__ = "daily_security_insights"
    __table_args__ = (
        # Composite unique index: one insight per user/project/date
        Index(
            "uix_daily_insight_user_project_date",
            "user_id",
            "project_id",
            "date",
            unique=True,
        ),
        Index("ix_daily_insight_user_date", "user_id", "date"),
        Index("ix_daily_insight_project_date", "project_id", "date"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=True)
    date = Column(Date, nullable=False)
    generated_insight = Column(Text, nullable=False)
    trend_status = Column(
        Enum("Improving", "Stable", "Worsening", name="trend_status_enum"),
        nullable=False,
        default="Stable",
    )
    model_used = Column(String(100), nullable=True)
    context_summary = Column(Text, nullable=True)  # JSON snapshot of raw context data
    generated_at = Column(DateTime, default=lambda: datetime.now(UTC), nullable=False)

    user = relationship("User")
    project = relationship("Project", foreign_keys=[project_id])
