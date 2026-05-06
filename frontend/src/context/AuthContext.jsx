import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { saveAuthData, clearAuthData, getStoredUser, getMe, refreshSessionIfNeeded } from '../services/authService'
import api from '../services/api'

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
    api.post('/api/auth/logout').catch(() => {})
    clearAuthData()
    localStorage.removeItem(IDLE_STORAGE_KEY)
    setUser(null)
  }, [clearIdleTimer])

  const recordActivity = useCallback(() => {
    if (!user) return

    localStorage.setItem(IDLE_STORAGE_KEY, String(Date.now()))
    clearIdleTimer()
    idleTimerRef.current = setTimeout(() => {
      logout()
    }, IDLE_TIMEOUT_MS)
  }, [clearIdleTimer, logout, user])

  const startIdleTracking = useCallback(() => {
    recordActivity()
  }, [recordActivity])

  const checkIdleState = useCallback(() => {
    if (!user) {
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

  // Restore session on app load and sync with server
  useEffect(() => {
    const initAuth = async () => {
      const storedUser = getStoredUser()
      if (storedUser) {
        setUser(storedUser)
        startIdleTracking()
      }

      try {
        await refreshSessionIfNeeded()
        const freshUser = await getMe()
        setUser(freshUser)
        localStorage.setItem('user', JSON.stringify(freshUser))
      } catch {
        if (!storedUser) {
          clearAuthData()
          setUser(null)
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
