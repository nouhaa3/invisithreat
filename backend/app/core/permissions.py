"""
Role-Based Access Control (RBAC) — central permissions registry.

Permissions are string constants. Each role maps to a set of permissions.
Use require_permission() as a FastAPI dependency to guard endpoints.
"""
from fastapi import Depends, HTTPException, status
from app.core.jwt import get_current_user
from app.models.user import User


# ── Permission constants ──────────────────────────────────────────────────────

class P:
    """All permission identifiers in one place."""
    # User management (Admin only)
    MANAGE_USERS               = "manage_users"
    ASSIGN_ROLES               = "assign_roles"

    # Project management
    MANAGE_ALL_PROJECTS        = "manage_all_projects"   # Admin sees/edits everyone's projects
    MANAGE_OWN_PROJECTS        = "manage_own_projects"   # Developer creates/edits own projects

    # Dashboard
    VIEW_DASHBOARD             = "view_dashboard"

    # Scan & development actions (Developer + Admin)
    MANAGE_PROJECT_MEMBERS     = "manage_project_members"
    RUN_SCAN                   = "run_scan"
    MANAGE_GITHUB_REPOS        = "manage_github_repos"
    MARK_FALSE_POSITIVE        = "mark_false_positive"

    # Results visible to Developer + Security Manager + Admin
    VIEW_SCAN_RESULTS          = "view_scan_results"
    VIEW_VULNERABILITIES       = "view_vulnerabilities"

    # Security-lead exclusive actions
    GENERATE_REPORTS           = "generate_reports"
    PRIORITIZE_VULNERABILITIES = "prioritize_vulnerabilities"
    VIEW_SECURITY_METRICS      = "view_security_metrics"


# ── Role → permissions map ────────────────────────────────────────────────────

ROLE_PERMISSIONS: dict = {
    "Admin": [
        P.MANAGE_USERS,
        P.ASSIGN_ROLES,
        P.MANAGE_ALL_PROJECTS,
        P.MANAGE_OWN_PROJECTS,
        P.VIEW_DASHBOARD,
        P.MANAGE_PROJECT_MEMBERS,
        P.RUN_SCAN,
        P.MANAGE_GITHUB_REPOS,
        P.MARK_FALSE_POSITIVE,
        P.VIEW_SCAN_RESULTS,
        P.VIEW_VULNERABILITIES,
        P.GENERATE_REPORTS,
        P.PRIORITIZE_VULNERABILITIES,
        P.VIEW_SECURITY_METRICS,
    ],
    "Developer": [
        P.MANAGE_OWN_PROJECTS,
        P.VIEW_DASHBOARD,
        P.MANAGE_PROJECT_MEMBERS,
        P.RUN_SCAN,
        P.MANAGE_GITHUB_REPOS,
        P.MARK_FALSE_POSITIVE,
        P.VIEW_SCAN_RESULTS,
        P.VIEW_VULNERABILITIES,
    ],
    "Security Manager": [
        P.VIEW_DASHBOARD,
        P.VIEW_SCAN_RESULTS,
        P.VIEW_VULNERABILITIES,
        P.GENERATE_REPORTS,
        P.PRIORITIZE_VULNERABILITIES,
        P.VIEW_SECURITY_METRICS,
    ],
    "Viewer": [
        P.VIEW_DASHBOARD,
    ],
}


def has_permission(role_name: str, permission: str) -> bool:
    """Check whether a role has a given permission."""
    return permission in ROLE_PERMISSIONS.get(role_name, [])


def require_permission(permission: str):
    """
    FastAPI dependency factory — blocks the request if the current user's
    role does not include `permission`.

    Usage:
        @router.post("/scans")
        async def create_scan(user = Depends(require_permission(P.RUN_SCAN))):
            ...
    """
    async def _check(current_user: User = Depends(get_current_user)) -> User:
        role_name = current_user.role.name if current_user.role else None
        if not has_permission(role_name, permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied: '{permission}' required.",
            )
        return current_user
    return _check
