from __future__ import annotations

import logging
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.observability import Timer, new_request_id, set_request_context, clear_request_context


logger = logging.getLogger(__name__)


class RequestTracingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("X-Request-ID") or new_request_id()
        endpoint = f"{request.method} {request.url.path}"
        set_request_context(request_id=request_id, endpoint=endpoint, service="api")
        response = None

        with Timer() as t:
            try:
                response = await call_next(request)
            except Exception:
                logger.exception("Unhandled request error", extra={"extra": {"endpoint": endpoint}})
                raise

        # Log request completion after Timer context closes so duration_ms is available.
        logger.info(
            "request_complete",
            extra={"extra": {"status_code": getattr(response, "status_code", 500), "duration_ms": t.duration_ms}},
        )
        clear_request_context()

        response.headers["X-Request-ID"] = request_id
        return response
