"""
CLI scan endpoint — receives local scan results from scanner.exe and stores them
as a completed scan in the platform.
"""
import uuid, json
from datetime import datetime, UTC
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session
from typing import Optional, List

from app.db.session import get_db
from app.core.api_key_auth import get_user_from_api_key
from app.models.user import User
from app.models.scan import Project, Scan, ScanMethod, ScanStatus
from app.models.member import ProjectMember
from app.services.notification import create_notification

router = APIRouter(prefix="/cli", tags=["CLI"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class CLIFinding(BaseModel):
    rule_id:     str
    severity:    str        # CRITICAL / HIGH / MEDIUM / LOW / INFO
    title:       str
    description: str
    file:        str
    line:        int
    snippet:     Optional[str] = ""
    category:    Optional[str] = ""
    fix:         Optional[str] = ""


class CLIScanPayload(BaseModel):
    project_id:    str                  # UUID string
    path:          str                  # local path scanned (display only)
    scanned_files: int = 0
    duration_ms:   float = 0
    findings:      List[CLIFinding] = []


class CLIScanResponse(BaseModel):
    scan_id:        uuid.UUID
    project_id:     uuid.UUID
    total_findings: int
    by_severity:    dict
    url:            str                 # platform URL to view results


class ProjectListItem(BaseModel):
    id:   uuid.UUID
    name: str
    description: Optional[str] = None
    scan_count:  int = 0
    model_config = ConfigDict(from_attributes=True)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _assert_access(db, project_id, user):
    """Returns project if user is owner or member, else 403."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    is_owner  = str(project.owner_id) == str(user.id)
    is_member = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id,
        ProjectMember.user_id    == user.id,
    ).first()
    if not is_owner and not is_member:
        raise HTTPException(status_code=403, detail="Access denied")
    return project


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/projects", response_model=List[ProjectListItem])
async def cli_list_projects(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_user_from_api_key),
):
    """List all projects accessible to the authenticated user (for scanner.exe `projects` command)."""
    owned = db.query(Project).filter(Project.owner_id == current_user.id).all()
    membership_pids = [
        m.project_id for m in db.query(ProjectMember)
        .filter(ProjectMember.user_id == current_user.id).all()
    ]
    member_projects = db.query(Project).filter(Project.id.in_(membership_pids)).all()
    all_projects = {str(p.id): p for p in owned + member_projects}.values()

    result = []
    for p in all_projects:
        scan_count = db.query(Scan).filter(Scan.project_id == p.id).count()
        result.append(ProjectListItem(
            id=p.id, name=p.name, description=p.description, scan_count=scan_count
        ))
    return result


@router.post("/scan", response_model=CLIScanResponse, status_code=201)
async def cli_upload_scan(
    payload: CLIScanPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_user_from_api_key),
):
    """
    Called by scanner.exe after a local SAST scan.
    Creates a completed Scan with all findings and returns the platform URL.
    """
    try:
        project_id = uuid.UUID(payload.project_id)
    except ValueError:
        raise HTTPE    
    VIEWER users: limited to 2 trial scans
    DEVELOPER or higher: unlimited scans
    """
    try:
        project_id = uuid.UUID(payload.project_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid project_id format")

    project = _assert_access(db, project_id, current_user)

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
 "info": 0}
    for f in payload.findings:
        key = f.severity.lower()
        by_sev[key] = by_sev.get(key, 0) + 1

    # Build results_json in the format the frontend expects:
    # { "findings": [...], "summary": { "critical": N, "high": N, ... } }
    findings_for_db = [
        {
            "rule_id":     f.rule_id,
            "title":       f.title,
            "severity":    f.severity.lower(),
            "category":    f.category or "",
            "description": f.description,
            "fix":         f.fix or "",
            "file":        f.file,
            "line":        f.line,
            "code":        f.snippet or "",
        }
        for f in payload.findings
    ]
    results_for_db = {
        "findings": findings_for_db,
        "summary": {
            **by_sev,
            "total_findings": len(payload.findings),
            "scanned_files":  payload.scanned_files,
            "tool":           "InvisiThreat CLI",
            "version":        "1.0.0",
        },
    }

    scan = Scan(
        id=uuid.uuid4(),
        project_id=project.id,
        method=ScanMethod.cli,
        status=ScanStatus.completed,
        results_json=json.dumps(results_for_db),
        started_at=datetime.now(UTC),
        completed_at=datetime.now(UTC),
    )
    db.add(scan)
    db.commit()
    db.refresh(scan)

    # In-app notification for the project owner
    total = len(payload.findings)
    critical_count = by_sev.get("critical", 0)
    high_count = by_sev.get("high", 0)
    if total == 0:
        sev_msg = "No vulnerabilities found."
    else:
        parts = []
        if critical_count: parts.append(f"{critical_count} critical")
        if high_count: parts.append(f"{high_count} high")
        sev_msg = ", ".join(parts) + "." if parts else f"{total} finding(s)."
    create_notification(
        db,
        user_id=project.owner_id,
        type="scan_complete",
        title=f'Scan completed — {project.name}',
        message=f'{total} finding{"s" if total != 1 else ""} detected. {sev_msg}',
        link=f'/projects/{project.id}',
    )

    return CLIScanResponse(
        scan_id=scan.id,
        project_id=project.id,
        total_findings=len(payload.findings),
        by_severity=by_sev,
        url=f"/projects/{project.id}",
    )
