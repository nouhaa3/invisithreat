import { useEffect, useRef, useState } from 'react'
import AppLayout from '../components/AppLayout'
import { generateInsight, getTodayInsight, listInsights } from '../services/insightService'
import Pagination, { PAGE_SIZE } from '../components/Pagination'

const ORANGE = '#FF6B2B'
const ORANGE_LIGHT = '#FF8C5A'

// ─── Trend Badge ─────────────────────────────────────────────────────────────
function TrendBadge({ status }) {
  const cfg = {
    Improving: { color: '#4ade80', bg: 'rgba(74,222,128,0.1)', border: 'rgba(74,222,128,0.25)', icon: '↑' },
    Stable:    { color: '#60a5fa', bg: 'rgba(96,165,250,0.1)', border: 'rgba(96,165,250,0.25)', icon: '→' },
    Worsening: { color: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.25)', icon: '↓' },
  }[status] || { color: '#9ca3af', bg: 'rgba(156,163,175,0.1)', border: 'rgba(156,163,175,0.25)', icon: '?' }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}>
      <span>{cfg.icon}</span>
      {status}
    </span>
  )
}

// ─── Rendered Insight ─────────────────────────────────────────────────────────
function InsightBody({ text }) {
  if (!text) return null

  // Parse markdown-ish headings into styled sections
  const lines = text.split('\n')
  const elements = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (line.startsWith('## ')) {
      elements.push(
        <h3 key={i} className="text-sm font-bold text-white mt-5 mb-2 flex items-center gap-2">
          <span className="w-1 h-4 rounded-full flex-shrink-0" style={{ background: ORANGE }} />
          {line.replace(/^## /, '')}
        </h3>
      )
    } else if (line.startsWith('**') && line.endsWith('**')) {
      elements.push(
        <p key={i} className="text-sm font-semibold text-white/80 mt-3 mb-1">
          {line.replace(/\*\*/g, '')}
        </p>
      )
    } else if (line.startsWith('- ') || line.startsWith('• ')) {
      elements.push(
        <li key={i} className="text-sm text-white/65 leading-6 ml-4 list-disc">
          {line.replace(/^[-•] /, '')}
        </li>
      )
    } else if (line.trim() === '') {
      elements.push(<div key={i} className="h-1" />)
    } else {
      // Normal paragraph — render inline bold markers
      const parts = line.split(/(\*\*[^*]+\*\*)/)
      elements.push(
        <p key={i} className="text-sm text-white/65 leading-6">
          {parts.map((part, j) =>
            part.startsWith('**') && part.endsWith('**')
              ? <strong key={j} className="text-white/80 font-semibold">{part.replace(/\*\*/g, '')}</strong>
              : part
          )}
        </p>
      )
    }
    i++
  }

  return <div className="mt-2">{elements}</div>
}

// ─── History Card ─────────────────────────────────────────────────────────────
function HistoryCard({ insight, onSelect, selected }) {
  const d = new Date(insight.date)
  const dateStr = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  const genStr = new Date(insight.generated_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

  return (
    <button
      onClick={() => onSelect(insight)}
      className="w-full text-left px-4 py-3 rounded-xl transition-all"
      style={{
        background: selected ? 'rgba(255,107,43,0.08)' : 'rgba(255,255,255,0.02)',
        border: selected ? '1px solid rgba(255,107,43,0.25)' : '1px solid rgba(255,255,255,0.05)',
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-white/80">{dateStr}</span>
        <TrendBadge status={insight.trend_status} />
      </div>
      <p className="text-[11px] text-white/30 mt-1">Generated {genStr} · {insight.model_used || 'AI'}</p>
    </button>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DailyInsightsPage() {
  const [current, setCurrent] = useState(null)       // displayed insight
  const [history, setHistory] = useState([])
  const [total, setTotal] = useState(0)
  const [histPage, setHistPage] = useState(0)
  const [generating, setGenerating] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [loadingToday, setLoadingToday] = useState(true)
  const [error, setError] = useState(null)
  const contentRef = useRef(null)

  // Load today's cached insight
  useEffect(() => {
    getTodayInsight()
      .then(data => { if (data) setCurrent(data) })
      .catch(() => {})
      .finally(() => setLoadingToday(false))
  }, [])

  // Load history
  useEffect(() => {
    setLoadingHistory(true)
    listInsights({ limit: PAGE_SIZE, offset: histPage * PAGE_SIZE })
      .then(data => {
        setHistory(data.items || [])
        setTotal(data.total || 0)
      })
      .catch(() => {})
      .finally(() => setLoadingHistory(false))
  }, [histPage])

  const handleGenerate = async (forceRegenerate = false) => {
    setGenerating(true)
    setError(null)
    try {
      const result = await generateInsight({ forceRegenerate })
      setCurrent(result)
      // Refresh history
      const fresh = await listInsights({ limit: PAGE_SIZE, offset: 0 })
      setHistory(fresh.items || [])
      setTotal(fresh.total || 0)
      setHistPage(0)
      // Scroll to insight
      setTimeout(() => contentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to generate insight. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  const isToday = current
    ? new Date(current.date).toDateString() === new Date().toDateString()
    : false

  const displayDate = current
    ? new Date(current.date).toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      })
    : new Date().toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      })

  return (
    <AppLayout>
      <main className="max-w-6xl mx-auto px-4 py-8 flex flex-col gap-6">

        {/* ── Page Header ── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-1">
              {/* Brain/AI icon */}
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(255,107,43,0.1)', border: '1px solid rgba(255,107,43,0.18)' }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={ORANGE} strokeWidth="1.8">
                  <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.44-4.16Z"/>
                  <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.44-4.16Z"/>
                </svg>
              </div>
              <h1 className="text-xl font-bold text-white">Daily Security Insights</h1>
            </div>
            <p className="text-sm text-white/35 ml-12">
              AI-powered security analysis — your virtual Security Analyst & Coach
            </p>
          </div>

          <div className="flex items-center gap-3">
            {current && (
              <button
                onClick={() => handleGenerate(true)}
                disabled={generating}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-40"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  className={generating ? 'animate-spin' : ''}>
                  <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                </svg>
                Regenerate
              </button>
            )}
            <button
              onClick={() => handleGenerate(false)}
              disabled={generating}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 transition-all"
              style={{
                background: generating
                  ? 'rgba(255,107,43,0.4)'
                  : 'linear-gradient(135deg, #FF6B2B, #C13A00)',
                boxShadow: '0 4px 14px rgba(255,107,43,0.2)',
              }}
            >
              {generating ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Analyzing…
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                  </svg>
                  {current && isToday ? 'Refresh Today' : 'Generate Today\'s Insight'}
                </>
              )}
            </button>
          </div>
        </div>

        {/* ── Error Banner ── */}
        {error && (
          <div className="px-4 py-3 rounded-xl text-sm text-red-400"
            style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}>
            {error}
          </div>
        )}

        <div className="flex gap-6 items-start flex-col lg:flex-row">

          {/* ── Main Insight Panel ── */}
          <div className="flex-1 min-w-0" ref={contentRef}>
            {loadingToday && !current ? (
              <div className="rounded-2xl p-8 flex flex-col items-center gap-3"
                style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.06)' }}>
                <span className="w-8 h-8 rounded-full border-2 border-white/10 border-t-white/40 animate-spin" />
                <p className="text-white/30 text-sm">Loading today's insight…</p>
              </div>
            ) : !current ? (
              /* Empty state */
              <div className="rounded-2xl p-10 flex flex-col items-center gap-4 text-center"
                style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                  style={{ background: 'rgba(255,107,43,0.08)', border: '1px solid rgba(255,107,43,0.15)' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={ORANGE} strokeWidth="1.5">
                    <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.44-4.16Z"/>
                    <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.44-4.16Z"/>
                  </svg>
                </div>
                <div>
                  <p className="text-white font-semibold text-base">No insight for today yet</p>
                  <p className="text-white/35 text-sm mt-1 max-w-sm">
                    Generate your Daily Security Insight to receive an AI-powered analysis of your current security posture, trends, and personalized recommendations.
                  </p>
                </div>
                <button
                  onClick={() => handleGenerate(false)}
                  disabled={generating}
                  className="mt-2 flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg, #FF6B2B, #C13A00)', boxShadow: '0 4px 14px rgba(255,107,43,0.25)' }}
                >
                  {generating ? (
                    <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Analyzing…</>
                  ) : (
                    <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> Generate Insight</>
                  )}
                </button>
              </div>
            ) : (
              /* Insight card */
              <div className="rounded-2xl overflow-hidden"
                style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.06)' }}>
                {/* Card header */}
                <div className="px-6 py-4 flex items-center justify-between gap-3"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-semibold uppercase tracking-widest text-white/30">
                        Daily Security Insights
                      </span>
                      {isToday && (
                        <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(255,107,43,0.1)', border: '1px solid rgba(255,107,43,0.2)', color: ORANGE_LIGHT }}>
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" /> TODAY
                        </span>
                      )}
                    </div>
                    <p className="text-base font-bold text-white mt-0.5">{displayDate}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <TrendBadge status={current.trend_status} />
                    <span className="text-[11px] text-white/25">
                      {current.model_used || 'AI'} ·{' '}
                      {new Date(current.generated_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>

                {/* Insight body */}
                <div className="px-6 py-5">
                  {generating ? (
                    <div className="flex flex-col items-center gap-4 py-10">
                      <div className="relative w-12 h-12">
                        <span className="absolute inset-0 rounded-full border-2 border-white/5 animate-ping" />
                        <span className="absolute inset-1 rounded-full border-2 border-orange-500/30 border-t-orange-500 animate-spin" />
                      </div>
                      <div className="text-center">
                        <p className="text-white/60 text-sm font-medium">Analyzing your security posture…</p>
                        <p className="text-white/25 text-xs mt-1">The AI security analyst is reviewing your data</p>
                      </div>
                    </div>
                  ) : (
                    <InsightBody text={current.generated_insight} />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── History Sidebar ── */}
          <div className="w-full lg:w-64 flex-shrink-0">
            <div className="rounded-2xl overflow-hidden"
              style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <p className="text-xs font-semibold uppercase tracking-widest text-white/30">History</p>
              </div>
              <div className="p-3 flex flex-col gap-2">
                {loadingHistory ? (
                  <div className="py-6 flex justify-center">
                    <span className="w-5 h-5 rounded-full border-2 border-white/10 border-t-white/30 animate-spin" />
                  </div>
                ) : history.length === 0 ? (
                  <p className="text-xs text-white/25 text-center py-6">No history yet</p>
                ) : (
                  history.map(item => (
                    <HistoryCard
                      key={item.id}
                      insight={item}
                      selected={current?.id === item.id}
                      onSelect={setCurrent}
                    />
                  ))
                )}
                {total > PAGE_SIZE && (
                  <Pagination
                    page={histPage}
                    totalPages={Math.ceil(total / PAGE_SIZE)}
                    onPageChange={setHistPage}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </AppLayout>
  )
}
