"""
DailySecurityInsightService
============================
Acts as a virtual Security Analyst and Security Coach.

Workflow:
  1. collect_context()   — query DB for today's scans, findings, risk scores, tasks
  2. build_prompt()      — construct a rich analyst-style prompt for Ollama
  3. call_ollama()       — stream / generate from the LLM
  4. detect_trend()      — heuristically determine Improving / Stable / Worsening
  5. persist()           — upsert result in daily_security_insights (cache)
"""

from __future__ import annotations

import json
import logging
from datetime import date, datetime, UTC, timedelta
from typing import Optional
from uuid import UUID

from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.daily_security_insight import DailySecurityInsight
from app.models.scan import Scan, ScanStatus
from app.models.scan import Project
from app.models.risk_score import RiskScore
from app.models.vulnerability_workflow import VulnerabilityTask, VulnerabilityTaskStatus
from app.schemas.daily_security_insight import InsightContextSchema, ScanSnapshotSchema
from app.services.llm_client import LLMError, _post_ollama

log = logging.getLogger(__name__)


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _parse_results(results_json: str | None) -> dict:
    if not results_json:
        return {}
    try:
        return json.loads(results_json)
    except Exception:
        return {}


def _extract_counts(results: dict) -> dict:
    summary = results.get("summary") or {}
    findings = results.get("findings") or []
    total = summary.get("total_findings") or summary.get("total") or len(findings)
    return {
        "total": int(total),
        "critical": int(summary.get("critical") or 0),
        "high": int(summary.get("high") or 0),
        "medium": int(summary.get("medium") or 0),
        "low": int(summary.get("low") or 0),
        "findings": findings,
    }


def _fingerprint(finding: dict) -> str:
    rule = finding.get("rule_id") or finding.get("check_id") or ""
    file_ = finding.get("file") or finding.get("file_path") or ""
    line = finding.get("line") or finding.get("line_number") or ""
    return f"{rule}:{file_}:{line}"


# ─── Context Collection ───────────────────────────────────────────────────────

