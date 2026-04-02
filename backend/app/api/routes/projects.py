from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from typing import List
from app.db.session import get_db
from app.core.jwt import require_admin
from app.core.permissions import require_permission, P
from app.core.rate_limit import limiter
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
from app.models.scan import Scan as ScanModel, ScanStatus
from app.models.github_repository import GitHubRepository
from app.services.risk_score import get_or_create_scan_risk_score

router = APIRouter(prefix="/projects", tags=["Projects"])


def _guess_repo_name(repo_url: str) -> str:
    cleaned = (repo_url or "").strip().rstrip("/")
    tail = cleaned.split("/")[-1] if cleaned else "repository"
    return tail[:-4] if tail.lower().endswith(".git") else tail


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
    get_project_accessible(db, project_id, current_user)  # verify access (owner or member)
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
