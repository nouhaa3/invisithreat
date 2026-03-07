from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from app.db.session import get_db
from app.core.jwt import get_current_user, require_admin
from app.models.user import User
from app.models.audit_log import AuditLog
from app.schemas.audit_log import AuditLogResponse

router = APIRouter(prefix="/audit-logs", tags=["Audit Logs"])


@router.get("", response_model=List[AuditLogResponse])
async def get_my_audit_logs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the last 100 audit log entries for the authenticated user."""
    return (
        db.query(AuditLog)
        .filter(AuditLog.user_id == current_user.id)
        .order_by(AuditLog.created_at.desc())
        .limit(100)
        .all()
    )


@router.get("/admin", response_model=List[AuditLogResponse])
async def admin_get_audit_logs(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Admin only — return the last 500 audit log entries across all users."""
    return (
        db.query(AuditLog)
        .order_by(AuditLog.created_at.desc())
        .limit(500)
        .all()
    )
