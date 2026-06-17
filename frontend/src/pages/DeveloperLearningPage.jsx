import { useEffect, useState } from 'react'
import AppLayout from '../components/AppLayout'
import { getDeveloperLearning } from '../services/aiAnalyticsService'

// ─── Design tokens ────────────────────────────────────────────────────────────
const ACCENT    = '#FF6B2B'
const CARD_BG   = 'rgba(255,255,255,0.03)'
const CARD_BDR  = '1px solid rgba(255,255,255,0.08)'

// ─── Trend colours ────────────────────────────────────────────────────────────
const TREND_CFG = {
  Improving: { color: '#4ade80', bg: 'rgba(74,222,128,0.10)',  border: 'rgba(74,222,128,0.25)',  icon: '↑' },
  Stable:    { color: '#60a5fa', bg: 'rgba(96,165,250,0.10)',  border: 'rgba(96,165,250,0.25)',  icon: '→' },
  Worsening: { color: '#f87171', bg: 'rgba(248,113,113,0.10)', border: 'rgba(248,113,113,0.25)', icon: '↓' },
}

// ─── Autonomy score ring ──────────────────────────────────────────────────────
function ScoreRing({ score, trend }) {
  const r    = 48
  const circ = 2 * Math.PI * r
  const pct  = Math.max(0, Math.min(100, score))
  const dash = (pct / 100) * circ
  const gap  = circ - dash

  const color =
    pct >= 75 ? '#4ade80' :
    pct >= 50 ? '#60a5fa' :
    pct >= 30 ? '#eab308' : '#f87171'

  const label =
    pct >= 75 ? 'High' :
    pct >= 50 ? 'Medium' :
    pct >= 30 ? 'Low' : 'Very Low'

  const cfg = TREND_CFG[trend] || TREND_CFG.Stable

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={120} height={120} viewBox="0 0 120 120">
        <circle cx={60} cy={60} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={10} />
        <circle
          cx={60} cy={60} r={r} fill="none"
          stroke={color} strokeWidth={10}
          strokeDasharray={`${dash} ${gap}`}
          strokeLinecap="round"
          transform="rotate(-90 60 60)"
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
        <text x={60} y={55} textAnchor="middle" fill={color} fontSize={24} fontWeight="700" dominantBaseline="middle">
          {pct}
        </text>
        <text x={60} y={74} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize={11}>
          {label}
        </text>
      </svg>
      <span
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
        style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}
      >
        {cfg.icon} {trend}
      </span>
    </div>
  )
}

