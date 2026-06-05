from __future__ import annotations

from datetime import date, datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field


TrendStatus = Literal["Improving", "Stable", "Worsening"]


# ─── Request ─────────────────────────────────────────────────────────────────

class InsightGenerateRequest(BaseModel):
    project_id: Optional[UUID] = Field(
        None,
        description="Scope the insight to a specific project. Omit for a cross-project insight.",
    )
    force_regenerate: bool = Field(
        False,
        description="If True, discard any cached insight and generate a fresh one.",
    )
    model: Optional[str] = Field(
        None,
        description="Override the Ollama model to use for generation.",
    )


# ─── Response ────────────────────────────────────────────────────────────────

class InsightOut(BaseModel):
    id: UUID
    user_id: UUID
    project_id: Optional[UUID]
    date: date
    generated_insight: str
    trend_status: TrendStatus
    model_used: Optional[str]
    generated_at: datetime

    model_config = {"from_attributes": True}


class InsightListOut(BaseModel):
    items: list[InsightOut]
    total: int


# ─── Internal context snapshot (stored in context_summary JSON) ──────────────

class ScanSnapshotSchema(BaseModel):
    scan_id: str
    project_name: str
    project_id: str
    status: str
    method: str
    total_findings: int
    critical: int
    high: int
    medium: int
    low: int
    risk_score: Optional[float]
    completed_at: Optional[str]


class InsightContextSchema(BaseModel):
    """Raw context collected before prompt construction — persisted as JSON."""
    date: str
    total_scans_today: int
    total_findings_today: int
    new_findings: int
    fixed_findings: int
    recurring_findings: int
    critical_today: int
    high_today: int
    medium_today: int
    low_today: int
    avg_risk_score_today: Optional[float]
    avg_risk_score_previous: Optional[float]
    risk_delta: Optional[float]
    active_projects: int
    scans: list[ScanSnapshotSchema]
    top_recurring_rules: list[str]
    remediation_activity: int  # number of workflow tasks closed today
