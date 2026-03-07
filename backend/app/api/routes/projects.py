from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.db.session import get_db
from app.core.jwt import require_admin
from app.core.permissions import require_permission, P
from app.core.config import settings
from app.models.user import User
from app.schemas.scan import (
    ProjectCreate, ProjectUpdate, ProjectResponse,
    ScanCreate, ScanResponse, CLITokenResponse, CLIScanUpload
)
from app.services.project import (
    create_project, get_projects_for_user, get_project, get_project_accessible,
    update_project, delete_project, enrich_project,
    create_scan, get_scans_for_project
)
from app.services.github_scanner import run_github_scan
import uuid, secrets
from datetime import datetime, UTC
from app.models.scan import Project as ProjectModel
from app.models.member import ProjectMember as MemberModel

router = APIRouter(prefix="/projects", tags=["Projects"])


# ─── Admin Routes ──────────────────────────────────────────────────────────────

@router.get("/admin/all", response_model=List[ProjectResponse], tags=["Admin"])
async def admin_list_all_projects(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Admin only — list every project across all users."""
    projects = db.query(ProjectModel).order_by(ProjectModel.created_at.desc()).all()
    return [enrich_project(db, p) for p in projects]

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
    memberships = {
        m.project_id: m.role_projet.lower()
        for m in db.query(MemberModel).filter(MemberModel.user_id == current_user.id).all()
    }
    return [
        enrich_project(db, p, "owner" if p.owner_id == current_user.id else memberships.get(p.id, "viewer"))
        for p in projects
    ]


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
    scan = create_scan(db, project, data.method, data.repo_url, data.repo_branch)

    if data.method == "github":
        if not data.repo_url:
            raise HTTPException(status_code=400, detail="repo_url is required for GitHub scans")
        background_tasks.add_task(
            run_github_scan,
            scan_id=str(scan.id),
            repo_url=data.repo_url,
            branch=data.repo_branch or "main",
            db_url=settings.DATABASE_URL,
        )

    return scan


@router.get("/{project_id}/scans", response_model=List[ScanResponse])
async def list_project_scans(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(P.VIEW_SCAN_RESULTS)),
):
    get_project_accessible(db, project_id, current_user)  # verify access (owner or member)
    return get_scans_for_project(db, project_id)


@router.post("/{project_id}/scans/{scan_id}/claim-token", response_model=CLITokenResponse)
async def get_cli_upload_token(
    project_id: uuid.UUID,
    scan_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(P.RUN_SCAN)),
):
    """
    Issue a one-time upload token for the CLI to send results back.
    The CLI never needs a user password — only this short-lived token.
    """
    get_project(db, project_id, current_user)
    from app.models.scan import Scan
    scan = db.query(Scan).filter(Scan.id == scan_id, Scan.project_id == project_id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    token = secrets.token_urlsafe(32)
    # Store token temporarily in scan record (real impl: Redis / signed JWT)
    scan.results_json = f"__pending_token:{token}"
    db.commit()
    return CLITokenResponse(upload_token=token, scan_id=scan_id, expires_in=3600)


@router.post("/scans/upload", status_code=200)
async def cli_upload_results(
    payload: CLIScanUpload,
    db: Session = Depends(get_db),
):
    """
    Endpoint called by the CLI (no user auth) to upload scan results using the upload token.
    """
    from app.models.scan import Scan, ScanStatus
    scan = db.query(Scan).filter(
        Scan.results_json == f"__pending_token:{payload.upload_token}"
    ).first()
    if not scan:
        raise HTTPException(status_code=401, detail="Invalid or expired upload token")
    scan.results_json = payload.results_json
    scan.status = ScanStatus.completed if payload.status == "completed" else ScanStatus.failed
    scan.error_message = payload.error_message
    scan.completed_at = datetime.now(UTC)
    db.commit()
    return {"message": "Results uploaded successfully", "scan_id": str(scan.id)}
