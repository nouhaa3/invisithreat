from sqlalchemy import Column, String, Boolean, ForeignKey, DateTime, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime, UTC
import uuid
from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nom = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    profile_picture = Column(String, nullable=True)
    date_creation = Column(DateTime, default=lambda: datetime.now(UTC))
    is_active = Column(Boolean, default=False)   # activated by admin
    is_pending = Column(Boolean, default=True)    # waiting for admin approval
    reset_code = Column(String, nullable=True)
    reset_code_expires = Column(DateTime, nullable=True)

    role_id = Column(UUID(as_uuid=True), ForeignKey("roles.id"))
    role = relationship("Role", back_populates="users")
    projects = relationship("Project", back_populates="owner", cascade="all, delete-orphan")