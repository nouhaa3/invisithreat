import uuid

from sqlalchemy import Column, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.base import Base


class ScanComparison(Base):
    __tablename__ = "scan_comparisons"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    scan_id = Column(UUID(as_uuid=True), ForeignKey("scans.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    new_vulnerabilities = Column(Integer, nullable=False, default=0)
    fixed_vulnerabilities = Column(Integer, nullable=False, default=0)

    scan = relationship("Scan", back_populates="scan_comparison")
