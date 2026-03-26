import uuid
from datetime import datetime, UTC

from sqlalchemy import Column, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.base import Base


class SecurityReport(Base):
    __tablename__ = "security_reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    generated_at = Column(DateTime, nullable=False, default=lambda: datetime.now(UTC))
    format = Column(String(20), nullable=False, default="pdf")

    project = relationship("Project", back_populates="security_reports")
