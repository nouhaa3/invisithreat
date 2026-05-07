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

// ✅ Attache le Bearer token à chaque requête
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ✅ Gère le 401 — tente un refresh puis rejoue la requête
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config || {}
    const url = config.url || ''
    const isAuthEndpoint = url.includes('/auth/login') || url.includes('/auth/register')
    const isRefreshEndpoint = url.includes(REFRESH_ENDPOINT)

    if (
      error.response?.status === 401 &&
      !isAuthEndpoint &&
      !isRefreshEndpoint &&
      !config._retry
    ) {
      config._retry = true

      const storedRefreshToken = localStorage.getItem('refresh_token')

      // ✅ Si pas de refresh token → ne pas tenter, rediriger directement
      if (!storedRefreshToken) {
        localStorage.removeItem('user')
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        window.location.href = '/login'
        return Promise.reject(error)
      }

      try {
        if (!refreshPromise) {
          refreshPromise = refreshApi
            .post(REFRESH_ENDPOINT, { refresh_token: storedRefreshToken })
            .then((res) => {
              if (res.data.access_token) {
                localStorage.setItem('access_token', res.data.access_token)
              }
              if (res.data.refresh_token) {
                localStorage.setItem('refresh_token', res.data.refresh_token)
              }
              return res
            })
            .finally(() => {
              refreshPromise = null
            })
        }

        await refreshPromise

        // Rejouer la requête originale avec le nouveau token
        const newToken = localStorage.getItem('access_token')
        config.headers.Authorization = `Bearer ${newToken}`
        return api(config)

      } catch {
        localStorage.removeItem('user')
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        window.location.href = '/login'
        return Promise.reject(error)
      }
    }

    return Promise.reject(error)
  }
)

export default api