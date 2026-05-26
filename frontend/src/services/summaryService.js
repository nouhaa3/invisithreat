import api from './api'

export const listProjectSummaries = async (projectId) => {
  const res = await api.get(`/api/llm/projects/${projectId}/summaries`)
  return res.data
}

export const listScanSummaries = async (scanId) => {
  const res = await api.get(`/api/llm/scans/${scanId}/summaries`)
  return res.data
}

export const getSummary = async (projectId, summaryId) => {
  const res = await api.get(`/api/llm/projects/${projectId}/summaries`)
  const list = res.data || []
  return list.find(s => String(s.id) === String(summaryId))
}

export const listAllSummaries = async () => {
  const res = await api.get('/api/llm/summaries')
  return res.data
}

export const requestVulnerabilityAssist = async (payload) => {
  const res = await api.post('/api/llm/vulnerability-assist', payload)
  return res.data
}
