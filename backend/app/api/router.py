"""
Main API router
"""
from fastapi import APIRouter
from app.api import health
from app.api.routes import auth
from app.api.routes import projects
from app.api.routes import scanner

api_router = APIRouter()

# Include sub-routers
api_router.include_router(health.router, prefix="/health", tags=["health"])
api_router.include_router(auth.router, tags=["auth"])
api_router.include_router(projects.router, tags=["projects"])
api_router.include_router(scanner.router, tags=["scanner"])
