"""
Main API router
"""
from fastapi import APIRouter
from app.api import health
from app.api.routes import auth
from app.api.routes import projects
from app.api.routes import scanner
from app.api.routes import members
from app.api.routes import dashboard
from app.api.routes import api_keys
from app.api.routes import cli_scan
from app.api.routes import notifications
from app.api.routes import audit_logs
from app.api.routes import user_audit_logs
from app.api.routes import totp
from app.api.routes import integrations

api_router = APIRouter()

# Include sub-routers
api_router.include_router(health.router, prefix="/health", tags=["health"])
api_router.include_router(auth.router, tags=["auth"])
api_router.include_router(projects.router, tags=["projects"])
api_router.include_router(scanner.router, tags=["scanner"])
api_router.include_router(members.router)
api_router.include_router(dashboard.router)
api_router.include_router(api_keys.router)
api_router.include_router(cli_scan.router)
api_router.include_router(notifications.router)
api_router.include_router(user_audit_logs.router)
api_router.include_router(audit_logs.router)
api_router.include_router(totp.router)
api_router.include_router(integrations.router)
