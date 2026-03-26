import uuid
from datetime import datetime, UTC

from sqlalchemy import Column, DateTime, Float, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.base import Base


class SecurityMetric(Base):
    __tablename__ = "security_metrics"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(String(100), nullable=False)
    value = Column(Float, nullable=False, default=0.0)
    calculated_at = Column(DateTime, nullable=False, default=lambda: datetime.now(UTC))

    project = relationship("Project", back_populates="security_metrics")
