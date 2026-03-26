"""
InvisiThreat Backend API
FastAPI application entry point
"""
import logging
from importlib import import_module

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.router import api_router
from app.db.base import Base
from app.db.session import engine

# Import all models so SQLAlchemy registers them before create_all
for _model_module in (
    "user",
    "role",
    "scan",
    "member",
    "api_key",
    "notification",
    "audit_log",
    "risk_score",
    "auth_token",
    "security_report",
    "security_metric",
    "github_repository",
    "scan_tool",
    "tool_execution",
    "scan_comparison",
    "vulnerability",
    "recommendation",
):
    import_module(f"app.models.{_model_module}")

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
        "ALTER TABLE projects ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'active'",
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
        """CREATE TABLE IF NOT EXISTS risk_scores (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            scan_id UUID NOT NULL UNIQUE REFERENCES scans(id) ON DELETE CASCADE,
            score DOUBLE PRECISION NOT NULL DEFAULT 0,
            exploitability DOUBLE PRECISION NOT NULL DEFAULT 0,
            business_impact DOUBLE PRECISION NOT NULL DEFAULT 0,
            calculated_at TIMESTAMP DEFAULT NOW()
        )""",
        "CREATE INDEX IF NOT EXISTS ix_risk_scores_scan_id ON risk_scores(scan_id)",
        """CREATE TABLE IF NOT EXISTS auth_tokens (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            access_token TEXT NOT NULL,
            refresh_token TEXT NOT NULL,
            expiration TIMESTAMP NOT NULL,
            created_at TIMESTAMP DEFAULT NOW()
        )""",
        "CREATE INDEX IF NOT EXISTS ix_auth_tokens_user_id ON auth_tokens(user_id)",
        """CREATE TABLE IF NOT EXISTS security_reports (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            generated_at TIMESTAMP DEFAULT NOW(),
            format VARCHAR(20) NOT NULL DEFAULT 'pdf'
        )""",
        "CREATE INDEX IF NOT EXISTS ix_security_reports_project_id ON security_reports(project_id)",
        """CREATE TABLE IF NOT EXISTS security_metrics (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            type VARCHAR(100) NOT NULL,
            value DOUBLE PRECISION NOT NULL DEFAULT 0,
            calculated_at TIMESTAMP DEFAULT NOW()
        )""",
        "CREATE INDEX IF NOT EXISTS ix_security_metrics_project_id ON security_metrics(project_id)",
        """CREATE TABLE IF NOT EXISTS github_repositories (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            name VARCHAR(200) NOT NULL,
            url VARCHAR(500) NOT NULL,
            default_branch VARCHAR(120) NOT NULL DEFAULT 'main',
            access_token VARCHAR(500)
        )""",
        "CREATE INDEX IF NOT EXISTS ix_github_repositories_project_id ON github_repositories(project_id)",
        """CREATE TABLE IF NOT EXISTS scan_tools (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(120) NOT NULL UNIQUE,
            type VARCHAR(80) NOT NULL
        )""",
        """CREATE TABLE IF NOT EXISTS tool_executions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            scan_id UUID NOT NULL UNIQUE REFERENCES scans(id) ON DELETE CASCADE,
            scan_tool_id UUID NOT NULL REFERENCES scan_tools(id),
            started_at TIMESTAMP DEFAULT NOW(),
            ended_at TIMESTAMP,
            status VARCHAR(50) NOT NULL DEFAULT 'pending',
            log_path VARCHAR(500)
        )""",
        "CREATE INDEX IF NOT EXISTS ix_tool_executions_scan_id ON tool_executions(scan_id)",
        """CREATE TABLE IF NOT EXISTS scan_comparisons (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            scan_id UUID NOT NULL UNIQUE REFERENCES scans(id) ON DELETE CASCADE,
            new_vulnerabilities INTEGER NOT NULL DEFAULT 0,
            fixed_vulnerabilities INTEGER NOT NULL DEFAULT 0
        )""",
        "CREATE INDEX IF NOT EXISTS ix_scan_comparisons_scan_id ON scan_comparisons(scan_id)",
        """CREATE TABLE IF NOT EXISTS vulnerabilities (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
            risk_score_id UUID REFERENCES risk_scores(id),
            title VARCHAR(255) NOT NULL,
            description TEXT,
            severity VARCHAR(30) NOT NULL DEFAULT 'medium',
            status VARCHAR(30) NOT NULL DEFAULT 'open',
            cvss_score DOUBLE PRECISION,
            false_positive BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT NOW()
        )""",
        "CREATE INDEX IF NOT EXISTS ix_vulnerabilities_scan_id ON vulnerabilities(scan_id)",
        "CREATE INDEX IF NOT EXISTS ix_vulnerabilities_risk_score_id ON vulnerabilities(risk_score_id)",
        """CREATE TABLE IF NOT EXISTS recommendations (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vulnerability_id UUID NOT NULL REFERENCES vulnerabilities(id) ON DELETE CASCADE,
            content TEXT NOT NULL,
            generated_at TIMESTAMP DEFAULT NOW()
        )""",
        "CREATE INDEX IF NOT EXISTS ix_recommendations_vulnerability_id ON recommendations(vulnerability_id)",
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