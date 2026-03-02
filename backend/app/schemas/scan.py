from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime
import uuid


# ─── Project Schemas ────────────────────────────────────────────────────────

class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    language: Optional[str] = "Other"
    analysis_type: Optional[str] = "SAST"
    visibility: Optional[str] = "private"


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    language: Optional[str] = None
    analysis_type: Optional[str] = None
    visibility: Optional[str] = None


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

    model_config = ConfigDict(from_attributes=True)


class ProjectListResponse(BaseModel):
    projects: List[ProjectResponse]
    total: int


# ─── Scan Schemas ────────────────────────────────────────────────────────────

class ScanCreate(BaseModel):
    method: str  # "cli" | "github"
    repo_url: Optional[str] = None
    repo_branch: Optional[str] = "main"


class ScanResponse(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    method: str
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
    status: str  # "completed" | "failed"
    error_message: Optional[str] = None
