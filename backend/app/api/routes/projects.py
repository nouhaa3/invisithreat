from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, joinedload
from typing import List
from app.db.session import get_db
from app.core.jwt import require_admin
from app.core.permissions import require_permission, P
from app.core.rate_limit import limiter
from app.core.config import settings
from app.models.user import User
from app.schemas.scan import (
    ProjectCreate, ProjectUpdate, ProjectResponse,
    ScanCreate, ScanResponse, CLITokenResponse, CLIScanUpload,
    AdminProjectsResponse, ProjectAdminStatusUpdate, ProjectAdminStatusResponse,
    SecurityProjectsResponse, SecurityWorkflowActionRequest,
    SecurityWorkflowActionResponse, BulkProjectActionRequest, BulkProjectActionResponse
)
from app.services.project import (
    create_project, get_projects_for_user, get_project, get_project_accessible,
    update_project, delete_project, enrich_project, get_scans_for_projects_batch,
    create_scan, get_scans_for_project,
    get_admin_projects_management, update_project_status_admin, delete_project_admin,
    get_security_projects_overview
)
from app.services.github_scanner import run_github_scan
import uuid, secrets
import json
from datetime import date, datetime, UTC
from app.models.scan import Project as ProjectModel
from app.models.member import ProjectMember as MemberModel
from app.models.scan import Scan as ScanModel, ScanStatus
from app.models.role import Role
from app.models.github_repository import GitHubRepository
from app.models.vulnerability_workflow import (
    VulnerabilityTask,
    VulnerabilityTaskComment,
    VulnerabilityTaskStatus,
)
from app.services.risk_score import get_or_create_scan_risk_score
from app.services.notification import create_notification
from app.schemas.vulnerability_workflow import (
    VulnerabilityWorkflowSnapshotResponse,
    VulnerabilityTaskResponse,
    VulnerabilityTaskUpdateRequest,
    VulnerabilityTaskCommentCreate,
    VulnerabilityTaskCommentResponse,
)

router = APIRouter(prefix="/projects", tags=["Projects"])


def _guess_repo_name(repo_url: str) -> str:
    cleaned = (repo_url or "").strip().rstrip("/")
    tail = cleaned.split("/")[-1] if cleaned else "repository"
    return tail[:-4] if tail.lower().endswith(".git") else tail


def _security_workflow_template(action: str, project_name: str, actor_name: str, note: str | None) -> tuple[str, str]:
    if action == "request_fixes":
        title = f'Security action required - Fix vulnerabilities in "{project_name}"'
        message = f"{actor_name} requested corrective actions for this project."
    elif action == "request_rescan":
        title = f'Security action required - Re-run scan for "{project_name}"'
        message = f"{actor_name} requested a new scan after remediation."
    else:
        title = f'Security validation closed - "{project_name}"'
        message = f"{actor_name} confirmed risk reduction and closed this validation cycle."

    if note:
        message = f"{message} Note: {note}"
    return title, message


def _to_non_negative_int(value) -> int:
    try:
        parsed = int(value)
        return parsed if parsed > 0 else 0
    except (TypeError, ValueError):
        return 0


def _scan_security_counts(scan: ScanModel | None) -> tuple[int, int]:
    if not scan or scan.status != ScanStatus.completed or not scan.results_json:
        return 0, 0

    if scan.results_json.startswith("__pending_token:"):
        return 0, 0

    try:
        payload = json.loads(scan.results_json)
    except (TypeError, ValueError, json.JSONDecodeError):
        return 0, 0

    summary = payload.get("summary") if isinstance(payload, dict) else None
    findings = payload.get("findings") if isinstance(payload, dict) else []
    findings = findings if isinstance(findings, list) else []

    if isinstance(summary, dict):
        total = _to_non_negative_int(summary.get("total_findings", summary.get("total", len(findings))))
        critical = _to_non_negative_int(summary.get("critical", None))
        if critical == 0:
            critical = sum(1 for finding in findings if str((finding or {}).get("severity", "")).lower() == "critical")
        return total, critical

    total = len(findings)
    critical = sum(1 for finding in findings if str((finding or {}).get("severity", "")).lower() == "critical")
    return total, critical


