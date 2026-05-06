from __future__ import annotations

import json
from datetime import datetime, UTC
from typing import Any

from celery import Celery
import redis

from app.core.config import settings


celery_app = Celery(
    "invisithreat",
    broker=settings.CELERY_BROKER,
    backend=settings.CELERY_BACKEND,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_acks_late=True,          # reliability: re-queue on worker crash
    worker_prefetch_multiplier=1, # fairness for long scans
    task_reject_on_worker_lost=True,
)

# Discover tasks under app.workers.*
celery_app.autodiscover_tasks(["app.workers"])


def redis_client() -> redis.Redis:
    return redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)


def progress_key(scan_id: str) -> str:
    return f"scan:progress:{scan_id}"


def lock_key(scan_id: str) -> str:
    return f"scan:lock:{scan_id}"


def set_scan_progress(scan_id: str, payload: dict[str, Any], ttl_seconds: int = 3600) -> None:
    r = redis_client()
    stamped = dict(payload)
    stamped["_updated_at"] = datetime.now(UTC).isoformat()
    r.setex(progress_key(scan_id), ttl_seconds, json.dumps(stamped))


def get_scan_progress(scan_id: str) -> dict[str, Any]:
    r = redis_client()
    raw = r.get(progress_key(scan_id))
    if not raw:
        return {}
    try:
        return json.loads(raw)
    except Exception:
        return {}


def acquire_scan_lock(scan_id: str, ttl_seconds: int = 900) -> bool:
    """Idempotency guard: prevent the same scan running twice."""
    r = redis_client()
    return bool(r.set(lock_key(scan_id), "1", nx=True, ex=ttl_seconds))


def release_scan_lock(scan_id: str) -> None:
    r = redis_client()
    r.delete(lock_key(scan_id))
