import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const REFRESH_ENDPOINT = '/api/auth/refresh'

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // ✅ envoie les cookies automatiquement
  headers: {
    'Content-Type': 'application/json',
  },
})

const refreshApi = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // ✅ envoie les cookies automatiquement
  headers: {
    'Content-Type': 'application/json',
  },
})

let refreshPromise = null

// ✅ PAS d'intercepteur request — le cookie est envoyé automatiquement par le navigateur

// Intercepteur RESPONSE — gère le 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config || {}
    const url = config.url || ''
    const isAuthEndpoint =
      url.includes('/auth/login') || url.includes('/auth/register')
    const isRefreshEndpoint = url.includes(REFRESH_ENDPOINT)

    if (
      error.response?.status === 401 &&
      !isAuthEndpoint &&
      !isRefreshEndpoint &&
      !config._retry
    ) {
      config._retry = true

      try {
        if (!refreshPromise) {
          // ✅ Payload vide — le cookie refresh est envoyé automatiquement
          refreshPromise = refreshApi
            .post(REFRESH_ENDPOINT, {})
            .finally(() => {
              refreshPromise = null
            })
        }

        await refreshPromise
        // ✅ Rejouer la requête — le nouveau cookie access est envoyé automatiquement
        return api(config)
      } catch {
        // Refresh échoué → vraiment déconnecté
        localStorage.removeItem('user')
        window.location.href = '/login'
        return Promise.reject(error)
      }
    }

    return Promise.reject(error)
  }
)

export default api