// ─── Bar chart (daily / weekly) ───────────────────────────────────────────────
function BarChart({ data = [], dateKey = 'date' }) {
  const max = Math.max(...data.map(d => d.count), 1)
  if (!data.length) return null
  return (
    <div className="flex items-end gap-px h-20 w-full">
      {data.map((d, i) => {
        const pct = (d.count / max) * 100
        return (
          <div key={i} className="flex-1 flex flex-col items-center group relative">
            <div
              className="w-full rounded-sm transition-all duration-200 group-hover:opacity-75"
              style={{
                height: `${Math.max(pct, 3)}%`,
                background: d.count > 0 ? ACCENT : 'rgba(255,255,255,0.07)',
              }}
            />
            <div className="absolute bottom-full mb-1 hidden group-hover:flex z-10 pointer-events-none flex-col items-center">
              <div
                className="rounded px-2 py-1 text-xs whitespace-nowrap"
                style={{ background: '#1a1a1a', border: CARD_BDR, color: '#e5e7eb' }}
              >
                {d[dateKey]}: <span style={{ color: ACCENT }}>{d.count}</span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Horizontal bar ───────────────────────────────────────────────────────────
function HBar({ label, count, maxCount, color = ACCENT, badge }) {
  const pct = maxCount > 0 ? (count / maxCount) * 100 : 0
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-white/60 truncate w-44 flex-shrink-0">{label}</span>
      <div className="flex-1 rounded-full overflow-hidden" style={{ height: 7, background: 'rgba(255,255,255,0.06)' }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="text-xs font-semibold text-white/80 w-8 text-right flex-shrink-0">{count}</span>
      {badge && (
        <span
          className="text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0"
          style={{ background: 'rgba(248,113,113,0.12)', color: '#f87171' }}
        >
          ×{badge}
        </span>
      )}
    </div>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color }) {
  return (
    <div className="rounded-xl p-5 flex flex-col gap-1" style={{ background: CARD_BG, border: CARD_BDR }}>
      <p className="text-xs text-white/50 uppercase tracking-widest">{label}</p>
      <p className="text-3xl font-bold" style={{ color: color || ACCENT }}>{value}</p>
      {sub && <p className="text-xs text-white/40">{sub}</p>}
    </div>
  )
}

// ─── Window picker ────────────────────────────────────────────────────────────
const WINDOW_OPTIONS = [
  { label: '7 days',   value: 7  },
  { label: '30 days',  value: 30 },
  { label: '90 days',  value: 90 },
]

const SCAN_TYPE_COLORS = {
  SAST:         '#60a5fa',
  DAST:         '#f472b6',
  Secrets:      '#fbbf24',
  Dependencies: '#34d399',
  Full:         '#a78bfa',
  Unknown:      '#6b7280',
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function DeveloperLearningPage() {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [days, setDays]       = useState(30)
  const [view, setView]       = useState('daily') // 'daily' | 'weekly'

  useEffect(() => {
    setLoading(true)
    setError(null)
    getDeveloperLearning(days)
      .then(setData)
      .catch(err => setError(err?.response?.data?.detail || 'Failed to load learning data'))
      .finally(() => setLoading(false))
  }, [days])

  const topVulns   = data?.top_vulnerability_types || []
  const repeated   = data?.repeated_requests       || []
  const dailyTrend = data?.daily_trend             || []
  const weeklyTrend= data?.weekly_trend            || []
  const scanTypes  = data?.usage_by_scan_type      || []
  const autonomy   = data?.autonomy                || { score: 0, trend: 'Stable', distinct_types: 0, repeated_type_count: 0 }
  const maxVulns   = Math.max(...topVulns.map(v => v.count), 1)
  const maxRepeated= Math.max(...repeated.map(r => r.count), 1)
  const maxScan    = Math.max(...scanTypes.map(s => s.count), 1)

  const chartData   = view === 'daily' ? dailyTrend : weeklyTrend
  const chartDateKey= view === 'daily' ? 'date' : 'week'
  const allZero     = chartData.every(d => d.count === 0)

  return (
    <AppLayout>
      <div className="min-h-screen px-4 py-8 md:px-8" style={{ background: '#080808' }}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Learning Dashboard</h1>
            <p className="text-sm text-white/40 mt-1">
              Track your AI assist usage to understand which vulnerabilities you rely on most and how your autonomy evolves.
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
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

        {/* ── Error ──────────────────────────────────────────────────────── */}
        {error && (
          <div className="mb-6 rounded-xl p-4 text-sm text-red-400" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
            {error}
          </div>
        )}

        {/* ── Loading skeleton ───────────────────────────────────────────── */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8 animate-pulse">
            {[0,1,2,3].map(i => (
              <div key={i} className="h-24 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }} />
            ))}
          </div>
        )}

        {!loading && data && (
          <>
            {/* ── Top row: stat cards + autonomy ring ──────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <StatCard
                label="Total AI Requests"
                value={data.total_requests.toLocaleString()}
                sub={`Last ${days} days`}
              />
              <StatCard
                label="Distinct Vuln Types"
                value={autonomy.distinct_types}
                sub="Breadth of knowledge explored"
                color="#60a5fa"
              />
              <StatCard
                label="Repeated Patterns"
                value={autonomy.repeated_type_count}
                sub="Vuln types asked ≥ 2 times"
                color={autonomy.repeated_type_count > 3 ? '#f87171' : '#eab308'}
              />

              {/* Autonomy score card */}
              <div className="rounded-xl p-5 flex flex-col items-center justify-center gap-1" style={{ background: CARD_BG, border: CARD_BDR }}>
                <p className="text-xs text-white/50 uppercase tracking-widest mb-2">Autonomy Score</p>
                <ScoreRing score={autonomy.score} trend={autonomy.trend} />
              </div>
            </div>

            {/* ── Usage evolution chart ─────────────────────────────────── */}
            <div className="rounded-xl p-5 mb-6" style={{ background: CARD_BG, border: CARD_BDR }}>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-semibold text-white/80">AI Usage Over Time</p>
                <div className="flex gap-1">
                  {['daily', 'weekly'].map(v => (
                    <button
                      key={v}
                      onClick={() => setView(v)}
                      className="px-2.5 py-1 rounded text-xs font-medium transition-all capitalize"
                      style={{
                        background: view === v ? 'rgba(255,107,43,0.15)' : 'rgba(255,255,255,0.04)',
                        color:      view === v ? ACCENT : 'rgba(255,255,255,0.4)',
                        border:     view === v ? '1px solid rgba(255,107,43,0.3)' : '1px solid rgba(255,255,255,0.06)',
                      }}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
              {allZero ? (
                <p className="text-sm text-white/30 text-center py-6">
                  No AI usage recorded in this window. Start using "Assist with AI" on vulnerabilities.
                </p>
              ) : (
                <BarChart data={chartData} dateKey={chartDateKey} />
              )}
              {!allZero && (
                <div className="flex justify-between mt-2 text-xs text-white/25">
                  <span>{chartData[0]?.[chartDateKey] || ''}</span>
                  <span>{chartData[chartData.length - 1]?.[chartDateKey] || ''}</span>
                </div>
              )}
            </div>

            {/* ── Two-column: top vuln types + repeated requests ────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

              {/* Most requested vulnerability types */}
              <div className="rounded-xl p-5" style={{ background: CARD_BG, border: CARD_BDR }}>
                <p className="text-sm font-semibold text-white/80 mb-1">Most Requested Vulnerability Types</p>
                <p className="text-xs text-white/35 mb-4">Vulnerabilities you ask AI to help with most.</p>
                {topVulns.length === 0 ? (
                  <p className="text-sm text-white/30 text-center py-6">No AI requests yet in this window.</p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {topVulns.map((v, i) => (
                      <div key={v.vulnerability_type} className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-bold text-white/25 w-5">{i + 1}</span>
                          <span className="text-sm text-white/75 font-medium truncate">{v.vulnerability_type}</span>
                        </div>
                        <HBar label="" count={v.count} maxCount={maxVulns} color="#a78bfa" />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Repeated requests */}
              <div className="rounded-xl p-5" style={{ background: CARD_BG, border: CARD_BDR }}>
                <div className="flex items-start justify-between mb-1">
                  <p className="text-sm font-semibold text-white/80">Repeated Requests</p>
                  {repeated.length > 0 && (
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ml-2"
                      style={{ background: 'rgba(248,113,113,0.10)', color: '#f87171', border: '1px solid rgba(248,113,113,0.2)' }}
                    >
                      {repeated.length} pattern{repeated.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <p className="text-xs text-white/35 mb-4">
                  Vulnerability types you've asked about ≥ 2 times — review these to build independent expertise.
                </p>
                {repeated.length === 0 ? (
                  <div className="flex flex-col items-center py-6 gap-2">
                    <span className="text-2xl">🎉</span>
                    <p className="text-sm text-white/40">No repeated patterns — great diversity!</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {repeated.map((r, i) => (
                      <div key={r.vulnerability_type} className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-bold text-white/25 w-5">{i + 1}</span>
                          <span className="text-sm text-white/75 font-medium truncate">{r.vulnerability_type}</span>
                        </div>
                        <HBar
                          label=""
                          count={r.count}
                          maxCount={maxRepeated}
                          color="#f87171"
                          badge={r.count}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── Scan type breakdown ────────────────────────────────────── */}
            {scanTypes.length > 0 && (
              <div className="rounded-xl p-5 mb-6" style={{ background: CARD_BG, border: CARD_BDR }}>
                <p className="text-sm font-semibold text-white/80 mb-4">Usage by Scan Type</p>
                <div className="flex flex-col gap-3">
                  {scanTypes.map(s => (
                    <HBar
                      key={s.scan_type}
                      label={s.scan_type}
                      count={s.count}
                      maxCount={maxScan}
                      color={SCAN_TYPE_COLORS[s.scan_type] || '#6b7280'}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* ── Learning tip ───────────────────────────────────────────── */}
            <div
              className="rounded-xl p-5"
              style={{ background: 'rgba(255,107,43,0.04)', border: '1px solid rgba(255,107,43,0.15)' }}
            >
              <p className="text-sm font-semibold mb-2" style={{ color: ACCENT }}>How is the Autonomy Score calculated?</p>
              <p className="text-xs text-white/50 leading-5">
                Your score starts at <strong className="text-white/70">70</strong> and is adjusted based on your usage patterns.
                Repeated requests on the same vulnerability type reduce the score (the more repetitions, the bigger the penalty — up to −30 per type).
                Exploring a wider variety of distinct vulnerability types adds up to <strong className="text-white/70">+30 points</strong> (5 pts per unique type).
                A higher score means you're building real security expertise rather than relying on AI for the same issues repeatedly.
              </p>
            </div>
          </>
        )}

        {!loading && !data && !error && (
          <div className="text-center py-20 text-white/30 text-sm">No data to display.</div>
        )}
      </div>
    </AppLayout>
  )
}
