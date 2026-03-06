"""
Dashboard statistics endpoint
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime, UTC, timedelta
from collections import defaultdict
import json

from app.db.session import get_db
from app.core.permissions import require_permission, P
from app.models.user import User
from app.models.scan import Project, Scan, ScanStatus
from app.models.member import ProjectMember

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


def _parse_findings(results_json: str) -> list:
    if not results_json or results_json.startswith("__pending_token:"):
        return []
    try:
        data = json.loads(results_json)
        return data.get("findings", [])
    except Exception:
        return []


@router.get("/stats")
async def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(P.VIEW_DASHBOARD)),
):
    # 1. Collect accessible projects (owned + member)
    owned = db.query(Project).filter(Project.owner_id == current_user.id).all()
    owned_ids = {p.id for p in owned}
    memberships = db.query(ProjectMember).filter(ProjectMember.user_id == current_user.id).all()
    member_project_ids = [m.project_id for m in memberships if m.project_id not in owned_ids]
    member_projects = db.query(Project).filter(Project.id.in_(member_project_ids)).all() if member_project_ids else []
    all_projects = owned + member_projects
    all_project_ids = [p.id for p in all_projects]

    if not all_project_ids:
        return {
            "total_projects": 0,
            "total_scans": 0,
            "active_scans": 0,
            "security_score": 100,
            "total_findings": 0,
            "by_severity": {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0},
            "scan_trend": [],
            "top_risky_projects": [],
        }

    # 2. All scans for these projects
    all_scans = db.query(Scan).filter(Scan.project_id.in_(all_project_ids)).all()
    total_scans = len(all_scans)
    active_scans = sum(1 for s in all_scans if s.status in (ScanStatus.pending, ScanStatus.running))

    # 3. Aggregate findings from latest completed scan per project
    severity_totals = defaultdict(int)
    project_risk = []  # (project_name, project_id, critical, high)

    for p in all_projects:
        proj_scans = sorted(
            [s for s in all_scans if s.project_id == p.id and s.status == ScanStatus.completed],
            key=lambda s: s.started_at or datetime.min,
            reverse=True,
        )
        if not proj_scans:
            continue
        findings = _parse_findings(proj_scans[0].results_json)
        crit = high = med = low = info = 0
        for f in findings:
            sev = (f.get("severity") or "info").lower()
            if sev == "critical":   crit += 1; severity_totals["critical"] += 1
            elif sev == "high":     high += 1; severity_totals["high"] += 1
            elif sev == "medium":   med  += 1; severity_totals["medium"] += 1
            elif sev == "low":      low  += 1; severity_totals["low"] += 1
            else:                   info += 1; severity_totals["info"] += 1
        if crit + high > 0:
            project_risk.append({"id": str(p.id), "name": p.name, "critical": crit, "high": high, "medium": med, "low": low})

    # Sort top risky projects
    top_risky = sorted(project_risk, key=lambda x: (x["critical"], x["high"]), reverse=True)[:5]

    # 4. Security score (100 → penalise per severity)
    total_findings = sum(severity_totals.values())
    penalty = (
        severity_totals["critical"] * 15 +
        severity_totals["high"]     * 8  +
        severity_totals["medium"]   * 3  +
        severity_totals["low"]      * 1
    )
    security_score = max(0, 100 - penalty)

    # 5. Scan trend — last 14 days
    now = datetime.now(UTC)
    trend_map = defaultdict(int)
    for s in all_scans:
        if s.started_at:
            ts = s.started_at if s.started_at.tzinfo else s.started_at.replace(tzinfo=UTC)
            days_ago = (now - ts).days
            if 0 <= days_ago <= 13:
                day_label = ts.strftime("%b %d")
                trend_map[day_label] += 1

    # Build ordered 14-day list
    scan_trend = []
    for i in range(13, -1, -1):
        day = now - timedelta(days=i)
        label = day.strftime("%b %d")
        scan_trend.append({"date": label, "count": trend_map.get(label, 0)})

    return {
        "total_projects": len(all_projects),
        "total_scans": total_scans,
        "active_scans": active_scans,
        "security_score": security_score,
        "total_findings": total_findings,
        "by_severity": {
            "critical": severity_totals["critical"],
            "high":     severity_totals["high"],
            "medium":   severity_totals["medium"],
            "low":      severity_totals["low"],
            "info":     severity_totals["info"],
        },
        "scan_trend": scan_trend,
        "top_risky_projects": top_risky,
    }
