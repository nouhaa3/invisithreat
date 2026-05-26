from sqlalchemy import Column, Text, DateTime, Integer, ForeignKey, String, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime, UTC
import uuid

from app.db.base import Base


class ScanSummary(Base):
    __tablename__ = "scan_summaries"
    __table_args__ = (
        Index("ix_scan_summaries_project_id", "project_id"),
        Index("ix_scan_summaries_scan_id", "scan_id"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False, index=True)
    scan_id = Column(UUID(as_uuid=True), ForeignKey("scans.id"), nullable=False, index=True)

    model = Column(String, nullable=True)
    summary = Column(Text, nullable=True)
    priorities = Column(Text, nullable=True)
    remediation_steps = Column(Text, nullable=True)
    references = Column(Text, nullable=True)
    raw = Column(Text, nullable=True)

    elapsed_ms = Column(Integer, nullable=True)
    generated_at = Column(DateTime, default=lambda: datetime.now(UTC), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(UTC), nullable=False)

    project = relationship("Project")
    scan = relationship("Scan")
