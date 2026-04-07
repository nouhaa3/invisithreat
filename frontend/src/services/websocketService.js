import io from 'socket.io-client'

let socket = null
const notificationListeners = new Map() // Track listeners to clean them up properly

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export const initializeWebSocket = (userId, userRole, userEmail) => {
  console.log(`[WS-INIT] Initializing WebSocket for user: ${userId} (${userRole})`)
  
  // If already initialized, just re-identify (in case user changed)
  if (socket !== null && socket.connected) {
    console.log('[WS-INIT] WebSocket already connected, re-identifying...')
    socket.emit('identify', {
      user_id: userId,
      email: userEmail,
      role: userRole,
    })
    console.log('[WS-INIT] Identify event emitted')
    return socket
  }

  console.log('[WS-INIT] Creating new Socket.IO connection...')
  
  socket = io(API_URL, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
  })

  socket.on('connect', () => {
    console.log('[WS-CONNECT] Connected to WebSocket')
    console.log(`[WS-CONNECT] Sending identify event for user: ${userId} (${userRole})`)
    socket.emit('identify', {
      user_id: userId,
      email: userEmail,
      role: userRole,
    })
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

  socket.on('error', (error) => {
    console.error('[WS-ERROR] WebSocket error:', error)
  })

  return socket
}

export const closeWebSocket = () => {
  if (socket) {
    socket.disconnect()
    socket = null
    // Clear all listeners when closing
    notificationListeners.clear()
  }
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
