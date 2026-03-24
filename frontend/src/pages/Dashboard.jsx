import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import AppLayout from '../components/AppLayout'
import RoleRequestModal from '../components/RoleRequestModal'
import { getProjects, deleteProject, getDashboardStats } from '../services/projectService'
import { getMe } from '../services/authService'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

const SEV_COLORS = {
  critical: '#f87171',
  high:     '#fb923c',
  medium:   '#eab308',
  low:      '#60a5fa',
  info:     '#6b7280',
}

const STATUS_CONFIG = {
  completed: { label: 'Completed', color: '#22c55e', bg: 'rgba(34,197,94,0.08)'  },
  running:   { label: 'Running',   color: '#FF6B2B', bg: 'rgba(255,107,43,0.08)' },
  pending:   { label: 'Pending',   color: '#eab308', bg: 'rgba(234,179,8,0.08)'  },
  failed:    { label: 'Failed',    color: '#ef4444', bg: 'rgba(239,68,68,0.08)'  },
}

// ─── Score ring ───────────────────────────────────────────────────────────────

function ScoreRing({ score }) {
  const r = 42
  const circ = 2 * Math.PI * r
  const pct  = Math.max(0, Math.min(100, score))
  const dash = (pct / 100) * circ
  const color = pct >= 80 ? '#22c55e' : pct >= 50 ? '#eab308' : pct >= 25 ? '#fb923c' : '#f87171'
  const label = pct >= 80 ? 'Good' : pct >= 50 ? 'Fair' : pct >= 25 ? 'At Risk' : 'Critical'
  return (
    <div className="flex flex-col items-center justify-center gap-1">
      <svg width="110" height="110" viewBox="0 0 110 110">
        <circle cx="55" cy="55" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
        <circle
          cx="55" cy="55" r={r} fill="none"
          stroke={color} strokeWidth="10"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 55 55)"
          style={{ transition: 'stroke-dasharray 0.8s ease' }}
        />
        <text x="55" y="50" textAnchor="middle" fill="white" fontSize="20" fontWeight="700" dy=".1em">{pct}</text>
        <text x="55" y="68" textAnchor="middle" fill={color} fontSize="9" fontWeight="600">{label}</text>
      </svg>
      <p className="text-xs text-white/30 mt-1">Security Score</p>
    </div>
  )
}

// ─── Severity donut ───────────────────────────────────────────────────────────

function SeverityDonut({ bySev }) {
  const entries = Object.entries(SEV_COLORS).map(([k, c]) => ({ key: k, color: c, count: bySev[k] || 0 }))
  const total = entries.reduce((s, e) => s + e.count, 0)
  if (total === 0) {
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="w-[80px] h-[80px] rounded-full flex items-center justify-center"
          style={{ border: '10px solid rgba(34,197,94,0.2)' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <p className="text-xs text-white/30">No findings</p>
      </div>
    )
  }
  const r = 32; const circ = 2 * Math.PI * r
  let offset = 0
  const slices = entries.filter(e => e.count > 0).map(e => {
    const pct = e.count / total
    const len = pct * circ
    const slice = { ...e, offset, len }
    offset += len
    return slice
  })
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <svg width="90" height="90" viewBox="0 0 90 90">
          {slices.map((s, i) => (
            <circle key={i} cx="45" cy="45" r={r} fill="none"
              stroke={s.color} strokeWidth="14"
              strokeDasharray={`${s.len} ${circ - s.len}`}
              strokeDashoffset={-s.offset + circ / 4}
              transform="rotate(-90 45 45)"
            />
          ))}
          <text x="45" y="45" textAnchor="middle" fill="white" fontSize="14" fontWeight="700" dy=".35em">{total}</text>
        </svg>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center">
        {entries.filter(e => e.count > 0).map(e => (
          <span key={e.key} className="flex items-center gap-1 text-[11px]" style={{ color: e.color }}>
            <span className="w-2 h-2 rounded-full inline-block flex-shrink-0" style={{ background: e.color }} />
            {e.count} {e.key}
          </span>
        ))}
      </div>
    </div>
  )
}

// ─── Trend bars ───────────────────────────────────────────────────────────────

