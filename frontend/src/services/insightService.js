import api from './api'

export const generateInsight = async ({ projectId, forceRegenerate = false, model } = {}) => {
  const res = await api.post('/api/insights', {
    project_id: projectId || null,
    force_regenerate: forceRegenerate,
    model: model || null,
  })
  return res.data
}

export const getTodayInsight = async (projectId) => {
  const params = projectId ? { project_id: projectId } : {}
  const res = await api.get('/api/insights/today', { params })
  return res.data  // null if no insight yet today
}

export const listInsights = async ({ projectId, limit = 30, offset = 0 } = {}) => {
  const params = { limit, offset }
  if (projectId) params.project_id = projectId
  const res = await api.get('/api/insights', { params })
  return res.data  // { items, total }
}
