from __future__ import annotations

import json
import uuid
from datetime import datetime, UTC

from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.permissions import require_permission, P
from app.core.scan_sanitizer import sanitize_scan_results
from app.db.session import get_db
from app.models.scan import Scan as ScanModel, ScanStatus
from app.models.vulnerability import Vulnerability as VulnerabilityModel
from app.models.vulnerability_workflow import VulnerabilityTask as VulnerabilityTaskModel
from app.models.recommendation import Recommendation as RecommendationModel
from app.models.ai_usage_log import AIUsageLog
from app.schemas.llm import (
    LLMChatThreadCreateRequest,
    LLMChatThreadResponse,
    LLMChatThreadSummaryResponse,
    LLMChatThreadUpdateRequest,
    ScanSummaryRequest,
    ScanSummaryResponse,
    VulnerabilityAssistRequest,
)
from app.services.llm_client import generate_scan_summary, stream_vulnerability_assist, LLMError
from app.services.project import get_project_accessible
from app.models.scan_summary import ScanSummary as ScanSummaryModel
from app.models.llm_chat_thread import LLMChatThread as LLMChatThreadModel


router = APIRouter(prefix="/llm", tags=["llm"])


@router.post("/scan-summary", response_model=ScanSummaryResponse)
async def llm_scan_summary(
    payload: ScanSummaryRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_permission(P.USE_AI_SUMMARIES)),
):
    if not settings.FEATURE_AI_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="AI features are disabled. Set FEATURE_AI_ENABLED=true to enable.",
        )

    scan = db.query(ScanModel).filter(ScanModel.id == payload.scan_id).first()
    if not scan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scan not found")

    project, _ = get_project_accessible(db, scan.project_id, current_user)

    if scan.status != ScanStatus.completed:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Scan is not completed")
    if not scan.results_json or scan.results_json.startswith("__pending_token:"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Scan results are not available")

    try:
        raw_payload = json.loads(scan.results_json)
    except (TypeError, ValueError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Scan results are invalid JSON") from exc

    sanitized = sanitize_scan_results(raw_payload)
    max_findings = payload.max_findings
    findings = (sanitized.get("findings") or [])[:max_findings]
    summary = sanitized.get("summary") or {}

    try:
        result = await generate_scan_summary(
            summary,
            findings,
            project_name=project.name,
            analysis_type=scan.analysis_type or "SAST",
        )
    except LLMError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc

    # Persist summary to database
    try:
        saved = ScanSummaryModel(
            project_id=project.id,
            scan_id=scan.id,
            model=result.get("model"),
            summary=result.get("summary"),
            priorities=json.dumps(result.get("priorities") or []),
            remediation_steps=json.dumps(result.get("remediation_steps") or []),
            references=json.dumps(result.get("references") or []),
            raw=result.get("raw"),
            elapsed_ms=result.get("elapsed_ms"),
            generated_at=datetime.now(UTC),
        )
        db.add(saved)
        db.commit()
        db.refresh(saved)
    except Exception as exc:  # pragma: no cover - defensive
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to save summary: {exc}") from exc

    return ScanSummaryResponse(
        id=saved.id,
        scan_id=scan.id,
        model=result["model"],
        summary=result["summary"],
        priorities=result["priorities"],
        remediation_steps=result["remediation_steps"],
        references=result["references"],
        generated_at=saved.generated_at,
        elapsed_ms=result.get("elapsed_ms"),
        raw=result.get("raw"),
    )



def _row_to_response(row: ScanSummaryModel):
    try:
        priorities = json.loads(row.priorities) if row.priorities else []
    except (TypeError, ValueError, json.JSONDecodeError):
        priorities = []
    try:
        remediation = json.loads(row.remediation_steps) if row.remediation_steps else []
    except (TypeError, ValueError, json.JSONDecodeError):
        remediation = []
    try:
        references = json.loads(row.references) if row.references else []
    except (TypeError, ValueError, json.JSONDecodeError):
        references = []

    return ScanSummaryResponse(
        id=row.id,
        scan_id=row.scan_id,
        project_id=row.project_id,
        project_name=row.project.name if row.project else None,
        model=row.model or '',
        summary=row.summary or '',
        priorities=priorities,
        remediation_steps=remediation,
        references=references,
        generated_at=row.generated_at,
        elapsed_ms=row.elapsed_ms,
        raw=row.raw,
    )


def _as_uuid(value: str, field_name: str) -> uuid.UUID:
    try:
        return uuid.UUID(str(value))
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid {field_name}") from exc


def _messages_to_payload(messages: list[dict]) -> str:
    return json.dumps(messages or [], ensure_ascii=False)


def _messages_from_payload(raw: str | None) -> list[dict]:
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, list) else []
    except (TypeError, ValueError, json.JSONDecodeError):
        return []


def _thread_title_from_messages(messages: list[dict], fallback: str = "New chat") -> str:
    for msg in messages:
        if (msg.get("role") or "").lower() == "user":
            content = (msg.get("content") or "").strip()
            if content:
                compact = " ".join(content.split())
                return compact[:80]
    return fallback


def _thread_preview(messages: list[dict]) -> str:
    for msg in reversed(messages or []):
        content = (msg.get("content") or "").strip()
        if content:
            compact = " ".join(content.split())
            return compact[:140]
    return ""


def _thread_summary_response(row: LLMChatThreadModel) -> LLMChatThreadSummaryResponse:
    messages = _messages_from_payload(row.messages)
    target_payload = None
    if row.target_payload:
        try:
            parsed = json.loads(row.target_payload)
            if isinstance(parsed, dict):
                target_payload = parsed
        except (TypeError, ValueError, json.JSONDecodeError):
            target_payload = None
    return LLMChatThreadSummaryResponse(
        id=row.id,
        project_id=row.project_id,
        title=row.title or "New chat",
        preview=_thread_preview(messages),
        message_count=len(messages),
        target_payload=target_payload,
        updated_at=row.updated_at,
        last_message_at=row.last_message_at,
    )


def _thread_full_response(row: LLMChatThreadModel) -> LLMChatThreadResponse:
    messages = _messages_from_payload(row.messages)
    target_payload = None
    if row.target_payload:
        try:
            parsed = json.loads(row.target_payload)
            if isinstance(parsed, dict):
                target_payload = parsed
        except (TypeError, ValueError, json.JSONDecodeError):
            target_payload = None
    summary = _thread_summary_response(row)
    return LLMChatThreadResponse(
        id=summary.id,
        project_id=summary.project_id,
        title=summary.title,
        preview=summary.preview,
        message_count=summary.message_count,
        updated_at=summary.updated_at,
        last_message_at=summary.last_message_at,
        target_payload=target_payload,
        messages=messages,
    )


def _build_vulnerability_context(
    *,
    title: str | None,
    description: str | None,
    severity: str | None,
    file_path: str | None,
    line_number: int | None,
    recommendation: str | None,
    source_tool: str | None,
    rule_id: str | None,
) -> str:
    severity_label = (severity or "info").upper()
    lines = [
        f"I need help with a {severity_label} severity vulnerability found in my code.",
        f"Title: {title or 'Untitled vulnerability'}",
    ]
    if description:
        lines.append(f"Description: {description}")
    if rule_id:
        lines.append(f"Rule: {rule_id}")
    if file_path:
        location = f"Location: {file_path}"
        if line_number:
            location += f" at line {line_number}"
        lines.append(location)
    if source_tool:
        lines.append(f"Tool that detected it: {source_tool}")
    if recommendation:
        lines.append(f"Current recommendation: {recommendation}")
    lines.append("Please explain this vulnerability clearly and provide")
    lines.append("step-by-step remediation instructions.")
    return "\n".join(lines)


def _prepend_vulnerability_context(conversation: list[dict[str, str]], context: str) -> list[dict[str, str]]:
    if not context:
        return conversation
    if len(conversation) == 0:
        return [{"role": "user", "content": context}]
    if len(conversation) >= 2:
        return conversation
    first = conversation[0]
    first_role = (first.get("role") or "user").lower()
    first_content = (first.get("content") or "").strip()
    if first_role == "user":
        first["content"] = f"{context}\n\n{first_content}" if first_content else context
        return conversation
    return [{"role": "user", "content": context}] + conversation


@router.get('/projects/{project_id}/summaries', response_model=list[ScanSummaryResponse])
def list_project_summaries(project_id: str, db: Session = Depends(get_db), _current_user=Depends(require_permission(P.USE_AI_SUMMARIES))):
    summaries = db.query(ScanSummaryModel).filter(ScanSummaryModel.project_id == project_id).order_by(ScanSummaryModel.generated_at.desc()).all()
    return [_row_to_response(s) for s in summaries]


@router.get('/scans/{scan_id}/summaries', response_model=list[ScanSummaryResponse])
def list_scan_summaries(scan_id: str, db: Session = Depends(get_db), _current_user=Depends(require_permission(P.USE_AI_SUMMARIES))):
    summaries = db.query(ScanSummaryModel).filter(ScanSummaryModel.scan_id == scan_id).order_by(ScanSummaryModel.generated_at.desc()).all()
    return [_row_to_response(s) for s in summaries]


@router.get('/summaries', response_model=list[ScanSummaryResponse])
def list_all_summaries(db: Session = Depends(get_db), _current_user=Depends(require_permission(P.USE_AI_SUMMARIES))):
    summaries = db.query(ScanSummaryModel).order_by(ScanSummaryModel.generated_at.desc()).limit(200).all()
    return [_row_to_response(s) for s in summaries]


@router.get('/projects/{project_id}/assist-threads', response_model=list[LLMChatThreadSummaryResponse])
def list_assist_threads(
    project_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_permission(P.USE_AI_SUMMARIES)),
):
    project_uuid = _as_uuid(project_id, "project_id")
    get_project_accessible(db, project_uuid, current_user)
    rows = (
        db.query(LLMChatThreadModel)
        .filter(
            LLMChatThreadModel.project_id == project_uuid,
            LLMChatThreadModel.user_id == current_user.id,
            LLMChatThreadModel.archived.is_(False),
        )
        .order_by(LLMChatThreadModel.last_message_at.desc())
        .limit(40)
        .all()
    )
    return [_thread_summary_response(row) for row in rows]