function TrendBars({ trend }) {
  const max = Math.max(...trend.map(d => d.count), 1)
  const show = trend.filter((_, i) => i % 2 === 0 || trend.length <= 10)
  return (
    <div className="w-full">
      <div className="flex items-end gap-1 h-24">
        {trend.map((d, i) => {
          const pct = d.count / max
          const height = Math.max(pct * 88, d.count > 0 ? 6 : 2)
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-0.5 group relative">
              {/* Tooltip */}
              {d.count > 0 && (
                <div className="absolute bottom-full mb-1 hidden group-hover:flex items-center justify-center z-10 pointer-events-none">
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded whitespace-nowrap"
                    style={{ background: '#222', color: '#FF8C5A', border: '1px solid rgba(255,107,43,0.3)' }}>
                    {d.count}
                  </span>
                </div>
              )}
              <div
                className="w-full rounded-t transition-all duration-300"
                style={{
                  height: `${height}px`,
                  background: d.count > 0
                    ? 'linear-gradient(180deg,#FF6B2B,rgba(255,107,43,0.3))'
                    : 'rgba(255,255,255,0.04)',
                }}
              />
            </div>
          )
        })}
      </div>
      {/* X axis labels — show every 4 */}
      <div className="flex gap-1 mt-1.5">
        {trend.map((d, i) => (
          <div key={i} className="flex-1 flex justify-center">
            {i % 4 === 0 && (
              <span className="text-[9px] text-white/20 whitespace-nowrap">{d.date.split(' ')[1]}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, accent }) {
  return (
    <div className="rounded-2xl px-5 py-4 flex flex-col gap-1"
      style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.06)' }}>
      <p className="text-xs font-semibold uppercase tracking-widest text-white/25">{label}</p>
      <p className="text-3xl font-bold" style={{ color: accent || '#fff' }}>{value}</p>
      {sub && <p className="text-xs text-white/25">{sub}</p>}
    </div>
  )
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { label: status || 'No scans', color: '#6b7280', bg: 'rgba(107,114,128,0.08)' }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
      style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}30` }}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: cfg.color }} />
      {cfg.label}
    </span>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const { user, updateUser } = useAuth()
  const navigate  = useNavigate()

  const [projects,      setProjects]      = useState([])
  const [stats,         setStats]         = useState(null)
  const [loading,       setLoading]       = useState(true)
  const [deletingId,    setDeletingId]    = useState(null)
  const [showRoleModal, setShowRoleModal] = useState(false)

  const load = async () => {
    try {
      const [proj, st, freshUser] = await Promise.all([getProjects(), getDashboardStats(), getMe()])
      setProjects(proj)
      setStats(st)
      if (freshUser) updateUser(freshUser)
    } catch {
      setProjects([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleDelete = async (e, id) => {
    e.stopPropagation()
    if (!confirm('Delete this project?')) return
    setDeletingId(id)
    try {
      await deleteProject(id)
      setProjects(prev => prev.filter(p => p.id !== id))
      setStats(prev => prev ? { ...prev, total_projects: prev.total_projects - 1 } : prev)
    } finally {
      setDeletingId(null)
    }
  }

  const bySev = stats?.by_severity || {}
  const hasSev = stats && Object.values(bySev).some(v => v > 0)
  const scoreColor = !stats ? '#6b7280'
    : stats.security_score >= 80 ? '#22c55e'
    : stats.security_score >= 50 ? '#eab308'
    : stats.security_score >= 25 ? '#fb923c'
    : '#f87171'

  return (
    <>
    <AppLayout>
      <main className="flex-1 overflow-auto">
        <div className="px-8 py-8">

          {/* Header */}
          <div className="mb-8 animate-slide-up">
            <h1 className="text-2xl font-bold text-white">
              {getGreeting()},{' '}
              <span style={{ color: '#FF6B2B' }}>{user?.nom?.split(' ')[0]}</span>
            </h1>
            <p className="text-sm text-white/30 mt-1">
              {loading ? 'Loading workspace...' : `${projects.length} project${projects.length !== 1 ? 's' : ''} in your workspace`}
            </p>
          </div>

          {/* VIEWER Trial Info Banner */}
          {user?.role_name === 'Viewer' && (user?.trial_scans_remaining ?? 0) > 0 && (
            <div className="mb-6 animate-slide-up rounded-2xl p-5 flex items-center justify-between"
              style={{ background: 'linear-gradient(135deg, rgba(255,107,43,0.08), rgba(255,107,43,0.04))', border: '1px solid rgba(255,107,43,0.2)' }}>
              <div>
                <p className="text-sm font-semibold text-white mb-1">Try InvisiThreat Risk-Free</p>
                <p className="text-xs text-white/60">
                  You have <span className="text-brand-orange font-semibold">{user?.trial_scans_remaining ?? 0} trial scan{(user?.trial_scans_remaining ?? 0) !== 1 ? 's' : ''}</span> remaining. Request a Developer role for unlimited scanning.
                </p>
              </div>
              <button
                onClick={() => setShowRoleModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white flex-shrink-0 transition-all hover:shadow-lg active:scale-[0.97]"
                style={{ background: 'linear-gradient(135deg,#FF6B2B,#C13A00)', boxShadow: '0 4px 16px rgba(255,107,43,0.3)' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5" />
                  <path d="M12 5v9" />
                  <path d="M9 11h6" />
                </svg>
                Request Role
              </button>
            </div>
          )}

          {/* ── KPI row ────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6 animate-slide-up" style={{ animationDelay: '0.04s' }}>
            <KpiCard label="Projects"      value={loading ? '—' : stats?.total_projects ?? 0}  sub="in workspace" />
            <KpiCard label="Total Scans"   value={loading ? '—' : stats?.total_scans ?? 0}     sub="all time" />
            <KpiCard label="Active Scans"  value={loading ? '—' : stats?.active_scans ?? 0}    sub="running / pending" accent={stats?.active_scans > 0 ? '#eab308' : undefined} />
            <KpiCard label="Findings"      value={loading ? '—' : stats?.total_findings ?? 0}  sub="latest scans" accent={stats?.total_findings > 0 ? '#fb923c' : undefined} />
          </div>

          {/* ── Charts row ─────────────────────────────────────────────────── */}
          {!loading && stats && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 animate-slide-up" style={{ animationDelay: '0.08s' }}>

              {/* Security score */}
              <div className="rounded-2xl p-5 flex flex-col items-center justify-center gap-2"
                style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.06)' }}>
                <ScoreRing score={stats.security_score} />
                <div className="w-full mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
                  {[['Critical', bySev.critical, '#f87171'], ['High', bySev.high, '#fb923c'], ['Medium', bySev.medium, '#eab308'], ['Low', bySev.low, '#60a5fa']].map(([lbl, v, c]) => (
                    <div key={lbl} className="flex items-center justify-between">
                      <span className="text-[11px] text-white/30">{lbl}</span>
                      <span className="text-[11px] font-bold" style={{ color: c }}>{v || 0}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Severity breakdown */}
              <div className="rounded-2xl p-5 flex flex-col gap-3"
                style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.06)' }}>
                <p className="text-xs font-semibold uppercase tracking-widest text-white/25">Findings by Severity</p>
                <div className="flex-1 flex items-center justify-center">
                  <SeverityDonut bySev={bySev} />
                </div>
                {hasSev && (
                  <div className="mt-1 flex flex-col gap-1">
                    {Object.entries(SEV_COLORS).map(([k, c]) => {
                      const n = bySev[k] || 0
                      const total = Math.max(stats.total_findings, 1)
                      const pct = Math.round((n / total) * 100)
                      return (
                        <div key={k} className="flex items-center gap-2">
                          <div className="h-1 rounded-full flex-1 overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: c }} />
                          </div>
                          <span className="text-[10px] w-6 text-right font-mono" style={{ color: c }}>{n}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Scan trend */}
              <div className="rounded-2xl p-5 flex flex-col gap-3"
                style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-widest text-white/25">Scan Activity</p>
                  <span className="text-[10px] text-white/20">last 14 days</span>
                </div>
                {stats.scan_trend?.length > 0 ? (
                  <div className="flex-1 flex items-end">
                    <TrendBars trend={stats.scan_trend} />
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <p className="text-white/15 text-xs">No scans in the last 14 days</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Top risky projects ─────────────────────────────────────────── */}
          {!loading && stats?.top_risky_projects?.length > 0 && (
            <div className="mb-6 animate-slide-up" style={{ animationDelay: '0.12s' }}>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-white/30 mb-3">Top Risky Projects</h2>
              <div className="rounded-2xl overflow-hidden"
                style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.06)' }}>
                {stats.top_risky_projects.map((p, i) => (
                  <div key={p.id}
                    onClick={() => navigate(`/projects/${p.id}`)}
                    className="flex items-center gap-4 px-5 py-3 cursor-pointer transition-colors hover:bg-white/[0.02]"
                    style={{ borderBottom: i < stats.top_risky_projects.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                    <span className="text-xs text-white/20 w-4 flex-shrink-0">{i + 1}</span>
                    <span className="flex-1 text-sm font-medium text-white truncate">{p.name}</span>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {p.critical > 0 && <SevPill n={p.critical} c="#f87171" label="crit" />}
                      {p.high     > 0 && <SevPill n={p.high}     c="#fb923c" label="high" />}
                      {p.medium   > 0 && <SevPill n={p.medium}   c="#eab308" label="med"  />}
                      {p.low      > 0 && <SevPill n={p.low}      c="#60a5fa" label="low"  />}
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="2">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Projects list ──────────────────────────────────────────────── */}
          <div className="animate-slide-up" style={{ animationDelay: '0.16s' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-white/30">Projects</h2>
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
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-6 h-6 rounded-full animate-spin"
                  style={{ border: '2px solid rgba(255,107,43,0.2)', borderTop: '2px solid #FF6B2B' }} />
              </div>
            ) : projects.length === 0 ? (
              <EmptyState onNew={() => navigate('/scans/new')} />
            ) : (
              <div className="flex flex-col gap-3">
                {projects.map(p => (
                  <ProjectRow
                    key={p.id}
                    project={p}
                    deleting={deletingId === p.id}
                    onClick={() => navigate(`/projects/${p.id}`)}
                    onDelete={e => handleDelete(e, p.id)}
                  />
                ))}
              </div>
            )}
          </div>

        </div>
      </main>
    </AppLayout>
    <RoleRequestModal 
      isOpen={showRoleModal} 
      onClose={() => setShowRoleModal(false)}
      currentRole={user?.role_name}
    />
    </>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SevPill({ n, c, label }) {
  return (
    <span className="flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded"
      style={{ background: `${c}15`, color: c, border: `1px solid ${c}30` }}>
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
      style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.05)' }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(255,107,43,0.15)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'}
    >
      <div className="flex items-center gap-4 min-w-0">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(255,107,43,0.08)', border: '1px solid rgba(255,107,43,0.12)' }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#FF6B2B" strokeWidth="1.8">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-white font-semibold text-sm truncate">{project.name}</p>
            {userRoleBadge && (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0"
                style={{
                  background: project.user_role === 'editor' ? 'rgba(255,107,43,0.1)' : 'rgba(107,114,128,0.1)',
                  color:      project.user_role === 'editor' ? '#FF8C5A' : '#9ca3af',
                  border:     project.user_role === 'editor' ? '1px solid rgba(255,107,43,0.2)' : '1px solid rgba(107,114,128,0.2)',
                }}>
                {project.user_role}
              </span>
            )}
          </div>
          <p className="text-white/30 text-xs mt-0.5 truncate">
            {project.description || 'No description'} · {project.scan_count} scan{project.scan_count !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-shrink-0 ml-4">
        <StatusBadge status={project.last_scan_status} />
        <span className="text-white/20 text-xs hidden md:block">
          {new Date(project.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
        {project.user_role === 'owner' || !project.user_role ? (
          <button
            onClick={onDelete}
            disabled={deleting}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-white/20 hover:text-red-400 p-1 rounded disabled:opacity-30"
          >
            {deleting ? (
              <div className="w-3.5 h-3.5 rounded-full animate-spin"
                style={{ border: '1.5px solid rgba(255,255,255,0.2)', borderTop: '1.5px solid #ef4444' }} />
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
            )}
          </button>
        ) : <div className="w-6" />}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
          className="text-white/15 group-hover:text-white/30 transition-colors">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>
    </div>
  )
}

function EmptyState({ onNew }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 rounded-2xl"
      style={{ border: '1px dashed rgba(255,255,255,0.08)' }}>
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: 'rgba(255,107,43,0.06)', border: '1px solid rgba(255,107,43,0.1)' }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FF6B2B" strokeWidth="1.5">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          <path d="M12 11v6M9 14h6" />
        </svg>
      </div>
      <p className="text-white font-semibold mb-1">No projects yet</p>
      <p className="text-white/30 text-sm mb-6">Create your first project to start scanning for vulnerabilities</p>
      <button onClick={onNew}
        className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-lg active:scale-[0.97]"
        style={{ background: 'linear-gradient(135deg,#FF6B2B,#C13A00)', boxShadow: '0 4px 16px rgba(255,107,43,0.25)' }}>
        Create first project
      </button>
    </div>
  )
}