def collect_context(
    db: Session,
    user_id: UUID,
    project_id: Optional[UUID],
    target_date: date,
) -> InsightContextSchema:
    """Collect all security-relevant data for the given date."""

    day_start = datetime(target_date.year, target_date.month, target_date.day, 0, 0, 0, tzinfo=UTC)
    day_end = day_start + timedelta(days=1)

    # ── Accessible projects ────────────────────────────────────────────────
    from app.models.member import ProjectMember  # local import to avoid circular

    owned_ids = db.query(Project.id).filter(Project.owner_id == user_id)
    member_ids = db.query(ProjectMember.project_id).filter(ProjectMember.user_id == user_id)
    accessible_q = owned_ids.union(member_ids)
    accessible_project_ids = [r[0] for r in accessible_q.all()]

    if project_id:
        scope_ids = [project_id] if project_id in accessible_project_ids else []
    else:
        scope_ids = accessible_project_ids

    if not scope_ids:
        return _empty_context(target_date)

    # ── Today's completed scans ────────────────────────────────────────────
    today_scans: list[Scan] = (
        db.query(Scan)
        .filter(
            Scan.project_id.in_(scope_ids),
            Scan.status == ScanStatus.completed,
            Scan.completed_at >= day_start,
            Scan.completed_at < day_end,
        )
        .order_by(Scan.completed_at.desc())
        .all()
    )

    # ── Previous scans (last 7 days, pre-today) ───────────────────────────
    prev_scans: list[Scan] = (
        db.query(Scan)
        .filter(
            Scan.project_id.in_(scope_ids),
            Scan.status == ScanStatus.completed,
            Scan.completed_at >= day_start - timedelta(days=7),
            Scan.completed_at < day_start,
        )
        .order_by(Scan.completed_at.desc())
        .all()
    )

    # ── Risk scores ────────────────────────────────────────────────────────
    today_scan_ids = [s.id for s in today_scans]
    prev_scan_ids = [s.id for s in prev_scans]

    today_risk_rows = (
        db.query(RiskScore)
        .filter(RiskScore.scan_id.in_(today_scan_ids))
        .all() if today_scan_ids else []
    )
    prev_risk_rows = (
        db.query(RiskScore)
        .filter(RiskScore.scan_id.in_(prev_scan_ids))
        .all() if prev_scan_ids else []
    )

    avg_risk_today = (
        sum(r.score for r in today_risk_rows) / len(today_risk_rows)
        if today_risk_rows else None
    )
    avg_risk_prev = (
        sum(r.score for r in prev_risk_rows) / len(prev_risk_rows)
        if prev_risk_rows else None
    )
    risk_delta = (
        round(avg_risk_today - avg_risk_prev, 2)
        if avg_risk_today is not None and avg_risk_prev is not None
        else None
    )

    # ── Aggregate finding counts ───────────────────────────────────────────
    today_findings_all: list[dict] = []
    scan_snapshots: list[ScanSnapshotSchema] = []

    projects_map: dict[UUID, Project] = {
        p.id: p
        for p in db.query(Project).filter(Project.id.in_(scope_ids)).all()
    }
    risk_map: dict[UUID, float] = {r.scan_id: r.score for r in today_risk_rows}

    for scan in today_scans:
        parsed = _parse_results(scan.results_json)
        counts = _extract_counts(parsed)
        today_findings_all.extend(counts["findings"])

        snap = ScanSnapshotSchema(
            scan_id=str(scan.id),
            project_name=projects_map.get(scan.project_id, type("x", (), {"name": "Unknown"})()).name,
            project_id=str(scan.project_id),
            status=scan.status.value,
            method=scan.method.value,
            total_findings=counts["total"],
            critical=counts["critical"],
            high=counts["high"],
            medium=counts["medium"],
            low=counts["low"],
            risk_score=risk_map.get(scan.id),
            completed_at=scan.completed_at.isoformat() if scan.completed_at else None,
        )
        scan_snapshots.append(snap)

    # ── Previous fingerprints (for recurring / fixed detection) ───────────
    prev_fingerprints: set[str] = set()
    prev_findings_all: list[dict] = []
    for scan in prev_scans:
        parsed = _parse_results(scan.results_json)
        findings = parsed.get("findings") or []
        for f in findings:
            fp = _fingerprint(f)
            prev_fingerprints.add(fp)
            prev_findings_all.append(f)

    today_fingerprints: set[str] = set()
    for f in today_findings_all:
        today_fingerprints.add(_fingerprint(f))

    new_findings = len(today_fingerprints - prev_fingerprints)
    fixed_findings = len(prev_fingerprints - today_fingerprints)
    recurring = len(today_fingerprints & prev_fingerprints)

    # ── Top recurring rules ────────────────────────────────────────────────
    from collections import Counter
    rule_counter: Counter = Counter()
    for f in today_findings_all:
        fp = _fingerprint(f)
        if fp in prev_fingerprints:
            rule = f.get("rule_id") or f.get("check_id") or "unknown"
            rule_counter[rule] += 1
    top_recurring = [r for r, _ in rule_counter.most_common(5)]

    # ── Remediation activity (tasks closed today) ──────────────────────────
    remediation_count = (
        db.query(func.count(VulnerabilityTask.id))
        .filter(
            VulnerabilityTask.project_id.in_(scope_ids),
            VulnerabilityTask.status.in_([
                VulnerabilityTaskStatus.fixed,
                VulnerabilityTaskStatus.verified,
            ]),
            VulnerabilityTask.updated_at >= day_start,
            VulnerabilityTask.updated_at < day_end,
        )
        .scalar()
        or 0
    )

    # ── Totals ─────────────────────────────────────────────────────────────
    total_critical = sum(s.critical for s in scan_snapshots)
    total_high = sum(s.high for s in scan_snapshots)
    total_medium = sum(s.medium for s in scan_snapshots)
    total_low = sum(s.low for s in scan_snapshots)
    total_findings = sum(s.total_findings for s in scan_snapshots)

    return InsightContextSchema(
        date=target_date.isoformat(),
        total_scans_today=len(today_scans),
        total_findings_today=total_findings,
        new_findings=new_findings,
        fixed_findings=fixed_findings,
        recurring_findings=recurring,
        critical_today=total_critical,
        high_today=total_high,
        medium_today=total_medium,
        low_today=total_low,
        avg_risk_score_today=round(avg_risk_today, 2) if avg_risk_today is not None else None,
        avg_risk_score_previous=round(avg_risk_prev, 2) if avg_risk_prev is not None else None,
        risk_delta=risk_delta,
        active_projects=len({s.project_id for s in today_scans}),
        scans=scan_snapshots,
        top_recurring_rules=top_recurring,
        remediation_activity=remediation_count,
    )


