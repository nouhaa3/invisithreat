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
    project_id: Optional[uuid.UUID] = None
    project_name: Optional[str] = None
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


class LLMChatThreadCreateRequest(BaseModel):
    title: Optional[str] = None
    target_payload: Optional[dict] = None
    messages: List[ChatMessage] = Field(default_factory=list)

    model_config = ConfigDict(extra="forbid")


class LLMChatThreadUpdateRequest(BaseModel):
    title: Optional[str] = None
    target_payload: Optional[dict] = None
    messages: Optional[List[ChatMessage]] = None
    archived: Optional[bool] = None

    model_config = ConfigDict(extra="forbid")


class LLMChatThreadSummaryResponse(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    title: str
    preview: str = ""
    message_count: int = 0
    target_payload: Optional[dict] = None
    updated_at: datetime
    last_message_at: datetime

    model_config = ConfigDict(extra="forbid")


class LLMChatThreadResponse(LLMChatThreadSummaryResponse):
    target_payload: Optional[dict] = None
    messages: List[ChatMessage] = Field(default_factory=list)

    model_config = ConfigDict(extra="forbid")