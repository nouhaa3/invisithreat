"""
InvisiThreat Backend API
FastAPI application entry point
"""
import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from socketio import ASGIApp

from app.api.router import api_router
from app.core.config import settings
from app.core.rate_limit import limiter
from app.core.jobs import cleanup_old_audit_logs
from app.services.socketio_service import sio

logger = logging.getLogger(__name__)

ALLOWED_ORIGINS = list(dict.fromkeys([
    settings.FRONTEND_URL,
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
]))

# ─── Scheduler Setup ──────────────────────────────────────────────────────────
scheduler = AsyncIOScheduler()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage app startup and shutdown"""
    # Startup
    scheduler.start()
    logger.info("[OK] Background job scheduler started")
    
    # Schedule daily cleanup
    scheduler.add_job(
        cleanup_old_audit_logs,
        "cron",
        hour=2,
        minute=0,  # Run at 2:00 AM daily
        id="cleanup_old_audit_logs",
        name="Clean old audit logs (> 2 weeks)",
    )
    logger.info("Scheduled cleanup_old_audit_logs to run daily at 02:00")
    
    yield
    
    # Shutdown
    scheduler.shutdown()
    logger.info("[OK] Background job scheduler stopped")

# Apply database migrations on startup
# run_migrations()  # TODO: Fix Alembic revision conflict - database already initialized

app_fastapi = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="InvisiThreat - Intelligent DevSecOps Platform",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

# Rate limiting middleware (add first)
app_fastapi.state.limiter = limiter
app_fastapi.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app_fastapi.add_middleware(SlowAPIMiddleware)

# CORS middleware - restricted configuration for security (add last to apply first)
# Include API router
app_fastapi.include_router(api_router, prefix="/api")

@app_fastapi.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "InvisiThreat API",
        "version": settings.APP_VERSION,
        "docs": "/api/docs"
    }

# Wrap FastAPI with Socket.IO ASGI app
_asgi_app = ASGIApp(sio, app_fastapi)

# Apply CORS middleware once at top-level to cover API and Socket.IO HTTP polling.
app = CORSMiddleware(
    _asgi_app,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "Accept", "Origin"],
)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