@router.post('/projects/{project_id}/assist-threads', response_model=LLMChatThreadResponse)
def create_assist_thread(
    project_id: str,
    payload: LLMChatThreadCreateRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_permission(P.USE_AI_SUMMARIES)),
):
    project_uuid = _as_uuid(project_id, "project_id")
    get_project_accessible(db, project_uuid, current_user)

    messages = [{"role": msg.role, "content": msg.content} for msg in (payload.messages or [])]
    title = (payload.title or "").strip() or _thread_title_from_messages(messages)
    now = datetime.now(UTC)
    row = LLMChatThreadModel(
        project_id=project_uuid,
        user_id=current_user.id,
        title=title,
        messages=_messages_to_payload(messages),
        target_payload=json.dumps(payload.target_payload or {}, ensure_ascii=False) if payload.target_payload is not None else None,
        updated_at=now,
        last_message_at=now,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _thread_full_response(row)


@router.get('/assist-threads/{thread_id}', response_model=LLMChatThreadResponse)
def get_assist_thread(
    thread_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_permission(P.USE_AI_SUMMARIES)),
):
    thread_uuid = _as_uuid(thread_id, "thread_id")
    row = (
        db.query(LLMChatThreadModel)
        .filter(
            LLMChatThreadModel.id == thread_uuid,
            LLMChatThreadModel.user_id == current_user.id,
            LLMChatThreadModel.archived.is_(False),
        )
        .first()
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat thread not found")

    get_project_accessible(db, row.project_id, current_user)
    return _thread_full_response(row)


@router.patch('/assist-threads/{thread_id}', response_model=LLMChatThreadResponse)
def update_assist_thread(
    thread_id: str,
    payload: LLMChatThreadUpdateRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_permission(P.USE_AI_SUMMARIES)),
):
    thread_uuid = _as_uuid(thread_id, "thread_id")
    row = (
        db.query(LLMChatThreadModel)
        .filter(
            LLMChatThreadModel.id == thread_uuid,
            LLMChatThreadModel.user_id == current_user.id,
            LLMChatThreadModel.archived.is_(False),
        )
        .first()
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat thread not found")

    get_project_accessible(db, row.project_id, current_user)

    now = datetime.now(UTC)
    if payload.archived is not None:
        row.archived = bool(payload.archived)
    if payload.target_payload is not None:
        row.target_payload = json.dumps(payload.target_payload, ensure_ascii=False)

    updated_messages = None
    if payload.messages is not None:
        updated_messages = [{"role": msg.role, "content": msg.content} for msg in (payload.messages or [])]
        row.messages = _messages_to_payload(updated_messages)
        if updated_messages:
            row.last_message_at = now

    if payload.title is not None:
        row.title = payload.title.strip() or "New chat"
    elif updated_messages is not None and (not row.title or row.title == "New chat"):
        row.title = _thread_title_from_messages(updated_messages)

    row.updated_at = now
    db.commit()
    db.refresh(row)
    return _thread_full_response(row)


@router.delete('/assist-threads/{thread_id}', status_code=status.HTTP_204_NO_CONTENT)
def delete_assist_thread(
    thread_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_permission(P.USE_AI_SUMMARIES)),
):
    thread_uuid = _as_uuid(thread_id, "thread_id")
    row = (
        db.query(LLMChatThreadModel)
        .filter(
            LLMChatThreadModel.id == thread_uuid,
            LLMChatThreadModel.user_id == current_user.id,
            LLMChatThreadModel.archived.is_(False),
        )
        .first()
    )
    if not row:
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    get_project_accessible(db, row.project_id, current_user)
    row.archived = True
    row.updated_at = datetime.now(UTC)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/vulnerability-assist")
