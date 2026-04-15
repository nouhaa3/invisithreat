import asyncio
import json
import logging
import os
from datetime import UTC, datetime
from json import JSONDecodeError
from typing import Dict
from urllib.parse import urlparse, urlunparse
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.permissions import P, require_permission
from app.db.session import SessionLocal, get_db
from app.models.scan import Scan, ScanMethod, ScanStatus
from app.models.user import User
from app.services.dast_scanner import run_dast_scan_async
from app.services.project import get_project_accessible
from app.services.risk_score import get_or_create_scan_risk_score

logger = logging.getLogger(__name__)

router = APIRouter()
_progress_cache: Dict[str, dict] = {}


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
    raw = (os.getenv("DAST_STATUS_STALE_SECONDS") or os.getenv("DAST_NO_PROGRESS_TIMEOUT") or "900").strip()
    try:
        return max(60, int(raw))
    except ValueError:
        return 900


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


def run_dast_scan_background(scan_id: str, target_url: str) -> None:
    db = SessionLocal()
    try:
        scan = db.query(Scan).filter(Scan.id == UUID(scan_id), Scan.method == ScanMethod.dast).first()
        if not scan:
            return

        scan.status = ScanStatus.running
        scan.started_at = datetime.now(UTC)
        db.commit()

        def progress_cb(payload: dict) -> None:
            _progress_cache[scan_id] = _stamp_progress(payload)

        result = asyncio.run(run_dast_scan_async(target_url, progress_callback=progress_cb))

        findings = result.get("vulnerabilities", [])
        scan.results_json = json.dumps(_build_results_payload(findings))
        scan.error_message = result.get("error")
        scan.completed_at = datetime.now(UTC)
        scan.status = ScanStatus.completed if result.get("completed") else ScanStatus.failed
        db.commit()

        if scan.status == ScanStatus.completed:
            get_or_create_scan_risk_score(db, scan)

        _progress_cache[scan_id] = _stamp_progress({
            "stage": "completed" if result.get("completed") else "failed",
            "spider_progress": result.get("progress", {}).get("spider_progress", 0),
            "active_scan_progress": result.get("progress", {}).get("active_scan_progress", 0),
            "alerts_found": len(findings),
            "error": result.get("error"),
        })
    except Exception as exc:
        logger.exception("Background DAST scan failed: %s", scan_id)
        scan = db.query(Scan).filter(Scan.id == UUID(scan_id), Scan.method == ScanMethod.dast).first()
        if scan:
            scan.status = ScanStatus.failed
            scan.error_message = str(exc)
            scan.completed_at = datetime.now(UTC)
            db.commit()
        _progress_cache[scan_id] = _stamp_progress({
            "stage": "failed",
            "spider_progress": 0,
            "active_scan_progress": 0,
            "alerts_found": 0,
            "error": str(exc),
        })
    finally:
        db.close()


@router.post("/scan/start")
async def start_dast_scan(
    target_url: str,
    project_id: str,
    background_tasks: BackgroundTasks,
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

    _progress_cache[str(scan.id)] = _stamp_progress({
        "stage": "pending",
        "spider_progress": 0,
        "active_scan_progress": 0,
        "alerts_found": 0,
        "error": None,
    })

    background_tasks.add_task(run_dast_scan_background, str(scan.id), effective_target_url)

    return {
        "status": "initiated",
        "scan_id": str(scan.id),
        "project_id": str(project.id),
        "target_url": target_url,
        "effective_target_url": effective_target_url,
        "message": "DAST scan started in background",
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

    progress = _progress_cache.get(scan_id, {})
    progress = _finalize_if_stale_running_scan(db, scan, progress)
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