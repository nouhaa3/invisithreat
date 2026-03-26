from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime, UTC
import uuid
import enum
from app.db.base import Base


class ScanMethod(str, enum.Enum):
    cli = "cli"
    github = "github"


class ScanStatus(str, enum.Enum):
    pending = "pending"
    running = "running"
    completed = "completed"
    failed = "failed"


class ProjectLanguage(str, enum.Enum):
    python = "Python"
    javascript = "JavaScript"
    typescript = "TypeScript"
    java = "Java"
    csharp = "C#"
    go = "Go"
    php = "PHP"
    ruby = "Ruby"
    other = "Other"


class ProjectAnalysisType(str, enum.Enum):
    sast = "SAST"
    secrets = "Secrets"
    dependencies = "Dependencies"
    full = "Full (SAST + Secrets + Dependencies)"


class ProjectVisibility(str, enum.Enum):
    private = "private"
    public = "public"


class Project(Base):
    __tablename__ = "projects"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    language = Column(String, nullable=True, default="Other")
    analysis_type = Column(String, nullable=True, default="SAST")
    visibility = Column(String, nullable=True, default="private")
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(UTC))

    owner = relationship("User", back_populates="projects")
    scans = relationship("Scan", back_populates="project", cascade="all, delete-orphan")
    members = relationship("ProjectMember", back_populates="project", cascade="all, delete-orphan")


class Scan(Base):
    __tablename__ = "scans"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    method = Column(Enum(ScanMethod), nullable=False)
    status = Column(Enum(ScanStatus), default=ScanStatus.pending, nullable=False)

    # For GitHub scans
    repo_url = Column(String, nullable=True)
    repo_branch = Column(String, nullable=True, default="main")

    # Results stored as JSON text
    results_json = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)

    started_at = Column(DateTime, default=lambda: datetime.now(UTC))
    completed_at = Column(DateTime, nullable=True)

    project = relationship("Project", back_populates="scans")
    risk_score = relationship("RiskScore", back_populates="scan", uselist=False, cascade="all, delete-orphan")
