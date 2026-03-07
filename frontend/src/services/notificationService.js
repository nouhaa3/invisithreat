import api from './api'

export const getNotifications = () =>
  api.get('/api/notifications').then(r => r.data)

export const getUnreadCount = () =>
  api.get('/api/notifications/unread-count').then(r => r.data.count)

export const markRead = (id) =>
  api.patch(`/api/notifications/${id}/read`)

export const markAllRead = () =>
  api.post('/api/notifications/read-all')

export const deleteNotification = (id) =>
  api.delete(`/api/notifications/${id}`)
