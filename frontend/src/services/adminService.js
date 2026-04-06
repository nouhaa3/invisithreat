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

export const adminApproveRoleRequest = async (userId) => {
  const res = await api.post(`/api/auth/admin/users/${userId}/approve-role-request`)
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

// Bulk operations
export const adminBulkDeleteUsers = async (userIds) => {
  const res = await api.post('/api/auth/admin/users/bulk/delete', { user_ids: userIds })
  return res.data
}

export const adminBulkActivateUsers = async (userIds) => {
  const res = await api.patch('/api/auth/admin/users/bulk/activate', { user_ids: userIds })
  return res.data
}

export const adminBulkDeactivateUsers = async (userIds) => {
  const res = await api.patch('/api/auth/admin/users/bulk/deactivate', { user_ids: userIds })
  return res.data
}
