import asyncio
import json
import logging
import os
from datetime import UTC, datetime
from json import JSONDecodeError
from typing import Dict
from urllib.parse import urlparse, urlunparse
from uuid import UUID
from app.services.zap_client import ZapClient, ZapApiException
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.permissions import P, require_permission
from app.db.session import SessionLocal, get_db
from app.models.scan import Scan, ScanMethod, ScanStatus
from app.models.user import User
from app.core.queue import get_scan_progress, set_scan_progress
from app.models.scan import JobState
from app.workers.scan_worker import run_dast_scan_job
from app.core.observability import request_id_var
from app.services.project import get_project_accessible
from app.services.risk_score import get_or_create_scan_risk_score
from app.core.scan_sanitizer import sanitize_scan_results

logger = logging.getLogger(__name__)

router = APIRouter()


def _utc_now_iso() -> str:
    return datetime.now(UTC).isoformat()


def _stamp_progress(payload: dict) -> dict:
    stamped = dict(payload)
    stamped["_updated_at"] = _utc_now_iso()
    return stamped


def _as_utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC)


def _parse_iso_utc(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return _as_utc(datetime.fromisoformat(value))
    except ValueError:
        return None


def _get_stale_timeout_seconds() -> int:
    raw = (os.getenv("DAST_STATUS_STALE_SECONDS") or os.getenv("DAST_NO_PROGRESS_TIMEOUT") or "300").strip()
    try:
        return min(600, max(60, int(raw)))
    except ValueError:
        return 300


def _finalize_if_stale_running_scan(db: Session, scan: Scan, progress: dict) -> dict:
    """Mark long-stalled running scans as failed to avoid endless polling loops.

    This also handles worker restarts where in-memory background task state is lost.
    """
    if scan.status != ScanStatus.running:
        return progress

    stale_after_seconds = _get_stale_timeout_seconds()
    now = datetime.now(UTC)

    last_update = _parse_iso_utc(progress.get("_updated_at"))
    started_at = _as_utc(scan.started_at)
    baseline = last_update or started_at
    if baseline is None:
        return progress

    if (now - baseline).total_seconds() < stale_after_seconds:
        return progress

    existing_error = scan.error_message or ""
    stall_error = f"DAST scan stalled for more than {stale_after_seconds}s. Marked as failed automatically."
    scan.status = ScanStatus.failed
    scan.completed_at = now
    scan.error_message = existing_error or stall_error
    db.commit()

    failed_progress = {
        "stage": "failed",
        "spider_progress": progress.get("spider_progress", 0),
        "active_scan_progress": progress.get("active_scan_progress", 0),
        "alerts_found": progress.get("alerts_found", 0),
        "error": scan.error_message,
    }
    stamped = _stamp_progress(failed_progress)
    _progress_cache[str(scan.id)] = stamped
    return stamped


def _resolve_scanner_target_url(target_url: str) -> str:
    parsed = urlparse(target_url)
    if parsed.hostname not in {"localhost", "127.0.0.1"}:
        return target_url

    if not os.path.exists("/.dockerenv"):
        return target_url

    replacement_host = os.getenv("DAST_LOCALHOST_HOST", "host.docker.internal")
    netloc = replacement_host if parsed.port is None else f"{replacement_host}:{parsed.port}"
    rewritten = urlunparse((parsed.scheme, netloc, parsed.path, parsed.params, parsed.query, parsed.fragment))
    logger.warning("Rewriting localhost target for Docker: %s -> %s", target_url, rewritten)
    return rewritten


def _build_results_payload(findings: list[dict]) -> dict:
    summary = {
        "total_findings": len(findings),
        "critical": sum(1 for f in findings if f["severity"] == "critical"),
        "high": sum(1 for f in findings if f["severity"] == "high"),
        "medium": sum(1 for f in findings if f["severity"] == "medium"),
        "low": sum(1 for f in findings if f["severity"] == "low"),
        "info": sum(1 for f in findings if f["severity"] == "info"),
        "tool": "OWASP ZAP",
        "version": "dynamic",
    }
    return {
        "findings": findings,
        "summary": summary,
    }


def _map_zap_risk(risk: str | None) -> str:
    normalized = (risk or "").strip().lower()
    if normalized == "high":
        return "high"
    if normalized == "medium":
        return "medium"
    if normalized == "low":
        return "low"
    return "info"


def _normalize_zap_alert(alert: dict, index: int) -> dict:
    description = alert.get("description") or alert.get("desc") or "No description provided by ZAP."
    recommendation = alert.get("solution") or f"Review and remediate: {alert.get('name', 'Unknown alert')}"
    endpoint = alert.get("url") or ""
    severity = _map_zap_risk(alert.get("risk"))

    return {
        "id": f"dast-{index}",
        "rule_id": f"DAST_{index}",
        "title": alert.get("name") or "Unknown DAST finding",
        "severity": severity,
        "category": "dast",
        "description": description,
        "recommendation": recommendation,
        "file": endpoint,
        "line": 0,
        "code": description[:200],
        "source_tool": "owasp_zap",
    }


def _fetch_zap_findings_for_target(target_url: str | None) -> list[dict]:
    try:
        client = ZapClient()
        alerts_resp = client.core.alerts(baseurl=target_url or None)
        alerts = alerts_resp.get("alerts", []) if isinstance(alerts_resp, dict) else []
        if not isinstance(alerts, list):
            return []
        return [_normalize_zap_alert(alert, idx) for idx, alert in enumerate(alerts, start=1)]
    except ZapApiException:
        logger.exception("Failed to fetch ZAP findings for target %s", target_url)
        return []


def _recover_running_scan_from_zap(db: Session, scan: Scan, progress: dict) -> dict:
    """Recover scans stuck in running state after backend reload/interruption.

    If ZAP has already completed its work, finalize the DB scan immediately
    with recovered findings so the UI no longer remains in running forever.
    """
    if scan.status != ScanStatus.running:
        return progress

    last_update = _parse_iso_utc(progress.get("_updated_at"))
    if last_update and (datetime.now(UTC) - last_update).total_seconds() < 20:
        return progress

    try:
        client = ZapClient()
        if not client.is_running():
            return progress

        spider_progress = client.spider.status()
        active_scans = client.ascan.scans()

        running_active_scan = False
        active_progress = 100
        if isinstance(active_scans, list) and active_scans:
            parsed_progresses: list[int] = []
            for item in active_scans:
                try:
                    item_progress = int(str(item.get("progress", "0")))
                except (ValueError, TypeError):
                    item_progress = 0
                parsed_progresses.append(max(0, min(100, item_progress)))

                state = str(item.get("state", "")).strip().upper()
                if item_progress < 100 or state not in {"FINISHED", "COMPLETE", "COMPLETED", "STOPPED"}:
                    running_active_scan = True

            if parsed_progresses:
                active_progress = min(parsed_progresses)

        if running_active_scan:
            live_progress = _stamp_progress({
                "stage": "active_scan_in_progress",
                "spider_progress": max(0, min(100, spider_progress)),
                "active_scan_progress": active_progress,
                "alerts_found": progress.get("alerts_found", 0),
                "error": progress.get("error"),
            })
            _progress_cache[str(scan.id)] = live_progress
            return live_progress

        if spider_progress >= 100:
            findings = _fetch_zap_findings_for_target(scan.repo_url)
            now = datetime.now(UTC)

            scan.results_json = json.dumps(sanitize_scan_results(_build_results_payload(findings)))
            scan.status = ScanStatus.completed
            scan.completed_at = now

            recovery_note = "Recovered DAST results after background interruption."
            if not scan.error_message:
                scan.error_message = recovery_note
            elif recovery_note not in scan.error_message:
                scan.error_message = f"{scan.error_message} | {recovery_note}"

            db.commit()
            get_or_create_scan_risk_score(db, scan)

            completed_progress = _stamp_progress({
                "stage": "completed",
                "spider_progress": 100,
                "active_scan_progress": 100,
                "alerts_found": len(findings),
                "error": scan.error_message,
            })
            _progress_cache[str(scan.id)] = completed_progress
            return completed_progress
    except ZapApiException:
        logger.exception("Unable to recover running DAST scan %s from ZAP state", scan.id)

    return progress


def run_dast_scan_background(scan_id: str, target_url: str) -> None:
    _ = scan_id
    _ = target_url
    raise RuntimeError("Legacy background executor should not be used in Phase 2.")


@router.post("/scan/start")
async def start_dast_scan(
    target_url: str,
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(P.RUN_SCAN)),
) -> dict:
    if not target_url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="Invalid URL format. Must start with http:// or https://")

    project_uuid = UUID(project_id)
    project, user_role = get_project_accessible(db, project_uuid, current_user)
    if user_role not in ("owner", "editor", "admin"):
        raise HTTPException(status_code=403, detail="Only owners and editors can run scans")

    effective_target_url = _resolve_scanner_target_url(target_url)

    scan = Scan(
        project_id=project.id,
        method=ScanMethod.dast,
        status=ScanStatus.pending,
        repo_url=target_url,
        repo_branch=None,
        results_json=None,
        error_message=None,
    )
    db.add(scan)
    db.commit()
    db.refresh(scan)

    set_scan_progress(str(scan.id), {
        "stage": "pending",
        "spider_progress": 0,
        "active_scan_progress": 0,
        "alerts_found": 0,
        "error": None,
    }, ttl_seconds=7200)

    headers = {"request_id": request_id_var.get(), "user_id": str(current_user.id)}
    job = run_dast_scan_job.apply_async(args=[str(scan.id), effective_target_url], headers=headers)
    scan.job_id = job.id
    scan.job_state = JobState.queued.value
    scan.job_updated_at = datetime.now(UTC)
    db.commit()

    return {
        "status": "initiated",
        "scan_id": str(scan.id),
        "job_id": job.id,
        "project_id": str(project.id),
        "target_url": target_url,
        "effective_target_url": effective_target_url,
        "message": "DAST scan enqueued",
    }


