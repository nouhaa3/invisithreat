import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import Select from '../components/Select'
import { useAuth } from '../context/AuthContext'
import {
  adminGetUsers,
  adminChangeRole,
  adminToggleActive,
  adminApproveUser,
  adminRejectUser,
  adminDeleteUser,
  adminUpdateUser,
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

  useEffect(() => {
    if (me && me.role_name !== 'Admin') navigate('/dashboard', { replace: true })
  }, [me, navigate])

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
        <div className="max-w-6xl mx-auto px-8 py-8">

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
          <div className="flex flex-wrap items-center gap-3 mb-5 animate-slide-up">
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
          </div>

          {/* ── All users table ───────────────────────────────────────────────── */}
          <div className="rounded-2xl overflow-hidden animate-slide-up"
            style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.06)' }}>

            <div className="grid grid-cols-12 gap-4 px-5 py-3 text-xs font-semibold uppercase tracking-widest text-white/25"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="col-span-4">User</div>
              <div className="col-span-3 text-center">Role</div>
              <div className="col-span-2 text-center">Status</div>
              <div className="col-span-2 text-center">Joined</div>
              <div className="col-span-1 text-right">Actions</div>
            </div>

            {loading ? (
              <div className="flex justify-center py-16">
                <div className="w-8 h-8 rounded-full animate-spin"
                  style={{ border: '2px solid rgba(255,107,43,0.2)', borderTop: '2px solid #FF6B2B' }} />
              </div>
            ) : error ? (
              <p className="text-red-400 text-sm text-center py-12">{error}</p>
            ) : filtered.length === 0 ? (
              <p className="text-white/25 text-sm text-center py-12">No users found</p>
            ) : (
              filtered.map((u, idx) => {
                const isMe = u.id === me?.id
                return (
                  <div key={u.id}
                    className="grid grid-cols-12 gap-4 px-5 py-4 items-center transition-colors hover:bg-white/[0.015]"
                    style={{ borderBottom: idx < filtered.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>

                    {/* User */}
                    <div className="col-span-4 flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                        style={{ background: 'rgba(255,107,43,0.1)', border: '1px solid rgba(255,107,43,0.15)', color: '#FF8C5A' }}>
                        {u.nom?.charAt(0).toUpperCase()}
                      </div>
                      {editingUser?.id === u.id ? (
                        <div className="flex flex-col gap-1 min-w-0 flex-1">
                          <input
                            autoFocus
                            value={editingUser.nom}
                            onChange={e => setEditingUser(p => ({ ...p, nom: e.target.value }))}
                            onKeyDown={e => { if (e.key === 'Enter') handleSaveProfile(); if (e.key === 'Escape') setEditingUser(null) }}
                            className="w-full px-2 py-1 rounded-lg text-sm font-semibold text-white outline-none"
                            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,107,43,0.35)' }}
                            placeholder="Name"
                          />
                          <input
                            value={editingUser.email}
                            onChange={e => setEditingUser(p => ({ ...p, email: e.target.value }))}
                            onKeyDown={e => { if (e.key === 'Enter') handleSaveProfile(); if (e.key === 'Escape') setEditingUser(null) }}
                            className="w-full px-2 py-1 rounded-lg text-xs outline-none"
                            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,107,43,0.2)', color: 'rgba(255,255,255,0.5)' }}
                            placeholder="Email"
                          />
                        </div>
                      ) : (
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white truncate">
                            {u.nom} {isMe && <span className="text-[10px] text-white/30 font-normal ml-1">(you)</span>}
                          </p>
                          <p className="text-xs text-white/30 truncate">{u.email}</p>
                        </div>
                      )}
                    </div>

                    {/* Role selector */}
                    <div className="col-span-3 flex justify-center">
                      {isMe ? (
                        <RoleBadge role={u.role_name} />
                      ) : (
                        <div className="w-[152px]">
                          <Select
                            value={u.role_name}
                            options={ROLES}
                            loading={!!changingRole[u.id]}
                            onChange={v => handleRoleChange(u.id, v)}
                            size="sm"
                            getOptionStyle={r => ROLE_COLOR[r]}
                          />
                        </div>
                      )}
                    </div>

                    {/* Status — click to toggle */}
                    <div className="col-span-2 flex justify-center">
                      {togglingActive[u.id] ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                          style={{
                            color:      u.is_active ? '#22c55e' : '#6b7280',
                            background: u.is_active ? 'rgba(34,197,94,0.08)' : 'rgba(107,114,128,0.08)',
                            border:     `1px solid ${u.is_active ? 'rgba(34,197,94,0.2)' : 'rgba(107,114,128,0.2)'}`,
                          }}>
                          <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                        </span>
                      ) : (
                        <button
                          onClick={() => !isMe && handleToggleActive(u.id)}
                          disabled={togglingActive[u.id] || deleting[u.id]}
                          title={isMe ? undefined : u.is_active ? 'Click to deactivate' : 'Click to activate'}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-opacity"
                          style={{
                            color:      u.is_active ? '#22c55e' : '#6b7280',
                            background: u.is_active ? 'rgba(34,197,94,0.08)' : 'rgba(107,114,128,0.08)',
                            border:     `1px solid ${u.is_active ? 'rgba(34,197,94,0.2)' : 'rgba(107,114,128,0.2)'}`,
                            cursor:     isMe ? 'default' : 'pointer',
                          }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                            style={{ background: u.is_active ? '#22c55e' : '#6b7280' }} />
                          {u.is_active ? 'Active' : 'Inactive'}
                        </button>
                      )}
                    </div>

                    {/* Joined */}
                    <div className="col-span-2 flex justify-center">
                      <span className="text-xs text-white/30 whitespace-nowrap">
                        {new Date(u.date_creation).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                    </div>

                    {/* Actions: edit + delete */}
                    <div className="col-span-1 flex justify-end gap-2">
                      {!isMe && editingUser?.id === u.id ? (
                        <>
                          <button
                            onClick={handleSaveProfile}
                            disabled={saving[u.id]}
                            title="Save changes"
                            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all disabled:opacity-40"
                            style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', color: '#4ade80' }}
                          >
                            {saving[u.id] ? (
                              <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                            )}
                          </button>
                          <button
                            onClick={() => setEditingUser(null)}
                            title="Cancel"
                            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
                            style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.18)', color: '#f87171' }}
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                          </button>
                        </>
                      ) : (
                        <>
                          {!isMe && (
                            <button
                              onClick={() => setEditingUser({ id: u.id, nom: u.nom, email: u.email })}
                              title="Edit name / email"
                              className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
                              style={{ background: 'rgba(255,107,43,0.07)', border: '1px solid rgba(255,107,43,0.18)', color: '#FF8C5A' }}
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>
                          )}
                          {!isMe && (
                            <button
                              onClick={() => handleDelete(u.id, u.nom)}
                              disabled={togglingActive[u.id] || deleting[u.id]}
                              title="Delete user permanently"
                              className="w-8 h-8 rounded-lg flex items-center justify-center transition-all disabled:opacity-40"
                              style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', color: '#f87171' }}
                            >
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
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </main>
    </AppLayout>
  )
}
