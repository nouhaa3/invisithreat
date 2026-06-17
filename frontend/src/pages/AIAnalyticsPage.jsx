import { useEffect, useState } from 'react'
import AppLayout from '../components/AppLayout'
import { getAIAnalytics } from '../services/aiAnalyticsService'

// ─── Colour palette ───────────────────────────────────────────────────────────

const ACCENT   = '#FF6B2B'
const CARD_BG  = 'rgba(255,255,255,0.03)'
const CARD_BDR = '1px solid rgba(255,255,255,0.08)'

// ─── Mini bar chart ───────────────────────────────────────────────────────────

function TrendChart({ data = [] }) {
  if (!data.length) return null
  const max = Math.max(...data.map(d => d.count), 1)
  return (
    <div className="flex items-end gap-0.5 h-16 w-full">
      {data.map((d, i) => {
        const pct = (d.count / max) * 100
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-0.5 group relative">
            <div
              className="w-full rounded-sm transition-all duration-200 group-hover:opacity-80"
              style={{
                height: `${Math.max(pct, 4)}%`,
                background: d.count > 0 ? ACCENT : 'rgba(255,255,255,0.08)',
              }}
            />
            {/* tooltip */}
            <div className="absolute bottom-full mb-1 hidden group-hover:block z-10 pointer-events-none">
              <div
                className="rounded px-2 py-1 text-xs whitespace-nowrap"
                style={{ background: '#1a1a1a', border: CARD_BDR, color: '#e5e7eb' }}
              >
                {d.date}: <span style={{ color: ACCENT }}>{d.count}</span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Horizontal bar ───────────────────────────────────────────────────────────

function HBar({ label, count, maxCount, color = ACCENT }) {
  const pct = maxCount > 0 ? (count / maxCount) * 100 : 0
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-white/60 truncate w-40 flex-shrink-0">{label}</span>
      <div className="flex-1 rounded-full overflow-hidden" style={{ height: 8, background: 'rgba(255,255,255,0.06)' }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="text-xs font-semibold text-white/80 w-8 text-right flex-shrink-0">{count}</span>
    </div>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }) {
  return (
    <div className="rounded-xl p-5 flex flex-col gap-1" style={{ background: CARD_BG, border: CARD_BDR }}>
      <p className="text-xs text-white/50 uppercase tracking-widest">{label}</p>
      <p className="text-3xl font-bold" style={{ color: ACCENT }}>{value}</p>
      {sub && <p className="text-xs text-white/40">{sub}</p>}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const WINDOW_OPTIONS = [
  { label: '7 days',  value: 7  },
  { label: '30 days', value: 30 },
  { label: '90 days', value: 90 },
]

const SCAN_TYPE_COLORS = {
  SAST:         '#60a5fa',
  DAST:         '#f472b6',
  Secrets:      '#fbbf24',
  Dependencies: '#34d399',
  Full:         '#a78bfa',
  Unknown:      '#6b7280',
}

export default function AIAnalyticsPage() {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [days, setDays]       = useState(30)

  useEffect(() => {
    setLoading(true)
    setError(null)
    getAIAnalytics(days)
      .then(setData)
      .catch(err => setError(err?.response?.data?.detail || 'Failed to load analytics'))
      .finally(() => setLoading(false))
  }, [days])

  // derived
  const topDevs   = data?.top_developers          || []
  const topVulns  = data?.top_vulnerability_types || []
  const scanTypes = data?.usage_by_scan_type      || []
  const trend     = data?.usage_trend             || []
  const maxDevs   = Math.max(...topDevs.map(d => d.count), 1)
  const maxVulns  = Math.max(...topVulns.map(v => v.count), 1)

  return (
    <AppLayout>
      <div className="min-h-screen px-4 py-8 md:px-8" style={{ background: '#080808' }}>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">AI Usage Analytics</h1>
            <p className="text-sm text-white/40 mt-1">
              Track how developers use the AI assistance feature across all projects.
            </p>
          </div>

          {/* Time window picker */}
          <div className="flex gap-2">
            {WINDOW_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setDays(opt.value)}
                className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
                style={{
                  background: days === opt.value ? ACCENT : 'rgba(255,255,255,0.06)',
                  color:      days === opt.value ? '#fff' : 'rgba(255,255,255,0.5)',
                  border:     CARD_BDR,
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-xl p-4 text-sm text-red-400" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
            {error}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 animate-pulse">
            {[0, 1, 2].map(i => (
              <div key={i} className="h-24 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }} />
            ))}
          </div>
        )}

        {!loading && data && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <StatCard
                label="Total AI Usages"
                value={data.total_usages.toLocaleString()}
                sub={`Last ${days} days`}
              />
              <StatCard
                label="Unique Developers"
                value={topDevs.length}
                sub="Users who used AI assist"
              />
              <StatCard
                label="Vulnerability Types"
                value={topVulns.length}
                sub="Distinct vulnerability categories"
              />
            </div>

            {/* Usage trend chart */}
            <div className="rounded-xl p-5 mb-6" style={{ background: CARD_BG, border: CARD_BDR }}>
              <p className="text-sm font-semibold text-white/80 mb-4">Daily Usage Trend</p>
              {trend.every(d => d.count === 0) ? (
                <p className="text-sm text-white/30 text-center py-4">No AI usage in this period.</p>
              ) : (
                <TrendChart data={trend} />
              )}
              <div className="flex justify-between mt-2 text-xs text-white/30">
                <span>{trend[0]?.date || ''}</span>
                <span>{trend[trend.length - 1]?.date || ''}</span>
              </div>
            </div>

            {/* Two-column: top devs + top vuln types */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

              {/* Top developers */}
              <div className="rounded-xl p-5" style={{ background: CARD_BG, border: CARD_BDR }}>
                <p className="text-sm font-semibold text-white/80 mb-4">Top Developers Using AI</p>
                {topDevs.length === 0 ? (
                  <p className="text-sm text-white/30 text-center py-4">No data.</p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {topDevs.map((dev, i) => (
                      <div key={dev.user_id} className="flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white/30 w-5">{i + 1}</span>
                            <div>
                              <span className="text-sm text-white/80 font-medium">{dev.user_name}</span>
                              {dev.user_email && (
                                <span className="text-xs text-white/30 ml-2">{dev.user_email}</span>
                              )}
                            </div>
                          </div>
                          <span
                            className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{ background: 'rgba(255,107,43,0.12)', color: ACCENT }}
                          >
                            {dev.user_role || 'Unknown'}
                          </span>
                        </div>
                        <HBar label="" count={dev.count} maxCount={maxDevs} />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Most requested vulnerability types */}
              <div className="rounded-xl p-5" style={{ background: CARD_BG, border: CARD_BDR }}>
                <p className="text-sm font-semibold text-white/80 mb-4">Most Requested Vulnerability Types</p>
                {topVulns.length === 0 ? (
                  <p className="text-sm text-white/30 text-center py-4">No data.</p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {topVulns.map((v, i) => (
                      <div key={v.vulnerability_type} className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white/30 w-5">{i + 1}</span>
                          <span className="text-sm text-white/80 font-medium truncate">{v.vulnerability_type}</span>
                        </div>
                        <HBar label="" count={v.count} maxCount={maxVulns} color="#a78bfa" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Usage by scan type */}
            <div className="rounded-xl p-5" style={{ background: CARD_BG, border: CARD_BDR }}>
              <p className="text-sm font-semibold text-white/80 mb-4">Usage by Scan Type</p>
              {scanTypes.length === 0 ? (
                <p className="text-sm text-white/30 text-center py-4">No data.</p>
              ) : (
                <div className="flex flex-wrap gap-4">
                  {scanTypes.map(st => {
                    const color = SCAN_TYPE_COLORS[st.scan_type] || SCAN_TYPE_COLORS.Unknown
                    return (
                      <div
                        key={st.scan_type}
                        className="flex flex-col items-center justify-center rounded-xl px-6 py-4 gap-1"
                        style={{ background: 'rgba(255,255,255,0.04)', border: CARD_BDR, minWidth: 110 }}
                      >
                        <span className="text-2xl font-bold" style={{ color }}>{st.count}</span>
                        <span className="text-xs text-white/50 font-medium">{st.scan_type}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  )
}