@router.get("/scan/{scan_id}/status")
async def get_dast_scan_status(
    scan_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(P.VIEW_SCAN_RESULTS)),
) -> dict:
    scan = db.query(Scan).filter(Scan.id == UUID(scan_id), Scan.method == ScanMethod.dast).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")

    get_project_accessible(db, scan.project_id, current_user)

    progress = get_scan_progress(scan_id)
    results = None
    if scan.results_json:
        try:
            results = json.loads(scan.results_json)
        except JSONDecodeError:
            results = None

    findings = (results or {}).get("findings", [])

    status_value = scan.status.value if hasattr(scan.status, "value") else str(scan.status)
    raw_error = scan.error_message or progress.get("error")
    warning = raw_error if status_value == ScanStatus.completed.value else None
    error = raw_error if status_value == ScanStatus.failed.value else None

    return {
        "scan_id": str(scan.id),
        "target_url": scan.repo_url,
        "status": status_value,
        "stage": progress.get("stage", status_value),
        "spider_progress": progress.get("spider_progress", 100 if scan.status in {ScanStatus.completed, ScanStatus.failed} else 0),
        "active_scan_progress": progress.get("active_scan_progress", 100 if scan.status in {ScanStatus.completed, ScanStatus.failed} else 0),
        "alerts_found": progress.get("alerts_found", len(findings)),
        "vulnerabilities_found": len(findings),
        "last_progress_at": progress.get("_updated_at"),
        "started_at": scan.started_at.isoformat() if scan.started_at else None,
        "completed_at": scan.completed_at.isoformat() if scan.completed_at else None,
        "warning": warning,
        "error": error,
    }