def _empty_context(target_date: date) -> InsightContextSchema:
    return InsightContextSchema(
        date=target_date.isoformat(),
        total_scans_today=0,
        total_findings_today=0,
        new_findings=0,
        fixed_findings=0,
        recurring_findings=0,
        critical_today=0,
        high_today=0,
        medium_today=0,
        low_today=0,
        avg_risk_score_today=None,
        avg_risk_score_previous=None,
        risk_delta=None,
        active_projects=0,
        scans=[],
        top_recurring_rules=[],
        remediation_activity=0,
    )


# ─── Prompt Builder ───────────────────────────────────────────────────────────

def build_analyst_prompt(ctx: InsightContextSchema) -> str:
    risk_trend = "N/A"
    if ctx.risk_delta is not None:
        if ctx.risk_delta < -0.5:
            risk_trend = f"improved by {abs(ctx.risk_delta):.2f} points"
        elif ctx.risk_delta > 0.5:
            risk_trend = f"worsened by {ctx.risk_delta:.2f} points"
        else:
            risk_trend = f"remained stable (delta: {ctx.risk_delta:+.2f})"

    scan_details = ""
    for s in ctx.scans:
        scan_details += (
            f"  - Project '{s.project_name}': {s.total_findings} findings "
            f"(critical={s.critical}, high={s.high}, medium={s.medium}, low={s.low}), "
            f"risk_score={s.risk_score or 'N/A'}, method={s.method}\n"
        )
    if not scan_details:
        scan_details = "  No scans completed today.\n"

    recurring_rules = ", ".join(ctx.top_recurring_rules) if ctx.top_recurring_rules else "None detected"

    prompt = f"""You are a senior cybersecurity analyst and security coach embedded in the InvisiThreat platform.

Your task is to produce a **Daily Security Insights** report for {ctx.date}.

Below is the raw security telemetry collected today. Use it as your evidence base — do NOT just echo these numbers. Instead, reason about them, identify patterns, and produce professional security analysis.

=== SECURITY TELEMETRY ===
Date: {ctx.date}
Scans completed today: {ctx.total_scans_today}
Active projects scanned: {ctx.active_projects}

Total findings today: {ctx.total_findings_today}
  ↳ Critical: {ctx.critical_today}
  ↳ High:     {ctx.high_today}
  ↳ Medium:   {ctx.medium_today}
  ↳ Low:      {ctx.low_today}

New findings (not seen in previous 7 days): {ctx.new_findings}
Fixed/resolved findings: {ctx.fixed_findings}
Recurring findings (seen in previous scans too): {ctx.recurring_findings}

Risk score today: {ctx.avg_risk_score_today if ctx.avg_risk_score_today is not None else 'N/A'}
Risk score previous period: {ctx.avg_risk_score_previous if ctx.avg_risk_score_previous is not None else 'N/A'}
Risk trend: {risk_trend}

Remediation tasks closed today: {ctx.remediation_activity}

Top recurring vulnerability rules: {recurring_rules}

Per-scan breakdown:
{scan_details}
=== END TELEMETRY ===

Write a **Daily Security Insights** report structured as follows. Each section must be substantive prose — not a list of statistics.

---

## Executive Summary
Provide a 2-3 sentence overview of today's security posture. Is the project in a better or worse state than before? Mention the most critical aspect.

## Key Security Insights
Highlight the 3-5 most important findings or observations from today's data. Focus on what matters most to a security decision-maker. Explain the *why* and *impact*, not just the numbers.

## Trend Analysis
Analyze whether security is improving, stable, or worsening. Use the risk delta, new vs. fixed findings ratio, and recurring findings to justify your conclusion. Be specific about what is driving the trend.

## Recurring Weaknesses
Identify patterns that keep appearing across scans. What root causes could explain them? What does their persistence indicate about the development or operations practice?

## Risk Assessment
Provide a holistic risk assessment. What is the blast radius if current vulnerabilities were exploited? Which finding categories represent the highest business risk?

## AI Recommendations
Give 3-5 specific, actionable, prioritized recommendations. Frame them as a security advisor would — practical, contextual, and tied to observed evidence. Avoid generic advice.

## Future Outlook
If current trends continue unchanged, what is the likely security trajectory over the next 2-4 scan cycles? What early warning signs should be watched? What would constitute a meaningful improvement?

---

Write in a professional, confident, and analytical tone. The report should feel like it was written by a senior security professional, not generated by a script. Do not include raw numbers as bullet lists — integrate data into narrative reasoning.
"""
    return prompt.strip()


