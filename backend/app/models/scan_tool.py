import uuid

from sqlalchemy import Column, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.base import Base


class ScanTool(Base):
    __tablename__ = "scan_tools"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(120), nullable=False, unique=True)
    type = Column(String(80), nullable=False)

    executions = relationship("ToolExecution", back_populates="scan_tool")
