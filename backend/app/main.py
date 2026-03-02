"""
InvisiThreat Backend API
FastAPI application entry point
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.router import api_router
from app.db.base import Base
from app.db.session import engine

# Import all models so SQLAlchemy registers them before create_all
from app.models import user, role  # noqa: F401
from app.models import scan as scan_models  # noqa: F401

# Create database tables
Base.metadata.create_all(bind=engine)

# ─── Lightweight column migration (idempotent) ───────────────────────────────
# Adds new columns to existing tables without Alembic, safe to run every boot.
def _run_migrations():
    from sqlalchemy import text
    migrations = [
        "ALTER TABLE projects ADD COLUMN IF NOT EXISTS language VARCHAR DEFAULT 'Other'",
        "ALTER TABLE projects ADD COLUMN IF NOT EXISTS analysis_type VARCHAR DEFAULT 'SAST'",
        "ALTER TABLE projects ADD COLUMN IF NOT EXISTS visibility VARCHAR DEFAULT 'private'",
    ]
    with engine.connect() as conn:
        for stmt in migrations:
            conn.execute(text(stmt))
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