import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { saveAuthData, clearAuthData, getStoredUser, getMe, refreshSessionIfNeeded } from '../services/authService'

const AuthContext = createContext(null)
const IDLE_TIMEOUT_MS = 30 * 60 * 1000
const IDLE_STORAGE_KEY = 'ivt:last-activity-at'
const ACTIVITY_EVENTS = ['click', 'keydown', 'mousemove', 'mousedown', 'scroll', 'touchstart']

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
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
    clearAuthData()
    localStorage.removeItem(IDLE_STORAGE_KEY)
    setUser(null)
  }, [clearIdleTimer])

  const recordActivity = useCallback(() => {
    if (!localStorage.getItem('access_token')) return

    localStorage.setItem(IDLE_STORAGE_KEY, String(Date.now()))
    clearIdleTimer()
    idleTimerRef.current = setTimeout(() => {
      logout()
    }, IDLE_TIMEOUT_MS)
  }, [clearIdleTimer, logout])

  const startIdleTracking = useCallback(() => {
    recordActivity()
  }, [recordActivity])

  const checkIdleState = useCallback(() => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      clearIdleTimer()
      return
    }

    const lastActivityRaw = localStorage.getItem(IDLE_STORAGE_KEY)
    const lastActivityAt = Number(lastActivityRaw || 0)
    if (!lastActivityAt) {
      recordActivity()
      return
    }

    const elapsed = Date.now() - lastActivityAt
    if (elapsed >= IDLE_TIMEOUT_MS) {
      logout()
      return
    }

    clearIdleTimer()
    idleTimerRef.current = setTimeout(() => {
      logout()
    }, IDLE_TIMEOUT_MS - elapsed)
  }, [clearIdleTimer, logout, recordActivity])

  const refreshSession = useCallback(async () => {
    if (refreshInFlightRef.current) return

    const hasAccessToken = !!localStorage.getItem('access_token')
    const hasRefreshToken = !!localStorage.getItem('refresh_token')
    if (!hasAccessToken || !hasRefreshToken) return

    refreshInFlightRef.current = true
    try {
      await refreshSessionIfNeeded()
    } catch {
      logout()
    } finally {
      refreshInFlightRef.current = false
    }
  }, [logout])

  // Restore session on app load and sync with server
  useEffect(() => {
    const initAuth = async () => {
      const storedUser = getStoredUser()
      const token = localStorage.getItem('access_token')
      if (storedUser && token) {
        // Set stored user immediately for better UX
        setUser(storedUser)
        startIdleTracking()

        try {
          await refreshSessionIfNeeded()
        } catch {
          logout()
          setIsLoading(false)
          return
        }
        
        // Sync with server to get latest data (profile picture, etc)
        try {
          const freshUser = await getMe()
          setUser(freshUser)
          // Update localStorage with fresh data
          localStorage.setItem('user', JSON.stringify(freshUser))
        } catch (error) {
          // If sync fails, keep the stored user
          console.debug('Failed to sync user data from server:', error)
        }
      }
      setIsLoading(false)
    }
    
    initAuth()
  }, [logout, startIdleTracking])

  useEffect(() => {
    if (isLoading || !user) return

    const onActivity = () => {
      recordActivity()
    }

    const onVisibilityChange = () => {
      if (!document.hidden) {
        recordActivity()
      }
    }

    const onStorageChange = (event) => {
      if (event.key === IDLE_STORAGE_KEY && event.newValue) {
        checkIdleState()
      }
    }

    ACTIVITY_EVENTS.forEach(eventName => {
      window.addEventListener(eventName, onActivity, { passive: true })
    })
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('storage', onStorageChange)

    checkIdleState()

    const intervalId = setInterval(checkIdleState, 60_000)

    return () => {
      clearInterval(intervalId)
      ACTIVITY_EVENTS.forEach(eventName => {
        window.removeEventListener(eventName, onActivity)
      })
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('storage', onStorageChange)
    }
  }, [checkIdleState, isLoading, recordActivity, user])

  useEffect(() => {
    if (isLoading || !user) return

    refreshSession()
    const intervalId = setInterval(refreshSession, 60_000)

    return () => {
      clearInterval(intervalId)
    }
  }, [isLoading, refreshSession, user])

  const loginSuccess = (data) => {
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
    <AuthContext.Provider value={{ user, isLoading, loginSuccess, logout, updateUser, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
