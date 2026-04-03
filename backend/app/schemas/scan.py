from pydantic import BaseModel, ConfigDict, field_validator, model_validator
from typing import Optional, List, Literal
from datetime import datetime
import uuid


# ─── Project Schemas ────────────────────────────────────────────────────────

class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    language: Optional[str] = "Other"
    analysis_type: Optional[str] = "SAST"
    visibility: Optional[str] = "private"

    model_config = ConfigDict(extra="forbid")

    @field_validator("name")
    @classmethod
    def _name_not_blank(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("name is required")
        return value.strip()


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    language: Optional[str] = None
    analysis_type: Optional[str] = None
    visibility: Optional[str] = None

    model_config = ConfigDict(extra="forbid")


class ProjectResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str] = None
    language: Optional[str] = None
    analysis_type: Optional[str] = None
    visibility: Optional[str] = "private"
    owner_id: uuid.UUID
    created_at: datetime
    scan_count: int = 0
    last_scan_status: Optional[str] = None
    user_role: Optional[str] = None  # "owner" | "editor" | "viewer"

    model_config = ConfigDict(from_attributes=True)


class ProjectListResponse(BaseModel):
    projects: List[ProjectResponse]
    total: int


# ─── Scan Schemas ────────────────────────────────────────────────────────────

class ScanCreate(BaseModel):
    method: Literal["cli", "github"]
    repo_url: Optional[str] = None
    repo_branch: Optional[str] = "main"
    repo_token: Optional[str] = None

    model_config = ConfigDict(extra="forbid")

    @model_validator(mode="after")
    def _require_repo_url_for_github(self):
        if self.method == "github" and not (self.repo_url and self.repo_url.strip()):
            raise ValueError("repo_url is required when method is 'github'")
        if self.repo_token is not None:
            self.repo_token = self.repo_token.strip() or None
        return self


class ScanResponse(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    method: Optional[str] = None
    status: str
    repo_url: Optional[str] = None
    repo_branch: Optional[str] = None
    results_json: Optional[str] = None
    error_message: Optional[str] = None
    started_at: datetime
    completed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class ScanListResponse(BaseModel):
    scans: List[ScanResponse]
    total: int


class CLITokenResponse(BaseModel):
    """Token returned to the CLI for uploading scan results"""
    upload_token: str
    scan_id: uuid.UUID
    expires_in: int  # seconds


class CLIScanUpload(BaseModel):
    """Payload sent by CLI when uploading local scan results"""
    upload_token: str
    results_json: str
    status: Literal["completed", "failed"]
    error_message: Optional[str] = None

    model_config = ConfigDict(extra="forbid")

    @field_validator("results_json")
    @classmethod
    def _results_not_blank(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("results_json is required")
        return value
