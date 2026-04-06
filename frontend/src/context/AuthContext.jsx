import { createContext, useContext, useState, useEffect } from 'react'
import { saveAuthData, clearAuthData, getStoredUser, getMe } from '../services/authService'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  // Restore session on app load and sync with server
  useEffect(() => {
    const initAuth = async () => {
      const storedUser = getStoredUser()
      const token = localStorage.getItem('access_token')
      if (storedUser && token) {
        // Set stored user immediately for better UX
        setUser(storedUser)
        
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
  }, [])

  const loginSuccess = (data) => {
    saveAuthData(data)
    setUser(data.user)
  }

  const updateUser = (updatedUser) => {
    const merged = { ...user, ...updatedUser }
    setUser(merged)
    localStorage.setItem('user', JSON.stringify(merged))
  }

  const logout = () => {
    clearAuthData()
    setUser(null)
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
