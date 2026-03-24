import api from './api'

/**
 * Login - uses OAuth2PasswordRequestForm (form data, not JSON)
 * Backend expects: username (email), password as form fields
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
 * Register - JSON body with nom, email, password
 */
export const register = async ({ nom, email, password }) => {
  const response = await api.post('/api/auth/register', {
    nom,
    email,
    password,
  })
  return response.data
}

/**
 * Verify email with token
 */
export const verifyEmail = async (token) => {
  const response = await api.get(`/api/auth/action/verify-email/${token}`)
  return response.data
}

/**
 * Resend verification email
 */
export const resendVerificationEmail = async (email) => {
  const response = await api.post('/api/auth/resend-verification', { email })
  return response.data
}

/**
 * Request role upgrade
 */
export const requestRole = async (role_name) => {
  const response = await api.post('/api/auth/request-role', { role_name })
  return response.data
}

/**
 * Refresh access token
 */
export const refreshToken = async (refresh_token) => {
  const response = await api.post('/api/auth/refresh', { refresh_token })
  return response.data
}

/**
 * Persist auth data in localStorage
 */
export const saveAuthData = (data) => {
  localStorage.setItem('access_token', data.access_token)
  localStorage.setItem('refresh_token', data.refresh_token)
  localStorage.setItem('user', JSON.stringify(data.user))
}

/**
 * Clear auth data from localStorage
 */
export const clearAuthData = () => {
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
  localStorage.removeItem('user')
}

/**
 * Get stored user
 */
export const getStoredUser = () => {
  try {
    const user = localStorage.getItem('user')
    return user ? JSON.parse(user) : null
  } catch {
    return null
  }
}

/**
 * Step 1 — request a reset code (admin will receive it by email)
 */
export const forgotPassword = async (email) => {
  const response = await api.post('/api/auth/forgot-password', { email })
  return response.data
}

/**
 * Step 2 — verify the 6-digit code; returns { reset_token }
 */
export const verifyResetCode = async (email, code) => {
  const response = await api.post('/api/auth/verify-reset-code', { email, code })
  return response.data
}

/**
 * Step 3 — set a new password using the reset token
 */
export const resetPassword = async (reset_token, new_password) => {
  const response = await api.post('/api/auth/reset-password', { reset_token, new_password })
  return response.data
}

/**
 * Update own profile (name and/or email)
 */
export const updateMyProfile = async ({ nom, email }) => {
  const response = await api.patch('/api/auth/me', { nom, email })
  return response.data  // UserWithRole
}

/**
 * Change own password
 */
export const changeMyPassword = async (current_password, new_password) => {
  await api.post('/api/auth/me/change-password', { current_password, new_password })
}
