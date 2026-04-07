import API from "./api"

/**
 * Get current user's audit logs (login, profile updates, etc.)
 * Limited to last 100 logs
 * @returns {Promise<Array>} List of audit logs for current user
 */
export async function getMyAuditLogs() {
  const response = await API.get("/api/audit-logs/mine")
  return response.data || []
}

/**
 * Get all audit logs for admin with optional filtering
 * @param {Object} params - Filter parameters
 * @param {string} params.action - Filter by action type
 * @param {string} params.user_id - Filter by user ID
 * @param {string} params.search - Free-text search in details
 * @param {number} params.limit - Number of results (default 100)
 * @param {number} params.offset - Pagination offset (default 0)
 * @returns {Promise<Array>} List of audit logs
 */
export async function getAuditLogs(params = {}) {
  const query = new URLSearchParams()
  if (params.action) query.append("action", params.action)
  if (params.user_id) query.append("user_id", params.user_id)
  if (params.search) query.append("search", params.search)
  if (params.limit) query.append("limit", params.limit)
  if (params.offset) query.append("offset", params.offset)
  
  const response = await API.get(`/api/admin/audit-logs?${ query.toString() }`)
  return response.data
}

/**
 * Get distinct action types for filtering
 * @returns {Promise<Array>} List of action types
 */
export async function getAuditLogActions() {
  const response = await API.get("/api/admin/audit-logs/actions")
  return response.data
}

/**
 * Export audit logs as CSV
 * @param {Object} params - Filter parameters (same as getAuditLogs)
 * @returns {Promise<Blob>} CSV blob
 */
export async function exportAuditLogs(params = {}) {
  const query = new URLSearchParams()
  if (params.action) query.append("action", params.action)
  if (params.user_id) query.append("user_id", params.user_id)
  if (params.search) query.append("search", params.search)
  
  const response = await API.get(`/api/admin/audit-logs/export?${ query.toString() }`, {
    responseType: "blob",
  })
  return response.data
}