async def llm_vulnerability_assist(
    payload: VulnerabilityAssistRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_permission(P.USE_AI_SUMMARIES)),
):
    if not settings.FEATURE_AI_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="AI features are disabled. Set FEATURE_AI_ENABLED=true to enable.",
        )

    raw_id = (payload.vulnerability_id or "").strip()
    parsed_uuid = None
    if raw_id:
        try:
            parsed_uuid = uuid.UUID(raw_id)
        except (TypeError, ValueError):
            parsed_uuid = None

    vulnerability = None
    task = None
    if parsed_uuid:
        vulnerability = (
            db.query(VulnerabilityModel)
            .filter(VulnerabilityModel.id == parsed_uuid)
            .first()
        )
        task = (
            db.query(VulnerabilityTaskModel)
            .filter(VulnerabilityTaskModel.id == parsed_uuid)
            .first()
        )

    context_payload = payload.context
    if not vulnerability and not task and not context_payload and not payload.project_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vulnerability not found")

    project_id = None
    if task:
        project_id = task.project_id
    if vulnerability:
        scan = db.query(ScanModel).filter(ScanModel.id == vulnerability.scan_id).first()
        if scan:
            project_id = scan.project_id
    if not project_id and payload.project_id:
        project_id = payload.project_id

    if not project_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found for vulnerability")

    project = get_project_accessible(db, project_id, current_user)[0]

    recommendation = None
    if vulnerability:
        rec = (
            db.query(RecommendationModel)
            .filter(RecommendationModel.vulnerability_id == vulnerability.id)
            .order_by(RecommendationModel.generated_at.desc())
            .first()
        )
        if rec:
            recommendation = rec.content

    title = context_payload.title if context_payload else None
    description = context_payload.description if context_payload else None
    severity = context_payload.severity if context_payload else None
    file_path = context_payload.file_path if context_payload else None
    line_number = context_payload.line_number if context_payload else None
    source_tool = context_payload.source_tool if context_payload else None
    rule_id = context_payload.rule_id if context_payload else None

    if task:
        title = task.title or title
        severity = task.severity or severity
        file_path = task.file_path or file_path
        line_number = task.line_number or line_number

    if vulnerability:
        title = title or vulnerability.title
        description = vulnerability.description
        if vulnerability.severity is not None:
            severity_value = getattr(vulnerability.severity, "value", str(vulnerability.severity))
            severity = severity or severity_value
    if context_payload and context_payload.recommendation:
        recommendation = recommendation or context_payload.recommendation

    context = _build_vulnerability_context(
        title=title,
        description=description,
        severity=severity,
        file_path=file_path,
        line_number=line_number,
        recommendation=recommendation,
        source_tool=source_tool,
        rule_id=rule_id,
    )

    conversation = [
        {"role": msg.role, "content": msg.content}
        for msg in (payload.conversation or [])
    ]
    conversation = _prepend_vulnerability_context(conversation, context)

    system_prompt = (
        "You are a cybersecurity expert assistant inside InvisiThreat DevSecOps platform. "
        f"You are helping with the project '{project.name}'. "
        "You help developers understand and fix security vulnerabilities. "
        "Be concise, practical, and friendly. "
        "When asked casual questions, answer briefly and naturally. "
        "When asked technical questions, be precise and provide code examples. "
        "Never re-introduce yourself after the first message."
    )

    async def event_stream():
        try:
            async for chunk in stream_vulnerability_assist(conversation, system_prompt=system_prompt):
                if chunk:
                    yield f"data: {chunk}\n\n"
        except LLMError:
            yield "data: AI assistant is temporarily unavailable. Please try again.\n\n"

    # Determine scan_type from the scan that owns the vulnerability
    scan_type = None
    if vulnerability and vulnerability.scan_id:
        parent_scan = db.query(ScanModel).filter(ScanModel.id == vulnerability.scan_id).first()
        if parent_scan:
            scan_type = str(getattr(parent_scan, "analysis_type", None) or "SAST")
    elif task:
        scan_type = "SAST"

    # Persist AI usage record (best-effort; never fail the request)
    try:
        usage_log = AIUsageLog(
            user_id=current_user.id,
            user_role=current_user.role.name if current_user.role else None,
            project_id=project.id if project else None,
            vulnerability_id=parsed_uuid,
            vulnerability_type=title,
            scan_type=scan_type,
        )
        db.add(usage_log)
        db.commit()
    except Exception as _log_exc:  # pragma: no cover  # noqa: BLE001
        db.rollback()

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )