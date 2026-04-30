import { useNavigate } from 'react-router-dom'

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export default function AdminDashboardStats({ stats, loading, user }) {
  const navigate = useNavigate()

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
          <p className="text-red-300 text-sm font-medium">Unable to load admin dashboard data.</p>
        </div>
      </div>
    )
  }

  const summary = stats.summary || {}
  const usage = stats.system_usage || {}
  const health = stats.system_health || {}
  const roleDist = stats.user_distribution?.by_role || {}
  const trend = stats.usage_trend || []

  const trendMax = Math.max(...trend.map((d) => d.count || 0), 1)
  const healthColor = health.score >= 80 ? '#22c55e' : health.score >= 60 ? '#eab308' : '#f87171'
  const activeUserRate = Number(health.active_user_rate || 0)
  const scanSuccessRate = Number(health.scan_success_rate || 0)

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
      <div className="mb-6 animate-slide-up flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight">
            {getGreeting()}, <span style={{ color: '#FF8C5A' }}>{user?.nom?.split(' ')[0] || 'Admin'}</span>
          </h1>
          <p className="text-sm text-white/45 mt-2">Global platform overview and operational governance metrics</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => navigate('/admin')}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: 'linear-gradient(135deg,#FF6B2B,#C13A00)' }}
          >
            Manage Users
          </button>
          <button
            onClick={() => navigate('/notifications')}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white/85"
            style={{ border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.02)' }}
          >
            Review Alerts
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6 animate-slide-up" style={{ animationDelay: '0.04s' }}>
        <KpiCard label="Users" value={summary.total_users ?? 0} sub={`${summary.active_users ?? 0} active`} />
        <KpiCard label="Active Projects" value={summary.active_projects ?? 0} sub={`${summary.total_projects ?? 0} total`} />
        <KpiCard label="Reports" value={summary.reports_generated ?? 0} sub={`${usage.reports_last_30_days ?? 0} in last 30d`} />
        <KpiCard label="System Health" value={`${health.score ?? 0}%`} sub={health.status || 'Unknown'} accent={healthColor} />
        <KpiCard label="Active Users Rate" value={`${activeUserRate.toFixed(1)}%`} sub="healthy adoption" accent={activeUserRate >= 70 ? '#22c55e' : '#eab308'} />
      </div>

      <div
        className="mb-6 animate-slide-up rounded-2xl p-4 sm:p-5"
        style={{ background: '#101010', border: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            ['Scans (30d)', usage.scans_last_30_days ?? 0, '#60a5fa'],
            ['New Projects (30d)', usage.projects_created_last_30_days ?? 0, '#a78bfa'],
            ['Reports (30d)', usage.reports_last_30_days ?? 0, '#f59e0b'],
            ['Scan Success', `${scanSuccessRate.toFixed(1)}%`, scanSuccessRate >= 80 ? '#22c55e' : '#f87171'],
          ].map(([label, value, color]) => (
            <div key={label} className="rounded-xl px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <p className="text-[11px] uppercase tracking-[0.14em] text-white/35">{label}</p>
              <p className="text-xl font-bold mt-1" style={{ color }}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 animate-slide-up" style={{ animationDelay: '0.08s' }}>
        <div
          className="rounded-2xl p-5 flex flex-col items-center justify-center gap-2"
          style={{ background: 'linear-gradient(170deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <HealthRing score={Number(health.score || 0)} color={healthColor} />
          <div className="w-full mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
            <MetricLine label="Status" value={health.status || 'Unknown'} color={healthColor} />
            <MetricLine label="Users Active" value={`${activeUserRate.toFixed(1)}%`} color={activeUserRate >= 70 ? '#22c55e' : '#eab308'} />
            <MetricLine label="Scan Success" value={`${scanSuccessRate.toFixed(1)}%`} color={scanSuccessRate >= 80 ? '#22c55e' : '#f87171'} />
            <MetricLine label="Avg Projects" value={`${Number(usage.avg_projects_per_user || 0).toFixed(2)}`} color="#60a5fa" />
          </div>
        </div>

        <div
          className="rounded-2xl p-5 flex flex-col gap-3"
          style={{ background: 'linear-gradient(170deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-white/25">Users by Role</p>
          <div className="mt-1 flex flex-col gap-3">
            {Object.entries(roleDist).map(([role, count]) => {
              const total = Math.max(summary.total_users || 0, 1)
              const pct = Math.round((Number(count || 0) / total) * 100)
              const color = role === 'Admin'
                ? '#FF8C5A'
                : role === 'Developer'
                  ? '#60a5fa'
                  : role === 'Security Manager'
                    ? '#a78bfa'
                    : '#9ca3af'
              return (
                <div key={role} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/65">{role}</span>
                    <span className="text-[11px] text-white/45">{count} ({pct}%)</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <div className="h-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div
          className="rounded-2xl p-5 flex flex-col gap-3"
          style={{ background: 'linear-gradient(170deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/25">System Activity</p>
            <span className="text-[10px] text-white/20">last 14 days</span>
          </div>
          {trend.length > 0 ? (
            <div className="flex-1 flex flex-col justify-end">
              <div className="flex items-end gap-1 h-24">
                {trend.map((d, i) => {
                  const pct = (d.count || 0) / trendMax
                  const height = Math.max(pct * 88, d.count > 0 ? 6 : 2)
                  return (
                    <div key={`${d.date}-${i}`} className="flex-1 flex flex-col items-center gap-0.5 group relative">
                      {d.count > 0 && (
                        <div className="absolute bottom-full mb-1 hidden group-hover:flex items-center justify-center z-10 pointer-events-none">
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded whitespace-nowrap"
                            style={{ background: '#222', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.3)' }}>
                            {d.count}
                          </span>
                        </div>
                      )}
                      <div
                        className="w-full rounded-t transition-all duration-300"
                        style={{
                          height: `${height}px`,
                          background: d.count > 0
                            ? 'linear-gradient(180deg,#60a5fa,rgba(96,165,250,0.3))'
                            : 'rgba(255,255,255,0.04)',
                        }}
                      />
                    </div>
                  )
                })}
              </div>
              <div className="flex gap-1 mt-1.5">
                {trend.map((d, i) => (
                  <div key={`label-${d.date}-${i}`} className="flex-1 flex justify-center">
                    {i % 4 === 0 && (
                      <span className="text-[9px] text-white/20 whitespace-nowrap">{d.date.split(' ')[1]}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-white/15 text-xs">No system activity in the last 14 days</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function KpiCard({ label, value, sub, accent }) {
  return (
    <div className="ui-card ui-card-sheen px-5 py-4 flex flex-col gap-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/30">{label}</p>
      <p className="text-3xl font-bold leading-none" style={{ color: accent || '#fff' }}>{value}</p>
      <p className="text-xs text-white/35">{sub}</p>
    </div>
  )
}

function HealthRing({ score, color }) {
  const r = 42
  const circ = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, Number(score || 0)))
  const dash = (pct / 100) * circ

  return (
    <div className="flex flex-col items-center justify-center gap-1">
      <svg width="110" height="110" viewBox="0 0 110 110">
        <circle cx="55" cy="55" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
        <circle
          cx="55"
          cy="55"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 55 55)"
          style={{ transition: 'stroke-dasharray 0.8s ease' }}
        />
        <text x="55" y="50" textAnchor="middle" fill="white" fontSize="20" fontWeight="700" dy=".1em">{pct.toFixed(1)}</text>
        <text x="55" y="68" textAnchor="middle" fill={color} fontSize="9" fontWeight="600">Health</text>
      </svg>
      <p className="text-xs text-white/30 mt-1">System Score</p>
    </div>
  )
}

function MetricLine({ label, value, color }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] text-white/30">{label}</span>
      <span className="text-[11px] font-bold" style={{ color }}>{value}</span>
    </div>
  )
}
