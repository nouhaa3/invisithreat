import api from './api'

export const getAdminDashboardStats = async () => {
  const res = await api.get('/api/dashboard/admin-stats')
  return res.data
}