def _ensure_validation_can_be_confirmed(db: Session, project_id: uuid.UUID) -> None:
    completed_scans = (
        db.query(ScanModel)
        .filter(ScanModel.project_id == project_id, ScanModel.status == ScanStatus.completed)
        .order_by(ScanModel.started_at.desc())
        .limit(2)
        .all()
    )

    if not completed_scans:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot confirm validation: no completed scan available.",
        )

    latest_total, latest_critical = _scan_security_counts(completed_scans[0])
    if latest_critical > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot confirm validation: latest completed scan still has critical findings.",
        )

    if len(completed_scans) == 1:
        if latest_total > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot confirm validation: at least one follow-up completed scan with reduced findings is required.",
            )
        return

    previous_total, _ = _scan_security_counts(completed_scans[1])
    if latest_total >= previous_total and latest_total > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot confirm validation: findings did not decrease versus previous completed scan.",
        )


def _normalize_finding_text(value) -> str:
    return " ".join(str(value or "").strip().lower().split())


def _finding_fingerprint(finding: dict) -> str:
    rule_id = _normalize_finding_text(finding.get("rule_id") or "rule")
    title = _normalize_finding_text(finding.get("title") or "untitled")
    file_path = _normalize_finding_text(finding.get("file") or finding.get("path") or "")
    line_number = _finding_line_number(finding) or 0
    raw_key = f"{rule_id}|{title}|{file_path}|{line_number}"
    if len(raw_key) <= 190:
        return raw_key
    return raw_key[:190]


def _finding_line_number(finding: dict) -> int | None:
    try:
        value = finding.get("line")
        if value is None:
            return None
        parsed = int(value)
        return parsed if parsed > 0 else None
    except (TypeError, ValueError):
        return None


def _latest_completed_scan_with_findings(db: Session, project_id: uuid.UUID) -> tuple[ScanModel | None, list[dict]]:
    latest_scan = (
        db.query(ScanModel)
        .filter(ScanModel.project_id == project_id, ScanModel.status == ScanStatus.completed)
        .order_by(ScanModel.started_at.desc())
        .first()
    )
    if not latest_scan or not latest_scan.results_json:
        return latest_scan, []
    if latest_scan.results_json.startswith("__pending_token:"):
        return latest_scan, []
    try:
        payload = json.loads(latest_scan.results_json)
    except (TypeError, ValueError, json.JSONDecodeError):
        return latest_scan, []

    findings = payload.get("findings", []) if isinstance(payload, dict) else []
    return latest_scan, findings if isinstance(findings, list) else []


def _is_security_actor(user: User) -> bool:
    role_name = user.role.name if user.role else None
    return role_name in {"Security Manager", "Admin"}


def _project_assignable_users(db: Session, project: ProjectModel) -> list[dict]:
    assignee_map: dict[str, dict] = {}

    owner = db.query(User).filter(User.id == project.owner_id).first()
    if owner:
        assignee_map[str(owner.id)] = {
            "user_id": owner.id,
            "nom": owner.nom,
            "role_projet": "Owner",
            "profile_picture": owner.profile_picture,
        }

    members = (
        db.query(MemberModel)
        .options(joinedload(MemberModel.user))
        .filter(MemberModel.project_id == project.id)
        .all()
    )
    for member in members:
        role_label = (member.role_projet or "Viewer").strip() or "Viewer"
        if role_label.lower() not in {"owner", "editor"}:
            continue
        user = member.user
        if not user:
            continue
        key = str(user.id)
        if key in assignee_map:
            continue
        assignee_map[key] = {
            "user_id": user.id,
            "nom": user.nom,
            "role_projet": role_label,
            "profile_picture": user.profile_picture,
        }

    return sorted(assignee_map.values(), key=lambda item: item["nom"].lower())


