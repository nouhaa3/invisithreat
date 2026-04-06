"""
InvisiThreat Backend API
FastAPI application entry point
"""
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.api.router import api_router
from app.core.config import settings
from app.core.rate_limit import limiter

logger = logging.getLogger(__name__)

# Apply database migrations on startup
# run_migrations()  # TODO: Fix Alembic revision conflict - database already initialized

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="InvisiThreat - Intelligent DevSecOps Platform",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json"
)

# CORS middleware - restricted configuration for security
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.FRONTEND_URL,
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "Accept", "Origin"],
)

# Rate limiting middleware
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

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
