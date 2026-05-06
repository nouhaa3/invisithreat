"""
Background jobs and scheduled tasks for InvisiThreat
"""
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.models.audit_log import AuditLog
from app.models.scan import Scan
import logging

logger = logging.getLogger(__name__)

async def cleanup_old_audit_logs():
    """
    Delete audit logs older than 2 weeks to optimize database storage.
    This job runs daily and removes logs created more than 10 days ago.
    """
    db = SessionLocal()
    try:
        # Calculate the cutoff date (2 weeks ago)
        cutoff_date = datetime.utcnow() - timedelta(days=10)
        
        # Count logs to be deleted
        count_before = db.query(AuditLog).count()
        
        # Delete old logs
        deleted = db.query(AuditLog).filter(
            AuditLog.created_at < cutoff_date
        ).delete(synchronize_session=False)
        
        db.commit()
        
        count_after = db.query(AuditLog).count()
        
        logger.info(f"[OK] Cleanup audit logs: Deleted { deleted } logs older than { cutoff_date.date() }")
        logger.info(f"   Before: { count_before } logs, After: { count_after } logs")
        
    except Exception as e:
        logger.error(f"[ERROR] Failed to cleanup audit logs: { str(e) }")
        db.rollback()
    finally:
        db.close()


async def cleanup_expired_scans():
    db = SessionLocal()
    try:
        now = datetime.utcnow()
        deleted = db.query(Scan).filter(Scan.expires_at < now).delete(synchronize_session=False)
        db.commit()
        logger.info("Expired scan cleanup deleted %s rows", deleted)
    except Exception as exc:
        logger.error("Failed to cleanup expired scans: %s", exc)
        db.rollback()
    finally:
        db.close()
