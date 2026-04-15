import io from 'socket.io-client'

let socket = null
const notificationListeners = new Map() // Track listeners to clean them up properly
let currentIdentity = null

const getSocketBaseUrl = () => {
  const envUrl = String(import.meta.env.VITE_API_URL || '').trim()
  const currentHost = window.location.hostname || 'localhost'
  const isLocalHost = ['localhost', '127.0.0.1', '::1'].includes(currentHost)

  if (envUrl) {
    try {
      const parsed = new URL(envUrl, window.location.origin)
      const envHostIsLocal = ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname)

      // Ignore localhost API URL when frontend is not running locally.
      if (envHostIsLocal && !isLocalHost) {
        throw new Error('Localhost API URL is not valid for non-local frontend host')
      }

      // In case API URL is configured as .../api, keep Socket.IO on root namespace endpoint.
      if (parsed.pathname && parsed.pathname !== '/') {
        parsed.pathname = parsed.pathname.replace(/\/api\/?$/, '/')
      }

      // Avoid mixed-content websocket issues when app is served over HTTPS.
      if (window.location.protocol === 'https:' && parsed.protocol === 'http:') {
        parsed.protocol = 'https:'
      }

      return parsed.origin
    } catch {
      // Fall through to local fallback.
    }
  }

  // Local dev default: backend on 8000. For non-local hosts, use same origin.
  if (isLocalHost) {
    return `${window.location.protocol}//${currentHost}:8000`
  }
  return window.location.origin
}

const emitIdentify = () => {
  if (!socket || !socket.connected || !currentIdentity?.user_id) return
  socket.emit('identify', currentIdentity)
}

export const initializeWebSocket = (userId, userRole, userEmail) => {
  console.log(`[WS-INIT] Initializing WebSocket for user: ${userId} (${userRole})`)

  currentIdentity = {
    user_id: userId,
    email: userEmail,
    role: userRole,
  }
  
  // Reuse existing socket instead of creating duplicates (important with React StrictMode).
  if (socket !== null) {
    if (socket.connected) {
      console.log('[WS-INIT] WebSocket already connected, re-identifying...')
      emitIdentify()
      console.log('[WS-INIT] Identify event emitted')
    } else {
      console.log('[WS-INIT] Existing WebSocket found, reconnecting...')
      socket.connect()
    }
    return socket
  }

  console.log('[WS-INIT] Creating new Socket.IO connection...')
  const socketBaseUrl = getSocketBaseUrl()
  console.log('[WS-INIT] Socket base URL:', socketBaseUrl)
  
  socket = io(socketBaseUrl, {
    path: '/socket.io',
    tryAllTransports: true,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: Infinity,
    timeout: 20000,
  })

  socket.on('connect', () => {
    console.log('[WS-CONNECT] Connected to WebSocket')
    if (socket?.io?.engine?.transport?.name) {
      console.log('[WS-CONNECT] Transport:', socket.io.engine.transport.name)
    }
    console.log('[WS-CONNECT] Sending identify event')
    emitIdentify()
    console.log('[WS-CONNECT] Identify event emitted')
  })

  socket.on('connected', (data) => {
    console.log('[WS-IDENTIFIED] WebSocket identification successful:', data)
  })

  socket.on('notification', (data) => {
    console.log('[WS-NOTIFICATION] Notification received:', data)
    // Broadcast to all registered listeners
    notificationListeners.forEach((handler) => {
      console.log('[WS-NOTIFICATION] Calling listener')
      handler(data)
    })
  })

  socket.on('disconnect', () => {
    console.log('[WS-DISCONNECT] Disconnected from WebSocket')
  })

  socket.on('connect_error', (error) => {
    console.error('[WS-CONNECT-ERROR] Socket.IO connection error:', error?.message || error)
  })

  socket.on('error', (error) => {
    console.error('[WS-ERROR] Socket.IO error:', error)
  })

  socket.io.on('reconnect_attempt', (attempt) => {
    console.log(`[WS-RECONNECT] Attempt ${attempt}`)
  })

  socket.io.on('reconnect', (attempt) => {
    console.log(`[WS-RECONNECT] Successful after ${attempt} attempts`)
    emitIdentify()
  })

  return socket
}

export const closeWebSocket = () => {
  if (socket) {
    console.log('[WS-CLOSE] Closing WebSocket connection')
    socket.disconnect()
    socket = null
  }
  currentIdentity = null
  // Clear all listeners when closing
  notificationListeners.clear()
}

export const isWebSocketConnected = () => {
  return socket !== null && socket.connected
}

export const getSocket = () => socket

/**
 * Register a notification callback - callback is NOT called directly
 * Instead, it's stored and called when Socket.IO receives 'notification' event
 * @param {Function} callback - Function to call with notification data
 * @returns {Function} Cleanup function to unregister this callback
 */
export const onNotification = (callback) => {
  const callbackId = Math.random().toString(36).slice(2)
  
  // Store callback with unique ID
  notificationListeners.set(callbackId, callback)
  console.log(`[LISTENER-REGISTERED] Registered notification listener (ID: ${callbackId}), total listeners: ${notificationListeners.size}`)
  
  // Return cleanup function
  return () => {
    notificationListeners.delete(callbackId)
    console.log(`[LISTENER-CLEANUP] Unregistered notification listener (ID: ${callbackId}), remaining listeners: ${notificationListeners.size}`)
  }
}

/**
 * Unregister a notification callback
 * @param {Function|String} callbackOrCleanup - Callback function or cleanup function from onNotification
 * @deprecated Use the cleanup function returned by onNotification instead
 */
export const offNotification = (callbackOrCleanup) => {
  // If it's a function returned by onNotification, call it
  if (typeof callbackOrCleanup === 'function') {
    callbackOrCleanup()
  }
}
