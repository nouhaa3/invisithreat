import uuid
from datetime import datetime, UTC

from sqlalchemy import Column, DateTime, ForeignKey, Index, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.base import Base


class Recommendation(Base):
    __tablename__ = "recommendations"
    __table_args__ = (
        Index("ix_recommendations_vuln_created", "vulnerability_id", "generated_at"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vulnerability_id = Column(UUID(as_uuid=True), ForeignKey("vulnerabilities.id", ondelete="CASCADE"), nullable=False, index=True)
    content = Column(Text, nullable=False)
    generated_at = Column(DateTime, nullable=False, default=lambda: datetime.now(UTC))

    vulnerability = relationship("Vulnerability", back_populates="recommendations")
