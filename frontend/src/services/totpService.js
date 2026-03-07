import api from './api'

export const getStatus    = ()           => api.get('/api/auth/2fa/status').then(r => r.data)
export const setup        = ()           => api.post('/api/auth/2fa/setup').then(r => r.data)
export const enable       = (code)       => api.post('/api/auth/2fa/enable', { code }).then(r => r.data)
export const disable      = (code)       => api.post('/api/auth/2fa/disable', { code }).then(r => r.data)
export const verifyLogin  = (totp_token, code) =>
  api.post('/api/auth/2fa/verify-login', { totp_token, code }).then(r => r.data)
