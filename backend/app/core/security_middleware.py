import json

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.core.logging_security import redact_log_text


class SecurityHardeningMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Minimal request guardrails.
        if request.method in {"POST", "PUT", "PATCH"}:
            content_type = (request.headers.get("content-type") or "").lower()
            if "application/json" in content_type:
                body = await request.body()
                if body:
                    try:
                        json.loads(body)
                    except json.JSONDecodeError:
                        return Response(status_code=400, content="Invalid JSON payload")

        response = await call_next(request)

        # Basic browser/security headers.
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        response.headers["Cache-Control"] = "no-store"

        # Final lightweight response redaction pass.
        if response.media_type and "application/json" in response.media_type:
            try:
                # Only scrub obvious accidental leaks.
                response.body = redact_log_text(response.body.decode()).encode()
            except Exception:
                pass
        return response
