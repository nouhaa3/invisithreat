from sqlalchemy.orm import Session
from app.models.audit_log import AuditLog
from app.core.masking import redact_text


def create_audit_log(
    db: Session,
    user_id,
    action: str,
    detail: str = None,
    ip_address: str = None,
) -> AuditLog:
    """Persist an audit log entry for a user action."""
    entry = AuditLog(
        user_id=user_id,
        action=action,
        detail=redact_text(detail),
        ip_address=ip_address,
    )
    db.add(entry)
    db.commit()
    return entry
