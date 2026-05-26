import { useState, useEffect } from 'react'
import { listProjectSummaries } from '../services/summaryService'

export default function SummarySidebar({ projectId }) {
  const [summaries, setSummaries] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!projectId) return
    let mounted = true
    setLoading(true)
    listProjectSummaries(projectId).then((res) => {
      if (!mounted) return
      setSummaries(res || [])
    }).catch(() => {}).finally(() => mounted && setLoading(false))
    return () => { mounted = false }
  }, [projectId])

  return (
    <div className="w-72 ml-6 flex-shrink-0">
      <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-white">AI Summaries</h4>
          <span className="text-xs text-white/40">{loading ? 'Loading...' : `${summaries.length}`}</span>
        </div>
        {summaries.length === 0 && <p className="text-white/30 text-sm">No summaries yet. Generate one from a completed scan.</p>}
        <div className="flex flex-col gap-2">
          {summaries.map(s => (
            <div key={s.id} className="p-2 rounded hover:bg-white/2 cursor-pointer">
              <div className="text-xs text-white/80 font-medium truncate">{s.model || 'AI Summary'}</div>
              <div className="text-[11px] text-white/30">{new Date(s.generated_at).toLocaleString()}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
