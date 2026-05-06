import hashlib
from typing import Any
from uuid import UUID

from app.core.masking import mask_secret


def sanitize_finding(raw: dict[str, Any]) -> dict[str, Any]:
    file_path = (raw.get("file_path") or raw.get("file") or raw.get("path") or "").strip()
    line_number = raw.get("line_number") if raw.get("line_number") is not None else raw.get("line") or 0
    try:
        line_number = int(line_number)
    except (TypeError, ValueError):
        line_number = 0

    identifier = f"{raw.get('rule_id','')}|{file_path}|{line_number}"
    source_hash = hashlib.sha256(identifier.encode()).hexdigest()
    masked = mask_secret(raw.get("secret") or raw.get("code") or raw.get("snippet") or "")

    return {
        # AI-ready normalized schema
        "id": raw.get("id"),
        "scan_id": raw.get("scan_id"),
        "project_id": raw.get("project_id"),
        "rule_id": raw.get("rule_id") or "",
        "severity": (raw.get("severity") or "info").lower(),
        "category": (raw.get("category") or "security").lower(),
        "file_path": file_path,
        "line_number": line_number,
        "metadata": {
            "title": raw.get("title") or "Security finding",
            "description": raw.get("description") or "",
            "recommendation": raw.get("recommendation") or raw.get("fix") or "",
            "source_tool": raw.get("source_tool"),
            "source_hash": source_hash,
        },
        "masked_context": masked or None,
        # AI placeholders (disabled by default; no AI logic here)
        "vulnerability_summary": raw.get("vulnerability_summary") or None,
        "remediation_hint": raw.get("remediation_hint") or None,
        "ai_classification": raw.get("ai_classification"),
        "ai_confidence_score": raw.get("ai_confidence_score"),

        # Backward-compatible fields for existing UI
        "title": raw.get("title") or "Security finding",
        "description": raw.get("description") or "",
        "recommendation": raw.get("recommendation") or raw.get("fix") or "",
        "file": file_path,
        "line": line_number,
        "source_hash": source_hash,
        "masked_value": masked or None,
        "source_tool": raw.get("source_tool"),
    }


def sanitize_scan_results(payload: dict[str, Any] | None) -> dict[str, Any]:
    data = payload or {}
    findings = data.get("findings") if isinstance(data.get("findings"), list) else []
    sanitized_findings = [sanitize_finding(f) for f in findings if isinstance(f, dict)]
    summary = data.get("summary") if isinstance(data.get("summary"), dict) else {}
    summary["total_findings"] = len(sanitized_findings)
    return {"findings": sanitized_findings, "summary": summary}
