import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { saveAuthData, clearAuthData, getStoredUser, getMe, refreshSessionIfNeeded } from '../services/authService'
import api from '../services/api'

const AuthContext = createContext(null)
const IDLE_TIMEOUT_MS = 30 * 60 * 1000
const IDLE_WARNING_MS = 29 * 60 * 1000  // Warn 1 minute before logout
const IDLE_STORAGE_KEY = 'ivt:last-activity-at'
const ACTIVITY_EVENTS = ['click', 'keydown', 'mousemove', 'mousedown', 'scroll', 'touchstart']

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [inactivityWarning, setInactivityWarning] = useState(false)
  const idleTimerRef = useRef(null)
  const refreshInFlightRef = useRef(false)

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current)
      idleTimerRef.current = null
    }
  }, [])

  const logout = useCallback(() => {
    clearIdleTimer()
    api.post('/api/auth/logout').catch(() => {})
    clearAuthData()
    localStorage.removeItem(IDLE_STORAGE_KEY)
    setUser(null)
  }, [clearIdleTimer])

  const recordActivity = useCallback(() => {
    if (!user) return
    localStorage.setItem(IDLE_STORAGE_KEY, String(Date.now()))
    setInactivityWarning(false)  // Clear warning when user is active
    clearIdleTimer()
    idleTimerRef.current = setTimeout(logout, IDLE_TIMEOUT_MS)
  }, [clearIdleTimer, logout, user])

  const startIdleTracking = useCallback(() => {
    recordActivity()
  }, [recordActivity])

  const checkIdleState = useCallback(() => {
    if (!user) { clearIdleTimer(); setInactivityWarning(false); return }
    const lastActivityAt = Number(localStorage.getItem(IDLE_STORAGE_KEY) || 0)
    if (!lastActivityAt) { recordActivity(); return }
    const elapsed = Date.now() - lastActivityAt
    
    // User has been inactive too long → logout
    if (elapsed >= IDLE_TIMEOUT_MS) { 
      logout()
      return 
    }
    
    // Warn user 1 minute before logout
    if (elapsed >= IDLE_WARNING_MS && !inactivityWarning) {
      setInactivityWarning(true)
    } else if (elapsed < IDLE_WARNING_MS && inactivityWarning) {
      setInactivityWarning(false)
    }
    
    clearIdleTimer()
    idleTimerRef.current = setTimeout(logout, IDLE_TIMEOUT_MS - elapsed)
  }, [clearIdleTimer, logout, recordActivity, user, inactivityWarning])

  const refreshSession = useCallback(async () => {
    if (refreshInFlightRef.current) return
    if (!user) return
    refreshInFlightRef.current = true
    try {
      await refreshSessionIfNeeded()
    } catch {
      logout()
    } finally {
      refreshInFlightRef.current = false
    }
  }, [logout, user])

  // Restore session au démarrage
  useEffect(() => {
    const initAuth = async () => {
      const storedUser = getStoredUser()

      if (!storedUser) {
        // Pas d'user en localStorage → pas connecté
        setIsLoading(false)
        return
      }

      // IMPORTANT: Don't reset activity time on initialization
      // Check if we already have a recorded activity time
      const existingActivity = localStorage.getItem(IDLE_STORAGE_KEY)
      if (!existingActivity) {
        // First time loading → set activity to now
        localStorage.setItem(IDLE_STORAGE_KEY, String(Date.now()))
      }
      // Otherwise keep existing activity time (preserve across page reloads)

      // Restore user immediately to avoid flash
      setUser(storedUser)
      startIdleTracking()

      try {
        // Try getMe directly — access cookie may still be valid
        const freshUser = await getMe()
        setUser(freshUser)
        localStorage.setItem('user', JSON.stringify(freshUser))
      } catch (getmeError) {
        // Access cookie expired → try refresh once
        try {
          await refreshSessionIfNeeded()
          const freshUser = await getMe()
          setUser(freshUser)
          localStorage.setItem('user', JSON.stringify(freshUser))
        } catch (refreshError) {
          // Refresh also failed → truly logged out
          console.warn('Auth initialization failed:', refreshError.message || refreshError)
          clearAuthData()
          setUser(null)
        }
      } finally {
        setIsLoading(false)
      }
    }

    initAuth()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Idle tracking
  useEffect(() => {
    if (isLoading || !user) return
    const onActivity = () => recordActivity()
    const onVisibilityChange = () => { if (!document.hidden) recordActivity() }
    const onStorageChange = (e) => { if (e.key === IDLE_STORAGE_KEY && e.newValue) checkIdleState() }

    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, onActivity, { passive: true }))
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('storage', onStorageChange)
    checkIdleState()
    const intervalId = setInterval(checkIdleState, 60_000)

    return () => {
      clearInterval(intervalId)
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, onActivity))
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('storage', onStorageChange)
    }
  }, [checkIdleState, isLoading, recordActivity, user])

  // Token refresh: separate from inactivity timeout
  // Refresh at 25 minutes (before 30-min access token expiry)
  // This prevents token from expiring during normal use
  useEffect(() => {
    if (isLoading || !user) return
    
    const intervalId = setInterval(() => {
      refreshSession().catch((err) => {
        console.debug('Periodic session refresh failed:', err.message || err)
        // Don't logout on refresh failure — let normal auth flow handle it
      })
    }, 25 * 60 * 1000)
    
    return () => clearInterval(intervalId)
  }, [isLoading, refreshSession, user])

  const loginSuccess = (data) => {
    // Sauvegarder seulement l'user — les cookies sont gérés par le backend
    saveAuthData(data)
    setUser(data.user)
    startIdleTracking()
  }

  const updateUser = (updatedUser) => {
    const merged = { ...user, ...updatedUser }
    setUser(merged)
    localStorage.setItem('user', JSON.stringify(merged))
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, loginSuccess, logout, updateUser, isAuthenticated: !!user, inactivityWarning }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}