def _sync_current_vulnerability_tasks(
    db: Session,
    project: ProjectModel,
    latest_scan: ScanModel | None,
    findings: list[dict],
) -> list[uuid.UUID]:
    if not latest_scan or not findings:
        return []

    now = datetime.now(UTC)
    normalized_findings: list[dict] = []
    fingerprints: list[str] = []

    seen_fingerprints: set[str] = set()

    for finding in findings:
        if not isinstance(finding, dict):
            continue
        title = str(finding.get("title") or "Untitled vulnerability").strip()
        severity = str(finding.get("severity") or "info").lower().strip()
        if severity not in {"critical", "high", "medium", "low", "info"}:
            severity = "info"
        file_path = str(finding.get("file") or finding.get("path") or "").strip() or None
        line_number = _finding_line_number(finding)

        fingerprint = _finding_fingerprint(finding)
        if fingerprint in seen_fingerprints:
            continue
        seen_fingerprints.add(fingerprint)

        fingerprints.append(fingerprint)
        normalized_findings.append(
            {
                "fingerprint": fingerprint,
                "title": title,
                "severity": severity,
                "file_path": file_path,
                "line_number": line_number,
            }
        )

    if not normalized_findings:
        return []

    existing_tasks = (
        db.query(VulnerabilityTask)
        .filter(VulnerabilityTask.project_id == project.id, VulnerabilityTask.fingerprint.in_(fingerprints))
        .all()
    )
    task_by_fingerprint = {task.fingerprint: task for task in existing_tasks}

    touched_ids: list[uuid.UUID] = []
    for item in normalized_findings:
        task = task_by_fingerprint.get(item["fingerprint"])
        if not task:
            task = VulnerabilityTask(
                project_id=project.id,
                scan_id=latest_scan.id,
                fingerprint=item["fingerprint"],
                title=item["title"],
                severity=item["severity"],
                file_path=item["file_path"],
                line_number=item["line_number"],
                status=VulnerabilityTaskStatus.open,
                first_seen_at=now,
                last_seen_at=now,
                updated_at=now,
            )
            db.add(task)
            db.flush()
            task_by_fingerprint[item["fingerprint"]] = task
        else:
            previous_scan_id = task.scan_id
            task.scan_id = latest_scan.id
            task.title = item["title"]
            task.severity = item["severity"]
            task.file_path = item["file_path"]
            task.line_number = item["line_number"]
            task.last_seen_at = now
            if previous_scan_id and previous_scan_id != latest_scan.id and task.status in {
                VulnerabilityTaskStatus.fixed,
                VulnerabilityTaskStatus.verified,
            }:
                task.status = VulnerabilityTaskStatus.open

        touched_ids.append(task.id)

    db.commit()
    return touched_ids


def _deadline_state(task: VulnerabilityTask) -> tuple[bool, bool]:
    if not task.due_date or task.status in {VulnerabilityTaskStatus.fixed, VulnerabilityTaskStatus.verified}:
        return False, False

    today = date.today()
    delta = (task.due_date - today).days
    is_overdue = delta < 0
    is_due_soon = 0 <= delta <= 1
    return is_overdue, is_due_soon


def _serialize_comment(comment: VulnerabilityTaskComment) -> dict:
    author = comment.author
    return {
        "id": comment.id,
        "task_id": comment.task_id,
        "author_id": comment.author_id,
        "author_name": author.nom if author else "Unknown",
        "author_profile_picture": author.profile_picture if author else None,
        "message": comment.message,
        "created_at": comment.created_at,
    }


def _serialize_task(task: VulnerabilityTask) -> dict:
    is_overdue, is_due_soon = _deadline_state(task)
    comments_sorted = sorted(task.comments, key=lambda c: c.created_at or datetime.now(UTC))
    return {
        "id": task.id,
        "project_id": task.project_id,
        "scan_id": task.scan_id,
        "fingerprint": task.fingerprint,
        "title": task.title,
        "severity": task.severity,
        "file_path": task.file_path,
        "line_number": task.line_number,
        "status": task.status.value if isinstance(task.status, VulnerabilityTaskStatus) else str(task.status),
        "assignee_id": task.assignee_id,
        "assignee_name": task.assignee.nom if task.assignee else None,
        "assignee_profile_picture": task.assignee.profile_picture if task.assignee else None,
        "assigned_by_id": task.assigned_by_id,
        "assigned_by_name": task.assigned_by.nom if task.assigned_by else None,
        "due_date": task.due_date,
        "first_seen_at": task.first_seen_at,
        "last_seen_at": task.last_seen_at,
        "updated_at": task.updated_at,
        "is_overdue": is_overdue,
        "is_due_soon": is_due_soon,
        "comments": [_serialize_comment(comment) for comment in comments_sorted],
    }


def _notify_deadline_if_needed(db: Session, project: ProjectModel, task: VulnerabilityTask) -> bool:
    if not task.assignee_id or not task.due_date:
        return False
    if task.status in {VulnerabilityTaskStatus.fixed, VulnerabilityTaskStatus.verified}:
        return False
    if task.deadline_alert_sent_at is not None:
        return False

    today = date.today()
    delta = (task.due_date - today).days
    if delta > 1:
        return False

    if delta < 0:
        title = f'Deadline missed for "{task.title}"'
        message = f'The due date for project "{project.name}" has passed. Please update status or provide remediation details.'
    elif delta == 0:
        title = f'Deadline today for "{task.title}"'
        message = f'This vulnerability task in "{project.name}" is due today.'
    else:
        title = f'Deadline approaching for "{task.title}"'
        message = f'This vulnerability task in "{project.name}" is due tomorrow.'

    create_notification(
        db,
        user_id=task.assignee_id,
        type="system",
        title=title,
        message=message,
        link=f"/projects/{project.id}",
    )
    task.deadline_alert_sent_at = datetime.now(UTC)
    return True


