import api from './api'

/**
 * Fetch AI usage analytics (Security Manager only).
 * @param {number} days - look-back window in days (default 30)
 */
export const getAIAnalytics = async (days = 30) => {
  const res = await api.get('/api/dashboard/ai-analytics', { params: { days } })
  return res.data
}
