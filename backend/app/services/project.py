from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.scan import Project, Scan, ScanStatus
from app.models.user import User
from app.schemas.scan import ProjectCreate, ProjectUpdate
import uuid


def create_project(db: Session, owner: User, data: ProjectCreate) -> Project:
    project = Project(
        id=uuid.uuid4(),
        name=data.name,
        description=data.description,
        owner_id=owner.id,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def get_projects_for_user(db: Session, user: User) -> list[Project]:
    return db.query(Project).filter(Project.owner_id == user.id).order_by(Project.created_at.desc()).all()


def get_project(db: Session, project_id: uuid.UUID, user: User) -> Project:
    project = db.query(Project).filter(Project.id == project_id, Project.owner_id == user.id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


def update_project(db: Session, project_id: uuid.UUID, user: User, data: ProjectUpdate) -> Project:
    project = get_project(db, project_id, user)
    if data.name is not None:
        project.name = data.name
    if data.description is not None:
        project.description = data.description
    db.commit()
    db.refresh(project)
    return project


def delete_project(db: Session, project_id: uuid.UUID, user: User) -> None:
    project = get_project(db, project_id, user)
    db.delete(project)
    db.commit()


def enrich_project(db: Session, project: Project) -> dict:
    """Attach scan_count and last_scan_status to project dict"""
    scans = db.query(Scan).filter(Scan.project_id == project.id).order_by(Scan.started_at.desc()).all()
    last_status = scans[0].status.value if scans else None
    return {
        "id": project.id,
        "name": project.name,
        "description": project.description,
        "owner_id": project.owner_id,
        "created_at": project.created_at,
        "scan_count": len(scans),
        "last_scan_status": last_status,
    }


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
