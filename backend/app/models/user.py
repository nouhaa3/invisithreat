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
    is_active = Column(Boolean, default=True)    # true for VIEWER, set to true on signup
    is_pending = Column(Boolean, default=True)    # waiting for admin approval of OLD flow (deprecated)
    is_verified = Column(Boolean, default=False)  # email verification status
    reset_code = Column(String, nullable=True)
    reset_code_expires = Column(DateTime, nullable=True)
    totp_secret = Column(String, nullable=True)
    totp_enabled = Column(Boolean, default=False)
    trial_scans_remaining = Column(Integer, default=2)  # for VIEWER role
    requested_role_id = Column(UUID(as_uuid=True), ForeignKey("roles.id"), nullable=True)  # role request

    role_id = Column(UUID(as_uuid=True), ForeignKey("roles.id"))
    role = relationship("Role", back_populates="users", foreign_keys=[role_id])
    requested_role = relationship("Role", foreign_keys=[requested_role_id], viewonly=True)
    projects = relationship("Project", back_populates="owner", cascade="all, delete-orphan")
    memberships = relationship("ProjectMember", back_populates="user", cascade="all, delete-orphan")
    api_keys = relationship("UserAPIKey", back_populates="user", cascade="all, delete-orphan")
    auth_tokens = relationship("AuthToken", back_populates="user", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="user", cascade="all, delete-orphan")