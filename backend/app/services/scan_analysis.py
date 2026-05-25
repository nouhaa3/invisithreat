"""Analysis-type helpers for SAST, secrets, dependencies, DAST, and full scans."""

from __future__ import annotations

from typing import Any

SECRET_CATEGORIES = frozenset({
    "hardcoded_secret",
    "insecure_storage",
    "sensitive_data_exposure",
})

SECRET_RULE_PREFIXES = (
    "SEC",
    "ENV",
    "CFG003",
    "CFG004",
    "CFG005",
    "RN002",
    "JS005",
)

ANALYSIS_TYPES = frozenset({"SAST", "Secrets", "Dependencies", "Full", "DAST"})


def normalize_analysis_type(value: str | None, *, default: str = "SAST") -> str:
    raw = (value or "").strip()
    if not raw:
        return default
    lowered = raw.lower()
    mapping = {
        "sast": "SAST",
        "secrets": "Secrets",
        "dependencies": "Dependencies",
        "dependency": "Dependencies",
        "full": "Full",
        "dast": "DAST",
    }
    if lowered in mapping:
        return mapping[lowered]
    if raw in ANALYSIS_TYPES:
        return raw
    if lowered.startswith("full"):
        return "Full"
    return default


def finding_kind(finding: dict) -> str:
    category = (finding.get("category") or "").strip().lower()
    if category == "dependency":
        return "dependency"
    if category == "dast":
        return "dast"
    if category in SECRET_CATEGORIES:
        return "secret"
    rule_id = (finding.get("rule_id") or "").upper()
    if any(rule_id.startswith(prefix) for prefix in SECRET_RULE_PREFIXES):
        return "secret"
    return "sast"


def filter_findings(findings: list[dict], analysis_type: str) -> list[dict]:
    normalized = normalize_analysis_type(analysis_type)
    if normalized == "Full":
        return list(findings)
    if normalized == "SAST":
        return [f for f in findings if finding_kind(f) == "sast"]
    if normalized == "Secrets":
        return [f for f in findings if finding_kind(f) == "secret"]
    if normalized == "Dependencies":
        return [f for f in findings if finding_kind(f) == "dependency"]
    if normalized == "DAST":
        return [f for f in findings if finding_kind(f) == "dast"]
    return list(findings)


def count_severities(findings: list[dict]) -> dict[str, int]:
    counts = {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}
    for finding in findings:
        severity = (finding.get("severity") or "info").lower()
        if severity in counts:
            counts[severity] += 1
    return counts


def build_summary(
    findings: list[dict],
    *,
    scanned_files: int = 0,
    tool: str | None = None,
    version: str | None = None,
    tools: list[dict] | None = None,
    analysis_type: str | None = None,
    dast: dict | None = None,
) -> dict[str, Any]:
    counts = count_severities(findings)
    summary: dict[str, Any] = {
        "total_findings": len(findings),
        "scanned_files": scanned_files,
        **counts,
    }
    if tool:
        summary["tool"] = tool
    if version:
        summary["version"] = version
    if tools:
        summary["tools"] = tools
    if analysis_type:
        summary["analysis_type"] = normalize_analysis_type(analysis_type)
    if dast is not None:
        summary["dast"] = dast
    return summary


def should_run_sast(analysis_type: str) -> bool:
    return normalize_analysis_type(analysis_type) in {"SAST", "Full"}


def should_run_secrets(analysis_type: str) -> bool:
    return normalize_analysis_type(analysis_type) in {"Secrets", "Full"}


def should_run_dependencies(analysis_type: str) -> bool:
    return normalize_analysis_type(analysis_type) in {"Dependencies", "Full"}


def should_run_dast(analysis_type: str, dast_target_url: str | None) -> bool:
    return normalize_analysis_type(analysis_type) == "Full" and bool((dast_target_url or "").strip())
