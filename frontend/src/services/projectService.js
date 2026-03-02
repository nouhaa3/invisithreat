import api from './api'

// ─── Projects ────────────────────────────────────────────────────────────────

export const getProjects = async () => {
  const res = await api.get('/api/projects')
  return res.data
}

export const getProject = async (id) => {
  const res = await api.get(`/api/projects/${id}`)
  return res.data
}

export const createProject = async ({ name, description, language, analysis_type, visibility }) => {
  const res = await api.post('/api/projects', { name, description, language, analysis_type, visibility })
  return res.data
}

export const updateProject = async (id, { name, description, language, analysis_type, visibility }) => {
  const res = await api.patch(`/api/projects/${id}`, { name, description, language, analysis_type, visibility })
  return res.data
}

export const deleteProject = async (id) => {
  await api.delete(`/api/projects/${id}`)
}

// ─── Scans ───────────────────────────────────────────────────────────────────

export const getScans = async (projectId) => {
  const res = await api.get(`/api/projects/${projectId}/scans`)
  return res.data
}

export const createScan = async (projectId, { method, repo_url, repo_branch }) => {
  const res = await api.post(`/api/projects/${projectId}/scans`, {
    method,
    repo_url,
    repo_branch,
  })
  return res.data
}

export const getCLIToken = async (projectId, scanId) => {
  const res = await api.post(`/api/projects/${projectId}/scans/${scanId}/claim-token`)
  return res.data
}
