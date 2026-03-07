import api from './api'

export const listApiKeys = () =>
  api.get('/api/auth/api-keys').then(r => r.data)

export const createApiKey = (name) =>
  api.post('/api/auth/api-keys', { name }).then(r => r.data)

export const revokeApiKey = (id) =>
  api.delete(`/api/auth/api-keys/${id}`)