def _security_team_user_ids(db: Session) -> list[uuid.UUID]:
    users = (
        db.query(User)
        .join(Role, User.role_id == Role.id)
        .filter(Role.name.in_(["Security Manager", "Admin"]))
        .all()
    )
    return [user.id for user in users]


def _can_collaborate_on_task(current_user: User, user_role: str, task: VulnerabilityTask) -> bool:
    if _is_security_actor(current_user):
        return True
    if user_role in {"owner", "editor"}:
        return True
    return task.assignee_id == current_user.id


def _task_sort_key(task: VulnerabilityTask) -> tuple[int, datetime]:
    severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}
    sev = str(task.severity or "info").lower()
    updated = task.updated_at or datetime.now(UTC)
    return severity_order.get(sev, 99), updated


# ─── Admin Routes ──────────────────────────────────────────────────────────────

@router.get("/admin/all", response_model=List[ProjectResponse], tags=["Admin"])
async def admin_list_all_projects(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Admin only — list every project across all users."""
    projects = db.query(ProjectModel).order_by(ProjectModel.created_at.desc()).all()
    
    # Get all scans for all projects in ONE query (not 1+N)
    project_ids = [p.id for p in projects]
    scans_by_project = get_scans_for_projects_batch(db, project_ids)
    
    # Build response with enriched data using batch scan data
    result = []
    for project in projects:
        scans = scans_by_project.get(project.id, [])
        last_status = scans[0].status.value if scans else None
        result.append({
            "id": project.id,
            "name": project.name,
            "description": project.description,
            "project_type": project.project_type,
            "language": project.language,
            "analysis_type": project.analysis_type,
            "visibility": project.visibility,
            "owner_id": project.owner_id,
            "created_at": project.created_at,
            "scan_count": len(scans),
            "last_scan_status": last_status,
            "user_role": "admin",
        })
    return result


@router.get("/admin/management", response_model=AdminProjectsResponse, tags=["Admin"])
async def admin_management_projects(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_permission(P.MANAGE_ALL_PROJECTS)),
):
    """Admin-only management view with high-level project data and summary."""
    return get_admin_projects_management(db)


@router.patch("/admin/{project_id}/status", response_model=ProjectAdminStatusResponse, tags=["Admin"])
async def admin_update_project_status(
    project_id: uuid.UUID,
    data: ProjectAdminStatusUpdate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_permission(P.MANAGE_ALL_PROJECTS)),
):
    return update_project_status_admin(db, project_id, data.status)


@router.post("/admin/bulk/delete", response_model=BulkProjectActionResponse, tags=["Admin"])
async def admin_bulk_delete_projects(
    payload: BulkProjectActionRequest,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_permission(P.MANAGE_ALL_PROJECTS)),
):
    """Admin-only bulk deletion of projects with per-project error reporting."""
    success_count = 0
    failed_count = 0
    errors: dict[str, str] = {}

    for project_id in payload.project_ids:
        project_exists = db.query(ProjectModel.id).filter(ProjectModel.id == project_id).first()
        if not project_exists:
            failed_count += 1
            errors[str(project_id)] = "Project not found"
            continue

        try:
            delete_project_admin(db, project_id)
            success_count += 1
        except SQLAlchemyError:
            db.rollback()
            failed_count += 1
            errors[str(project_id)] = "An unexpected error occurred"

    return BulkProjectActionResponse(
        success_count=success_count,
        failed_count=failed_count,
        errors=errors,
    )


@router.delete("/admin/{project_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Admin"])
async def admin_delete_project(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_permission(P.MANAGE_ALL_PROJECTS)),
):
    delete_project_admin(db, project_id)


@router.get("/security/overview", response_model=SecurityProjectsResponse, tags=["Security"])
async def security_projects_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(P.VIEW_SECURITY_METRICS)),
):
    """Security-manager view with security-focused project summaries."""
    return get_security_projects_overview(db, current_user)


@router.post("/{project_id}/security/workflow-action", response_model=SecurityWorkflowActionResponse, tags=["Security"])
async def trigger_security_workflow_action(
    project_id: uuid.UUID,
    data: SecurityWorkflowActionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(P.PRIORITIZE_VULNERABILITIES)),
):
    project, _ = get_project_accessible(db, project_id, current_user)

    if data.action == "confirm_validation":
        _ensure_validation_can_be_confirmed(db, project_id)

    owner_user = db.query(User).filter(User.id == project.owner_id).first()
    recipient_map: dict[str, dict] = {}

    recipient_map[str(project.owner_id)] = {
        "user_id": project.owner_id,
        "nom": owner_user.nom if owner_user else "Project Owner",
        "role_projet": "Owner",
    }

    members = (
        db.query(MemberModel)
        .filter(MemberModel.project_id == project_id)
        .all()
    )

    for member in members:
        role_label = (member.role_projet or "Viewer").strip() or "Viewer"
        role_normalized = role_label.lower()
        if role_normalized not in {"owner", "editor"}:
            continue

        key = str(member.user_id)
        if key in recipient_map:
            continue

        member_user = db.query(User).filter(User.id == member.user_id).first()
        if not member_user:
            continue

        recipient_map[key] = {
            "user_id": member.user_id,
            "nom": member_user.nom,
            "role_projet": role_label,
        }

    actor_name = current_user.nom or "Security Manager"
    title, message = _security_workflow_template(data.action, project.name, actor_name, data.note)

    for recipient in recipient_map.values():
        create_notification(
            db,
            user_id=recipient["user_id"],
            type="system",
            title=title,
            message=message,
            link=f"/projects/{project.id}",
        )

    action_label = {
        "request_fixes": "Fix request sent to project team.",
        "request_rescan": "Re-scan request sent to project team.",
        "confirm_validation": "Validation closure shared with project team.",
    }[data.action]

    return {
        "action": data.action,
        "notified_count": len(recipient_map),
        "recipients": list(recipient_map.values()),
        "message": action_label,
    }


@router.get(
    "/{project_id}/security/vulnerability-tasks",
    response_model=VulnerabilityWorkflowSnapshotResponse,
    tags=["Security"],
)
async def get_vulnerability_workflow_snapshot(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(P.VIEW_VULNERABILITIES)),
):
    project, _user_role = get_project_accessible(db, project_id, current_user)
    latest_scan, findings = _latest_completed_scan_with_findings(db, project_id)
    touched_ids = _sync_current_vulnerability_tasks(db, project, latest_scan, findings)

    assignees = _project_assignable_users(db, project)
    if not touched_ids:
        return {
            "project_id": project.id,
            "scan_id": latest_scan.id if latest_scan else None,
            "scan_completed_at": latest_scan.completed_at if latest_scan else None,
            "assignees": assignees,
            "tasks": [],
        }

    tasks = (
        db.query(VulnerabilityTask)
        .options(
            joinedload(VulnerabilityTask.comments).joinedload(VulnerabilityTaskComment.author),
            joinedload(VulnerabilityTask.assignee),
            joinedload(VulnerabilityTask.assigned_by),
        )
        .filter(VulnerabilityTask.id.in_(touched_ids))
        .all()
    )

    deadline_updates = False
    for task in tasks:
        deadline_updates = _notify_deadline_if_needed(db, project, task) or deadline_updates
    if deadline_updates:
        db.commit()

    tasks_sorted = sorted(tasks, key=_task_sort_key)
    return {
        "project_id": project.id,
        "scan_id": latest_scan.id if latest_scan else None,
        "scan_completed_at": latest_scan.completed_at if latest_scan else None,
        "assignees": assignees,
        "tasks": [_serialize_task(task) for task in tasks_sorted],
    }


@router.patch(
    "/{project_id}/security/vulnerability-tasks/{task_id}",
    response_model=VulnerabilityTaskResponse,
    tags=["Security"],
)
async def update_vulnerability_task(
    project_id: uuid.UUID,
    task_id: uuid.UUID,
    data: VulnerabilityTaskUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(P.VIEW_VULNERABILITIES)),
):
    project, user_role = get_project_accessible(db, project_id, current_user)
    task = (
        db.query(VulnerabilityTask)
        .options(
            joinedload(VulnerabilityTask.comments).joinedload(VulnerabilityTaskComment.author),
            joinedload(VulnerabilityTask.assignee),
            joinedload(VulnerabilityTask.assigned_by),
        )
        .filter(VulnerabilityTask.id == task_id, VulnerabilityTask.project_id == project.id)
        .first()
    )
    if not task:
        raise HTTPException(status_code=404, detail="Vulnerability task not found")

    if not _can_collaborate_on_task(current_user, user_role, task):
        raise HTTPException(status_code=403, detail="You cannot update this vulnerability task")

    is_security_actor = _is_security_actor(current_user)
    if not is_security_actor and any([data.assignee_id is not None, data.clear_assignee, data.due_date is not None, data.clear_due_date]):
        raise HTTPException(status_code=403, detail="Only Security Manager/Admin can change assignment or deadline")

    if not is_security_actor and data.status == "verified":
        raise HTTPException(status_code=403, detail="Only Security Manager/Admin can mark a task as verified")

    available_assignees = _project_assignable_users(db, project)
    available_assignee_ids = {entry["user_id"] for entry in available_assignees}

    previous_assignee_id = task.assignee_id
    previous_status = task.status.value if isinstance(task.status, VulnerabilityTaskStatus) else str(task.status)

    if data.clear_assignee:
        task.assignee_id = None
        task.assigned_by_id = current_user.id

    if data.assignee_id is not None:
        if data.assignee_id not in available_assignee_ids:
            raise HTTPException(status_code=400, detail="Selected assignee is not eligible for this project")
        task.assignee_id = data.assignee_id
        task.assigned_by_id = current_user.id

    if data.clear_due_date:
        task.due_date = None
        task.deadline_alert_sent_at = None

    if data.due_date is not None:
        task.due_date = data.due_date
        task.deadline_alert_sent_at = None

    if data.status is not None:
        task.status = VulnerabilityTaskStatus(data.status)

    created_comment = None
    if data.note:
        created_comment = VulnerabilityTaskComment(
            task_id=task.id,
            author_id=current_user.id,
            message=data.note,
        )
        db.add(created_comment)

    db.commit()

    if task.assignee_id and task.assignee_id != previous_assignee_id:
        create_notification(
            db,
            user_id=task.assignee_id,
            type="system",
            title=f'You were assigned "{task.title}"',
            message=f'{current_user.nom} assigned you a {task.severity} vulnerability in "{project.name}".',
            link=f"/projects/{project.id}",
        )

    current_status = task.status.value if isinstance(task.status, VulnerabilityTaskStatus) else str(task.status)
    if current_status != previous_status:
        if current_status == "fixed":
            security_recipients = {user_id for user_id in _security_team_user_ids(db) if user_id != current_user.id}
            for recipient_id in security_recipients:
                create_notification(
                    db,
                    user_id=recipient_id,
                    type="system",
                    title=f'Fix ready for review: "{task.title}"',
                    message=f'{current_user.nom} marked this vulnerability as fixed in "{project.name}".',
                    link=f"/projects/{project.id}",
                )
        elif current_status == "verified" and task.assignee_id and task.assignee_id != current_user.id:
            create_notification(
                db,
                user_id=task.assignee_id,
                type="system",
                title=f'Fix validated: "{task.title}"',
                message=f'{current_user.nom} verified this vulnerability in "{project.name}".',
                link=f"/projects/{project.id}",
            )

    if created_comment and task.assignee_id and task.assignee_id != current_user.id:
        create_notification(
            db,
            user_id=task.assignee_id,
            type="system",
            title=f'New comment on "{task.title}"',
            message=f'{current_user.nom}: {created_comment.message}',
            link=f"/projects/{project.id}",
        )

    updated_task = (
        db.query(VulnerabilityTask)
        .options(
            joinedload(VulnerabilityTask.comments).joinedload(VulnerabilityTaskComment.author),
            joinedload(VulnerabilityTask.assignee),
            joinedload(VulnerabilityTask.assigned_by),
        )
        .filter(VulnerabilityTask.id == task.id)
        .first()
    )
    return _serialize_task(updated_task)


@router.post(
    "/{project_id}/security/vulnerability-tasks/{task_id}/comments",
    response_model=VulnerabilityTaskCommentResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Security"],
)
async def add_vulnerability_task_comment(
    project_id: uuid.UUID,
    task_id: uuid.UUID,
    data: VulnerabilityTaskCommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(P.VIEW_VULNERABILITIES)),
):
    project, user_role = get_project_accessible(db, project_id, current_user)
    task = (
        db.query(VulnerabilityTask)
        .options(joinedload(VulnerabilityTask.assignee), joinedload(VulnerabilityTask.assigned_by))
        .filter(VulnerabilityTask.id == task_id, VulnerabilityTask.project_id == project.id)
        .first()
    )
    if not task:
        raise HTTPException(status_code=404, detail="Vulnerability task not found")

    if not _can_collaborate_on_task(current_user, user_role, task):
        raise HTTPException(status_code=403, detail="You cannot comment on this vulnerability task")

    comment = VulnerabilityTaskComment(task_id=task.id, author_id=current_user.id, message=data.message)
    db.add(comment)
    db.commit()

    recipients: set[uuid.UUID] = set()
    if task.assignee_id and task.assignee_id != current_user.id:
        recipients.add(task.assignee_id)
    if task.assigned_by_id and task.assigned_by_id != current_user.id:
        recipients.add(task.assigned_by_id)

    if not _is_security_actor(current_user):
        for security_user_id in _security_team_user_ids(db):
            if security_user_id != current_user.id:
                recipients.add(security_user_id)

    for recipient_id in recipients:
        create_notification(
            db,
            user_id=recipient_id,
            type="system",
            title=f'New discussion message on "{task.title}"',
            message=f'{current_user.nom}: {data.message}',
            link=f"/projects/{project.id}",
        )

    saved_comment = (
        db.query(VulnerabilityTaskComment)
        .options(joinedload(VulnerabilityTaskComment.author))
        .filter(VulnerabilityTaskComment.id == comment.id)
        .first()
    )
    return _serialize_comment(saved_comment)

@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_new_project(
    data: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(P.MANAGE_OWN_PROJECTS)),
):
    project = create_project(db, current_user, data)
    return enrich_project(db, project, "owner")


@router.get("", response_model=List[ProjectResponse])
async def list_projects(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(P.VIEW_SCAN_RESULTS)),
):
    projects = get_projects_for_user(db, current_user)
    
    # Get all scan data for all projects in ONE query (not 1+N)
    project_ids = [p.id for p in projects]
    scans_by_project = get_scans_for_projects_batch(db, project_ids)
    
    # Get user's memberships
    memberships = {
        m.project_id: m.role_projet.lower()
        for m in db.query(MemberModel).filter(MemberModel.user_id == current_user.id).all()
    }
    
    # Build response with enriched data
    result = []
    for project in projects:
        scans = scans_by_project.get(project.id, [])
        last_status = scans[0].status.value if scans else None
        user_role = "owner" if project.owner_id == current_user.id else memberships.get(project.id, "viewer")
        
        result.append({
            "id": project.id,
            "name": project.name,
            "description": project.description,
            "project_type": project.project_type,
            "language": project.language,
            "analysis_type": project.analysis_type,
            "visibility": project.visibility,
            "owner_id": project.owner_id,
            "created_at": project.created_at,
            "scan_count": len(scans),
            "last_scan_status": last_status,
            "user_role": user_role,
        })
    return result


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_one_project(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(P.VIEW_SCAN_RESULTS)),
):
    project, user_role = get_project_accessible(db, project_id, current_user)
    return enrich_project(db, project, user_role)


@router.patch("/{project_id}", response_model=ProjectResponse)
async def update_one_project(
    project_id: uuid.UUID,
    data: ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(P.MANAGE_OWN_PROJECTS)),
):
    project = update_project(db, project_id, current_user, data)
    return enrich_project(db, project, "owner")


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_one_project(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(P.MANAGE_OWN_PROJECTS)),
):
    delete_project(db, project_id, current_user)


# ─── Scans ───────────────────────────────────────────────────────────────────

@router.post("/{project_id}/scans", response_model=ScanResponse, status_code=status.HTTP_201_CREATED)
async def create_new_scan(
    project_id: uuid.UUID,
    data: ScanCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(P.RUN_SCAN)),
):
    project, user_role = get_project_accessible(db, project_id, current_user)
    if user_role not in ("owner", "editor"):
        raise HTTPException(status_code=403, detail="Only owners and editors can run scans")
    if data.method not in ("cli", "github"):
        raise HTTPException(status_code=400, detail="method must be 'cli' or 'github'")
    
    # Check trial scans limit for VIEWER role
    if current_user.role.name == "Viewer":
        if getattr(current_user, 'trial_scans_remaining', 0) <= 0:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Trial scan limit reached. Upgrade your role to continue scanning.",
            )
        # Decrement trial scans
        current_user.trial_scans_remaining -= 1
        db.commit()
    
    scan = create_scan(db, project, data.method, data.repo_url, data.repo_branch)

    if data.method == "github":
        if not data.repo_url:
            raise HTTPException(status_code=400, detail="repo_url is required for GitHub scans")

        repo_record = (
            db.query(GitHubRepository)
            .filter(GitHubRepository.project_id == project.id)
            .first()
        )
        if not repo_record:
            repo_record = GitHubRepository(
                project_id=project.id,
                name=_guess_repo_name(data.repo_url),
                url=data.repo_url.strip(),
                default_branch=(data.repo_branch or "main").strip() or "main",
                access_token=(data.repo_token or None),
            )
            db.add(repo_record)
        else:
            repo_record.name = _guess_repo_name(data.repo_url)
            repo_record.url = data.repo_url.strip()
            repo_record.default_branch = (data.repo_branch or "main").strip() or "main"
            if data.repo_token is not None:
                repo_record.access_token = data.repo_token
        db.commit()

        background_tasks.add_task(
            run_github_scan,
            scan_id=str(scan.id),
            repo_url=data.repo_url,
            branch=data.repo_branch or "main",
            db_url=settings.DATABASE_URL,
            github_token=data.repo_token,
        )

    return scan


@router.get("/{project_id}/scans", response_model=List[ScanResponse])
async def list_project_scans(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(P.VIEW_SCAN_RESULTS)),
):
    get_project_accessible(db, project_id, current_user)
    return get_scans_for_project(db, project_id)


@router.get("/{project_id}/risk-score")
async def get_project_risk_score(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(P.VIEW_SCAN_RESULTS)),
):
    get_project_accessible(db, project_id, current_user)
    latest_scan = (
        db.query(ScanModel)
        .filter(ScanModel.project_id == project_id, ScanModel.status == ScanStatus.completed)
        .order_by(ScanModel.started_at.desc())
        .first()
    )
    if not latest_scan:
        return {
            "project_id": str(project_id),
            "scan_id": None,
            "score": 0.0,
            "exploitability": 0.0,
            "business_impact": 0.0,
        }

    risk = get_or_create_scan_risk_score(db, latest_scan)
    return {
        "project_id": str(project_id),
        "scan_id": str(latest_scan.id),
        "score": round(float(risk.score), 2) if risk else 0.0,
        "exploitability": round(float(risk.exploitability), 2) if risk else 0.0,
        "business_impact": round(float(risk.business_impact), 2) if risk else 0.0,
    }


@router.get("/{project_id}/scans/{scan_id}/risk-score")
async def get_scan_risk_score(
    project_id: uuid.UUID,
    scan_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(P.VIEW_SCAN_RESULTS)),
):
    get_project_accessible(db, project_id, current_user)
    scan = db.query(ScanModel).filter(ScanModel.id == scan_id, ScanModel.project_id == project_id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    risk = get_or_create_scan_risk_score(db, scan)
    if not risk:
        return {
            "project_id": str(project_id),
            "scan_id": str(scan_id),
            "score": 0.0,
            "exploitability": 0.0,
            "business_impact": 0.0,
        }
    return {
        "project_id": str(project_id),
        "scan_id": str(scan_id),
        "score": round(float(risk.score), 2),
        "exploitability": round(float(risk.exploitability), 2),
        "business_impact": round(float(risk.business_impact), 2),
    }


@router.post("/{project_id}/scans/{scan_id}/claim-token", response_model=CLITokenResponse)
@limiter.limit("30/minute")
async def get_cli_upload_token(
    project_id: uuid.UUID,
    scan_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(P.RUN_SCAN)),
):
    """
    Issue a one-time upload token for the CLI to send results back.
    The CLI never needs a user password — only this short-lived token.
    """
    _ = request
    get_project(db, project_id, current_user)
    scan = db.query(ScanModel).filter(ScanModel.id == scan_id, ScanModel.project_id == project_id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    token = secrets.token_urlsafe(32)
    # Store token temporarily in scan record (real impl: Redis / signed JWT)
    scan.results_json = f"__pending_token:{token}"
    db.commit()
    return CLITokenResponse(upload_token=token, scan_id=scan_id, expires_in=3600)


@router.post("/scans/upload", status_code=200)
@limiter.limit("60/minute")
async def cli_upload_results(
    payload: CLIScanUpload,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Endpoint called by the CLI (no user auth) to upload scan results using the upload token.
    """
    _ = request
    scan = db.query(ScanModel).filter(
        ScanModel.results_json == f"__pending_token:{payload.upload_token}"
    ).first()
    if not scan:
        raise HTTPException(status_code=401, detail="Invalid or expired upload token")
    scan.results_json = payload.results_json
    scan.status = ScanStatus.completed if payload.status == "completed" else ScanStatus.failed
    scan.error_message = payload.error_message
    scan.completed_at = datetime.now(UTC)
    db.commit()
    if scan.status == ScanStatus.completed:
        get_or_create_scan_risk_score(db, scan)
    return {"message": "Results uploaded successfully", "scan_id": str(scan.id)}
