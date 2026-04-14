from sqlalchemy import inspect, text
from sqlalchemy.orm import Session, joinedload
from fastapi import HTTPException, status
from app.models.scan import Project, Scan, ScanStatus
from app.models.user import User
from app.models.member import ProjectMember
from app.schemas.scan import ProjectCreate, ProjectUpdate
import uuid
import json


def _has_global_security_scope(user: User) -> bool:
    role_name = user.role.name if getattr(user, "role", None) else None
    return role_name in {"Security Manager", "Admin"}


def create_project(db: Session, owner: User, data: ProjectCreate) -> Project:
    project = Project(
        id=uuid.uuid4(),
        name=data.name,
        description=data.description,
        project_type=data.project_type or "Other",
        language=data.language or "Other",
        analysis_type=data.analysis_type or "SAST",
        visibility=data.visibility or "private",
        owner_id=owner.id,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def get_projects_for_user(db: Session, user: User) -> list[Project]:
    """Get all projects accessible to user (owned OR member) in ONE query."""
    from sqlalchemy import or_
    # Get all projects where user is owner OR member - in ONE query
    all_projects = db.query(Project).filter(
        or_(
            Project.owner_id == user.id,
            Project.id.in_(
                db.query(ProjectMember.project_id).filter(ProjectMember.user_id == user.id)
            )
        )
    ).all()
    return sorted(all_projects, key=lambda p: p.created_at, reverse=True)


def get_projects_for_security_scope(db: Session, user: User) -> list[Project]:
    if _has_global_security_scope(user):
        return db.query(Project).order_by(Project.created_at.desc()).all()
    return get_projects_for_user(db, user)


def get_project(db: Session, project_id: uuid.UUID, user: User) -> Project:
    """Owner-only access — used for edit/delete routes."""
    project = db.query(Project).filter(Project.id == project_id, Project.owner_id == user.id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


def get_project_accessible(db: Session, project_id: uuid.UUID, user: User) -> tuple:
    """Returns (project, user_role) for owner OR member. user_role: 'owner' | 'editor' | 'viewer'."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    if project.owner_id == user.id:
        return project, "owner"

    # Security leadership roles can read project security data platform-wide.
    if _has_global_security_scope(user):
        role_name = user.role.name if user.role else "security_manager"
        return project, "admin" if role_name == "Admin" else "security_manager"

    membership = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id,
        ProjectMember.user_id == user.id
    ).first()
    if membership:
        return project, membership.role_projet.lower()
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")


def update_project(db: Session, project_id: uuid.UUID, user: User, data: ProjectUpdate) -> Project:
    project = get_project(db, project_id, user)
    if data.name is not None:
        project.name = data.name
    if data.description is not None:
        project.description = data.description
    if data.project_type is not None:
        project.project_type = data.project_type
    if data.language is not None:
        project.language = data.language
    if data.analysis_type is not None:
        project.analysis_type = data.analysis_type
    if data.visibility is not None:
        project.visibility = data.visibility
    db.commit()
    db.refresh(project)
    return project


def delete_project(db: Session, project_id: uuid.UUID, user: User) -> None:
    project = get_project(db, project_id, user)
    _delete_legacy_dast_scans_for_project(db, project.id)
    db.delete(project)
    db.commit()


def enrich_project(db: Session, project: Project, user_role: str = None) -> dict:
    """Attach scan_count, last_scan_status and user_role to project dict."""
    scans = db.query(Scan).filter(Scan.project_id == project.id).order_by(Scan.started_at.desc()).all()
    last_status = scans[0].status.value if scans else None
    return {
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
    }


def get_scans_for_projects_batch(db: Session, project_ids: list[uuid.UUID]) -> dict:
    """Get all scans for multiple projects in a single query. Returns {project_id: [scans]}"""
    if not project_ids:
        return {}
    
    scans_by_project = {}
    all_scans = db.query(Scan).filter(Scan.project_id.in_(project_ids)).order_by(Scan.started_at.desc()).all()
    
    for scan in all_scans:
        if scan.project_id not in scans_by_project:
            scans_by_project[scan.project_id] = []
        scans_by_project[scan.project_id].append(scan)
    
    return scans_by_project


def create_scan(db: Session, project: Project, method: str, repo_url: str = None, repo_branch: str = "main") -> Scan:
    scan = Scan(
        id=uuid.uuid4(),
        project_id=project.id,
        method=method,
        status=ScanStatus.pending,
        repo_url=repo_url,
        repo_branch=repo_branch,
    )
    db.add(scan)
    db.commit()
    db.refresh(scan)
    return scan


def get_scans_for_project(db: Session, project_id: uuid.UUID) -> list[Scan]:
    return db.query(Scan).filter(Scan.project_id == project_id).order_by(Scan.started_at.desc()).all()


def _parse_findings(results_json: str | None) -> list[dict]:
    if not results_json or results_json.startswith("__pending_token:"):
        return []
    try:
        data = json.loads(results_json)
        findings = data.get("findings", [])
        return findings if isinstance(findings, list) else []
    except (ValueError, TypeError, json.JSONDecodeError):
        return []


def _risk_level_from_score(score: float | None) -> str:
    if score is None:
        return "Low"
    if score >= 7:
        return "High"
    if score >= 4:
        return "Medium"
    return "Low"


def _normalize_project_status(status_value: str | None) -> str:
    status_lower = (status_value or "active").strip().lower()
    return "archived" if status_lower in ("archived", "inactive", "disabled") else "active"


def get_admin_projects_management(db: Session) -> dict:
    projects = (
        db.query(Project)
        .options(
            joinedload(Project.owner),
            joinedload(Project.members),
            joinedload(Project.scans).joinedload(Scan.risk_score),
        )
        .order_by(Project.created_at.desc())
        .all()
    )

    summary = {
        "total_projects": len(projects),
        "active_projects": 0,
        "archived_projects": 0,
        "total_users_involved": 0,
    }

    involved_user_ids: set[uuid.UUID] = set()
    result_projects = []

    for project in projects:
        normalized_status = _normalize_project_status(project.status)
        if normalized_status == "active":
            summary["active_projects"] += 1
        else:
            summary["archived_projects"] += 1

        owner_name = project.owner.nom if project.owner else "Unknown"
        owner_id = project.owner_id

        member_user_ids = {m.user_id for m in project.members}
        # Count owner + distinct members as project users involved.
        users_assigned_count = 1 + len(member_user_ids - {owner_id})

        involved_user_ids.add(owner_id)
        involved_user_ids.update(member_user_ids)

        total_scans = len(project.scans)

        latest_scan_ts = None
        latest_completed_scan = None
        latest_completed_sort_key = None

        for scan in project.scans:
            candidates = [scan.completed_at, scan.started_at]
            scan_latest_ts = max((c for c in candidates if c is not None), default=None)
            if scan_latest_ts and (latest_scan_ts is None or scan_latest_ts > latest_scan_ts):
                latest_scan_ts = scan_latest_ts

            if scan.status == ScanStatus.completed:
                sort_key = scan.started_at or scan.completed_at
                if sort_key and (latest_completed_sort_key is None or sort_key > latest_completed_sort_key):
                    latest_completed_sort_key = sort_key
                    latest_completed_scan = scan

        last_member_activity = max((m.joined_at for m in project.members if m.joined_at), default=None)
        last_activity_at = max(
            [d for d in [project.created_at, latest_scan_ts, last_member_activity] if d is not None],
            default=project.created_at,
        )

        risk_score = None
        if latest_completed_scan and latest_completed_scan.risk_score:
            risk_score = float(latest_completed_scan.risk_score.score)

        result_projects.append({
            "id": project.id,
            "name": project.name,
            "owner_id": owner_id,
            "owner_name": owner_name,
            "users_assigned_count": users_assigned_count,
            "total_scans": total_scans,
            "global_risk_level": _risk_level_from_score(risk_score),
            "created_at": project.created_at,
            "last_activity_at": last_activity_at,
            "status": normalized_status,
        })

    summary["total_users_involved"] = len(involved_user_ids)

    return {
        "summary": summary,
        "projects": result_projects,
    }


def get_security_projects_overview(db: Session, user: User) -> dict:
    accessible_projects = get_projects_for_security_scope(db, user)
    project_ids = [p.id for p in accessible_projects]

    if not project_ids:
        return {
            "summary": {
                "total_projects": 0,
                "projects_with_findings": 0,
                "critical_projects": 0,
                "avg_risk_score": 0.0,
            },
            "projects": [],
        }

    projects = (
        db.query(Project)
        .options(
            joinedload(Project.owner),
            joinedload(Project.scans).joinedload(Scan.risk_score),
        )
        .filter(Project.id.in_(project_ids))
        .order_by(Project.created_at.desc())
        .all()
    )

    summary = {
        "total_projects": len(projects),
        "projects_with_findings": 0,
        "critical_projects": 0,
        "avg_risk_score": 0.0,
    }

    risk_scores: list[float] = []
    result_projects = []

    for project in projects:
        scans_sorted = sorted(
            project.scans,
            key=lambda s: (s.completed_at or s.started_at or project.created_at),
            reverse=True,
        )

        total_scans = len(scans_sorted)
        last_scan = scans_sorted[0] if scans_sorted else None
        last_scan_status = last_scan.status.value if last_scan else None

        latest_completed_scan = next(
            (s for s in scans_sorted if s.status == ScanStatus.completed),
            None,
        )

        risk_score = 0.0
        if latest_completed_scan and latest_completed_scan.risk_score:
            risk_score = round(float(latest_completed_scan.risk_score.score), 2)
            risk_scores.append(risk_score)

        findings = _parse_findings(latest_completed_scan.results_json) if latest_completed_scan else []
        critical = high = medium = low = 0

        for finding in findings:
            sev = (finding.get("severity") or "info").lower()
            if sev == "critical":
                critical += 1
            elif sev == "high":
                high += 1
            elif sev == "medium":
                medium += 1
            elif sev == "low":
                low += 1

        if (critical + high + medium + low) > 0:
            summary["projects_with_findings"] += 1
        if critical > 0:
            summary["critical_projects"] += 1

        scan_activity_dates = [(s.completed_at or s.started_at) for s in scans_sorted]
        last_activity_at = max(
            [d for d in [project.created_at, *scan_activity_dates] if d is not None],
            default=project.created_at,
        )

        result_projects.append({
            "id": project.id,
            "name": project.name,
            "owner_name": project.owner.nom if project.owner else "Unknown",
            "total_scans": total_scans,
            "last_scan_status": last_scan_status,
            "global_risk_level": _risk_level_from_score(risk_score),
            "risk_score": risk_score,
            "critical": critical,
            "high": high,
            "medium": medium,
            "low": low,
            "created_at": project.created_at,
            "last_activity_at": last_activity_at,
        })

    summary["avg_risk_score"] = round(sum(risk_scores) / len(risk_scores), 2) if risk_scores else 0.0

    return {
        "summary": summary,
        "projects": result_projects,
    }


def update_project_status_admin(db: Session, project_id: uuid.UUID, status_value: str) -> dict:
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    normalized_status = _normalize_project_status(status_value)
    project.status = normalized_status
    db.commit()
    db.refresh(project)

    return {"id": project.id, "status": normalized_status}


def _delete_legacy_dast_scans_for_project(db: Session, project_id: uuid.UUID) -> None:
    """Cleanup compatibility: some environments still contain a legacy `dast_scans` table.

    If present, rows referencing the project must be deleted before removing the project,
    otherwise PostgreSQL raises a FK violation.
    """
    bind = db.get_bind()
    if bind is None:
        return

    if not inspect(bind).has_table("dast_scans"):
        return

    db.execute(
        text("DELETE FROM dast_scans WHERE project_id = :project_id"),
        {"project_id": str(project_id)},
    )


def delete_project_admin(db: Session, project_id: uuid.UUID) -> None:
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    _delete_legacy_dast_scans_for_project(db, project.id)
    db.delete(project)
    db.commit()