@router.get("/scan/{scan_id}/results")
async def get_dast_scan_results(
    scan_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(P.VIEW_SCAN_RESULTS)),
) -> dict:
    scan = db.query(Scan).filter(Scan.id == UUID(scan_id), Scan.method == ScanMethod.dast).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")

    get_project_accessible(db, scan.project_id, current_user)

    if scan.status not in {ScanStatus.completed, ScanStatus.failed}:
        raise HTTPException(status_code=400, detail=f"Scan is {scan.status.value}, not completed yet")

    if not scan.results_json:
        raise HTTPException(status_code=400, detail="Scan has no results yet")

    try:
        payload = json.loads(scan.results_json or "{}")
    except JSONDecodeError:
        payload = {"findings": [], "summary": {"total_findings": 0}}

    return {
        "scan_id": str(scan.id),
        "target_url": scan.repo_url,
        "status": scan.status.value,
        "warning": scan.error_message,
        "summary": payload.get("summary", {}),
        "vulnerabilities": payload.get("findings", []),
        "completed_at": scan.completed_at.isoformat() if scan.completed_at else None,
    }


@router.get("/project/{project_id}/scans")
async def list_project_dast_scans(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(P.VIEW_SCAN_RESULTS)),
) -> dict:
    project_uuid = UUID(project_id)
    get_project_accessible(db, project_uuid, current_user)

    scans = (
        db.query(Scan)
        .filter(Scan.project_id == project_uuid, Scan.method == ScanMethod.dast)
        .order_by(Scan.started_at.desc())
        .all()
    )

    updated_any = False
    for scan in scans:
        if scan.status != ScanStatus.running:
            continue
        original_status = scan.status
        progress = _progress_cache.get(str(scan.id), {})
        progress = _recover_running_scan_from_zap(db, scan, progress)
        _finalize_if_stale_running_scan(db, scan, progress)
        if scan.status != original_status:
            updated_any = True

    if updated_any:
        scans = (
            db.query(Scan)
            .filter(Scan.project_id == project_uuid, Scan.method == ScanMethod.dast)
            .order_by(Scan.started_at.desc())
            .all()
        )

    return {
        "total": len(scans),
        "scans": [
            {
                "id": str(scan.id),
                "target_url": scan.repo_url,
                "status": scan.status.value if hasattr(scan.status, "value") else str(scan.status),
                "started_at": scan.started_at.isoformat() if scan.started_at else None,
                "completed_at": scan.completed_at.isoformat() if scan.completed_at else None,
                "error": scan.error_message,
            }
            for scan in scans
        ],
    }