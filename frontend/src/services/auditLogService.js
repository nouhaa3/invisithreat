import api from './api'

export const getMyAuditLogs = async () => {
  const res = await api.get('/api/audit-logs')
  return res.data
}
