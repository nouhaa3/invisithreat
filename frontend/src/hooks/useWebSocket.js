import { useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { initializeWebSocket, onNotification } from '../services/websocketService'

export const useWebSocket = (onNotification_callback) => {
  const { user } = useAuth()

  useEffect(() => {
    if (!user) return

    // Initialize WebSocket connection (server derives user from auth cookie)
    initializeWebSocket()

    // Register notification listener - gets cleanup function back
    let cleanup = null
    if (onNotification_callback) {
      cleanup = onNotification(onNotification_callback)
    }

    // Cleanup on unmount
    return () => {
      if (cleanup) {
        cleanup() // Call cleanup function to unregister listener
      }
      // Don't close WebSocket yet - other components might still need it
      // closeWebSocket() will be called when the app unmounts
    }
  }, [user, onNotification_callback])
}

