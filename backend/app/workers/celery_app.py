from app.core.queue import celery_app

# Ensure task modules are imported for registration.
from app.workers import scan_worker as _scan_worker  # noqa: F401

__all__ = ["celery_app"]
