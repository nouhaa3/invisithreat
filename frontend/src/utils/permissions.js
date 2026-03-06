/**
 * Role-Based Access Control — mirrors backend/app/core/permissions.py
 * Single source of truth for what each role can do.
 */

export const PERMISSIONS = {
  // Admin only
  MANAGE_USERS:               'manage_users',
  ASSIGN_ROLES:               'assign_roles',

  // Project management
  MANAGE_ALL_PROJECTS:        'manage_all_projects',
  MANAGE_OWN_PROJECTS:        'manage_own_projects',

  // Dashboard
  VIEW_DASHBOARD:             'view_dashboard',

  // Developer actions
  MANAGE_PROJECT_MEMBERS:     'manage_project_members',
  RUN_SCAN:                   'run_scan',
  MANAGE_GITHUB_REPOS:        'manage_github_repos',
  MARK_FALSE_POSITIVE:        'mark_false_positive',

  // Results (Developer + Security Manager + Admin)
  VIEW_SCAN_RESULTS:          'view_scan_results',
  VIEW_VULNERABILITIES:       'view_vulnerabilities',

  // Security Manager exclusive
  GENERATE_REPORTS:           'generate_reports',
  PRIORITIZE_VULNERABILITIES: 'prioritize_vulnerabilities',
  VIEW_SECURITY_METRICS:      'view_security_metrics',
}

export const ROLE_PERMISSIONS = {
  Admin: [
    PERMISSIONS.MANAGE_USERS,
    PERMISSIONS.ASSIGN_ROLES,
    PERMISSIONS.MANAGE_ALL_PROJECTS,
    PERMISSIONS.MANAGE_OWN_PROJECTS,
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.MANAGE_PROJECT_MEMBERS,
    PERMISSIONS.RUN_SCAN,
    PERMISSIONS.MANAGE_GITHUB_REPOS,
    PERMISSIONS.MARK_FALSE_POSITIVE,
    PERMISSIONS.VIEW_SCAN_RESULTS,
    PERMISSIONS.VIEW_VULNERABILITIES,
    PERMISSIONS.GENERATE_REPORTS,
    PERMISSIONS.PRIORITIZE_VULNERABILITIES,
    PERMISSIONS.VIEW_SECURITY_METRICS,
  ],
  Developer: [
    PERMISSIONS.MANAGE_OWN_PROJECTS,
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.MANAGE_PROJECT_MEMBERS,
    PERMISSIONS.RUN_SCAN,
    PERMISSIONS.MANAGE_GITHUB_REPOS,
    PERMISSIONS.MARK_FALSE_POSITIVE,
    PERMISSIONS.VIEW_SCAN_RESULTS,
    PERMISSIONS.VIEW_VULNERABILITIES,
  ],
  'Security Manager': [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_SCAN_RESULTS,
    PERMISSIONS.VIEW_VULNERABILITIES,
    PERMISSIONS.GENERATE_REPORTS,
    PERMISSIONS.PRIORITIZE_VULNERABILITIES,
    PERMISSIONS.VIEW_SECURITY_METRICS,
  ],
  Viewer: [
    PERMISSIONS.VIEW_DASHBOARD,
  ],
}

/**
 * Check if a role has a specific permission.
 * @param {string|null} role
 * @param {string} permission
 * @returns {boolean}
 */
export function can(role, permission) {
  return (ROLE_PERMISSIONS[role] ?? []).includes(permission)
}
