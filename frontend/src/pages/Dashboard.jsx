import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import AppLayout from '../components/AppLayout'
import AdminDashboardStats from '../components/AdminDashboardStats'
import RoleRequestModal from '../components/RoleRequestModal'
import { getDashboardStats, getSecurityManagerProjects } from '../services/projectService'
import { getAdminDashboardStats } from '../services/adminDashboardService'
import { can, PERMISSIONS } from '../utils/permissions'

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

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

function downloadCsv(filename, headers, rows) {
  const lines = [headers.map(csvCell).join(',')]
  for (const row of rows) lines.push(row.map(csvCell).join(','))
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
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
    <div className="ui-card ui-card-sheen px-5 py-4 flex flex-col gap-1.5 transition-all">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/30">{label}</p>
      <p className="text-3xl font-bold leading-none" style={{ color: accent || '#fff' }}>{value}</p>
      {sub && <p className="text-xs text-white/35">{sub}</p>}
    </div>
  )
}

function getPriorityInfo(project) {
  const critical = Number(project?.critical || 0)
  const high = Number(project?.high || 0)
  const risk = Number(project?.risk_score || 0)
  if (critical > 0 || risk >= 7) return { label: 'P1', hint: 'Immediate', color: '#f87171' }
  if (high > 0 || risk >= 4) return { label: 'P2', hint: 'Soon', color: '#fb923c' }
  return { label: 'P3', hint: 'Monitor', color: '#60a5fa' }
}

function PriorityPill({ info }) {
  return (
    <span
      className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
      style={{ background: `${info.color}1A`, border: `1px solid ${info.color}33`, color: info.color }}
      title={info.hint}
    >
      {info.label}
    </span>
  )
}

function ScanStatusPill({ status }) {
  if (!status) {
    return (
      <span
        className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
        style={{ background: 'rgba(156,163,175,0.1)', border: '1px solid rgba(156,163,175,0.25)', color: '#9ca3af' }}
      >
        No Scan
      </span>
    )
  }

  const cfg = STATUS_CONFIG[status] || {
    label: status.replace('_', ' '),
    color: '#9ca3af',
    bg: 'rgba(156,163,175,0.1)',
  }

  return (
    <span
      className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
      style={{ background: cfg.bg, border: `1px solid ${cfg.color}33`, color: cfg.color }}
    >
      {cfg.label}
    </span>
  )
}

