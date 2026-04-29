import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const REFRESH_ENDPOINT = '/api/auth/refresh'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

const refreshApi = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

let refreshPromise = null

const persistTokens = (data) => {
  if (data?.access_token) {
    localStorage.setItem('access_token', data.access_token)
  }
  if (data?.refresh_token) {
    localStorage.setItem('refresh_token', data.refresh_token)
  }
}

// Attach access token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle 401 - token expired (skip auth endpoints to avoid redirect loop)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config || {}
    const url = config.url || ''
    const isAuthEndpoint = url.includes('/auth/login') || url.includes('/auth/register')
    const isRefreshEndpoint = url.includes(REFRESH_ENDPOINT)

    if (error.response?.status === 401 && !isAuthEndpoint && !isRefreshEndpoint && !config._retry) {
      const refreshToken = localStorage.getItem('refresh_token')
      if (!refreshToken) {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        localStorage.removeItem('user')
        window.location.href = '/login'
        return Promise.reject(error)
      }

      config._retry = true

      try {
        if (!refreshPromise) {
          refreshPromise = refreshApi.post(REFRESH_ENDPOINT, { refresh_token: refreshToken })
            .finally(() => {
              refreshPromise = null
            })
        }

        const refreshResponse = await refreshPromise
        persistTokens(refreshResponse.data)
        config.headers = config.headers || {}
        config.headers.Authorization = `Bearer ${refreshResponse.data.access_token}`
        return api(config)
      } catch (refreshError) {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        localStorage.removeItem('user')
        window.location.href = '/login'
        return Promise.reject(refreshError)
      }
    }
    return Promise.reject(error)
  }
)

export default api
