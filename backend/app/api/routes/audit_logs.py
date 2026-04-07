from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import desc, or_, and_
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from io import StringIO
import csv
import uuid

from app.db.session import get_db
from app.models.audit_log import AuditLog
from app.models.user import User
from app.core.permissions import require_permission, P
from app.schemas.audit_log import AuditLogOut

router = APIRouter(prefix="/api/admin/audit-logs", tags=["admin-audit-logs"])

# ─── GET: List audit logs with filters ─────────────────────────────────────
@router.get("", response_model=dict)
async def list_audit_logs(
    action: str = Query(None, description="Filter by action type"),
    user_id: str = Query(None, description="Filter by user ID"),
    search: str = Query(None, description="Free-text search in details"),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(require_permission(P.VIEW_AUDIT_LOGS)),
    db: Session = Depends(get_db),
):
    """Get all audit logs with optional filtering."""
    
    # Build query
    query = db.query(AuditLog).order_by(desc(AuditLog.created_at))
    
    # Apply filters
    if action:
        query = query.filter(AuditLog.action == action)
    
    if user_id:
        try:
            uid = uuid.UUID(user_id)
            query = query.filter(AuditLog.user_id == uid)
        except (ValueError, TypeError):
            pass
    
    if search:
        search_term = f"%{ search }%"
        query = query.filter(
            or_(
                AuditLog.detail.ilike(search_term),
                AuditLog.ip_address.ilike(search_term),
            )
        )
    
    # Get total count
    total = query.count()
    
    # Apply pagination
    logs = query.limit(limit).offset(offset).all()
    
    return {
        "logs": [AuditLogOut.from_orm(log).dict() for log in logs],
        "total": total,
        "limit": limit,
        "offset": offset,
    }

# ─── GET: Distinct action types ────────────────────────────────────────────
@router.get("/actions", response_model=list)
async def get_audit_log_actions(
    current_user: User = Depends(require_permission(P.VIEW_AUDIT_LOGS)),
    db: Session = Depends(get_db),
):
    """Get all distinct action types."""
    
    actions = (
        db.query(AuditLog.action)
        .distinct()
        .order_by(AuditLog.action)
        .all()
    )
    
    return [a[0] for a in actions if a[0]]

# ─── GET: Export audit logs as CSV ────────────────────────────────────────
@router.get("/export")
async def export_audit_logs(
    action: str = Query(None),
    user_id: str = Query(None),
    search: str = Query(None),
    current_user: User = Depends(require_permission(P.VIEW_AUDIT_LOGS)),
    db: Session = Depends(get_db),
):
    """Export filtered audit logs as CSV."""
    
    # Build query (same filters as list endpoint)
    query = db.query(AuditLog).order_by(desc(AuditLog.created_at))
    
    if action:
        query = query.filter(AuditLog.action == action)
    
    if user_id:
        try:
            uid = uuid.UUID(user_id)
            query = query.filter(AuditLog.user_id == uid)
        except (ValueError, TypeError):
            pass
    
    if search:
        search_term = f"%{ search }%"
        query = query.filter(
            or_(
                AuditLog.detail.ilike(search_term),
                AuditLog.ip_address.ilike(search_term),
            )
        )
    
    logs = query.limit(10000).all()
    
    # Create CSV
    output = StringIO()
    writer = csv.writer(output)
    
    # Headers
    writer.writerow(["ID", "User ID", "Action", "Details", "IP Address", "Timestamp"])
    
    # Rows
    for log in logs:
        writer.writerow([
            str(log.id),
            str(log.user_id),
            log.action,
            log.detail or "",
            log.ip_address or "",
            log.created_at.isoformat(),
        ])
    
    csv_content = output.getvalue()
    
    # Return as file
    from fastapi.responses import StreamingResponse
    return StreamingResponse(
        iter([csv_content]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=audit-logs.csv"},
    )