# ─── Trend Detection ──────────────────────────────────────────────────────────

def detect_trend(ctx: InsightContextSchema) -> str:
    """Heuristic trend detection based on risk delta, new vs fixed ratio, and critical count."""
    score = 0  # positive = improving, negative = worsening

    if ctx.risk_delta is not None:
        if ctx.risk_delta < -0.5:
            score += 2
        elif ctx.risk_delta > 0.5:
            score -= 2

    net_findings = ctx.fixed_findings - ctx.new_findings
    if net_findings > 2:
        score += 1
    elif net_findings < -2:
        score -= 1

    if ctx.critical_today == 0 and ctx.high_today <= 1:
        score += 1
    elif ctx.critical_today >= 3:
        score -= 2

    if ctx.remediation_activity >= 3:
        score += 1

    if ctx.recurring_findings > ctx.total_findings_today * 0.5 and ctx.total_findings_today > 0:
        score -= 1

    if score >= 2:
        return "Improving"
    if score <= -2:
        return "Worsening"
    return "Stable"


# ─── Main Service Entry Point ─────────────────────────────────────────────────

async def generate_daily_insight(
    db: Session,
    user_id: UUID,
    project_id: Optional[UUID],
    force_regenerate: bool = False,
    model_override: Optional[str] = None,
) -> DailySecurityInsight:
    """
    Generate (or return cached) the Daily Security Insight for today.

    Caching: one insight per (user_id, project_id, date). Skips Ollama if cached.
    """
    today = datetime.now(UTC).date()
    model = model_override or getattr(settings, "OLLAMA_MODEL", "llama3")

    # ── Cache check ────────────────────────────────────────────────────────
    if not force_regenerate:
        cached = _load_cached(db, user_id, project_id, today)
        if cached:
            log.info("Returning cached daily insight for user=%s date=%s", user_id, today)
            return cached

    # ── Collect context ────────────────────────────────────────────────────
    ctx = collect_context(db, user_id, project_id, today)

    if ctx.total_scans_today == 0:
        # No scan data — generate a minimal insight without calling Ollama
        insight_text = _no_data_insight(today)
        trend = "Stable"
    else:
        # ── Build prompt & call Ollama ─────────────────────────────────────
        prompt = build_analyst_prompt(ctx)
        payload = {
            "model": model,
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": 0.4, "num_predict": 1800},
        }
        try:
            resp = await _post_ollama(payload)
            insight_text = resp.get("response") or ""
        except LLMError as exc:
            log.warning("Ollama unavailable for daily insight: %s", exc)
            insight_text = _fallback_insight(ctx)

        trend = detect_trend(ctx)

    # ── Persist / upsert ──────────────────────────────────────────────────
    record = _upsert_insight(
        db=db,
        user_id=user_id,
        project_id=project_id,
        today=today,
        insight_text=insight_text,
        trend=trend,
        model=model,
        ctx=ctx,
    )
    return record


