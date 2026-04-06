from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.scan import Project, Scan, ScanStatus
from app.models.user import User
from app.models.member import ProjectMember
from app.schemas.scan import ProjectCreate, ProjectUpdate
import uuid


def create_project(db: Session, owner: User, data: ProjectCreate) -> Project:
    project = Project(
        id=uuid.uuid4(),
        name=data.name,
        description=data.description,
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
