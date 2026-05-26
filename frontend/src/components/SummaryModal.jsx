import { useState, useEffect } from 'react'

export default function SummaryModal({ open, onClose, scans = [], onGenerate }) {
  const [selected, setSelected] = useState(null)
  const [maxFindings, setMaxFindings] = useState(12)

  useEffect(() => {
    if (open) {
      setSelected(scans[0]?.id || null)
      setMaxFindings(12)
    }
  }, [open, scans])

  if (!open) return null

  const selectedScan = scans.find((scan) => String(scan.id) === String(selected)) || scans[0] || null
  const completedCount = scans.length

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center px-4 py-6">
      <button
        type="button"
        aria-label="Close AI summary dialog"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-summary-dialog-title"
        className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-[#0f0f0f] shadow-[0_20px_70px_rgba(0,0,0,0.6)]"
      >
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-orange-500 via-amber-400 to-orange-600" />

        <div className="p-5 md:p-6">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-orange-300">
                AI Summary
              </div>
              <h3 id="ai-summary-dialog-title" className="mt-3 text-lg md:text-xl font-semibold text-white">
                Choose a completed scan
              </h3>
              <p className="mt-1 text-xs text-white/45">
                Generate a concise summary and save it to the AI summaries list.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold text-white/65 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
            >
              Close
            </button>
          </div>

          <div className="mb-4 flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/30">Completed scans</p>
              <p className="mt-1 text-xs text-white/65">{completedCount} available for analysis</p>
            </div>
            <div className="rounded-full border border-orange-500/20 bg-orange-500/10 px-2.5 py-1 text-[10px] font-semibold text-orange-300">
              Max findings {maxFindings}
            </div>
          </div>

          <div className="max-h-[280px] overflow-y-auto pr-1">
            {scans.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/12 bg-white/[0.02] px-4 py-6 text-center">
                <p className="text-xs font-semibold text-white/70">No completed scans available</p>
                <p className="mt-1 text-[11px] text-white/35">Run a scan first, then generate the summary here.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {scans.map((scan) => {
                  const isSelected = String(selected) === String(scan.id)
                  return (
                    <label
                      key={scan.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition-all ${isSelected
                        ? 'border-orange-500/35 bg-orange-500/10'
                        : 'border-white/8 bg-white/[0.03] hover:border-white/14 hover:bg-white/[0.05]'
                        }`}
                    >
                      <input
                        type="radio"
                        name="scan"
                        value={scan.id}
                        checked={isSelected}
                        onChange={() => setSelected(scan.id)}
                        className="h-4 w-4 accent-orange-500"
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="rounded-full border border-white/10 bg-black/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/55">
                            {scan.method}
                          </span>
                          <span className="truncate text-xs font-semibold text-white/80">
                            {scan.analysis_type}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-[11px] text-white/35">
                          {scan.repo_url || scan.dast_target_url || 'No target'}
                        </p>
                      </div>

                      <div className="text-right text-[10px] text-white/35">
                        <div>Completed</div>
                        <div>{scan.completed_at ? new Date(scan.completed_at).toLocaleDateString() : 'N/A'}</div>
                      </div>
                    </label>
                  )
                })}
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-col gap-3 border-t border-white/8 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-sm">
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.22em] text-white/30">
                Max findings
              </label>
              <input
                type="number"
                min="1"
                max="50"
                value={maxFindings}
                onChange={(e) => setMaxFindings(Math.max(1, Math.min(50, Number(e.target.value || 12))))}
                className="w-24 rounded-xl border border-white/10 bg-black/55 px-3 py-2 text-xs text-white outline-none transition focus:border-orange-500/40 focus:ring-2 focus:ring-orange-500/20"
              />
            </div>

            <div className="flex items-center gap-2 sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white/70 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => onGenerate(selected || selectedScan?.id, maxFindings)}
                disabled={!selected && !selectedScan}
                className="rounded-xl border border-orange-500/25 bg-gradient-to-r from-orange-500/20 to-amber-500/15 px-3 py-2 text-xs font-semibold text-orange-200 transition hover:border-orange-400/40 hover:from-orange-500/30 hover:to-amber-500/20 hover:text-orange-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Generate summary
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
