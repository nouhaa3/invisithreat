import api from './api'

/**
 * Login - uses OAuth2PasswordRequestForm (form data, not JSON)
 */
export const login = async (email, password) => {
  const formData = new URLSearchParams()
  formData.append('username', email)
  formData.append('password', password)

  const response = await api.post('/api/auth/login', formData, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })

  return response.data
}

/**
 * Register
 */
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

/**
 * Refresh access token using stored refresh_token
 */
export const refreshToken = async () => {
  const token = localStorage.getItem('refresh_token')

  if (!token) {
    throw new Error('No refresh token available')
  }

  const response = await api.post('/api/auth/refresh', { refresh_token: token })

  if (response.data.access_token) {
    localStorage.setItem('access_token', response.data.access_token)
  }
  if (response.data.refresh_token) {
    localStorage.setItem('refresh_token', response.data.refresh_token)
  }

  return response.data
}

/**
 * Persist auth data in localStorage
 */
export const saveAuthData = (data) => {
  if (data.access_token)  localStorage.setItem('access_token', data.access_token)
  if (data.refresh_token) localStorage.setItem('refresh_token', data.refresh_token)
  if (data.user)          localStorage.setItem('user', JSON.stringify(data.user))
}

/**
 * Clear all auth data from localStorage
 */
export const clearAuthData = () => {
  localStorage.removeItem('user')
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
}

export const getStoredUser = () => {
  try {
    const user = localStorage.getItem('user')
    return user ? JSON.parse(user) : null
  } catch {
    return null
  }
}

export const getAccessToken = () => localStorage.getItem('access_token')

export const getStoredRefreshToken = () => localStorage.getItem('refresh_token')

export const isAuthenticated = () => {
  return !!(localStorage.getItem('access_token') && localStorage.getItem('user'))
}

/**
 * Refresh session only if a refresh token exists
 */
export const refreshSessionIfNeeded = async () => {
  const token = localStorage.getItem('refresh_token')
  if (!token) return // ← ne rien faire si pas connecté
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