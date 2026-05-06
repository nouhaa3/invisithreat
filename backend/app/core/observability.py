from __future__ import annotations

import contextvars
import json
import logging
import time
import traceback
import uuid
from datetime import datetime, UTC
from typing import Any


request_id_var: contextvars.ContextVar[str | None] = contextvars.ContextVar("request_id", default=None)
user_id_var: contextvars.ContextVar[str | None] = contextvars.ContextVar("user_id", default=None)
job_id_var: contextvars.ContextVar[str | None] = contextvars.ContextVar("job_id", default=None)
service_var: contextvars.ContextVar[str | None] = contextvars.ContextVar("service", default=None)
endpoint_var: contextvars.ContextVar[str | None] = contextvars.ContextVar("endpoint", default=None)


def new_request_id() -> str:
    return str(uuid.uuid4())


def set_request_context(
    *,
    request_id: str | None = None,
    user_id: str | None = None,
    job_id: str | None = None,
    service: str | None = None,
    endpoint: str | None = None,
) -> None:
    if request_id is not None:
        request_id_var.set(request_id)
    if user_id is not None:
        user_id_var.set(user_id)
    if job_id is not None:
        job_id_var.set(job_id)
    if service is not None:
        service_var.set(service)
    if endpoint is not None:
        endpoint_var.set(endpoint)


def clear_request_context() -> None:
    request_id_var.set(None)
    user_id_var.set(None)
    job_id_var.set(None)
    service_var.set(None)
    endpoint_var.set(None)


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        base: dict[str, Any] = {
            "ts": datetime.now(UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": request_id_var.get(),
            "user_id": user_id_var.get(),
            "job_id": job_id_var.get(),
            "service": service_var.get(),
            "endpoint": endpoint_var.get(),
        }

        if hasattr(record, "duration_ms"):
            base["duration_ms"] = getattr(record, "duration_ms")

        if record.exc_info:
            base["error"] = {
                "type": record.exc_info[0].__name__ if record.exc_info[0] else "Exception",
                "message": str(record.exc_info[1]) if record.exc_info[1] else "",
                "stack": "".join(traceback.format_exception(*record.exc_info))[:8000],
            }

        # Merge structured extras
        extras = getattr(record, "extra", None)
        if isinstance(extras, dict):
            base.update(extras)

        return json.dumps(base, ensure_ascii=False)


def configure_json_logging(level: str = "INFO") -> None:
    root = logging.getLogger()
    root.setLevel(level.upper())

    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())

    # Replace handlers to avoid mixed formats
    root.handlers = [handler]


class Timer:
    def __enter__(self):
        self.start = time.perf_counter()
        return self

    def __exit__(self, exc_type, exc, tb):
        self.duration_ms = round((time.perf_counter() - self.start) * 1000, 2)
