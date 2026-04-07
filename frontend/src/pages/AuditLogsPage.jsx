import { useState, useEffect, useCallback } from "react"
import AppLayout from "../components/AppLayout"
import { useAuth } from "../context/AuthContext"
import { useRelativeTime } from "../hooks/useRelativeTime"
import { getAuditLogs, getAuditLogActions, exportAuditLogs } from "../services/auditLogService"
import { adminGetUsers } from "../services/adminService"

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ACTION_ICONS = {
  login: "[LOGIN]",
  logout: "[LOGOUT]",
  register: "[REG]",
  api_key_created: "[API-KEY]",
  api_key_revoked: "[REVOKE]",
  settings_updated: "[SETTINGS]",
  profile_updated: "[PROFILE]",
  role_changed: "[ROLE]",
  role_request: "[REQUEST]",
  bulk_delete_users: "[DELETE]",
  user_created: "[CREATE]",
  user_deleted: "[REMOVE]",
  user_activated: "[ACTIVE]",
  user_deactivated: "[INACTIVE]",
  role_approved: "[APPROVE]",
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
  return <span>{relativeTime || "..."}</span>
}

export default function AuditLogsPage() {
  const { user } = useAuth()
  const [logs, setLogs] = useState([])
  const [allUsers, setAllUsers] = useState([])
  const [actions, setActions] = useState([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  // Filters
  const [searchText, setSearchText] = useState("")
  const [selectedAction, setSelectedAction] = useState("")
  const [selectedUserId, setSelectedUserId] = useState("")
  const [sortBy, setSortBy] = useState("recent")

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
      console.error("Failed to load audit logs:", err)
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
      console.error("Filter failed:", err)
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
        console.error("Pagination failed:", err)
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
      const a = document.createElement("a")
      a.href = url
      a.download = `audit-logs-${ new Date().toISOString().slice(0, 10) }.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error("Export failed:", err)
    } finally {
      setExporting(false)
    }
  }

  // Get user name by ID
  const getUserName = (userId) => {
    const u = allUsers.find((x) => x.id === userId)
    return u ? u.nom : "Unknown User"
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

  return (
    <AppLayout>
      <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "20px" }}>
        {/* Header */}
        <div className="mb-8">
          <h1 style={{ fontSize: "26px", fontWeight: "700", color: "white", marginBottom: "8px" }}>
            Audit Logs
          </h1>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "14px" }}>
            Complete history of all system activities · Auto-cleaned after 2 weeks
          </p>
        </div>

        {/* Filters */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr auto auto",
            gap: "12px",
            marginBottom: "24px",
          }}
        >
          {/* Search */}
          <div>
            <label style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", display: "block", marginBottom: "6px" }}>
              Search Details
            </label>
            <input
              type="text"
              placeholder="Search by IP, email, or action details..."
              value={ searchText }
              onChange={ (e) => setSearchText(e.target.value) }
              style={{
                width: "100%",
                padding: "8px 12px",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "6px",
                color: "white",
                fontSize: "13px",
              }}
            />
          </div>

          {/* Action Filter */}
          <div>
            <label style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", display: "block", marginBottom: "6px" }}>
              Action Type
            </label>
            <select
              value={ selectedAction }
              onChange={ (e) => setSelectedAction(e.target.value) }
              style={{
                width: "100%",
                padding: "8px 12px",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "6px",
                color: "white",
                fontSize: "13px",
              }}
            >
              <option value="">All Actions</option>
              { actions.map((act) => (
                <option key={ act } value={ act }>
                  { ACTION_ICONS[act] || "•" } { act }
                </option>
              )) }
            </select>
          </div>

          {/* User Filter */}
          <div>
            <label style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", display: "block", marginBottom: "6px" }}>
              User
            </label>
            <select
              value={ selectedUserId }
              onChange={ (e) => setSelectedUserId(e.target.value) }
              style={{
                width: "100%",
                padding: "8px 12px",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "6px",
                color: "white",
                fontSize: "13px",
              }}
            >
              <option value="">All Users</option>
              { allUsers.map((u) => (
                <option key={ u.id } value={ u.id }>
                  { u.nom } ({ u.email })
                </option>
              )) }
            </select>
          </div>

          {/* Export */}
          <button
            onClick={ handleExport }
            disabled={ exporting || logs.length === 0 }
            style={{
              padding: "8px 16px",
              background: exporting ? "rgba(255,107,43,0.5)" : "rgba(255,107,43,0.15)",
              border: "1px solid rgba(255,107,43,0.3)",
              borderRadius: "6px",
              color: "#FF8C5A",
              cursor: exporting ? "wait" : "pointer",
              fontSize: "13px",
              fontWeight: "600",
              marginTop: "20px",
              transition: "all 0.2s",
            }}
          >
            { exporting ? "Exporting..." : "Download CSV" }
          </button>

          {/* Clear */}
          <button
            onClick={ () => {
              setSearchText("")
              setSelectedAction("")
              setSelectedUserId("")
            } }
            style={{
              padding: "8px 16px",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "6px",
              color: "rgba(255,255,255,0.6)",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: "600",
              marginTop: "20px",
              transition: "all 0.2s",
            }}
            onMouseEnter={ (e) => {
              e.target.style.background = "rgba(255,255,255,0.1)"
              e.target.style.color = "rgba(255,255,255,0.8)"
            } }
            onMouseLeave={ (e) => {
              e.target.style.background = "rgba(255,255,255,0.05)"
              e.target.style.color = "rgba(255,255,255,0.6)"
            } }
          >
            Clear
          </button>
        </div>

        {/* Stats */}
        <div style={{ marginBottom: "20px" }}>
          <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "12px" }}>
            Showing { logs.length } of { totalLogs } logs · Page { currentPage + 1 } of { totalPages }
          </p>
        </div>

        {/* Logs Table */}
        { loading ? (
          <p style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", padding: "40px" }}>
            Loading audit logs...
          </p>
        ) : logs.length === 0 ? (
          <p style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", padding: "40px" }}>
            No audit logs found
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "13px",
              }}
            >
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                  <th style={{ padding: "12px", textAlign: "left", color: "rgba(255,255,255,0.4)", fontWeight: "600" }}>
                    Action
                  </th>
                  <th style={{ padding: "12px", textAlign: "left", color: "rgba(255,255,255,0.4)", fontWeight: "600" }}>
                    User
                  </th>
                  <th style={{ padding: "12px", textAlign: "left", color: "rgba(255,255,255,0.4)", fontWeight: "600" }}>
                    Details
                  </th>
                  <th style={{ padding: "12px", textAlign: "left", color: "rgba(255,255,255,0.4)", fontWeight: "600" }}>
                    IP Address
                  </th>
                  <th style={{ padding: "12px", textAlign: "left", color: "rgba(255,255,255,0.4)", fontWeight: "600" }}>
                    Time
                  </th>
                </tr>
              </thead>
              <tbody>
                { logs.map((log) => (
                  <tr
                    key={ log.id }
                    style={{
                      borderBottom: "1px solid rgba(255,255,255,0.05)",
                      transition: "background 0.2s",
                    }}
                    onMouseEnter={ (e) => {
                      e.currentTarget.style.background = "rgba(255,255,255,0.02)"
                    } }
                    onMouseLeave={ (e) => {
                      e.currentTarget.style.background = "transparent"
                    } }
                  >
                    <td style={{ padding: "12px" }}>
                      <span
                        style={{
                          padding: "4px 8px",
                          borderRadius: "4px",
                          background: ACTION_COLORS[log.action]
                            ? `${ ACTION_COLORS[log.action] }15`
                            : "rgba(255,255,255,0.05)",
                          color: ACTION_COLORS[log.action] || "rgba(255,255,255,0.7)",
                          fontSize: "12px",
                          fontWeight: "600",
                        }}
                      >
                        { ACTION_ICONS[log.action] || "•" } { log.action }
                      </span>
                    </td>
                    <td style={{ padding: "12px", color: "white" }}>
                      { getUserName(log.user_id) }
                    </td>
                    <td style={{ padding: "12px", color: "rgba(255,255,255,0.6)", maxWidth: "300px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      { log.detail || "-" }
                    </td>
                    <td style={{ padding: "12px", color: "rgba(255,255,255,0.5)", fontFamily: "monospace", fontSize: "11px" }}>
                      { log.ip_address || "-" }
                    </td>
                    <td style={{ padding: "12px", color: "rgba(255,255,255,0.4)" }}>
                      <RelativeTime iso={ log.created_at } />
                    </td>
                  </tr>
                )) }
              </tbody>
            </table>
          </div>
        ) }

        {/* Pagination */}
        { totalPages > 1 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              marginTop: "24px",
            }}
          >
            <button
              onClick={ () => loadPage(currentPage - 1) }
              disabled={ currentPage === 0 }
              style={{
                padding: "6px 12px",
                background: currentPage === 0 ? "rgba(255,255,255,0.05)" : "rgba(255,107,43,0.1)",
                border: "1px solid rgba(255,107,43,0.2)",
                borderRadius: "4px",
                color: currentPage === 0 ? "rgba(255,255,255,0.3)" : "#FF8C5A",
                cursor: currentPage === 0 ? "default" : "pointer",
                fontSize: "12px",
                fontWeight: "600",
              }}
            >
              ← Previous
            </button>

            { Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
              const pageNum = i
              return (
                <button
                  key={ pageNum }
                  onClick={ () => loadPage(pageNum) }
                  style={{
                    padding: "6px 12px",
                    background: currentPage === pageNum ? "rgba(255,107,43,0.2)" : "rgba(255,255,255,0.05)",
                    border:
                      currentPage === pageNum ? "1px solid rgba(255,107,43,0.5)" : "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "4px",
                    color: currentPage === pageNum ? "#FF8C5A" : "rgba(255,255,255,0.6)",
                    cursor: "pointer",
                    fontSize: "12px",
                    fontWeight: "600",
                  }}
                >
                  { pageNum + 1 }
                </button>
              )
            }) }

            <button
              onClick={ () => loadPage(currentPage + 1) }
              disabled={ currentPage >= totalPages - 1 }
              style={{
                padding: "6px 12px",
                background: currentPage >= totalPages - 1 ? "rgba(255,255,255,0.05)" : "rgba(255,107,43,0.1)",
                border: "1px solid rgba(255,107,43,0.2)",
                borderRadius: "4px",
                color: currentPage >= totalPages - 1 ? "rgba(255,255,255,0.3)" : "#FF8C5A",
                cursor: currentPage >= totalPages - 1 ? "default" : "pointer",
                fontSize: "12px",
                fontWeight: "600",
              }}
            >
              Next →
            </button>
          </div>
        ) }
      </div>
    </AppLayout>
  )
}
