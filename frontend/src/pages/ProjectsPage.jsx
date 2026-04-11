import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import AppLayout from '../components/AppLayout'
import {
  getDevProjects,
  getAdminProjects,
  getSecurityManagerProjects,
  deleteProject,
  deleteAdminProject,
  setAdminProjectStatus,
} from '../services/projectService'
import { can, PERMISSIONS } from '../utils/permissions'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

function formatDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

const RISK_COLOR = {
  Low: '#22c55e',
  Medium: '#f59e0b',
  High: '#ef4444',
}

const STATUS_STYLE = {
  active: {
    label: 'Active',
    color: '#22c55e',
    bg: 'rgba(34,197,94,0.1)',
    border: 'rgba(34,197,94,0.25)',
  },
  archived: {
    label: 'Archived',
    color: '#9ca3af',
    bg: 'rgba(156,163,175,0.08)',
    border: 'rgba(156,163,175,0.18)',
  },
}

const SCAN_STATUS_STYLE = {
  completed: { label: 'Completed', color: '#22c55e', bg: 'rgba(34,197,94,0.10)', border: 'rgba(34,197,94,0.25)' },
  running: { label: 'Running', color: '#f59e0b', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.30)' },
  pending: { label: 'Pending', color: '#60a5fa', bg: 'rgba(96,165,250,0.10)', border: 'rgba(96,165,250,0.30)' },
  failed: { label: 'Failed', color: '#ef4444', bg: 'rgba(239,68,68,0.10)', border: 'rgba(239,68,68,0.25)' },
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ title, description, actionLabel, onAction }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: 'rgba(255,107,43,0.08)', border: '1px solid rgba(255,107,43,0.12)' }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FF6B2B" strokeWidth="1.8">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-white mb-1">{title}</h3>
      <p className="text-sm text-white/50 mb-6 max-w-xs">{description}</p>
      {onAction && (
        <button
          onClick={onAction}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-lg active:scale-[0.97]"
          style={{ background: 'linear-gradient(135deg,#FF6B2B,#C13A00)', boxShadow: '0 4px 16px rgba(255,107,43,0.3)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14M5 12h14" />
          </svg>
          {actionLabel}
        </button>
      )}
    </div>
  )
}

// ─── Developer row ────────────────────────────────────────────────────────────

function SevPill({ n, c, label }) {
  return (
    <span
      className="flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded"
      style={{ background: `${c}15`, color: c, border: `1px solid ${c}30` }}
    >
      {n} {label}
    </span>
  )
}