function SecurityManagerDashboard({
  user,
  loading,
  stats,
  portfolioSummary,
  portfolioProjects,
  bySev,
  hasSev,
  avgRisk,
  riskColor,
  maxRisk,
  maxRiskColor,
  maxRiskSub,
  scoreColor,
  onOpenNotifications,
  onOpenProjects,
  onOpenProject,
  onExportSnapshot,
}) {
  if (loading) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        <div className="flex items-center justify-center py-16">
          <div
            className="w-8 h-8 rounded-full animate-spin"
            style={{ border: '2px solid rgba(255,107,43,0.2)', borderTop: '2px solid #FF6B2B' }}
          />
        </div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        <div
          className="rounded-2xl p-6"
          style={{
            background: 'linear-gradient(170deg, rgba(239,68,68,0.08), rgba(239,68,68,0.02))',
            border: '1px solid rgba(239,68,68,0.25)',
          }}
        >
          <p className="text-red-300 text-sm font-medium">Unable to load security manager dashboard data.</p>
        </div>
      </div>
    )
  }

  const queueSource = portfolioProjects?.length
    ? [...portfolioProjects].sort((a, b) => {
      const riskDelta = Number(b?.risk_score || 0) - Number(a?.risk_score || 0)
      if (riskDelta !== 0) return riskDelta
      const criticalDelta = Number(b?.critical || 0) - Number(a?.critical || 0)
      if (criticalDelta !== 0) return criticalDelta
      return Number(b?.high || 0) - Number(a?.high || 0)
    }).slice(0, 8)
    : (stats.top_risky_projects || [])

  const priorityQueue = queueSource.map((project) => ({
    ...project,
    priority: getPriorityInfo(project),
  }))

  const immediateActions = priorityQueue.filter((p) => p.priority.label === 'P1').length
  const prioritizedItems = priorityQueue.filter((p) => p.priority.label !== 'P3').length
  const monitoredProjects = portfolioSummary?.total_projects ?? stats.total_projects ?? 0
  const projectsWithFindings = portfolioSummary?.projects_with_findings
    ?? priorityQueue.filter((p) => Number(p?.critical || 0) + Number(p?.high || 0) + Number(p?.medium || 0) + Number(p?.low || 0) > 0).length
  const criticalProjects = portfolioSummary?.critical_projects
    ?? priorityQueue.filter((p) => Number(p?.critical || 0) > 0).length

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
      <div className="mb-6 animate-slide-up flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight">
            {getGreeting()}, <span style={{ color: '#FF8C5A' }}>{user?.nom?.split(' ')[0]}</span>
          </h1>
          <p className="text-sm text-white/45 mt-2">Security command center for risk prioritization and findings governance</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={onOpenProjects}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: 'linear-gradient(135deg,#FF6B2B,#C13A00)' }}
          >
            Security Portfolio
          </button>
          <button
            onClick={onExportSnapshot}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white/85"
            style={{ border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.02)' }}
          >
            Export Snapshot
          </button>
          <button
            onClick={onOpenNotifications}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white/85"
            style={{ border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.02)' }}
          >
            Review Alerts
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6 animate-slide-up" style={{ animationDelay: '0.04s' }}>
        <KpiCard label="Monitored Projects" value={monitoredProjects} sub="security scope" />
        <KpiCard label="With Findings" value={projectsWithFindings} sub="need follow-up" accent={projectsWithFindings > 0 ? '#f59e0b' : '#22c55e'} />
        <KpiCard label="Critical Projects" value={criticalProjects} sub="immediate attention" accent={criticalProjects > 0 ? '#f87171' : '#22c55e'} />
        <KpiCard label="Average Risk" value={`${avgRisk.toFixed(1)}/10`} sub="portfolio baseline" accent={riskColor} />
        <KpiCard label="Max Risk" value={`${maxRisk.toFixed(1)}/10`} sub={maxRiskSub} accent={maxRiskColor} />
      </div>

      <div className="mb-6 animate-slide-up rounded-2xl p-4 sm:p-5"
        style={{ background: '#101010', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            ['Needs Prioritization', prioritizedItems, prioritizedItems > 0 ? '#fb923c' : '#22c55e'],
            ['Immediate Actions', immediateActions, immediateActions > 0 ? '#f87171' : '#22c55e'],
            ['Active Scans', stats.active_scans ?? 0, (stats.active_scans ?? 0) > 0 ? '#eab308' : '#60a5fa'],
            ['Security Score', stats.security_score ?? 0, scoreColor],
          ].map(([label, value, color]) => (
            <div key={label} className="rounded-xl px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <p className="text-[11px] uppercase tracking-[0.14em] text-white/35">{label}</p>
              <p className="text-xl font-bold mt-1" style={{ color }}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 animate-slide-up" style={{ animationDelay: '0.08s' }}>
        <div className="rounded-2xl p-5 flex flex-col items-center justify-center gap-2"
          style={{ background: 'linear-gradient(170deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))', border: '1px solid rgba(255,255,255,0.06)' }}>
          <ScoreRing score={stats.security_score} />
          <div className="w-full mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
            {[
              ['Critical', bySev.critical, '#f87171'],
              ['High', bySev.high, '#fb923c'],
              ['Medium', bySev.medium, '#eab308'],
              ['Low', bySev.low, '#60a5fa'],
            ].map(([lbl, v, c]) => (
              <div key={lbl} className="flex items-center justify-between">
                <span className="text-[11px] text-white/30">{lbl}</span>
                <span className="text-[11px] font-bold" style={{ color: c }}>{v || 0}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl p-5 flex flex-col gap-3"
          style={{ background: 'linear-gradient(170deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-xs font-semibold uppercase tracking-widest text-white/25">Findings Distribution</p>
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

        <div className="rounded-2xl p-5 flex flex-col gap-3"
          style={{ background: 'linear-gradient(170deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/25">Scan Trend</p>
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

      <div className="mb-6 animate-slide-up" style={{ animationDelay: '0.12s' }}>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-white/30 mb-3">Prioritization Queue</h2>
        <div className="rounded-2xl overflow-hidden"
          style={{ background: 'linear-gradient(170deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))', border: '1px solid rgba(255,255,255,0.06)' }}>
          {priorityQueue.length > 0 ? (
            priorityQueue.map((project, i) => (
              <div key={project.id}
                onClick={() => onOpenProject(project.id)}
                className="flex items-center gap-4 px-5 py-3 cursor-pointer transition-colors hover:bg-white/[0.02]"
                style={{ borderBottom: i < priorityQueue.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                <span className="text-xs text-white/20 w-4 flex-shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{project.name}</p>
                  {project.owner_name && (
                    <p className="text-[11px] text-white/35 truncate">Owner: {project.owner_name}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {project.last_scan_status !== undefined && <ScanStatusPill status={project.last_scan_status} />}
                  <PriorityPill info={project.priority} />
                  {typeof project.risk_score === 'number' && <SevPill n={project.risk_score.toFixed(1)} c="#f87171" label="risk" />}
                  {project.critical > 0 && <SevPill n={project.critical} c="#f87171" label="crit" />}
                  {project.high > 0 && <SevPill n={project.high} c="#fb923c" label="high" />}
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>
            ))
          ) : (
            <div className="px-6 py-10 text-center">
              <p className="text-white/75 text-sm font-medium">No projects to prioritize yet</p>
              <p className="text-white/35 text-xs mt-1">As soon as scans complete, this queue will rank risk automatically.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const { user } = useAuth()
  const navigate  = useNavigate()
  const isAdmin = user?.role_name === 'Admin'
  const isSecurityManager = user?.role_name === 'Security Manager'

  const [stats,         setStats]         = useState(null)
  const [securityPortfolio, setSecurityPortfolio] = useState({ summary: null, projects: [] })
  const [loading,       setLoading]       = useState(true)
  const [showRoleModal, setShowRoleModal] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      // Load role-specific data
      let statsData
      if (user?.role_name === 'Admin') {
        statsData = await getAdminDashboardStats()
        setSecurityPortfolio({ summary: null, projects: [] })
      } else if (user?.role_name === 'Security Manager') {
        const [dashboardData, portfolioData] = await Promise.all([
          getDashboardStats(),
          getSecurityManagerProjects(),
        ])
        statsData = dashboardData
        setSecurityPortfolio({
          summary: portfolioData?.summary || null,
          projects: portfolioData?.projects || [],
        })
      } else {
        statsData = await getDashboardStats()
        setSecurityPortfolio({ summary: null, projects: [] })
      }
      setStats(statsData)
    } catch (err) {
      console.error('Dashboard error:', err)
      setStats(null)
      setSecurityPortfolio({ summary: null, projects: [] })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [user?.role_name])

  const bySev = stats?.by_severity || {}
  const hasSev = stats && Object.values(bySev).some(v => v > 0)
  const scoreColor = !stats ? '#6b7280'
    : stats.security_score >= 80 ? '#22c55e'
    : stats.security_score >= 50 ? '#eab308'
    : stats.security_score >= 25 ? '#fb923c'
    : '#f87171'
  const avgRisk = Number(stats?.risk_overview?.avg_score || 0)
  const riskColor = avgRisk >= 7 ? '#f87171' : avgRisk >= 4 ? '#fb923c' : '#22c55e'
  const maxRisk = Number(stats?.risk_overview?.max_score || 0)
  const maxRiskColor = maxRisk >= 7 ? '#f87171' : maxRisk >= 4 ? '#fb923c' : '#22c55e'
  const maxRiskProjectName = (securityPortfolio.projects || []).find(p => typeof p.risk_score === 'number')?.name
    || stats?.top_risky_projects?.find(p => typeof p.risk_score === 'number')?.name
  const maxRiskSub = loading || !stats
    ? 'highest project risk score'
    : maxRiskProjectName
      ? `project: ${maxRiskProjectName}`
      : 'no scored projects yet'

  const exportSecuritySnapshot = () => {
    if (!stats) return
    const source = securityPortfolio.projects?.length ? securityPortfolio.projects : (stats.top_risky_projects || [])
    const rows = source.map((p) => [
      p.name,
      Number(p.risk_score || 0).toFixed(2),
      p.critical || 0,
      p.high || 0,
      p.medium || 0,
      p.low || 0,
      getPriorityInfo(p).label,
    ])

    if (rows.length === 0) {
      rows.push(['No projects', '0.00', 0, 0, 0, 0, 'P3'])
    }

    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
    downloadCsv(`security-snapshot-${stamp}.csv`, [
      'project_name',
      'risk_score',
      'critical_findings',
      'high_findings',
      'medium_findings',
      'low_findings',
      'priority',
    ], rows)
  }

  return (
    <>
    <AppLayout>
      <main className="flex-1 overflow-auto">
        {/* Admin Dashboard */}
        {isAdmin && (
          <AdminDashboardStats stats={stats} loading={loading} user={user} />
        )}

        {/* Security Manager Dashboard */}
        {isSecurityManager && (
          <SecurityManagerDashboard
            user={user}
            loading={loading}
            stats={stats}
            portfolioSummary={securityPortfolio.summary}
            portfolioProjects={securityPortfolio.projects}
            bySev={bySev}
            hasSev={hasSev}
            avgRisk={avgRisk}
            riskColor={riskColor}
            maxRisk={maxRisk}
            maxRiskColor={maxRiskColor}
            maxRiskSub={maxRiskSub}
            scoreColor={scoreColor}
            onOpenNotifications={() => navigate('/notifications')}
            onOpenProjects={() => navigate('/projects')}
            onOpenProject={(projectId) => navigate(`/projects/${projectId}`)}
            onExportSnapshot={exportSecuritySnapshot}
          />
        )}
        
        {/* Technical Dashboard (Developer / Viewer) */}
        {!isAdmin && !isSecurityManager && (
        <div className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
          {/* Header */}
          <div className="mb-6 animate-slide-up flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight">
                {getGreeting()}, <span style={{ color: '#FF8C5A' }}>{user?.nom?.split(' ')[0]}</span>
              </h1>
              <p className="text-sm text-white/45 mt-2">
                {loading ? 'Loading workspace...' : 'Your security overview and metrics'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {can(user?.role_name, PERMISSIONS.RUN_SCAN) && (
                <button
                  onClick={() => navigate('/scans/new')}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
                  style={{ background: 'linear-gradient(135deg,#FF6B2B,#C13A00)' }}
                >
                  Launch New Scan
                </button>
              )}
              <button
                onClick={() => navigate('/notifications')}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white/85"
                style={{ border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.02)' }}
              >
                Review Alerts
              </button>
            </div>
          </div>

          {/* ── KPI row ────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6 animate-slide-up" style={{ animationDelay: '0.04s' }}>
            <KpiCard label="Projects"      value={loading || !stats ? '—' : stats?.total_projects ?? 0}  sub="in workspace" />
            <KpiCard label="Total Scans"   value={loading || !stats ? '—' : stats?.total_scans ?? 0}     sub="all time" />
            <KpiCard label="Active Scans"  value={loading || !stats ? '—' : stats?.active_scans ?? 0}    sub="running / pending" accent={stats?.active_scans > 0 ? '#eab308' : undefined} />
            <KpiCard label="Findings"      value={loading || !stats ? '—' : stats?.total_findings ?? 0}  sub="latest scans" accent={stats?.total_findings > 0 ? '#fb923c' : undefined} />
            <KpiCard label="Max Risk"      value={loading || !stats ? '—' : `${maxRisk.toFixed(1)}/10`}   sub={maxRiskSub} accent={maxRiskColor} />
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

          <div className="mb-6 animate-slide-up rounded-2xl p-4 sm:p-5"
            style={{ background: '#101010', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                ['Security score', loading || !stats ? '—' : stats?.security_score ?? 0, scoreColor],
                ['Average risk', loading || !stats ? '—' : `${avgRisk.toFixed(1)}/10`, riskColor],
                ['Critical', bySev.critical || 0, '#f87171'],
                ['High', bySev.high || 0, '#fb923c'],
              ].map(([label, value, color]) => (
                <div key={label} className="rounded-xl px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-white/35">{label}</p>
                  <p className="text-xl font-bold mt-1" style={{ color }}>{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Charts row ─────────────────────────────────────────────────── */}
          {!loading && stats && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 animate-slide-up" style={{ animationDelay: '0.08s' }}>

              {/* Security score */}
              <div className="rounded-2xl p-5 flex flex-col items-center justify-center gap-2"
                style={{ background: 'linear-gradient(170deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))', border: '1px solid rgba(255,255,255,0.06)' }}>
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
                style={{ background: 'linear-gradient(170deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))', border: '1px solid rgba(255,255,255,0.06)' }}>
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
                style={{ background: 'linear-gradient(170deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))', border: '1px solid rgba(255,255,255,0.06)' }}>
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
                style={{ background: 'linear-gradient(170deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))', border: '1px solid rgba(255,255,255,0.06)' }}>
                {stats.top_risky_projects.map((p, i) => (
                  <div key={p.id}
                    onClick={() => navigate(`/projects/${p.id}`)}
                    className="flex items-center gap-4 px-5 py-3 cursor-pointer transition-colors hover:bg-white/[0.02]"
                    style={{ borderBottom: i < stats.top_risky_projects.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                    <span className="text-xs text-white/20 w-4 flex-shrink-0">{i + 1}</span>
                    <span className="flex-1 text-sm font-medium text-white truncate">{p.name}</span>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {typeof p.risk_score === 'number' && <SevPill n={p.risk_score.toFixed(1)} c="#f87171" label="risk" />}
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

        </div>
        )}
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
