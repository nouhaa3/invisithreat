import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from './AuthContext'
import * as svc from '../services/notificationService'
import { adminGetUsers } from '../services/adminService'
import { initializeWebSocket, closeWebSocket, onNotification } from '../services/websocketService'

const NotificationContext = createContext(null)

export function NotificationProvider({ children }) {
  const { isAuthenticated, isLoading, user } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount]     = useState(0)
  const timerRef = useRef(null)
  const refreshRef = useRef(null)

  const userId = user?.id
  const userRole = user?.role_name

  const refresh = useCallback(async () => {
    if (!isAuthenticated) return
    try {
      const data = await svc.getNotifications()
      let merged = data

      // Backfill role-request notifications for existing pending requests.
      if (userRole === 'Admin') {
        const users = await adminGetUsers()
        const roleRequestNotifications = users
          .filter(u => !!u.requested_role_id)
          .map(u => ({
            id: `role-request-${u.id}`,
            type: 'role_request',
            title: `New role request from ${u.nom}`,
            message: `${u.email} requested the ${u.requested_role_name || 'Unknown'} role.`,
            link: '/admin',
            is_read: false,
            created_at: u.date_creation,
          }))

        const realRoleRequestSignatures = new Set(
          data
            .filter(n => n.type === 'role_request')
            .map(n => `${n.title}|${n.message}`)
        )

        const syntheticOnly = roleRequestNotifications.filter(
          n => !realRoleRequestSignatures.has(`${n.title}|${n.message}`)
        )

        merged = [...syntheticOnly, ...data]
      }

      setNotifications(merged)
      setUnreadCount(merged.filter(n => !n.is_read).length)
    } catch {}
  }, [isAuthenticated, userRole])

  useEffect(() => {
    refreshRef.current = refresh
  }, [refresh])

  // Initialize WebSocket for real-time notifications
  useEffect(() => {
    if (isLoading) {
      return
    }

    if (!isAuthenticated || !userId) {
      closeWebSocket()
      return
    }

    initializeWebSocket()

    // Listen for real-time notifications from Socket.IO for all roles.
    const cleanup = onNotification((socketNotif) => {
      if (!socketNotif || !socketNotif.type) {
        return
      }

      // Show badge quickly, then reconcile with backend source of truth.
      setUnreadCount(prev => prev + 1)
      refreshRef.current?.()
    })

    return () => {
      cleanup?.()
    }
  }, [isAuthenticated, isLoading, userId, userRole])

  useEffect(() => {
    if (isLoading) return

    if (!isAuthenticated) {
      setNotifications([])
      setUnreadCount(0)
      return
    }
    refresh()
    timerRef.current = setInterval(refresh, 60_000)
    return () => clearInterval(timerRef.current)
  }, [isAuthenticated, isLoading, refresh])

  const markRead = async (id) => {
    if (typeof id === 'string' && id.startsWith('role-request-')) {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
      setUnreadCount(prev => Math.max(0, prev - 1))
      return
    }
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
    // NOTE: Notification deletion is intentionally disabled. All notifications are permanent.
    // This function is kept for backward compatibility but does nothing.
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
