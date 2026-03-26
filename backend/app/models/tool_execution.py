import uuid
from datetime import datetime, UTC

from sqlalchemy import Column, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.base import Base


class ToolExecution(Base):
    __tablename__ = "tool_executions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    scan_id = Column(UUID(as_uuid=True), ForeignKey("scans.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    scan_tool_id = Column(UUID(as_uuid=True), ForeignKey("scan_tools.id"), nullable=False)
    started_at = Column(DateTime, nullable=False, default=lambda: datetime.now(UTC))
    ended_at = Column(DateTime, nullable=True)
    status = Column(String(50), nullable=False, default="pending")
    log_path = Column(String(500), nullable=True)

    scan = relationship("Scan", back_populates="tool_execution")
    scan_tool = relationship("ScanTool", back_populates="executions")
