import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import { useNotifications } from '../context/NotificationContext'
import { useAuth } from '../context/AuthContext'
import { useRelativeTime } from '../hooks/useRelativeTime'
import { adminApproveRoleRequest, adminChangeRole, adminGetUsers } from '../services/adminService'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60_000)      return 'Just now'
  if (diff < 3_600_000)   return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000)  return `${Math.floor(diff / 3_600_000)}h ago`
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// Real-time timestamp component
function RelativeTime({ iso }) {
  const relativeTime = useRelativeTime(iso)
  return <span>{relativeTime}</span>
}

const TYPE_CFG = {
  scan_complete: {
    label: 'Scan Complete',
    color: '#60a5fa',
    bg: 'rgba(96,165,250,0.08)',
    border: 'rgba(96,165,250,0.15)',
    icon: (
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    ),
  },
  vuln_found: {
    label: 'Vulnerability',
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.08)',
    border: 'rgba(245,158,11,0.15)',
    icon: (
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01" />
    ),
  },
  project_invite: {
    label: 'Project Invite',
    color: '#a78bfa',
    bg: 'rgba(167,139,250,0.08)',
    border: 'rgba(167,139,250,0.15)',
    icon: (
      <>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
  },
  role_request: {
    label: 'Role Request',
    color: '#60a5fa',
    bg: 'rgba(96,165,250,0.08)',
    border: 'rgba(96,165,250,0.15)',
    icon: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M19 8v6M16 11h6" />
      </>
    ),
  },
  system: {
    label: 'System',
    color: '#FF8C5A',
    bg: 'rgba(255,140,90,0.08)',
    border: 'rgba(255,140,90,0.15)',
    icon: (
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    ),
  },
}

const FILTERS = ['All', 'Unread', 'scan_complete', 'vuln_found', 'project_invite', 'role_request', 'system']
const FILTER_LABELS = {
  All: 'All',
  Unread: 'Unread',
  scan_complete: 'Scans',
  vuln_found: 'Vulnerabilities',
  project_invite: 'Invites',
  role_request: 'Role Requests',
  system: 'System',
}

const ROLES = ['Admin', 'Developer', 'Security Manager', 'Viewer']

// ─── Notification Card ────────────────────────────────────────────────────────