function ProjectRow({ project, deleting, onClick, onDelete }) {
  const userRoleBadge = project.user_role && project.user_role !== 'owner'
  return (
    <div
      onClick={onClick}
      className="group flex items-center justify-between px-5 py-4 rounded-2xl cursor-pointer transition-all"
      style={{
        background: 'linear-gradient(170deg, rgba(255,255,255,0.025), rgba(255,255,255,0.008))',
        border: '1px solid rgba(255,255,255,0.055)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'rgba(255,107,43,0.15)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'
      }}
    >
      <div className="flex items-center gap-4 min-w-0">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(255,107,43,0.08)', border: '1px solid rgba(255,107,43,0.12)' }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#FF6B2B" strokeWidth="1.8">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-white font-semibold text-sm truncate">{project.name}</p>
            {userRoleBadge && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0"
                style={{
                  background: project.user_role === 'editor' ? 'rgba(255,107,43,0.1)' : 'rgba(107,114,128,0.1)',
                  color: project.user_role === 'editor' ? '#FF8C5A' : '#9ca3af',
                }}
              >
                {project.user_role}
              </span>
            )}
          </div>
          <p className="text-[11px] text-white/40">{project.description || 'No description'}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          {project.critical > 0 && <SevPill n={project.critical} c="#f87171" label="crit" />}
          {project.high > 0 && <SevPill n={project.high} c="#fb923c" label="high" />}
          {project.medium > 0 && <SevPill n={project.medium} c="#eab308" label="med" />}
          {project.low > 0 && <SevPill n={project.low} c="#60a5fa" label="low" />}
        </div>
        {onDelete && (
          <button
            onClick={onDelete}
            disabled={deleting}
            className="opacity-0 group-hover:opacity-100 px-3 py-1.5 rounded text-xs font-semibold transition-all active:scale-95 disabled:opacity-50"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.12)', color: '#ef4444' }}
            title="Delete project"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Admin components ─────────────────────────────────────────────────────────

function SummaryCard({ label, value, sub, accent }) {
  return (
    <div
      className="rounded-2xl px-5 py-4 flex flex-col gap-1.5"
      style={{
        background: 'linear-gradient(170deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
        border: '1px solid rgba(255,255,255,0.06)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 8px 22px rgba(0,0,0,0.22)',
      }}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/30">{label}</p>
      <p className="text-3xl font-bold leading-none" style={{ color: accent || '#fff' }}>{value}</p>
      <p className="text-xs text-white/35">{sub}</p>
    </div>
  )
}

function StatusBadge({ status }) {
  const cfg = STATUS_STYLE[status] || STATUS_STYLE.archived
  return (
    <span
      className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
    >
      {cfg.label}
    </span>
  )
}

function RiskBadge({ risk }) {
  const color = RISK_COLOR[risk] || '#9ca3af'
  return (
    <span
      className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
      style={{ background: `${color}1A`, color, border: `1px solid ${color}33` }}
    >
      {risk}
    </span>
  )
}

function AdminProjectRow({ project, deleting, toggling, onView, onDelete, onToggleStatus, onManageMembers }) {
  const status = project.status || 'archived'
  const nextAction = status === 'active' ? 'Disable' : 'Enable'

  return (
    <div
      className="rounded-2xl px-5 py-4 transition-all"
      style={{
        background: 'linear-gradient(170deg, rgba(255,255,255,0.025), rgba(255,255,255,0.008))',
        border: '1px solid rgba(255,255,255,0.055)',
      }}
    >
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <p className="text-white font-semibold text-sm truncate">{project.name}</p>
            <StatusBadge status={status} />
            <RiskBadge risk={project.global_risk_level} />
          </div>
          <p className="text-[11px] text-white/40">Owner: {project.owner_name}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <MetaPill label="Users" value={project.users_assigned_count} />
            <MetaPill label="Scans" value={project.total_scans} />
            <MetaPill label="Created" value={formatDate(project.created_at)} />
            <MetaPill label="Last Activity" value={formatDate(project.last_activity_at)} />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap lg:justify-end">
          <button
            onClick={onView}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={{ background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.3)', color: '#60a5fa' }}
          >
            View
          </button>
          <button
            onClick={onManageMembers}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={{ background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.3)', color: '#a78bfa' }}
          >
            Members
          </button>
          <button
            onClick={onToggleStatus}
            disabled={toggling}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
            style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b' }}
          >
            {nextAction}
          </button>
          <button
            onClick={onDelete}
            disabled={deleting}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

function MetaPill({ label, value }) {
  return (
    <span
      className="text-[10px] px-2 py-0.5 rounded font-medium"
      style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.65)', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      {label}: <span className="text-white">{value}</span>
    </span>
  )
}

function ScanStatusBadge({ status }) {
  const cfg = SCAN_STATUS_STYLE[status] || {
    label: (status || 'No Scan').replace('_', ' '),
    color: '#9ca3af',
    bg: 'rgba(156,163,175,0.10)',
    border: 'rgba(156,163,175,0.25)',
  }

  return (
    <span
      className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
    >
      {cfg.label}
    </span>
  )
}

function SecurityProjectRow({ project, onView }) {
  return (
    <div
      className="rounded-2xl px-5 py-4 transition-all"
      style={{
        background: 'linear-gradient(170deg, rgba(255,255,255,0.025), rgba(255,255,255,0.008))',
        border: '1px solid rgba(255,255,255,0.055)',
      }}
    >
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <p className="text-white font-semibold text-sm truncate">{project.name}</p>
            <RiskBadge risk={project.global_risk_level} />
            <ScanStatusBadge status={project.last_scan_status} />
          </div>
          <p className="text-[11px] text-white/40">Owner: {project.owner_name}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <MetaPill label="Scans" value={project.total_scans} />
            <MetaPill label="Risk" value={`${Number(project.risk_score || 0).toFixed(1)}/10`} />
            <MetaPill label="Critical" value={project.critical || 0} />
            <MetaPill label="High" value={project.high || 0} />
            <MetaPill label="Created" value={formatDate(project.created_at)} />
            <MetaPill label="Last Activity" value={formatDate(project.last_activity_at)} />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap lg:justify-end">
          <button
            onClick={onView}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={{ background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.3)', color: '#60a5fa' }}
          >
            Security View
          </button>
        </div>
      </div>
    </div>
  )
}

function AdminProjectOverviewModal({ project, onClose }) {
  if (!project) return null

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="rounded-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto"
        style={{
          background: 'linear-gradient(170deg, rgba(20,20,20,0.96), rgba(15,15,15,0.93))',
          border: '1px solid rgba(255,107,43,0.3)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 60px rgba(255,107,43,0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Project Overview</h3>
            <p className="text-xs text-white/40 mt-1">High-level management information</p>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}
          >
            Close
          </button>
        </div>

        <div className="p-6 flex flex-col gap-3 text-sm">
          <InfoLine label="Name" value={project.name} />
          <InfoLine label="Owner" value={project.owner_name} />
          <InfoLine label="Users Assigned" value={project.users_assigned_count} />
          <InfoLine label="Total Scans" value={project.total_scans} />
          <InfoLine label="Global Risk" value={project.global_risk_level} />
          <InfoLine label="Status" value={project.status} />
          <InfoLine label="Created At" value={formatDate(project.created_at)} />
          <InfoLine label="Last Activity" value={formatDate(project.last_activity_at)} />
        </div>
      </div>
    </div>
  )
}

function InfoLine({ label, value }) {
  return (
    <div className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <span className="text-white/50">{label}</span>
      <span className="text-white font-medium">{value}</span>
    </div>
  )
}

// ─── Main Projects Page ───────────────────────────────────────────────────────

export default function ProjectsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const isAdmin = user?.role_name === 'Admin'
  const isSecurityManager = user?.role_name === 'Security Manager'
  const canRunScan = can(user?.role_name, PERMISSIONS.RUN_SCAN)
  const canDeleteProjects = can(user?.role_name, PERMISSIONS.MANAGE_OWN_PROJECTS)

  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState(null)
  const [togglingId, setTogglingId] = useState(null)
  const [viewingProject, setViewingProject] = useState(null)
  const [summary, setSummary] = useState({
    total_projects: 0,
    active_projects: 0,
    archived_projects: 0,
    total_users_involved: 0,
  })
  const [securitySummary, setSecuritySummary] = useState({
    total_projects: 0,
    projects_with_findings: 0,
    critical_projects: 0,
    avg_risk_score: 0,
  })

  const load = async () => {
    setLoading(true)
    try {
      if (isAdmin) {
        const payload = await getAdminProjects()
        setProjects(payload?.projects || [])
        setSummary(payload?.summary || {
          total_projects: 0,
          active_projects: 0,
          archived_projects: 0,
          total_users_involved: 0,
        })
      } else if (isSecurityManager) {
        const payload = await getSecurityManagerProjects()
        setProjects(payload?.projects || [])
        setSecuritySummary(payload?.summary || {
          total_projects: 0,
          projects_with_findings: 0,
          critical_projects: 0,
          avg_risk_score: 0,
        })
      } else {
        const proj = await getDevProjects()
        setProjects(proj)
      }
    } catch (err) {
      console.error('Projects page error:', err)
      setProjects([])
      if (isAdmin) {
        setSummary({
          total_projects: 0,
          active_projects: 0,
          archived_projects: 0,
          total_users_involved: 0,
        })
      } else if (isSecurityManager) {
        setSecuritySummary({
          total_projects: 0,
          projects_with_findings: 0,
          critical_projects: 0,
          avg_risk_score: 0,
        })
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [isAdmin, isSecurityManager])

  const handleDelete = async (e, id) => {
    e.stopPropagation()
    if (!isAdmin && !canDeleteProjects) return
    if (!confirm('Delete this project?')) return

    setDeletingId(id)
    try {
      if (isAdmin) {
        await deleteAdminProject(id)
        await load()
      } else {
        await deleteProject(id)
        setProjects((prev) => prev.filter((p) => p.id !== id))
      }
    } finally {
      setDeletingId(null)
    }
  }

  const handleToggleStatus = async (e, project) => {
    e.stopPropagation()
    const nextStatus = project.status === 'active' ? 'archived' : 'active'

    setTogglingId(project.id)
    try {
      await setAdminProjectStatus(project.id, nextStatus)
      await load()
    } finally {
      setTogglingId(null)
    }
  }

  return (
    <>
      <AppLayout>
        <main className="flex-1 overflow-auto">
          <div className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
            <div className="mb-6 animate-slide-up flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight">
                  {getGreeting()}, <span style={{ color: '#FF8C5A' }}>{user?.nom?.split(' ')[0]}</span>
                </h1>
                <p className="text-sm text-white/45 mt-2">
                  {loading
                    ? 'Loading projects...'
                    : isAdmin
                      ? `${summary.total_projects} project${summary.total_projects !== 1 ? 's' : ''} under governance`
                      : isSecurityManager
                        ? `${securitySummary.total_projects} project${securitySummary.total_projects !== 1 ? 's' : ''} in security oversight`
                      : `${projects.length} project${projects.length !== 1 ? 's' : ''} in your workspace`}
                </p>
              </div>
            </div>

            {isAdmin && !loading && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6 animate-slide-up" style={{ animationDelay: '0.04s' }}>
                <SummaryCard label="Total Projects" value={summary.total_projects} sub="all projects" />
                <SummaryCard label="Active" value={summary.active_projects} sub="enabled projects" accent="#22c55e" />
                <SummaryCard label="Archived" value={summary.archived_projects} sub="disabled projects" accent="#9ca3af" />
                <SummaryCard label="Users Involved" value={summary.total_users_involved} sub="owners + members" accent="#60a5fa" />
              </div>
            )}

            {isSecurityManager && !loading && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6 animate-slide-up" style={{ animationDelay: '0.04s' }}>
                <SummaryCard label="Total Projects" value={securitySummary.total_projects} sub="under monitoring" />
                <SummaryCard label="With Findings" value={securitySummary.projects_with_findings} sub="latest completed scans" accent="#f59e0b" />
                <SummaryCard label="Critical Projects" value={securitySummary.critical_projects} sub="require immediate attention" accent="#ef4444" />
                <SummaryCard label="Avg Risk" value={`${Number(securitySummary.avg_risk_score || 0).toFixed(1)}/10`} sub="portfolio risk score" accent="#60a5fa" />
              </div>
            )}

            <div className="animate-slide-up" style={{ animationDelay: isAdmin ? '0.08s' : '0.04s' }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-white/30">
                  {isAdmin ? 'Projects Governance' : isSecurityManager ? 'Security Portfolio' : 'All Projects'}
                </h2>

                {!isAdmin && canRunScan && (
                  <button
                    onClick={() => navigate('/scans/new')}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-lg active:scale-[0.97]"
                    style={{ background: 'linear-gradient(135deg,#FF6B2B,#C13A00)', boxShadow: '0 4px 16px rgba(255,107,43,0.3)' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                    New Scan
                  </button>
                )}
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <div
                    className="w-6 h-6 rounded-full animate-spin"
                    style={{ border: '2px solid rgba(255,107,43,0.2)', borderTop: '2px solid #FF6B2B' }}
                  />
                </div>
              ) : projects.length === 0 ? (
                <EmptyState
                  title={isAdmin ? 'No projects in the platform' : isSecurityManager ? 'No monitored projects yet' : 'No projects yet'}
                  description={
                    isAdmin
                      ? 'Projects will appear here as users create them. You can then manage members, status, and lifecycle.'
                      : isSecurityManager
                        ? 'Projects with security access will appear here. Use this view to prioritize risk and findings.'
                      : 'Launch your first scan to create a project. Projects help you organize and track your security findings.'
                  }
                  actionLabel="Launch New Scan"
                  onAction={!isAdmin && !isSecurityManager && canRunScan ? () => navigate('/scans/new') : null}
                />
              ) : isAdmin ? (
                <div className="flex flex-col gap-3">
                  {projects.map((p) => (
                    <AdminProjectRow
                      key={p.id}
                      project={p}
                      deleting={deletingId === p.id}
                      toggling={togglingId === p.id}
                      onView={() => setViewingProject(p)}
                      onManageMembers={() => navigate(`/projects/${p.id}/members`)}
                      onToggleStatus={(e) => handleToggleStatus(e, p)}
                      onDelete={(e) => handleDelete(e, p.id)}
                    />
                  ))}
                </div>
              ) : isSecurityManager ? (
                <div className="flex flex-col gap-3">
                  {projects.map((p) => (
                    <SecurityProjectRow
                      key={p.id}
                      project={p}
                      onView={() => navigate(`/projects/${p.id}`)}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {projects.map((p) => (
                    <ProjectRow
                      key={p.id}
                      project={p}
                      deleting={deletingId === p.id}
                      onClick={() => navigate(`/projects/${p.id}`)}
                      onDelete={canDeleteProjects ? (e) => handleDelete(e, p.id) : null}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>
      </AppLayout>

      {isAdmin && viewingProject && (
        <AdminProjectOverviewModal project={viewingProject} onClose={() => setViewingProject(null)} />
      )}
    </>
  )
}
