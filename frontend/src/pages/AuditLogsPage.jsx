import { useState, useEffect, useCallback } from 'react'
import AppLayout from '../components/AppLayout'
import { useRelativeTime } from '../hooks/useRelativeTime'
import { getAuditLogs, getAuditLogActions, exportAuditLogs } from '../services/auditLogService'
import { adminGetUsers } from '../services/adminService'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ACTION_ICONS = {
  login: 'LOGIN',
  logout: 'LOGOUT',
  register: 'REG',
  api_key_created: 'API-KEY',
  api_key_revoked: 'REVOKE',
  settings_updated: 'SETTINGS',
  profile_updated: 'PROFILE',
  role_changed: 'ROLE',
  role_request: 'REQUEST',
  bulk_delete_users: 'DELETE',
  user_created: 'CREATE',
  user_deleted: 'REMOVE',
  user_activated: 'ACTIVE',
  user_deactivated: 'INACTIVE',
  role_approved: 'APPROVE',
}

const ACTION_COLORS = {
  login: "#60a5fa",
  logout: "#60a5fa",
  register: "#4ade80",
  api_key_created: "#f59e0b",
  api_key_revoked: "#ef4444",
  settings_updated: "#8b5cf6",
  profile_updated: "#8b5cf6",
  role_changed: "#a78bfa",
  role_request: "#fbbf24",
  bulk_delete_users: "#ef4444",
  user_created: "#4ade80",
  user_deleted: "#ef4444",
  user_activated: "#4ade80",
  user_deactivated: "#ef4444",
  role_approved: "#4ade80",
}

