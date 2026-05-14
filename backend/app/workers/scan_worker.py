from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, UTC
from uuid import UUID

from celery import shared_task

from app.core.queue import acquire_scan_lock, release_scan_lock, set_scan_progress
from app.core.config import settings
from app.core.observability import set_request_context, clear_request_context
from app.db.session import SessionLocal
from app.models.scan import Scan, ScanMethod, ScanStatus
from app.models.scan import JobState
from app.services.dast_scanner import run_dast_scan_async
from app.core.scan_sanitizer import sanitize_scan_results
from app.services.github_scanner import run_github_scan
from app.services.notification import create_notification
from app.services.risk_score import get_or_create_scan_risk_score
from app.services.vulnerability_workflow import sync_vulnerability_tasks_for_scan
from app.services.socketio_service import SocketIOManager
from app.models.member import ProjectMember

logger = logging.getLogger(__name__)


def _set_scan_state(db, scan: Scan, *, status: ScanStatus, error: str | None = None) -> None:
    scan.status = status
    if status in {ScanStatus.completed, ScanStatus.failed}:
        scan.completed_at = datetime.now(UTC)
    if error is not None:
        scan.error_message = error
    db.commit()

def _set_job_state(db, scan: Scan, state: JobState, *, attempts: int | None = None) -> None:
    scan.job_state = state.value
    scan.job_updated_at = datetime.now(UTC)
    if attempts is not None:
        scan.job_attempts = str(attempts)
    db.commit()


def _project_user_ids(db, scan: Scan) -> list[str]:
    # Owner + members get scan lifecycle events
    user_ids = {str(scan.project.owner_id)}
    members = db.query(ProjectMember).filter(ProjectMember.project_id == scan.project_id).all()
    for m in members:
        user_ids.add(str(m.user_id))
    return list(user_ids)


@shared_task(
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_jitter=True,
    retry_kwargs={"max_retries": 3},
    soft_time_limit=900,
    time_limit=1200,
)
def run_github_scan_job(self, scan_id: str) -> dict:
    if not acquire_scan_lock(scan_id, ttl_seconds=1800):
        return {"status": "skipped", "reason": "locked"}

    db = SessionLocal()
    try:
        headers = getattr(self.request, "headers", {}) or {}
        set_request_context(
            request_id=headers.get("request_id"),
            user_id=headers.get("user_id"),
            job_id=self.request.id,
            service="worker",
            endpoint="celery:run_github_scan_job",
        )
        scan = db.query(Scan).filter(Scan.id == UUID(scan_id), Scan.method == ScanMethod.github).first()
        if not scan:
            return {"status": "not_found"}
        if scan.status in {ScanStatus.running, ScanStatus.completed}:
            return {"status": "skipped", "reason": f"already_{scan.status.value}"}
        if not scan.repo_url:
            _set_scan_state(db, scan, status=ScanStatus.failed, error="Missing repository URL for GitHub scan")
            return {"status": "failed", "reason": "missing_repo_url"}

        _set_job_state(db, scan, JobState.running, attempts=int(self.request.retries or 0))
        SocketIOManager.emit_scan_state_change(str(scan.id), str(scan.project_id), _project_user_ids(db, scan), self.request.id, JobState.running.value, scan.status.value)
        set_scan_progress(scan_id, {"stage": "running", "percent": 0, "message": "Starting SAST scan", "job_id": self.request.id})

        run_github_scan(
            scan_id=str(scan.id),
            repo_url=scan.repo_url,
            branch=scan.repo_branch or "main",
            db_url=settings.DATABASE_URL,
            github_token=None,
        )
        # Note: run_github_scan persists results itself using db_url parameter in current implementation.
        # We still update progress for UI parity.
        _set_job_state(db, scan, JobState.success, attempts=int(self.request.retries or 0))
        SocketIOManager.emit_scan_state_change(str(scan.id), str(scan.project_id), _project_user_ids(db, scan), self.request.id, JobState.success.value, scan.status.value)
        set_scan_progress(scan_id, {"stage": "completed", "percent": 100, "message": "Scan completed", "job_id": self.request.id})
        return {"status": "success"}
    finally:
        clear_request_context()
        db.close()
        release_scan_lock(scan_id)


