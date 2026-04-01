"""
InvisiThreat Backend API
FastAPI application entry point
"""
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.router import api_router
from app.db.base import Base
from app.db.session import engine

# Import all models so SQLAlchemy registers them before create_all
from app.models import user, role  # noqa: F401
from app.models import scan as scan_models  # noqa: F401
from app.models import member  # noqa: F401
from app.models import api_key  # noqa: F401
from app.models import notification  # noqa: F401
from app.models import audit_log  # noqa: F401

# Create database tables
Base.metadata.create_all(bind=engine)
logger = logging.getLogger(__name__)

# ─── Lightweight column migration (idempotent) ───────────────────────────────
# Adds new columns to existing tables without Alembic, safe to run every boot.
def _run_migrations():
    from sqlalchemy import text
    from sqlalchemy.exc import SQLAlchemyError
    migrations = [
        "ALTER TABLE projects ADD COLUMN IF NOT EXISTS language VARCHAR DEFAULT 'Other'",
        "ALTER TABLE projects ADD COLUMN IF NOT EXISTS analysis_type VARCHAR DEFAULT 'SAST'",
        "ALTER TABLE projects ADD COLUMN IF NOT EXISTS visibility VARCHAR DEFAULT 'private'",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_pending BOOLEAN NOT NULL DEFAULT FALSE",
        # Users that existed before is_pending was introduced should not be treated as pending
        "UPDATE users SET is_pending = FALSE WHERE is_pending = TRUE AND date_creation < NOW() - INTERVAL '2 minutes'",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_code VARCHAR",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_code_expires TIMESTAMP",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_scans_remaining INTEGER NOT NULL DEFAULT 2",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS requested_role_id UUID REFERENCES roles(id)",
        """CREATE TABLE IF NOT EXISTS user_api_keys (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            name VARCHAR(100) NOT NULL,
            key_prefix VARCHAR(12) NOT NULL,
            key_hash VARCHAR(64) NOT NULL UNIQUE,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT NOW(),
            last_used_at TIMESTAMP
        )""",
        """CREATE TABLE IF NOT EXISTS notifications (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            type VARCHAR(50) NOT NULL DEFAULT 'system',
            title VARCHAR(200) NOT NULL,
            message TEXT,
            link VARCHAR(500),
            is_read BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT NOW()
        )""",
        "CREATE INDEX IF NOT EXISTS ix_notifications_user_id ON notifications(user_id)",
        """CREATE TABLE IF NOT EXISTS audit_logs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            action VARCHAR(100) NOT NULL,
            detail VARCHAR(500),
            ip_address VARCHAR(45),
            created_at TIMESTAMP DEFAULT NOW()
        )""",
        "CREATE INDEX IF NOT EXISTS ix_audit_logs_user_id ON audit_logs(user_id)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret VARCHAR",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN NOT NULL DEFAULT FALSE",
    ]
    with engine.connect() as conn:
        # Prevent session-level statement timeout from aborting startup migrations.
        conn.execute(text("SET statement_timeout = 0"))
        for stmt in migrations:
            try:
                conn.execute(text(stmt))
            except SQLAlchemyError as exc:
                logger.warning("Skipping migration statement due to DB error: %s", exc)
        conn.commit()

_run_migrations()

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="InvisiThreat - Intelligent DevSecOps Platform",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.FRONTEND_URL,
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API router
app.include_router(api_router, prefix="/api")

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "InvisiThreat API",
        "version": settings.APP_VERSION,
        "docs": "/api/docs"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )