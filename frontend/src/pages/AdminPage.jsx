import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import Select from '../components/Select'
import { useAuth } from '../context/AuthContext'
import { useWebSocket } from '../hooks/useWebSocket'
import {
  adminGetUsers,
  adminChangeRole,
  adminToggleActive,
  adminApproveUser,
  adminRejectUser,
  adminDeleteUser,
  adminUpdateUser,
  adminBulkDeleteUsers,
  adminBulkActivateUsers,
  adminBulkDeactivateUsers,
} from '../services/adminService'

const ROLES = ['Admin', 'Developer', 'Security Manager', 'Viewer']

const ROLE_COLOR = {
  Admin:              { color: '#FF8C5A', bg: 'rgba(255,107,43,0.1)',  border: 'rgba(255,107,43,0.2)'  },
  Developer:          { color: '#60a5fa', bg: 'rgba(96,165,250,0.1)', border: 'rgba(96,165,250,0.2)'  },
  'Security Manager': { color: '#a78bfa', bg: 'rgba(167,139,250,0.1)',border: 'rgba(167,139,250,0.2)' },
  Viewer:             { color: '#6b7280', bg: 'rgba(107,114,128,0.1)',border: 'rgba(107,114,128,0.2)' },
}

function RoleBadge({ role }) {
  const cfg = ROLE_COLOR[role] || ROLE_COLOR.Viewer
  return (
    <span className="flex items-center justify-center w-[152px] px-2.5 py-1.5 rounded-xl text-xs font-semibold"
      style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}>
      {role}
    </span>
  )
}

export default function AdminPage() {
  const { user: me } = useAuth()
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [changingRole, setChangingRole]     = useState({})
  const [togglingActive, setTogglingActive] = useState({})
  const [approving, setApproving]           = useState({})
  const [rejecting, setRejecting]           = useState({})
  const [deleting, setDeleting]             = useState({})
  const [search, setSearch]     = useState('')
  const [filterRole, setFilterRole] = useState('All')
  const [editingUser, setEditingUser] = useState(null)  // { id, nom, email }
  const [saving, setSaving]           = useState({})
  const [selectedUserIds, setSelectedUserIds] = useState(new Set())
  const [bulkProcessing, setBulkProcessing] = useState(false)
  const [toolbarPos, setToolbarPos] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [detailsUserId, setDetailsUserId] = useState(null)  // Modal user details

  useEffect(() => {
    if (me && me.role_name !== 'Admin') navigate('/dashboard', { replace: true })
  }, [me, navigate])

  // Initialize WebSocket for real-time notifications
  useWebSocket((notification) => {
    if (!notification) return
    
    const { type, user, user_id, is_active } = notification
    
    if (type === 'user_created') {
      // Add new user to the top of the list (avoid duplicates by checking if already exists)
      const newUser = {
        id: user?.id,
        nom: user?.nom,
        email: user?.email,
        role_name: user?.role || 'Viewer',
        is_pending: true,
        is_active: false,
        date_creation: user?.created_at || new Date().toISOString(),
      }
      
      setUsers(prev => {
        // Check if user already exists in list
        const exists = prev.some(u => u.id === newUser.id)
        if (exists) {
          console.log('[WARN] User already exists, skipping duplicate:', newUser.nom)
          return prev
        }
        console.log('[NEW-USER] New user added:', newUser.nom)
        return [newUser, ...prev]
      })
    } 
    else if (type === 'user_deleted') {
      setUsers(prev => {
        const filtered = prev.filter(u => u.id !== user_id)
        if (filtered.length < prev.length) {
          console.log('[DELETE] User deleted:', user_id)
        }
        return filtered
      })
    } 
    else if (type === 'user_status_changed') {
      setUsers(prev => {
        const updated = prev.map(u => 
          u.id === user_id ? { ...u, is_active } : u
        )
        // Check if anything actually changed
        if (updated.some((u, i) => u.is_active !== prev[i].is_active)) {
          console.log('[UPDATE-STATUS] User status changed:', user_id, is_active ? 'activated' : 'deactivated')
        }
        return updated
      })
    }
  })

  const load = async () => {
    setLoading(true)
    try {
      const data = await adminGetUsers()
      setUsers(data)
    } catch {
      setError('Failed to load users')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const handleApprove = async (userId) => {
    setApproving(p => ({ ...p, [userId]: true }))
    try {
      const updated = await adminApproveUser(userId)
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...updated } : u))
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to approve user')
    } finally {
      setApproving(p => ({ ...p, [userId]: false }))
    }
  }

  const handleReject = async (userId) => {
    if (!window.confirm('Reject this user? They will receive an email notification.')) return
    setRejecting(p => ({ ...p, [userId]: true }))
    try {
      const updated = await adminRejectUser(userId)
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...updated } : u))
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to reject user')
    } finally {
      setRejecting(p => ({ ...p, [userId]: false }))
    }
  }

  const handleDelete = async (userId, nom) => {
    if (!window.confirm(`Permanently delete "${nom}"? This cannot be undone.`)) return
    setDeleting(p => ({ ...p, [userId]: true }))
    try {
      await adminDeleteUser(userId)
      setUsers(prev => prev.filter(u => u.id !== userId))
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to delete user')
    } finally {
      setDeleting(p => ({ ...p, [userId]: false }))
    }
  }

  const handleRoleChange = async (userId, newRole) => {
    setChangingRole(p => ({ ...p, [userId]: true }))
    try {
      const updated = await adminChangeRole(userId, newRole)
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role_name: updated.role_name } : u))
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to change role')
    } finally {
      setChangingRole(p => ({ ...p, [userId]: false }))
    }
  }

  const handleToggleActive = async (userId) => {
    setTogglingActive(p => ({ ...p, [userId]: true }))
    try {
      const updated = await adminToggleActive(userId)
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_active: updated.is_active } : u))
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to toggle user')
    } finally {
      setTogglingActive(p => ({ ...p, [userId]: false }))
    }
  }

  const handleSaveProfile = async () => {
    if (!editingUser) return
    setSaving(p => ({ ...p, [editingUser.id]: true }))
    try {
      const updated = await adminUpdateUser(editingUser.id, { nom: editingUser.nom, email: editingUser.email })
      setUsers(prev => prev.map(u => u.id === editingUser.id ? { ...u, nom: updated.nom, email: updated.email } : u))
      setEditingUser(null)
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to save changes')
    } finally {
      setSaving(p => ({ ...p, [editingUser.id]: false }))
    }
  }

  // Bulk operations
  const handleBulkDelete = async () => {
    if (selectedUserIds.size === 0) return
    const count = selectedUserIds.size
    if (!window.confirm(`Permanently delete ${count} user(s)? This cannot be undone.`)) return
    
    setBulkProcessing(true)
    try {
      const result = await adminBulkDeleteUsers(Array.from(selectedUserIds))
      setUsers(prev => prev.filter(u => !selectedUserIds.has(u.id)))
      setSelectedUserIds(new Set())
      alert(`Successfully deleted ${result.success_count} user(s)${result.failed_count > 0 ? `. Failed: ${result.failed_count}` : ''}`)
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to delete users')
    } finally {
      setBulkProcessing(false)
    }
  }

  const handleBulkActivate = async () => {
    if (selectedUserIds.size === 0) return
    const count = selectedUserIds.size
    
    setBulkProcessing(true)
    try {
      const result = await adminBulkActivateUsers(Array.from(selectedUserIds))
      setUsers(prev => prev.map(u => selectedUserIds.has(u.id) ? { ...u, is_active: true } : u))
      setSelectedUserIds(new Set())
      alert(`Successfully activated ${result.success_count} user(s)${result.failed_count > 0 ? `. Failed: ${result.failed_count}` : ''}`)
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to activate users')
    } finally {
      setBulkProcessing(false)
    }
  }

  const handleBulkDeactivate = async () => {
    if (selectedUserIds.size === 0) return
    const count = selectedUserIds.size
    if (!window.confirm(`Deactivate ${count} user(s)? They will receive a notification.`)) return
    
    setBulkProcessing(true)
    try {
      const result = await adminBulkDeactivateUsers(Array.from(selectedUserIds))
      setUsers(prev => prev.map(u => selectedUserIds.has(u.id) ? { ...u, is_active: false } : u))
      setSelectedUserIds(new Set())
      alert(`Successfully deactivated ${result.success_count} user(s)${result.failed_count > 0 ? `. Failed: ${result.failed_count}` : ''}`)
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to deactivate users')
    } finally {
      setBulkProcessing(false)
    }
  }

  const toggleUserSelection = (userId, isMe) => {
    if (isMe) return // Can't select your own user
    setSelectedUserIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(userId)) {
        newSet.delete(userId)
      } else {
        newSet.add(userId)
      }
      return newSet
    })
  }

  const toggleSelectAll = (filteredUsers, isMe) => {
    if (selectedUserIds.size === filteredUsers.filter(u => u.id !== me?.id).length) {
      setSelectedUserIds(new Set())
    } else {
      const allIds = new Set(filteredUsers.filter(u => u.id !== me?.id).map(u => u.id))
      setSelectedUserIds(allIds)
    }
  }

  const handleToolbarMouseDown = (e) => {
    setIsDragging(true)
    setDragOffset({
      x: e.clientX - toolbarPos.x,
      y: e.clientY - toolbarPos.y,
    })
  }

  useEffect(() => {
    if (!isDragging) return
    const handleMouseMove = (e) => {
      setToolbarPos({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y,
      })
    }
    const handleMouseUp = () => setIsDragging(false)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, dragOffset])

  const pending  = users.filter(u => u.is_pending)
  const active   = users.filter(u => !u.is_pending)
  const filtered = active.filter(u => {
    const matchSearch = u.nom.toLowerCase().includes(search.toLowerCase()) ||
                        u.email.toLowerCase().includes(search.toLowerCase())
    const matchRole = filterRole === 'All' || u.role_name === filterRole
    return matchSearch && matchRole
  })

  const stats = {
    total: active.length,
    activeCount: active.filter(u => u.is_active).length,
    byRole: ROLES.reduce((acc, r) => { acc[r] = active.filter(u => u.role_name === r).length; return acc }, {}),
  }

  return (
    <AppLayout>
      <main className="flex-1 overflow-auto">
        <div className="px-8 py-8">

          {/* Header */}
          <div className="mb-8 animate-slide-up">
            <h1 className="text-2xl font-bold text-white">User Management</h1>
            <p className="text-white/30 text-sm mt-1">Manage roles and access for all platform users</p>
          </div>

          {/* ── Pending approvals ─────────────────────────────────────────────── */}
          {!loading && pending.length > 0 && (
            <div className="mb-8 animate-slide-up">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                <h2 className="text-sm font-semibold text-white/80 uppercase tracking-widest">
                  Pending Approvals
                </h2>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold"
                  style={{ background: 'rgba(250,204,21,0.12)', border: '1px solid rgba(250,204,21,0.25)', color: '#fbbf24' }}>
                  {pending.length}
                </span>
              </div>

              <div className="flex flex-col gap-3">
                {pending.map(u => {
                  const cfg = ROLE_COLOR[u.role_name] || ROLE_COLOR.Viewer
                  const isProcessing = approving[u.id] || rejecting[u.id]
                  return (
                    <div key={u.id}
                      className="flex items-center gap-4 px-5 py-4 rounded-2xl"
                      style={{ background: 'rgba(250,204,21,0.04)', border: '1px solid rgba(250,204,21,0.15)' }}>

                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                        style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}>
                        {u.nom?.charAt(0).toUpperCase()}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{u.nom}</p>
                        <p className="text-xs text-white/30 truncate">{u.email}</p>
                      </div>

                      {/* Role badge */}
                      <RoleBadge role={u.role_name} />

                      {/* Requested */}
                      <span className="text-xs text-white/25 hidden sm:block">
                        {new Date(u.date_creation).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApprove(u.id)}
                          disabled={isProcessing || deleting[u.id]}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                          style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', color: '#4ade80' }}>
                          {approving[u.id] ? (
                            <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                          Approve
                        </button>
                        <button
                          onClick={() => handleReject(u.id)}
                          disabled={isProcessing || deleting[u.id]}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
                          {rejecting[u.id] ? (
                            <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          )}
                          Reject
                        </button>
                        <button
                          onClick={() => handleDelete(u.id, u.nom)}
                          disabled={isProcessing || deleting[u.id]}
                          title="Delete user permanently"
                          className="w-8 h-8 rounded-lg flex items-center justify-center transition-all disabled:opacity-50"
                          style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', color: '#f87171' }}>
                          {deleting[u.id] ? (
                            <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                              <path d="M10 11v6M14 11v6" />
                              <path d="M9 6V4h6v2" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Stats row ─────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8 animate-slide-up">
            <div className="rounded-2xl p-4" style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-xs text-white/30 uppercase tracking-widest mb-1">Total</p>
              <p className="text-2xl font-bold text-white">{stats.total}</p>
            </div>
            <div className="rounded-2xl p-4" style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-xs text-white/30 uppercase tracking-widest mb-1">Active</p>
              <p className="text-2xl font-bold text-green-400">{stats.activeCount}</p>
            </div>
            {ROLES.map(r => {
              const cfg = ROLE_COLOR[r]
              return (
                <div key={r} className="rounded-2xl p-4" style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <p className="text-xs uppercase tracking-widest mb-1" style={{ color: cfg.color }}>{r}</p>
                  <p className="text-2xl font-bold text-white">{stats.byRole[r] || 0}</p>
                </div>
              )
            })}
          </div>

          {/* ── Filters ───────────────────────────────────────────────────────── */}
          <div className="flex flex-wrap items-center gap-3 mb-6 animate-slide-up">
            <input
              className="px-4 py-2 rounded-xl text-sm text-white outline-none transition-all flex-1 min-w-48"
              style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.07)' }}
              placeholder="Search by name or email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onFocus={e => { e.target.style.borderColor = 'rgba(255,107,43,0.4)' }}
              onBlur={e =>  { e.target.style.borderColor = 'rgba(255,255,255,0.07)' }}
            />
            <div className="flex gap-2 flex-wrap">
              {['All', ...ROLES].map(r => (
                <button key={r} onClick={() => setFilterRole(r)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: filterRole === r ? 'rgba(255,107,43,0.1)' : 'rgba(255,255,255,0.03)',
                    border:     filterRole === r ? '1px solid rgba(255,107,43,0.25)' : '1px solid rgba(255,255,255,0.06)',
                    color:      filterRole === r ? '#FF8C5A' : 'rgba(255,255,255,0.35)',
                  }}>{r}</button>
              ))}
            </div>
            {filtered.length > 0 && (
              <button
                onClick={() => toggleSelectAll(filtered, me?.id)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all ml-auto"
                style={{
                  background: selectedUserIds.size === filtered.filter(u => u.id !== me?.id).length && filtered.filter(u => u.id !== me?.id).length > 0 ? 'rgba(255,107,43,0.15)' : 'rgba(255,255,255,0.03)',
                  border: selectedUserIds.size === filtered.filter(u => u.id !== me?.id).length && filtered.filter(u => u.id !== me?.id).length > 0 ? '1px solid rgba(255,107,43,0.3)' : '1px solid rgba(255,255,255,0.06)',
                  color: selectedUserIds.size === filtered.filter(u => u.id !== me?.id).length && filtered.filter(u => u.id !== me?.id).length > 0 ? '#FF8C5A' : 'rgba(255,255,255,0.35)',
                }}>
                {selectedUserIds.size === filtered.filter(u => u.id !== me?.id).length && filtered.filter(u => u.id !== me?.id).length > 0 ? 'Deselect All' : 'Select All'}
              </button>
            )}
          </div>

          {/* ── All users cards ───────────────────────────────────────────────── */}
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="w-8 h-8 rounded-full animate-spin"
                style={{ border: '2px solid rgba(255,107,43,0.2)', borderTop: '2px solid #FF6B2B' }} />
            </div>
          ) : error ? (
            <p className="text-red-400 text-sm text-center py-12">{error}</p>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 rounded-2xl animate-slide-up"
              style={{ border: '1px dashed rgba(255,255,255,0.08)' }}>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: 'rgba(255,107,43,0.06)', border: '1px solid rgba(255,107,43,0.1)' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FF6B2B" strokeWidth="1.5">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <p className="text-white font-semibold mb-1">No users found</p>
              <p className="text-white/30 text-sm">Try adjusting your search or role filters</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-slide-up">
              {filtered.map((u) => {
                const isMe = u.id === me?.id
                const isSelected = selectedUserIds.has(u.id)
                const cfg = ROLE_COLOR[u.role_name] || ROLE_COLOR.Viewer

                return (
                  <div
                    key={u.id}
                    className={`group relative rounded-2xl p-5 transition-all duration-200 ${
                      isSelected ? '' : 'hover:border-orange-500/20 hover:shadow-lg hover:shadow-orange-500/10'
                    }`}
                    style={{
                      background: 'linear-gradient(170deg, rgba(255,255,255,0.025), rgba(255,255,255,0.008))',
                      border: isSelected
                        ? '1.5px solid rgba(255,107,43,0.35)'
                        : '1px solid rgba(255,255,255,0.055)',
                      boxShadow: isSelected ? '0 0 20px rgba(255,107,43,0.15)' : 'none',
                    }}>

                    {/* Checkbox at top-right */}
                    <div className="absolute top-4 right-4">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleUserSelection(u.id, isMe)}
                        disabled={isMe}
                        className="w-5 h-5 rounded cursor-pointer accent-orange-500 disabled:opacity-30 disabled:cursor-not-allowed"
                      />
                    </div>

                    {/* Avatar + Name/Email */}
                    <div className="flex items-center gap-3 mb-3">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center text-base font-bold flex-shrink-0"
                        style={{
                          background: cfg.bg,
                          border: `1.5px solid ${cfg.border}`,
                          color: cfg.color,
                        }}>
                        {u.nom?.charAt(0).toUpperCase()}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">
                          {u.nom} {isMe && <span className="text-[10px] text-white/30 font-normal">(you)</span>}
                        </p>
                        <p className="text-xs text-white/40 truncate">{u.email}</p>
                      </div>
                    </div>

                    {/* Role Badge - Centered */}
                    <div className="flex justify-center mb-3">
                      <RoleBadge role={u.role_name} />
                    </div>

                    {/* View Details Button - Right */}
                    <div className="flex justify-end">
                      <button
                        onClick={() => setDetailsUserId(u.id)}
                        className="px-2 py-0.5 text-xs font-normal transition-all"
                        style={{
                          color: 'rgba(255,255,255,0.6)',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.color = 'rgba(255,255,255,0.8)'
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.color = 'rgba(255,255,255,0.6)'
                        }}>
                        View Details
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── Bulk actions toolbar ─────────────────────────────────────────── */}
          {selectedUserIds.size > 0 && (
            <div className="fixed px-4 z-50 pointer-events-none animate-slide-up"
              style={{
                left: `${toolbarPos.x}px`,
                top: `${toolbarPos.y}px`,
                animation: 'slideUpBouncy 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
              }}>
              <style>{`
                @keyframes slideUpBouncy {
                  0% { opacity: 0; transform: translateY(48px); }
                  100% { opacity: 1; transform: translateY(0); }
                }
              `}</style>
              <div className="rounded-2xl overflow-hidden shadow-2xl pointer-events-auto cursor-move select-none"
                onMouseDown={handleToolbarMouseDown}
                style={{
                  background: 'rgba(17, 17, 17, 0.95)',
                  border: '1px solid rgba(255,107,43,0.4)',
                  backdropFilter: 'blur(20px)',
                  boxShadow: '0 20px 60px rgba(0,0,0,0.3), 0 0 40px rgba(0,0,0,0.5)',
                }}>
                <div className="flex items-center justify-between gap-6 px-6 py-4">
                  
                  {/* Left: Selection info */}
                  <div className="flex items-center gap-3 min-w-max">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg"
                      style={{
                        background: 'rgba(255,107,43,0.15)',
                        border: '1px solid rgba(255,107,43,0.3)',
                      }}>
                      <span className="text-xs font-bold text-orange-400">
                        {selectedUserIds.size}
                      </span>
                    </div>
                    <span className="text-sm font-semibold text-white">
                      {selectedUserIds.size} user{selectedUserIds.size !== 1 ? 's' : ''} selected
                    </span>
                  </div>

                  {/* Divider */}
                  <div className="h-6 w-px bg-white/10" />

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedUserIds(new Set())}
                      disabled={bulkProcessing}
                      className="px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 disabled:opacity-50"
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: 'rgba(255,255,255,0.5)',
                      }}>
                      Cancel
                    </button>
                    
                    <button
                      onClick={handleBulkActivate}
                      disabled={bulkProcessing}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 disabled:opacity-50"
                      style={{
                        background: 'rgba(34,197,94,0.12)',
                        border: '1px solid rgba(34,197,94,0.3)',
                        color: '#22c55e',
                      }}>
                      {bulkProcessing && <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />}
                      Activate
                    </button>

                    <button
                      onClick={handleBulkDeactivate}
                      disabled={bulkProcessing}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 disabled:opacity-50"
                      style={{
                        background: 'rgba(245,158,11,0.12)',
                        border: '1px solid rgba(245,158,11,0.3)',
                        color: '#fbbf24',
                      }}>
                      {bulkProcessing && <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />}
                      Deactivate
                    </button>

                    <button
                      onClick={handleBulkDelete}
                      disabled={bulkProcessing}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 disabled:opacity-50"
                      style={{
                        background: 'rgba(239,68,68,0.12)',
                        border: '1px solid rgba(239,68,68,0.3)',
                        color: '#f87171',
                      }}>
                      {bulkProcessing && <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />}
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Padding for bulk toolbar */}
          {selectedUserIds.size > 0 && <div className="h-24" />}

          {/* ── User Details Modal ────────────────────────────────────────────── */}
          {detailsUserId && (
            <UserDetailsModal
              userId={detailsUserId}
              users={users}
              me={me}
              ROLES={ROLES}
              ROLE_COLOR={ROLE_COLOR}
              onClose={() => setDetailsUserId(null)}
              onUpdate={setUsers}
              states={{
                changingRole, setChangingRole,
                togglingActive, setTogglingActive,
                deleting, setDeleting,
                editingUser, setEditingUser,
                saving, setSaving,
              }}
              handlers={{
                handleRoleChange,
                handleToggleActive,
                handleDelete,
                handleSaveProfile,
              }}
            />
          )}
        </div>
      </main>
    </AppLayout>
  )
}

// ─── User Details Modal ───────────────────────────────────────────────────────

function UserDetailsModal({ userId, users, me, ROLES, ROLE_COLOR, onClose, onUpdate, states, handlers }) {
  const user = users.find(u => u.id === userId)
  if (!user) return null

  const isMe = user.id === me?.id
  const cfg = ROLE_COLOR[user.role_name] || ROLE_COLOR.Viewer
  const { changingRole, setChangingRole, togglingActive, setTogglingActive, deleting, setDeleting, editingUser, setEditingUser, saving, setSaving } = states
  const { handleRoleChange, handleToggleActive, handleDelete, handleSaveProfile } = handlers

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}>
      <div
        className="rounded-2xl w-full max-w-md max-h-[80vh] overflow-y-auto animate-in fade-in zoom-in duration-300"
        style={{
          background: 'linear-gradient(170deg, rgba(20,20,20,0.95), rgba(15,15,15,0.92))',
          border: '1px solid rgba(255,107,43,0.3)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 60px rgba(255,107,43,0.2)',
        }}
        onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center text-lg font-bold"
              style={{
                background: cfg.bg,
                border: `1.5px solid ${cfg.border}`,
                color: cfg.color,
              }}>
              {user.nom?.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-lg font-semibold text-white">
                {user.nom} {isMe && <span className="text-xs text-white/30">(you)</span>}
              </p>
              <p className="text-sm text-white/40">{user.email}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-all"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col gap-4">
          {/* Role */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-white/30 mb-2">Role</p>
            {editingUser?.id === user.id ? (
              <Select
                value={user.role_name}
                options={ROLES}
                loading={!!changingRole[user.id]}
                onChange={v => handleRoleChange(user.id, v)}
                getOptionStyle={r => ROLE_COLOR[r]}
              />
            ) : isMe || user.requested_role_id ? (
              <div className="px-3 py-2 rounded-lg text-sm font-semibold"
                style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                {user.role_name}
              </div>
            ) : (
              <Select
                value={user.role_name}
                options={ROLES}
                loading={!!changingRole[user.id]}
                onChange={v => handleRoleChange(user.id, v)}
                getOptionStyle={r => ROLE_COLOR[r]}
              />
            )}
          </div>

          {/* Status */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-white/30 mb-2">Status</p>
            <button
              onClick={() => !isMe && handleToggleActive(user.id)}
              disabled={togglingActive[user.id] || deleting[user.id] || isMe}
              className="w-full inline-flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-opacity"
              style={{
                color: user.is_active ? '#22c55e' : '#6b7280',
                background: user.is_active ? 'rgba(34,197,94,0.08)' : 'rgba(107,114,128,0.08)',
                border: `1px solid ${user.is_active ? 'rgba(34,197,94,0.2)' : 'rgba(107,114,128,0.2)'}`,
                cursor: isMe ? 'default' : 'pointer',
              }}>
              {togglingActive[user.id] ? (
                <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <span className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: user.is_active ? '#22c55e' : '#6b7280' }} />
              )}
              {user.is_active ? 'Active' : 'Inactive'}
            </button>
          </div>

          {/* Joined Date */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-white/30 mb-2">Joined</p>
            <p className="px-3 py-2 rounded-lg text-sm text-white/60"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
              {new Date(user.date_creation).toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          </div>

          {/* Edit Name/Email */}
          {!isMe && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-white/30 mb-2">Profile</p>
              {editingUser?.id === user.id ? (
                <div className="flex flex-col gap-2">
                  <input
                    autoFocus
                    value={editingUser.nom}
                    onChange={e => setEditingUser(p => ({ ...p, nom: e.target.value }))}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleSaveProfile()
                      if (e.key === 'Escape') setEditingUser(null)
                    }}
                    className="w-full px-3 py-2 rounded-lg text-sm font-semibold text-white outline-none"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,107,43,0.35)' }}
                    placeholder="Name"
                  />
                  <input
                    value={editingUser.email}
                    onChange={e => setEditingUser(p => ({ ...p, email: e.target.value }))}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleSaveProfile()
                      if (e.key === 'Escape') setEditingUser(null)
                    }}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,107,43,0.2)', color: 'rgba(255,255,255,0.5)' }}
                    placeholder="Email"
                  />
                </div>
              ) : (
                <button
                  onClick={() => setEditingUser({ id: user.id, nom: user.nom, email: user.email })}
                  className="w-full px-3 py-2 rounded-lg text-sm text-left transition-all"
                  style={{ background: 'rgba(255,107,43,0.08)', border: '1px solid rgba(255,107,43,0.15)', color: '#FF8C5A' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="inline mr-2">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  Edit Name & Email
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-white/10 flex gap-2">
          {!isMe && editingUser?.id === user.id ? (
            <>
              <button
                onClick={handleSaveProfile}
                disabled={saving[user.id]}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-40"
                style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)', color: '#4ade80' }}>
                {saving[user.id] ? (
                  <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin inline-block mr-2" />
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="inline mr-2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
                Save
              </button>
              <button
                onClick={() => setEditingUser(null)}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)', color: '#f87171' }}>
                Cancel
              </button>
            </>
          ) : !isMe && (
            <>
              <button
                onClick={() => handleDelete(user.id, user.nom)}
                disabled={deleting[user.id] || togglingActive[user.id]}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-40"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)', color: '#f87171' }}>
                {deleting[user.id] ? (
                  <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin inline-block mr-2" />
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="inline mr-2">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                    <path d="M10 11v6M14 11v6" />
                  </svg>
                )}
                Delete
              </button>
            </>
          )}
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
