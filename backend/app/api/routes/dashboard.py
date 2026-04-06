"""
Dashboard statistics endpoint
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, UTC, timedelta
from collections import defaultdict
import json

from app.db.session import get_db
from app.core.permissions import require_permission, P
from app.models.user import User
from app.models.scan import Project, Scan, ScanStatus
from app.models.member import ProjectMember
from app.services.risk_score import get_or_create_scan_risk_score

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


def _parse_findings(results_json: str) -> list:
    if not results_json or results_json.startswith("__pending_token:"):
        return []
    try:
        data = json.loads(results_json)
        return data.get("findings", [])
    except (ValueError, TypeError, json.JSONDecodeError):
        return []


@router.get("/stats")
async def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(P.VIEW_DASHBOARD)),
):
    from sqlalchemy import and_
    
    # 1. Get all accessible projects in ONE query (owned + member)
    owned = db.query(Project.id).filter(Project.owner_id == current_user.id).subquery()
    member_projects = db.query(Project.id).join(
        ProjectMember, and_(Project.id == ProjectMember.project_id, ProjectMember.user_id == current_user.id)
    ).subquery()
    
    # Get all project IDs accessible to user
    all_project_ids = db.query(Project.id).filter(
        (Project.id.in_(db.query(owned))) | (Project.id.in_(db.query(member_projects)))
    ).all()
    all_project_ids = [p.id for p in all_project_ids]
    
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
            "risk_overview": {
                "avg_score": 0.0,
                "avg_exploitability": 0.0,
                "avg_business_impact": 0.0,
                "max_score": 0.0,
            },
        }

    # 2. Get all projects for later use
    all_projects = db.query(Project).filter(Project.id.in_(all_project_ids)).all()
    
    # 3. Get ONLY completed scans (not all scans) - much smaller dataset
    completed_scans = db.query(Scan).filter(
        Scan.project_id.in_(all_project_ids),
        Scan.status == ScanStatus.completed
    ).order_by(Scan.started_at.desc()).all()
    
    # 4. Get active scan count in ONE query
    active_scan_count = db.query(func.count(Scan.id)).filter(
        Scan.project_id.in_(all_project_ids),
        Scan.status.in_([ScanStatus.pending, ScanStatus.running])
    ).scalar() or 0

    # 5. Group scans by project and get latest completed per project
    scans_by_project = {}
    for scan in completed_scans:
        if scan.project_id not in scans_by_project:
            scans_by_project[scan.project_id] = scan

    # 6. Aggregate findings and risk scores
    severity_totals = defaultdict(int)
    project_risk = []
    risk_rows = []

    for p in all_projects:
        latest_scan = scans_by_project.get(p.id)
        if not latest_scan:
            continue
        
        findings = _parse_findings(latest_scan.results_json)
        crit = high = med = low = info = 0
        for f in findings:
            sev = (f.get("severity") or "info").lower()
            if sev == "critical":   crit += 1; severity_totals["critical"] += 1
            elif sev == "high":     high += 1; severity_totals["high"] += 1
            elif sev == "medium":   med  += 1; severity_totals["medium"] += 1
            elif sev == "low":      low  += 1; severity_totals["low"] += 1
            else:                   info += 1; severity_totals["info"] += 1
        
        risk = get_or_create_scan_risk_score(db, latest_scan)
        risk_score = round(float(risk.score), 2) if risk else 0.0
        
        project_row = {
            "id": str(p.id),
            "name": p.name,
            "critical": crit,
            "high": high,
            "medium": med,
            "low": low,
            "risk_score": risk_score,
        }
        project_risk.append(project_row)
        if risk:
            risk_rows.append(risk)

    # Sort top risky projects
    top_risky = sorted(project_risk, key=lambda x: (x.get("risk_score", 0), x["critical"], x["high"]), reverse=True)[:5]

    # Security score
    total_findings = sum(severity_totals.values())
    penalty = (
        severity_totals["critical"] * 15 +
        severity_totals["high"]     * 8  +
        severity_totals["medium"]   * 3  +
        severity_totals["low"]      * 1
    )
    security_score = max(0, 100 - penalty)

    # Scan trend — last 14 days (only from completed scans)
    now = datetime.now(UTC)
    trend_map = defaultdict(int)
    for s in completed_scans:
        if s.started_at:
            ts = s.started_at if s.started_at.tzinfo else s.started_at.replace(tzinfo=UTC)
            days_ago = (now - ts).days
            if 0 <= days_ago <= 13:
                day_label = ts.strftime("%b %d")
                trend_map[day_label] += 1

    scan_trend = []
    for i in range(13, -1, -1):
        day = now - timedelta(days=i)
        label = day.strftime("%b %d")
        scan_trend.append({"date": label, "count": trend_map.get(label, 0)})

    risk_overview = {
        "avg_score": 0.0,
        "avg_exploitability": 0.0,
        "avg_business_impact": 0.0,
        "max_score": 0.0,
    }
    if risk_rows:
        risk_overview = {
            "avg_score": round(sum(float(r.score) for r in risk_rows) / len(risk_rows), 2),
            "avg_exploitability": round(sum(float(r.exploitability) for r in risk_rows) / len(risk_rows), 2),
            "avg_business_impact": round(sum(float(r.business_impact) for r in risk_rows) / len(risk_rows), 2),
            "max_score": round(max(float(r.score) for r in risk_rows), 2),
        }

    return {
        "total_projects": len(all_projects),
        "total_scans": len(completed_scans),
        "active_scans": active_scan_count,
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
        "risk_overview": risk_overview,
    }


@router.get("/risk-overview")
async def get_dashboard_risk_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(P.VIEW_DASHBOARD)),
):
    stats = await get_dashboard_stats(db=db, current_user=current_user)
    return stats.get("risk_overview", {
        "avg_score": 0.0,
        "avg_exploitability": 0.0,
        "avg_business_impact": 0.0,
        "max_score": 0.0,
    })
