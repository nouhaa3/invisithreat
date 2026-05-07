import api from './api'

export const login = async (email, password) => {
  const formData = new URLSearchParams()
  formData.append('username', email)
  formData.append('password', password)

  const response = await api.post('/api/auth/login', formData, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })

  return response.data
}

export const register = async ({ nom, email, password, confirmPassword }) => {
  const response = await api.post('/api/auth/register', {
    nom,
    email,
    password,
    password_confirm: confirmPassword,
  })
  return response.data
}

export const verifyEmail = async (token) => {
  const response = await api.get(`/api/auth/action/verify-email/${token}`)
  return response.data
}

export const resendVerificationEmail = async (email) => {
  const response = await api.post('/api/auth/resend-verification', { email })
  return response.data
}

export const requestRole = async (role_name) => {
  const response = await api.post('/api/auth/request-role', { role_name })
  return response.data
}

export const getMe = async () => {
  const response = await api.get('/api/auth/me')
  return response.data
}

// ✅ Refresh — payload vide, le cookie est envoyé automatiquement
export const refreshToken = async () => {
  const response = await api.post('/api/auth/refresh', {})
  return response.data
}

// ✅ Seulement l'user dans localStorage — PAS les tokens
export const saveAuthData = (data) => {
  if (data.user) {
    localStorage.setItem('user', JSON.stringify(data.user))
  }
}

export const clearAuthData = () => {
  localStorage.removeItem('user')
  // ✅ Les cookies sont supprimés par le backend via /logout
}

export const getStoredUser = () => {
  try {
    const user = localStorage.getItem('user')
    return user ? JSON.parse(user) : null
  } catch {
    return null
  }
}

// ✅ Refresh session — le cookie est géré automatiquement
export const refreshSessionIfNeeded = async () => {
  await refreshToken()
}

export const forgotPassword = async (email) => {
  const response = await api.post('/api/auth/forgot-password', { email })
  return response.data
}

export const verifyResetCode = async (email, code) => {
  const response = await api.post('/api/auth/verify-reset-code', { email, code })
  return response.data
}

export const resetPassword = async (reset_token, new_password) => {
  const response = await api.post('/api/auth/reset-password', { reset_token, new_password })
  return response.data
}

export const updateMyProfile = async ({ nom, email, profile_picture }) => {
  const response = await api.patch('/api/auth/me', { nom, email, profile_picture })
  return response.data
}

export const changeMyPassword = async (current_password, new_password) => {
  await api.post('/api/auth/me/change-password', { current_password, new_password })
}

export const isAuthenticated = () => {
  return !!localStorage.getItem('user')
}