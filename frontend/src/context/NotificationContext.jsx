import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from './AuthContext'
import * as svc from '../services/notificationService'
import { adminGetUsers } from '../services/adminService'
import { initializeWebSocket, onNotification, closeWebSocket } from '../services/websocketService'

const NotificationContext = createContext(null)

export function NotificationProvider({ children }) {
  const { isAuthenticated, isLoading, user } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount]     = useState(0)
  const timerRef = useRef(null)
  const refreshRef = useRef(null)

  const userId = user?.id
  const userRole = user?.role_name
  const userEmail = user?.email

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
      console.debug('[NOTIF-CONTEXT] Not initializing - not authenticated or no user')
      return
    }

    console.log('[NOTIF-CONTEXT] Initializing WebSocket for user:', userId, userRole)
    initializeWebSocket(userId, userRole, userEmail)

    // Listen for real-time notifications from Socket.IO
    let cleanup = null
    if (userRole === 'Admin') {
      console.log('[NOTIF-CONTEXT] User is Admin - registering notification listener')
      cleanup = onNotification((socketNotif) => {
        if (!socketNotif || !socketNotif.type) {
          console.warn('[WARN] [NOTIF-CONTEXT] Received invalid notification:', socketNotif)
          return
        }
        
        console.log('[NOTIF-CONTEXT] Socket.IO event received:', socketNotif.type)
        console.log('   Full data:', socketNotif)
        
        // Show the badge immediately (increment unreadCount)
        console.log('[NOTIF-CONTEXT] Incrementing unreadCount')
        setUnreadCount(prev => prev + 1)
        
        // Then refresh the notification list in the background
        console.log('[NOTIF-CONTEXT] Calling refresh()')
        refreshRef.current?.()
      })
    } else {
      console.log('[NOTIF-CONTEXT] User is NOT Admin - NOT registering notification listener')
    }

    return () => {
      if (cleanup) {
        console.log('[NOTIF-CONTEXT] Cleaning up notification listener')
        cleanup()
      }
    }
  }, [isAuthenticated, isLoading, userId, userRole, userEmail])

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
    const notif = notifications.find(n => n.id === id)
    if (!(typeof id === 'string' && id.startsWith('role-request-'))) {
      await svc.deleteNotification(id)
    }
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
