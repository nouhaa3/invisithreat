import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import { listAllSummaries } from '../services/summaryService'

const SEV_COLORS = { critical: '#f87171', high: '#fb923c', medium: '#eab308', low: '#60a5fa', info: '#a3a3a3' }

function PriorityTag({ text }) {
  // detect severity keyword in text
  const lower = text.toLowerCase()
  const color = lower.includes('critical') ? SEV_COLORS.critical
    : lower.includes('high') ? SEV_COLORS.high
    : lower.includes('medium') ? SEV_COLORS.medium
    : lower.includes('low') ? SEV_COLORS.low
    : '#FF8C5A'
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
      style={{ background: `${color}15`, border: `1px solid ${color}30`, color }}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
      {text}
    </span>
  )
}

function SummaryCard({ s, defaultOpen }) {
  const [open, setOpen] = useState(!!defaultOpen)
  const navigate = useNavigate()
  const date = s.generated_at
    ? new Date(s.generated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—'

  return (
    <div className="rounded-2xl overflow-hidden transition-all"
      style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.06)' }}>
      {/* Header — always visible, clickable */}
      <button
        className="w-full flex items-center justify-between px-5 py-4 text-left gap-4"
        style={{ borderBottom: open ? '1px solid rgba(255,255,255,0.05)' : 'none' }}
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex items-center gap-3 min-w-0">
          {/* Project icon */}
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(255,107,43,0.1)', border: '1px solid rgba(255,107,43,0.15)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FF6B2B" strokeWidth="1.8">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white/90 truncate">
              {s.project_name || 'Unknown project'}
            </p>
            <p className="text-[11px] text-white/35 mt-0.5">
              {date} · {s.model || 'AI'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {(s.priorities || []).length > 0 && (
            <span className="text-[11px] px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(255,107,43,0.1)', border: '1px solid rgba(255,107,43,0.2)', color: '#FF8C5A' }}>
              {s.priorities.length} priorities
            </span>
          )}
          {s.project_id && (
            <button
              onClick={(e) => { e.stopPropagation(); navigate(`/projects/${s.project_id}`) }}
              className="text-[11px] px-2 py-0.5 rounded-full transition-colors hover:bg-white/10"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}
            >
              View project →
            </button>
          )}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2"
            className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
      </button>

      {/* Body — collapsible */}
      {open && (
        <div className="px-5 py-4 flex flex-col gap-4">
          {/* Summary text */}
          <p className="text-sm text-white/65 leading-relaxed">
            {s.summary}
          </p>

          {/* Priorities */}
          {(s.priorities || []).length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/25 font-semibold mb-2">Priorities</p>
              <div className="flex flex-wrap gap-1.5">
                {s.priorities.map((p, i) => <PriorityTag key={i} text={p} />)}
              </div>
            </div>
          )}

          {/* Remediation steps */}
          {(s.remediation_steps || []).length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/25 font-semibold mb-2">Remediation Steps</p>
              <ol className="flex flex-col gap-1.5">
                {s.remediation_steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-white/60 leading-relaxed">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5"
                      style={{ background: 'rgba(255,107,43,0.15)', color: '#FF8C5A', minWidth: '1.25rem' }}>
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* References */}
          {(s.references || []).length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/25 font-semibold mb-2">References</p>
              <div className="flex flex-wrap gap-2">
                {s.references.map((ref, i) => (
                  <span key={i} className="text-[11px] text-white/40 font-mono px-2 py-0.5 rounded"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    {ref}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function Summaries() {
  const [summaries, setSummaries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await listAllSummaries()
        if (!mounted) return
        setSummaries(Array.isArray(data) ? data : [])
      } catch (e) {
        if (!mounted) return
        setError(e.response?.data?.detail || e.message || 'Failed to load summaries')
      } finally {
        mounted && setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [])

  const filtered = summaries.filter(s => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (s.project_name || '').toLowerCase().includes(q)
      || (s.summary || '').toLowerCase().includes(q)
      || (s.priorities || []).some(p => p.toLowerCase().includes(q))
  })

  // Stats
  const projectCount = new Set(summaries.map(s => s.project_id).filter(Boolean)).size

  return (
    <AppLayout>
      <main className="flex-1 overflow-auto">
        <div className="px-8 py-8 max-w-4xl mx-auto">

          {/* Header */}
          <div className="mb-8 animate-slide-up">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-semibold mb-4"
              style={{ background: 'rgba(255,107,43,0.12)', border: '1px solid rgba(255,107,43,0.3)', color: '#FF8C5A' }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 2l1.6 4.7 4.9 1.3-4.1 3 1.6 4.7-4-2.9-4 2.9 1.6-4.7-4.1-3 4.9-1.3L12 2z"/>
              </svg>
              AI Summaries
            </div>
            <h1 className="text-2xl font-semibold text-white">Scan Intelligence</h1>
            <p className="text-sm text-white/40 mt-1">AI-generated analysis stored automatically after each completed scan.</p>
          </div>

          {/* Stats strip */}
          {!loading && summaries.length > 0 && (
            <div className="grid grid-cols-3 gap-3 mb-6 animate-slide-up" style={{ animationDelay: '0.04s' }}>
              {[
                { label: 'Total Summaries', value: summaries.length },
                { label: 'Projects covered', value: projectCount },
                { label: 'Total priorities', value: summaries.reduce((acc, s) => acc + (s.priorities?.length || 0), 0) },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-xl px-4 py-3 text-center"
                  style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <p className="text-xl font-bold text-white">{value}</p>
                  <p className="text-[11px] text-white/30 mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Search */}
          {!loading && summaries.length > 0 && (
            <div className="relative mb-5 animate-slide-up" style={{ animationDelay: '0.06s' }}>
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by project, content or priority..."
                className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm text-white placeholder:text-white/25 focus:outline-none"
                style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.07)' }}
              />
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex flex-col gap-3">
              {[0, 1, 2].map(i => (
                <div key={i} className="rounded-2xl px-5 py-4 animate-pulse"
                  style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-xl bg-white/8" />
                    <div className="flex flex-col gap-1.5 flex-1">
                      <div className="h-3 w-40 rounded bg-white/8" />
                      <div className="h-2 w-24 rounded bg-white/5" />
                    </div>
                  </div>
                  <div className="h-2.5 w-full rounded bg-white/5" />
                  <div className="h-2.5 w-4/5 rounded bg-white/5 mt-1.5" />
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="rounded-2xl p-5 text-center" style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <p className="text-sm font-semibold text-red-300">Could not load summaries</p>
              <p className="text-xs text-white/40 mt-1">{error}</p>
            </div>
          )}

          {/* Empty */}
          {!loading && !error && summaries.length === 0 && (
            <div className="rounded-2xl p-8 text-center" style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: 'rgba(255,107,43,0.08)', border: '1px solid rgba(255,107,43,0.15)' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FF6B2B" strokeWidth="1.7">
                  <path d="M12 2l1.6 4.7 4.9 1.3-4.1 3 1.6 4.7-4-2.9-4 2.9 1.6-4.7-4.1-3 4.9-1.3L12 2z"/>
                </svg>
              </div>
              <p className="text-sm font-semibold text-white/70">No summaries yet</p>
              <p className="text-xs text-white/35 mt-1">AI summaries are generated automatically after each completed scan.</p>
            </div>
          )}

          {/* No results for search */}
          {!loading && !error && summaries.length > 0 && filtered.length === 0 && (
            <div className="text-center py-10">
              <p className="text-sm text-white/40">No summaries match "<span className="text-white/60">{search}</span>"</p>
            </div>
          )}

          {/* Summaries list */}
          {!loading && !error && filtered.length > 0 && (
            <div className="flex flex-col gap-3 animate-slide-up" style={{ animationDelay: '0.08s' }}>
              {filtered.map((s, idx) => (
                <SummaryCard key={s.id || idx} s={s} defaultOpen={idx === 0} />
              ))}
            </div>
          )}

        </div>
      </main>
    </AppLayout>
  )
}
