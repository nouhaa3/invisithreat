import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from './AuthContext'
import * as svc from '../services/notificationService'

const NotificationContext = createContext(null)

export function NotificationProvider({ children }) {
  const { isAuthenticated } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount]     = useState(0)
  const timerRef = useRef(null)

  const refresh = useCallback(async () => {
    if (!isAuthenticated) return
    try {
      const data = await svc.getNotifications()
      setNotifications(data)
      setUnreadCount(data.filter(n => !n.is_read).length)
    } catch {}
  }, [isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated) {
      setNotifications([])
      setUnreadCount(0)
      return
    }
    refresh()
    timerRef.current = setInterval(refresh, 60_000)
    return () => clearInterval(timerRef.current)
  }, [isAuthenticated, refresh])

  const markRead = async (id) => {
    await svc.markRead(id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  const markAllRead = async () => {
    await svc.markAllRead()
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    setUnreadCount(0)
  }

  const removeNotification = async (id) => {
    const notif = notifications.find(n => n.id === id)
    await svc.deleteNotification(id)
    setNotifications(prev => prev.filter(n => n.id !== id))
    if (notif && !notif.is_read) setUnreadCount(prev => Math.max(0, prev - 1))
  }

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      refresh,
      markRead,
      markAllRead,
      removeNotification,
    }}>
      {children}
    </NotificationContext.Provider>
  )
}

export const useNotifications = () => useContext(NotificationContext)
