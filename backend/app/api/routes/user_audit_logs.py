from fastapi import APIRouter, Depends
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.audit_log import AuditLog
from app.models.user import User
from app.core.jwt import get_current_user
from app.schemas.audit_log import AuditLogOut

router = APIRouter(prefix="/audit-logs", tags=["audit-logs"])

# GET: Current user's audit logs
@router.get("/mine")
async def get_my_audit_logs(
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get current user's audit logs (last 100)."""
    logs = (
        db.query(AuditLog)
        .filter(AuditLog.user_id == current_user.id)
        .order_by(desc(AuditLog.created_at))
        .limit(limit)
        .all()
    )
    
    return [AuditLogOut.from_orm(log).dict() for log in logs]