@shared_task(
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_jitter=True,
    retry_kwargs={"max_retries": 2},
    soft_time_limit=1800,
    time_limit=2100,
)
def run_dast_scan_job(self, scan_id: str, target_url: str) -> dict:
    if not acquire_scan_lock(scan_id, ttl_seconds=2400):
        return {"status": "skipped", "reason": "locked"}

    db = SessionLocal()
    try:
        headers = getattr(self.request, "headers", {}) or {}
        set_request_context(
            request_id=headers.get("request_id"),
            user_id=headers.get("user_id"),
            job_id=self.request.id,
            service="worker",
            endpoint="celery:run_dast_scan_job",
        )
        scan = db.query(Scan).filter(Scan.id == UUID(scan_id), Scan.method == ScanMethod.dast).first()
        if not scan:
            return {"status": "not_found"}
        if scan.status in {ScanStatus.running, ScanStatus.completed}:
            return {"status": "skipped", "reason": f"already_{scan.status.value}"}

        _set_scan_state(db, scan, status=ScanStatus.running)
        _set_job_state(db, scan, JobState.running, attempts=int(self.request.retries or 0))
        SocketIOManager.emit_scan_state_change(str(scan.id), str(scan.project_id), _project_user_ids(db, scan), self.request.id, JobState.running.value, scan.status.value)

        def progress_cb(payload: dict) -> None:
            set_scan_progress(scan_id, {**payload, "job_id": self.request.id}, ttl_seconds=7200)
            SocketIOManager.emit_scan_progress_update(str(scan.id), str(scan.project_id), _project_user_ids(db, scan), self.request.id, payload)

        result = asyncio.run(run_dast_scan_async(target_url, progress_callback=progress_cb))
        findings = result.get("vulnerabilities", [])

        scan.results_json = json.dumps(sanitize_scan_results({"findings": findings, "summary": {"tool": "OWASP ZAP"}}))
        scan.error_message = result.get("error")
        scan.status = ScanStatus.completed if result.get("completed") else ScanStatus.failed
        scan.completed_at = datetime.now(UTC)
        db.commit()

        if scan.status == ScanStatus.completed:
            get_or_create_scan_risk_score(db, scan)
            sync_vulnerability_tasks_for_scan(db, scan.project, scan)

        set_scan_progress(
            scan_id,
            {
                "stage": "completed" if scan.status == ScanStatus.completed else "failed",
                "spider_progress": result.get("progress", {}).get("spider_progress", 0),
                "active_scan_progress": result.get("progress", {}).get("active_scan_progress", 0),
                "alerts_found": len(findings),
                "error": scan.error_message,
                "job_id": self.request.id,
            },
            ttl_seconds=7200,
        )
        _set_job_state(db, scan, JobState.success if scan.status == ScanStatus.completed else JobState.failed, attempts=int(self.request.retries or 0))
        SocketIOManager.emit_scan_state_change(str(scan.id), str(scan.project_id), _project_user_ids(db, scan), self.request.id, scan.job_state, scan.status.value)
        return {"status": "success" if scan.status == ScanStatus.completed else "failed"}
    finally:
        clear_request_context()
        db.close()
        release_scan_lock(scan_id)


@shared_task(
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_jitter=True,
    retry_kwargs={"max_retries": 2},
    soft_time_limit=120,
    time_limit=180,
)
def process_cli_scan_job(self, scan_id: str, results_payload: dict) -> dict:
    if not acquire_scan_lock(scan_id, ttl_seconds=600):
        return {"status": "skipped", "reason": "locked"}

    db = SessionLocal()
    try:
        headers = getattr(self.request, "headers", {}) or {}
        set_request_context(
            request_id=headers.get("request_id"),
            user_id=headers.get("user_id"),
            job_id=self.request.id,
            service="worker",
            endpoint="celery:process_cli_scan_job",
        )
        scan = db.query(Scan).filter(Scan.id == UUID(scan_id), Scan.method == ScanMethod.cli).first()
        if not scan:
            return {"status": "not_found"}
        if scan.status in {ScanStatus.running, ScanStatus.completed}:
            return {"status": "skipped", "reason": f"already_{scan.status.value}"}

        _set_scan_state(db, scan, status=ScanStatus.running)
        _set_job_state(db, scan, JobState.running, attempts=int(self.request.retries or 0))
        SocketIOManager.emit_scan_state_change(str(scan.id), str(scan.project_id), _project_user_ids(db, scan), self.request.id, JobState.running.value, scan.status.value)
        set_scan_progress(scan_id, {"stage": "running", "percent": 10, "message": "Sanitizing findings", "job_id": self.request.id})

        sanitized = sanitize_scan_results(results_payload)
        scan.results_json = json.dumps(sanitized)
        scan.status = ScanStatus.completed
        scan.completed_at = datetime.now(UTC)
        db.commit()
        sync_vulnerability_tasks_for_scan(db, scan.project, scan, results_payload.get("findings"))

        # Notify owner (lightweight, consistent)
        project = scan.project
        create_notification(
            db,
            user_id=project.owner_id,
            type="scan_complete",
            title=f"Scan completed — {project.name}",
            message=f"{sanitized.get('summary', {}).get('total_findings', 0)} finding(s) detected.",
            link=f"/projects/{project.id}",
        )

        _set_job_state(db, scan, JobState.success, attempts=int(self.request.retries or 0))
        SocketIOManager.emit_scan_state_change(str(scan.id), str(scan.project_id), _project_user_ids(db, scan), self.request.id, JobState.success.value, scan.status.value)
        set_scan_progress(scan_id, {"stage": "completed", "percent": 100, "message": "CLI scan stored", "job_id": self.request.id})
        return {"status": "success"}
    finally:
        clear_request_context()
        db.close()
        release_scan_lock(scan_id)
