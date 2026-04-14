import api from './api'

// ─── Dashboard ────────────────────────────────────────────────────────────────

export const getDashboardStats = async () => {
  const res = await api.get('/api/dashboard/stats')
  return res.data
}

export const getDashboardRiskOverview = async () => {
  const res = await api.get('/api/dashboard/risk-overview')
  return res.data
}

// ─── Projects ────────────────────────────────────────────────────────────────

export const getProjects = async () => {
  const res = await api.get('/api/projects')
  return res.data
}

export const getDevProjects = async () => {
  const res = await api.get('/api/projects')
  return res.data
}

export const getAdminProjects = async () => {
  const res = await api.get('/api/projects/admin/management')
  return res.data
}

export const getSecurityManagerProjects = async () => {
  const res = await api.get('/api/projects/security/overview')
  return res.data
}

export const getProject = async (id) => {
  const res = await api.get(`/api/projects/${id}`)
  return res.data
}

export const createProject = async ({ name, description, project_type, language, analysis_type, visibility }) => {
  const res = await api.post('/api/projects', { name, description, project_type, language, analysis_type, visibility })
  return res.data
}

export const updateProject = async (id, { name, description, project_type, language, analysis_type, visibility }) => {
  const res = await api.patch(`/api/projects/${id}`, { name, description, project_type, language, analysis_type, visibility })
  return res.data
}

export const deleteProject = async (id) => {
  await api.delete(`/api/projects/${id}`)
}

export const deleteAdminProject = async (id) => {
  await api.delete(`/api/projects/admin/${id}`)
}

export const deleteAdminProjectsBulk = async (projectIds) => {
  const res = await api.post('/api/projects/admin/bulk/delete', { project_ids: projectIds })
  return res.data
}

export const setAdminProjectStatus = async (id, status) => {
  const res = await api.patch(`/api/projects/admin/${id}/status`, { status })
  return res.data
}

// ─── Scans ───────────────────────────────────────────────────────────────────

export const getScans = async (projectId) => {
  const res = await api.get(`/api/projects/${projectId}/scans`)
  return res.data
}

export const createScan = async (projectId, { method, repo_url, repo_branch, repo_token }) => {
  const res = await api.post(`/api/projects/${projectId}/scans`, {
    method,
    repo_url,
    repo_branch,
    repo_token,
  })
  return res.data
}

export const startDastScan = async (projectId, targetUrl) => {
  const res = await api.post('/api/dast/scan/start', null, {
    params: {
      target_url: targetUrl,
      project_id: projectId,
    },
  })
  return res.data
}

export const getDastScanStatus = async (scanId) => {
  const res = await api.get(`/api/dast/scan/${scanId}/status`)
  return res.data
}

export const getCLIToken = async (projectId, scanId) => {
  const res = await api.post(`/api/projects/${projectId}/scans/${scanId}/claim-token`)
  return res.data
}

// ─── Members ─────────────────────────────────────────────────────────────────

export const getMembers = async (projectId) => {
  const res = await api.get(`/api/projects/${projectId}/members`)
  return res.data
}

export const inviteMember = async (projectId, email, role_projet = 'Viewer') => {
  const res = await api.post(`/api/projects/${projectId}/members/invite`, { email, role_projet })
  return res.data
}

export const updateMemberRole = async (projectId, userId, role_projet) => {
  const res = await api.patch(`/api/projects/${projectId}/members/${userId}`, { role_projet })
  return res.data
}

export const removeMember = async (projectId, userId) => {
  await api.delete(`/api/projects/${projectId}/members/${userId}`)
}
