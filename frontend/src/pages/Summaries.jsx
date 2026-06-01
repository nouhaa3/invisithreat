import { useEffect, useState } from 'react'
import AppLayout from '../components/AppLayout'
import Pagination, { PAGE_SIZE } from '../components/Pagination'
import { listAllSummaries } from '../services/summaryService'

export default function Summaries() {
  const [summaries, setSummaries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [summariesPage, setSummariesPage] = useState(0)

  const formatDate = (value) => {
    if (!value) return '—'
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return '—'
    return parsed.toLocaleString()
  }

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
        console.error('Failed to load summaries', e)
        if (!mounted) return
        setError(e.response?.data?.detail || e.message || 'Failed to load summaries')
      } finally {
        mounted && setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [])

  const totalSummaries = summaries.length
  const latestSummary = summaries[0] || null
  const modelCount = new Set(summaries.map((s) => s.model).filter(Boolean)).size

  return (
    <AppLayout>
      <main className="flex-1 overflow-auto">
        <section className="ui-page">
          <div className="ui-container">
            <div className="ui-hero animate-slide-up" style={{ animationDelay: '0.02s' }}>
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-xl">
                  <div className="ui-chip mb-3" style={{ background: 'rgba(255,107,43,0.12)', borderColor: 'rgba(255,107,43,0.35)', color: '#FF8C5A' }}>
                    AI Summaries
                  </div>
                  <h1 className="text-2xl md:text-3xl font-semibold text-white">
                    Saved intelligence from your scans
                  </h1>
                  <p className="text-sm text-white/45 mt-2 leading-relaxed">
                    Review AI‑generated summaries, priorities, and remediation guidance — all in one curated feed.
                  </p>
                </div>
              </div>
            </div>

            {loading && (
              <div className="mt-6 space-y-3">
                {[0, 1, 2].map((idx) => (
                  <div key={idx} className="ui-row p-5 animate-pulse">
                    <div className="flex flex-col gap-3">
                      <div className="flex gap-2">
                        <div className="h-5 w-24 rounded-full bg-white/10" />
                        <div className="h-5 w-28 rounded-full bg-white/10" />
                      </div>
                      <div className="h-3 w-full rounded bg-white/5" />
                      <div className="h-3 w-4/5 rounded bg-white/5" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!loading && error && (
              <div className="ui-trust-strip mt-6" style={{ borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)' }}>
                <p className="text-red-300 text-sm font-semibold">Could not load summaries</p>
                <p className="text-sm text-white/45 mt-2">{error}</p>
              </div>
            )}

            {!loading && summaries.length === 0 && (
              <div className="ui-card mt-6 p-6 text-center">
                <p className="text-sm font-semibold text-white/80">No summaries available yet</p>
                <p className="text-sm text-white/45 mt-2">Generate a new AI summary from a completed scan to populate this view.</p>
              </div>
            )}

            {!loading && summaries.length > 0 && (
              <div className="mt-6 flex flex-col gap-3">
                {summaries.slice(summariesPage * PAGE_SIZE, (summariesPage + 1) * PAGE_SIZE).map((s) => (
                  <div key={s.id} className="ui-row p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="ui-chip" style={{ background: 'rgba(255,107,43,0.15)', borderColor: 'rgba(255,107,43,0.35)', color: '#FF8C5A' }}>
                            {s.model || 'AI Summary'}
                          </span>
                          <span className="ui-chip" style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}>
                            Scan {s.scan_id ? String(s.scan_id).slice(0, 8) : '—'}
                          </span>
                        </div>

                        <p className="mt-3 text-sm leading-6 text-white/75 line-clamp-3">
                          {s.summary}
                        </p>
                      </div>

                      <div className="flex flex-row items-center gap-3 lg:flex-col lg:items-end lg:text-right lg:shrink-0">
                        <div className="text-[11px] uppercase tracking-[0.2em] text-white/35">
                          Generated
                        </div>
                        <div className="text-sm font-medium text-white/70">
                          {formatDate(s.generated_at)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!loading && summaries.length > 0 && (
              <Pagination
                page={summariesPage}
                totalPages={Math.ceil(summaries.length / PAGE_SIZE)}
                onPageChange={setSummariesPage}
              />
            )}
          </div>
        </section>
      </main>
    </AppLayout>
  )
}
