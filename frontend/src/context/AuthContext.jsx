import { createContext, useContext, useState, useEffect } from 'react'
import { saveAuthData, clearAuthData, getStoredUser } from '../services/authService'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  // Restore session on app load
  useEffect(() => {
    const storedUser = getStoredUser()
    const token = localStorage.getItem('access_token')
    if (storedUser && token) {
      setUser(storedUser)
    }
    setIsLoading(false)
  }, [])

  const loginSuccess = (data) => {
    saveAuthData(data)
    setUser(data.user)
  }

  const logout = () => {
    clearAuthData()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, loginSuccess, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
