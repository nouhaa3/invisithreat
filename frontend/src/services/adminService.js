import api from './api'

export const adminGetUsers = async () => {
  const res = await api.get('/api/auth/admin/users')
  return res.data
}

export const adminChangeRole = async (userId, roleName) => {
  const res = await api.patch(`/api/auth/admin/users/${userId}/role`, { role_name: roleName })
  return res.data
}

export const adminToggleActive = async (userId) => {
  const res = await api.patch(`/api/auth/admin/users/${userId}/toggle-active`)
  return res.data
}

export const adminApproveUser = async (userId) => {
  const res = await api.post(`/api/auth/admin/users/${userId}/approve`)
  return res.data
}

export const adminRejectUser = async (userId) => {
  const res = await api.post(`/api/auth/admin/users/${userId}/reject`)
  return res.data
}

export const adminDeleteUser = async (userId) => {
  await api.delete(`/api/auth/admin/users/${userId}`)
}

export const adminUpdateUser = async (userId, { nom, email }) => {
  const res = await api.patch(`/api/auth/admin/users/${userId}/profile`, { nom, email })
  return res.data
}
