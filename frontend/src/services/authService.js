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
 * Register - JSON body with nom, email, password, role_name
 */
export const register = async ({ nom, email, password }) => {
  const response = await api.post('/api/auth/register', {
    nom,
    email,
    password,
    role_name: 'Viewer',
  })
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
