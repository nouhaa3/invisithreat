import uuid
from datetime import datetime, UTC

from sqlalchemy import Column, DateTime, Float, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.base import Base


class RiskScore(Base):
    __tablename__ = "risk_scores"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    scan_id = Column(UUID(as_uuid=True), ForeignKey("scans.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    score = Column(Float, nullable=False, default=0.0)
    exploitability = Column(Float, nullable=False, default=0.0)
    business_impact = Column(Float, nullable=False, default=0.0)
    calculated_at = Column(DateTime, nullable=False, default=lambda: datetime.now(UTC))

    scan = relationship("Scan", back_populates="risk_score")
    vulnerabilities = relationship("Vulnerability", back_populates="risk_score")