function NotifCard({
  notif,
  onMarkRead,
  onDelete,
  selectedRole,
  onRoleSelect,
  onApproveRoleRequest,
  onApplyRole,
  approvingRoleRequest,
  applyingRole,
}) {
  const navigate = useNavigate()
  const cfg = TYPE_CFG[notif.type] ?? TYPE_CFG.system
  const isRoleRequest = notif.type === 'role_request'

  const handleClick = async () => {
    if (isRoleRequest) return
    if (!notif.is_read) await onMarkRead(notif.id)
    if (notif.link) navigate(notif.link)
  }

  return (
    <div
      className={`group flex items-start gap-4 p-4 rounded-xl transition-all relative ${isRoleRequest ? '' : 'cursor-pointer'}`}
      style={{
        background: notif.is_read ? 'rgba(255,255,255,0.02)' : 'rgba(255,107,43,0.04)',
        border: `1px solid ${notif.is_read ? 'rgba(255,255,255,0.06)' : 'rgba(255,107,43,0.12)'}`,
      }}
      onClick={handleClick}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
      onMouseLeave={e => { e.currentTarget.style.background = notif.is_read ? 'rgba(255,255,255,0.02)' : 'rgba(255,107,43,0.04)' }}
    >
      {/* Unread dot */}
      {!notif.is_read && (
        <span
          className="absolute top-4 right-4 w-2 h-2 rounded-full flex-shrink-0"
          style={{ background: '#FF6B2B' }}
        />
      )}

      {/* Icon */}
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
      >
        <svg width="16" height="16" fill="none" stroke={cfg.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          {cfg.icon}
        </svg>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <span
                className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
                style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
              >
                {cfg.label}
              </span>
              {!notif.is_read && (
                <span
                  className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(255,107,43,0.1)', color: '#FF8C5A', border: '1px solid rgba(255,107,43,0.2)' }}
                >
                  New
                </span>
              )}
            </div>
            <p
              className="text-sm leading-snug"
              style={{ color: notif.is_read ? 'rgba(255,255,255,0.55)' : 'white', fontWeight: notif.is_read ? 400 : 600 }}
            >
              {notif.title}
            </p>
            {notif.message && (
              <p className="text-xs mt-1 leading-relaxed" style={{ color: 'rgba(255,255,255,0.35)' }}>
                {notif.message}
              </p>
            )}

            {isRoleRequest && notif.requestUserId && (
              <div className="mt-3 flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-2">
                <select
                  value={selectedRole}
                  onClick={e => e.stopPropagation()}
                  onChange={e => onRoleSelect(notif.requestUserId, e.target.value)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium outline-none"
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: 'rgba(255,255,255,0.9)',
                  }}
                >
                  {ROLES.map(role => (
                    <option key={role} value={role} style={{ background: '#222', color: 'white' }}>
                      {role}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation()
                    onApproveRoleRequest(notif.requestUserId)
                  }}
                  disabled={approvingRoleRequest || applyingRole}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                  style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', color: '#4ade80' }}
                >
                  {approvingRoleRequest ? 'Approving...' : 'Approve Request'}
                </button>

                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation()
                    onApplyRole(notif.requestUserId)
                  }}
                  disabled={approvingRoleRequest || applyingRole}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                  style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.25)', color: '#60a5fa' }}
                >
                  {applyingRole ? 'Applying...' : 'Apply Selected Role'}
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 mt-1">
            <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.2)' }}>
              <RelativeTime iso={notif.created_at} />
            </span>
          </div>
        </div>
      </div>

      {/* Delete button */}
      {!notif.synthetic && (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onDelete(notif.id) }}
          className="absolute bottom-3.5 right-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-white/20 hover:text-white/60"
          title="Dismiss"
        >
          <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const { user } = useAuth()
  const { notifications, unreadCount, refresh, markRead, markAllRead, removeNotification } = useNotifications()
  const [activeFilter, setActiveFilter] = useState('All')
  const [roleRequests, setRoleRequests] = useState([])
  const [selectedRoles, setSelectedRoles] = useState({})
  const [approvingRoleReq, setApprovingRoleReq] = useState({})
  const [applyingRoleReq, setApplyingRoleReq] = useState({})

  const isAdmin = user?.role_name === 'Admin'

  useEffect(() => {
    let mounted = true

    const loadRoleRequests = async () => {
      if (!isAdmin) {
        setRoleRequests([])
        return
      }
      try {
        const users = await adminGetUsers()
        const pendingRoleRequests = users.filter(u => !!u.requested_role_id)
        if (!mounted) return

        setRoleRequests(pendingRoleRequests)
        setSelectedRoles(prev => {
          const next = { ...prev }
          for (const reqUser of pendingRoleRequests) {
            if (!next[reqUser.id]) {
              next[reqUser.id] = reqUser.requested_role_name || 'Developer'
            }
          }
          return next
        })
      } catch {
        if (mounted) setRoleRequests([])
      }
    }

    loadRoleRequests()
    return () => { mounted = false }
  }, [isAdmin])

  const roleRequestNotifs = useMemo(() => {
    if (!isAdmin) return []
    return roleRequests.map(u => ({
      id: `role-request-${u.id}`,
      type: 'role_request',
      title: `${u.nom} requested ${u.requested_role_name || 'a role'}`,
      message: `${u.email} · Current role: ${u.role_name}`,
      is_read: false,
      created_at: u.date_creation || new Date().toISOString(),
      requestUserId: u.id,
      synthetic: true,
    }))
  }, [isAdmin, roleRequests])

  const dbNotifications = useMemo(
    () => notifications.filter(n => n.type !== 'role_request'),
    [notifications]
  )

  const allNotifications = useMemo(
    () => [...roleRequestNotifs, ...dbNotifications],
    [roleRequestNotifs, dbNotifications]
  )

  const totalUnread = unreadCount + roleRequestNotifs.length

  const handleApproveRoleRequest = async (userId) => {
    setApprovingRoleReq(prev => ({ ...prev, [userId]: true }))
    try {
      await adminApproveRoleRequest(userId)
      setRoleRequests(prev => prev.filter(u => u.id !== userId))
      await refresh()
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to approve role request')
    } finally {
      setApprovingRoleReq(prev => ({ ...prev, [userId]: false }))
    }
  }

  const handleApplyRole = async (userId) => {
    const roleName = selectedRoles[userId]
    if (!roleName) return

    setApplyingRoleReq(prev => ({ ...prev, [userId]: true }))
    try {
      await adminChangeRole(userId, roleName)
      setRoleRequests(prev => prev.filter(u => u.id !== userId))
      await refresh()
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to apply selected role')
    } finally {
      setApplyingRoleReq(prev => ({ ...prev, [userId]: false }))
    }
  }

  const filtered = allNotifications.filter(n => {
    if (activeFilter === 'All')    return true
    if (activeFilter === 'Unread') return !n.is_read
    return n.type === activeFilter
  })

  return (
    <AppLayout>
      <div className="px-8 py-8">

        {/* ── Header ── */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Notifications</h1>
            <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {totalUnread > 0
                ? `${totalUnread} unread notification${totalUnread !== 1 ? 's' : ''}`
                : 'All caught up!'}
            </p>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg transition-all"
              style={{
                background: 'rgba(255,107,43,0.1)',
                border: '1px solid rgba(255,107,43,0.2)',
                color: '#FF8C5A',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,107,43,0.18)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,107,43,0.1)' }}
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M20 6 9 17l-5-5" />
              </svg>
              Mark all read
            </button>
          )}
        </div>

        {/* ── Filter tabs ── */}
        <div className="flex gap-2 flex-wrap mb-6">
          {FILTERS.map(f => {
            const isActive = activeFilter === f
            return (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: isActive ? 'rgba(255,107,43,0.1)' : 'rgba(255,255,255,0.03)',
                  border:     isActive ? '1px solid rgba(255,107,43,0.25)' : '1px solid rgba(255,255,255,0.06)',
                  color:      isActive ? '#FF8C5A' : 'rgba(255,255,255,0.35)',
                }}
              >
                {FILTER_LABELS[f]}
              </button>
            )
          })}
        </div>

        {/* ── List ── */}
        {filtered.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-20 rounded-2xl"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <svg width="24" height="24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" viewBox="0 0 24 24">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </div>
            <p className="text-base font-semibold" style={{ color: 'rgba(255,255,255,0.3)' }}>
              {activeFilter === 'All' ? 'No notifications yet' : `No ${FILTER_LABELS[activeFilter].toLowerCase()} notifications`}
            </p>
            <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.15)' }}>
              {activeFilter === 'Unread' ? 'You\'re all caught up!' : 'Nothing here yet.'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map(n => (
              <NotifCard
                key={n.id}
                notif={n}
                onMarkRead={markRead}
                onDelete={removeNotification}
                selectedRole={selectedRoles[n.requestUserId] || 'Developer'}
                onRoleSelect={(userId, roleName) => setSelectedRoles(prev => ({ ...prev, [userId]: roleName }))}
                onApproveRoleRequest={handleApproveRoleRequest}
                onApplyRole={handleApplyRole}
                approvingRoleRequest={!!approvingRoleReq[n.requestUserId]}
                applyingRole={!!applyingRoleReq[n.requestUserId]}
              />
            ))}
          </div>
        )}

        {/* ── Footer info ── */}
        {filtered.length > 0 && (
          <p className="text-center text-xs mt-6" style={{ color: 'rgba(255,255,255,0.12)' }}>
            Showing {filtered.length} of {allNotifications.length} notification{allNotifications.length !== 1 ? 's' : ''} · auto-refreshes every 30s
          </p>
        )}
      </div>
    </AppLayout>
  )
}
