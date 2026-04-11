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


class AdminProjectsSummary(BaseModel):
    total_projects: int
    active_projects: int
    archived_projects: int
    total_users_involved: int


class AdminProjectResponse(BaseModel):
    id: uuid.UUID
    name: str
    owner_id: uuid.UUID
    owner_name: str
    users_assigned_count: int
    total_scans: int
    global_risk_level: Literal["Low", "Medium", "High"]
    created_at: datetime
    last_activity_at: Optional[datetime] = None
    status: Literal["active", "archived"] = "active"

    model_config = ConfigDict(from_attributes=True)


class AdminProjectsResponse(BaseModel):
    summary: AdminProjectsSummary
    projects: List[AdminProjectResponse]


class ProjectAdminStatusUpdate(BaseModel):
    status: Literal["active", "archived"]

    model_config = ConfigDict(extra="forbid")


class ProjectAdminStatusResponse(BaseModel):
    id: uuid.UUID
    status: Literal["active", "archived"]


class SecurityProjectsSummary(BaseModel):
    total_projects: int
    projects_with_findings: int
    critical_projects: int
    avg_risk_score: float


class SecurityProjectResponse(BaseModel):
    id: uuid.UUID
    name: str
    owner_name: str
    total_scans: int
    last_scan_status: Optional[str] = None
    global_risk_level: Literal["Low", "Medium", "High"]
    risk_score: float = 0.0
    critical: int = 0
    high: int = 0
    medium: int = 0
    low: int = 0
    created_at: datetime
    last_activity_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class SecurityProjectsResponse(BaseModel):
    summary: SecurityProjectsSummary
    projects: List[SecurityProjectResponse]


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