// Real-time timestamp component
function RelativeTime({ iso }) {
  const relativeTime = useRelativeTime(iso)
  return <span>{relativeTime || '...'}</span>
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState([])
  const [allUsers, setAllUsers] = useState([])
  const [actions, setActions] = useState([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  // Filters
  const [searchText, setSearchText] = useState('')
  const [selectedAction, setSelectedAction] = useState('')
  const [selectedUserId, setSelectedUserId] = useState('')

  // Pagination
  const [currentPage, setCurrentPage] = useState(0)
  const LIMIT = 50
  const [totalLogs, setTotalLogs] = useState(0)

  // Load initial data
  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [logData, actionData, usersData] = await Promise.all([
        getAuditLogs({ limit: LIMIT }),
        getAuditLogActions(),
        adminGetUsers(),
      ])
      setLogs(logData?.logs || [])
      setTotalLogs(logData?.total || 0)
      setActions(actionData || [])
      setAllUsers(usersData || [])
    } catch (err) {
      console.error('Failed to load audit logs:', err)
    } finally {
      setLoading(false)
    }
  }

  // Apply filters
  const applyFilters = useCallback(async () => {
    setCurrentPage(0)
    setLoading(true)
    try {
      const result = await getAuditLogs({
        action: selectedAction || undefined,
        user_id: selectedUserId || undefined,
        search: searchText || undefined,
        limit: LIMIT,
        offset: 0,
      })
      setLogs(result?.logs || [])
      setTotalLogs(result?.total || 0)
    } catch (err) {
      console.error('Filter failed:', err)
    } finally {
      setLoading(false)
    }
  }, [selectedAction, selectedUserId, searchText])

  // Handle pagination
  const loadPage = useCallback(
    async (page) => {
      setLoading(true)
      try {
        const result = await getAuditLogs({
          action: selectedAction || undefined,
          user_id: selectedUserId || undefined,
          search: searchText || undefined,
          limit: LIMIT,
          offset: page * LIMIT,
        })
        setLogs(result?.logs || [])
        setCurrentPage(page)
      } catch (err) {
        console.error('Pagination failed:', err)
      } finally {
        setLoading(false)
      }
    },
    [selectedAction, selectedUserId, searchText]
  )

  // Export logs
  const handleExport = async () => {
    setExporting(true)
    try {
      const blob = await exportAuditLogs({
        action: selectedAction || undefined,
        user_id: selectedUserId || undefined,
        search: searchText || undefined,
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Export failed:', err)
    } finally {
      setExporting(false)
    }
  }

  // Get user name by ID
  const getUserName = (userId) => {
    const u = allUsers.find((x) => x.id === userId)
    return u ? u.nom : 'Unknown User'
  }

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      applyFilters()
    }, 300)
    return () => clearTimeout(timer)
  }, [searchText, applyFilters])

  // Apply action/user filters immediately
  useEffect(() => {
    applyFilters()
  }, [selectedAction, selectedUserId])

  const totalPages = Math.ceil(totalLogs / LIMIT)

  const chipStyle = (action) => ({
    color: ACTION_COLORS[action] || 'rgba(255,255,255,0.75)',
    background: `${ACTION_COLORS[action] || 'rgba(255,255,255,0.2)'}1A`,
    border: `1px solid ${ACTION_COLORS[action] || 'rgba(255,255,255,0.2)'}55`,
  })

  return (
    <AppLayout>
      <div className="ui-container max-w-[1400px] mx-auto">
        <div className="ui-hero mb-6">
          <h1 className="text-3xl font-bold">Audit Logs</h1>
          <p className="text-sm text-white/50 mt-2">
            Enterprise activity ledger for authentication, roles, and platform actions.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px]">
            <span className="ui-chip">Tamper-aware visibility</span>
            <span className="ui-chip">Fast + collaborative review</span>
            <span className="ui-chip">Privacy-first operational audit trail</span>
          </div>
        </div>

        <div className="ui-card p-4 mb-5">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
            <input
              type="text"
              placeholder="Search by IP, email, or action details..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="ui-input xl:col-span-2"
            />
            <select value={selectedAction} onChange={(e) => setSelectedAction(e.target.value)} className="ui-input">
              <option value="">All Actions</option>
              {actions.map((act) => (
                <option key={act} value={act} style={{ background: '#141414' }}>
                  {ACTION_ICONS[act] || 'EVENT'} {act}
                </option>
              ))}
            </select>
            <select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)} className="ui-input">
              <option value="">All Users</option>
              {allUsers.map((u) => (
                <option key={u.id} value={u.id} style={{ background: '#141414' }}>
                  {u.nom} ({u.email})
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                onClick={handleExport}
                disabled={exporting || logs.length === 0}
                className="flex-1 rounded-xl border px-3 py-2 text-xs font-semibold text-brand-orange-light border-brand-orange/35 bg-brand-orange/10 disabled:opacity-40"
              >
                {exporting ? 'Exporting...' : 'CSV'}
              </button>
              <button
                onClick={() => {
                  setSearchText('')
                  setSelectedAction('')
                  setSelectedUserId('')
                }}
                className="flex-1 rounded-xl border px-3 py-2 text-xs font-semibold text-white/65 border-white/15 bg-white/5"
              >
                Clear
              </button>
            </div>
          </div>
        </div>

        <p className="text-xs text-white/35 mb-3">
          Showing {logs.length} of {totalLogs} logs · Page {currentPage + 1} of {Math.max(totalPages, 1)}
        </p>

        <div className="ui-card overflow-hidden">
          {loading ? (
            <div className="py-16 flex justify-center">
              <div className="w-7 h-7 rounded-full animate-spin border-2 border-white/15 border-t-brand-orange" />
            </div>
          ) : logs.length === 0 ? (
            <div className="py-16 text-center text-white/45 text-sm">No audit logs found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-white/45 text-xs uppercase tracking-wider">
                    <th className="text-left px-4 py-3 font-semibold">Action</th>
                    <th className="text-left px-4 py-3 font-semibold">User</th>
                    <th className="text-left px-4 py-3 font-semibold">Details</th>
                    <th className="text-left px-4 py-3 font-semibold">IP Address</th>
                    <th className="text-left px-4 py-3 font-semibold">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-2 px-2 py-1 rounded-md text-[11px] font-semibold" style={chipStyle(log.action)}>
                          {ACTION_ICONS[log.action] || 'EVENT'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-white/90">{getUserName(log.user_id)}</td>
                      <td className="px-4 py-3 text-white/60 max-w-[320px] truncate">{log.detail || '-'}</td>
                      <td className="px-4 py-3 text-white/50 font-mono text-xs">{log.ip_address || '-'}</td>
                      <td className="px-4 py-3 text-white/45 text-xs"><RelativeTime iso={log.created_at} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-5">
            <button
              onClick={() => loadPage(currentPage - 1)}
              disabled={currentPage === 0}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-white/15 bg-white/5 text-white/70 disabled:opacity-35"
            >
              Prev
            </button>
            {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => (
              <button
                key={i}
                onClick={() => loadPage(i)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                  currentPage === i
                    ? 'border-brand-orange/45 bg-brand-orange/15 text-brand-orange-light'
                    : 'border-white/15 bg-white/5 text-white/65'
                }`}
              >
                {i + 1}
              </button>
            ))}
            <button
              onClick={() => loadPage(currentPage + 1)}
              disabled={currentPage >= totalPages - 1}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-white/15 bg-white/5 text-white/70 disabled:opacity-35"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
