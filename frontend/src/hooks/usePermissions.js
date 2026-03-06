import { useAuth } from '../context/AuthContext'
import { can, PERMISSIONS } from '../utils/permissions'

/**
 * Hook that exposes per-permission boolean flags for the current user.
 *
 * Usage:
 *   const { canRunScan, canManageUsers, role } = usePermissions()
 *   const { can: check } = usePermissions()
 *   check(PERMISSIONS.RUN_SCAN)  // → true/false
 */
export default function usePermissions() {
  const { user } = useAuth()
  const role = user?.role_name ?? null

  return {
    role,
    /** Generic checker: usePermissions().can(PERMISSIONS.RUN_SCAN) */
    can: (permission) => can(role, permission),

    // ── Convenience booleans ────────────────────────────────────────────────
    canManageUsers:              can(role, PERMISSIONS.MANAGE_USERS),
    canAssignRoles:              can(role, PERMISSIONS.ASSIGN_ROLES),
    canManageAllProjects:        can(role, PERMISSIONS.MANAGE_ALL_PROJECTS),
    canManageOwnProjects:        can(role, PERMISSIONS.MANAGE_OWN_PROJECTS),
    canViewDashboard:            can(role, PERMISSIONS.VIEW_DASHBOARD),
    canManageProjectMembers:     can(role, PERMISSIONS.MANAGE_PROJECT_MEMBERS),
    canRunScan:                  can(role, PERMISSIONS.RUN_SCAN),
    canManageGithubRepos:        can(role, PERMISSIONS.MANAGE_GITHUB_REPOS),
    canMarkFalsePositive:        can(role, PERMISSIONS.MARK_FALSE_POSITIVE),
    canViewScanResults:          can(role, PERMISSIONS.VIEW_SCAN_RESULTS),
    canViewVulnerabilities:      can(role, PERMISSIONS.VIEW_VULNERABILITIES),
    canGenerateReports:          can(role, PERMISSIONS.GENERATE_REPORTS),
    canPrioritizeVulnerabilities: can(role, PERMISSIONS.PRIORITIZE_VULNERABILITIES),
    canViewSecurityMetrics:      can(role, PERMISSIONS.VIEW_SECURITY_METRICS),
  }
}
