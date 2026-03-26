import uuid

from sqlalchemy import Column, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.base import Base


class GitHubRepository(Base):
    __tablename__ = "github_repositories"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    url = Column(String(500), nullable=False)
    default_branch = Column(String(120), nullable=False, default="main")
    access_token = Column(String(500), nullable=True)

    project = relationship("Project", back_populates="github_repositories")
