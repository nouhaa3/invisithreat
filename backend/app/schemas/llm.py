from datetime import datetime
from typing import List, Optional, Literal
import uuid

from pydantic import BaseModel, ConfigDict, Field


class ScanSummaryRequest(BaseModel):
    scan_id: uuid.UUID
    max_findings: int = Field(default=12, ge=1, le=50)

    model_config = ConfigDict(extra="forbid")


class ScanSummaryResponse(BaseModel):
    id: Optional[uuid.UUID] = None
    scan_id: uuid.UUID
    model: str
    summary: str
    priorities: List[str] = Field(default_factory=list)
    remediation_steps: List[str] = Field(default_factory=list)
    references: List[str] = Field(default_factory=list)
    generated_at: datetime
    elapsed_ms: Optional[int] = None
    raw: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str

    model_config = ConfigDict(extra="forbid")


class VulnerabilityContext(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    severity: Optional[str] = None
    file_path: Optional[str] = None
    line_number: Optional[int] = None
    recommendation: Optional[str] = None
    source_tool: Optional[str] = None
    rule_id: Optional[str] = None

    model_config = ConfigDict(extra="forbid")


class VulnerabilityAssistRequest(BaseModel):
    vulnerability_id: Optional[str] = None
    project_id: Optional[str] = None
    context: Optional[VulnerabilityContext] = None
    conversation: List[ChatMessage] = Field(default_factory=list)

    model_config = ConfigDict(extra="forbid")


class VulnerabilityAssistResponse(BaseModel):
    model: str
    reply: str
    elapsed_ms: Optional[int] = None

    model_config = ConfigDict(extra="forbid")