def _load_cached(
    db: Session,
    user_id: UUID,
    project_id: Optional[UUID],
    today: date,
) -> Optional[DailySecurityInsight]:
    q = db.query(DailySecurityInsight).filter(
        DailySecurityInsight.user_id == user_id,
        DailySecurityInsight.date == today,
    )
    if project_id:
        q = q.filter(DailySecurityInsight.project_id == project_id)
    else:
        q = q.filter(DailySecurityInsight.project_id.is_(None))
    return q.first()


def _upsert_insight(
    db: Session,
    user_id: UUID,
    project_id: Optional[UUID],
    today: date,
    insight_text: str,
    trend: str,
    model: str,
    ctx: InsightContextSchema,
) -> DailySecurityInsight:
    existing = _load_cached(db, user_id, project_id, today)
    if existing:
        existing.generated_insight = insight_text
        existing.trend_status = trend
        existing.model_used = model
        existing.context_summary = ctx.model_dump_json()
        existing.generated_at = datetime.now(UTC)
        db.commit()
        db.refresh(existing)
        return existing

    record = DailySecurityInsight(
        user_id=user_id,
        project_id=project_id,
        date=today,
        generated_insight=insight_text,
        trend_status=trend,
        model_used=model,
        context_summary=ctx.model_dump_json(),
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


# ─── Fallback / No-data content ───────────────────────────────────────────────

def _no_data_insight(today: date) -> str:
    return (
        f"## Daily Security Insights — {today}\n\n"
        "No scans were completed today. The security posture cannot be assessed "
        "without active scan data. Consider scheduling a scan to maintain continuous "
        "visibility into your project's security state.\n\n"
        "**Recommendation:** Run at least one full-scope scan today to re-establish "
        "your security baseline and ensure emerging vulnerabilities are detected promptly."
    )


def _fallback_insight(ctx: InsightContextSchema) -> str:
    trend_verb = "remained stable"
    if ctx.risk_delta and ctx.risk_delta < -0.5:
        trend_verb = "improved"
    elif ctx.risk_delta and ctx.risk_delta > 0.5:
        trend_verb = "worsened"

    return (
        f"## Daily Security Insights — {ctx.date}\n\n"
        f"**Executive Summary:** Today's analysis covered {ctx.total_scans_today} scan(s) "
        f"across {ctx.active_projects} project(s). The overall security posture has {trend_verb}. "
        f"A total of {ctx.total_findings_today} findings were detected "
        f"({ctx.critical_today} critical, {ctx.high_today} high).\n\n"
        f"**Key Observations:** {ctx.new_findings} new findings emerged while "
        f"{ctx.fixed_findings} were resolved, and {ctx.recurring_findings} "
        f"findings recurred from previous scans. "
        f"Remediation activity: {ctx.remediation_activity} task(s) closed today.\n\n"
        "*(AI narrative unavailable — Ollama service unreachable. Raw telemetry shown above.)*"
    )


# ─── History retrieval ────────────────────────────────────────────────────────

def get_insight_history(
    db: Session,
    user_id: UUID,
    project_id: Optional[UUID],
    limit: int = 30,
    offset: int = 0,
) -> tuple[list[DailySecurityInsight], int]:
    q = db.query(DailySecurityInsight).filter(
        DailySecurityInsight.user_id == user_id,
    )
    if project_id:
        q = q.filter(DailySecurityInsight.project_id == project_id)
    total = q.count()
    items = q.order_by(DailySecurityInsight.date.desc()).offset(offset).limit(limit).all()
    return items, total
