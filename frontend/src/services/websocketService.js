import io from 'socket.io-client'

let socket = null
const notificationListeners = new Map() // Track listeners to clean them up properly

const sanitizePayload = (payload) => {
  if (payload == null) return payload
  if (Array.isArray(payload)) return payload.map(sanitizePayload)
  if (typeof payload === 'object') {
    const out = {}
    for (const [key, value] of Object.entries(payload)) {
      const keyLower = String(key).toLowerCase()
      if (['token', 'secret', 'password', 'code', 'snippet'].some(k => keyLower.includes(k))) continue
      out[key] = sanitizePayload(value)
    }
    return out
  }
  return payload
}

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

export const initializeWebSocket = () => {

  // Reuse existing socket instead of creating duplicates (important with React StrictMode).
  if (socket !== null) {
    if (socket.active) {
    } else {
      socket.connect()
    }
    return socket
  }

  const socketBaseUrl = getSocketBaseUrl()

  socket = io(socketBaseUrl, {
    path: '/socket.io',
    transports: ['websocket'],
    upgrade: false,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: Infinity,
    timeout: 20000,
  })

  socket.on('connect', () => {
  })

  socket.on('connected', () => {})

  socket.on('notification', (data) => {
    const safeData = sanitizePayload(data)
    // Broadcast to all registered listeners
    notificationListeners.forEach((handler) => {
      handler(safeData)
    })
  })

  socket.on('disconnect', () => {})
  socket.on('connect_error', () => {})
  socket.on('error', () => {})
  socket.io.on('reconnect_attempt', () => {})

  socket.io.on('reconnect', () => {})

  socket.io.on('reconnect_error', () => {})

  return socket
}

export const closeWebSocket = () => {
  if (socket) {
    socket.disconnect()
    socket = null
  }
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

  // Return cleanup function
  return () => {
    notificationListeners.delete(callbackId)
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

// Ensure old sockets are closed during Vite hot reloads so stale managers do not
// keep reconnecting in the background and spam timeout errors.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    try {
      closeWebSocket()
    } catch {
      // Ignore cleanup failures during module replacement.
    }
  })
}