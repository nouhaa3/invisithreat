"""
Main API router
"""
from fastapi import APIRouter
from app.api import health
from app.api.routes import auth

api_router = APIRouter()

# Include sub-routers
api_router.include_router(health.router, prefix="/health", tags=["health"])
api_router.include_router(auth.router, tags=["auth"])
