import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const REFRESH_ENDPOINT = '/api/auth/refresh'

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

const refreshApi = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

let refreshPromise = null

// Handle 401 - token expired (skip auth endpoints to avoid redirect loop)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config || {}
    const url = config.url || ''
    const isAuthEndpoint = url.includes('/auth/login') || url.includes('/auth/register')
    const isRefreshEndpoint = url.includes(REFRESH_ENDPOINT)

    if (error.response?.status === 401 && !isAuthEndpoint && !isRefreshEndpoint && !config._retry) {
      config._retry = true

      try {
        if (!refreshPromise) {
          refreshPromise = refreshApi.post(REFRESH_ENDPOINT, {})
            .finally(() => {
              refreshPromise = null
            })
        }

        await refreshPromise
        return api(config)
      } catch (refreshError) {
        window.location.href = '/login'
        return Promise.reject(refreshError)
      }
    }
    return Promise.reject(error)
  }
)

export default api
