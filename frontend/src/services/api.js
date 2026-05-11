import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL ?? ''
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

// Intercepteur RESPONSE — gère le 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config || {}
    const url = config.url || ''
    const isAuthEndpoint =
      url.includes('/auth/login') || url.includes('/auth/register')
    const isRefreshEndpoint = url.includes(REFRESH_ENDPOINT)
    const isMeEndpoint = url.includes('/auth/me')

    if (
      error.response?.status === 401 &&
      !isAuthEndpoint &&
      !isRefreshEndpoint &&
      !isMeEndpoint &&
      !config._retry
    ) {
      config._retry = true

      try {
        if (!refreshPromise) {
          refreshPromise = refreshApi
            .post(REFRESH_ENDPOINT, {})
            .finally(() => {
              refreshPromise = null
            })
        }

        await refreshPromise
        return api(config)
      } catch (refreshError) {
        // ✅ Only logout if refresh truly failed
        // Don't immediately clear user — let AuthContext handle it naturally
        console.debug('Token refresh failed:', refreshError.message || refreshError)
        
        // Clear auth data and redirect to login on refresh failure
        localStorage.removeItem('user')
        window.location.href = '/login'
        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(error)
  }
)

export default api