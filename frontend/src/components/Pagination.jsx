export const PAGE_SIZE = 10

export default function Pagination({ page, totalPages, onPageChange }) {
  if (!totalPages || totalPages <= 1) return null

  return (
    <div className="flex items-center justify-center gap-2 mt-4">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page === 0}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white/70 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
        aria-label="Previous page"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      {Array.from({ length: totalPages }, (_, i) => {
        // Show first, last, current ±1, and ellipsis for the rest
        const show = i === 0 || i === totalPages - 1 || Math.abs(i - page) <= 1
        if (!show) {
          // Show ellipsis only once per gap
          if (i === 1 || i === totalPages - 2) {
            return (
              <span key={i} className="text-xs text-white/20 px-1">…</span>
            )
          }
          return null
        }
        return (
          <button
            key={i}
            onClick={() => onPageChange(i)}
            className="w-8 h-8 rounded-lg text-xs font-semibold transition-all"
            style={
              i === page
                ? { background: 'linear-gradient(135deg, #FF6B2B, #C13A00)', color: '#fff', border: '1px solid transparent' }
                : { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.07)' }
            }
          >
            {i + 1}
          </button>
        )
      })}

      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages - 1}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white/70 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
        aria-label="Next page"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
    </div>
  )
}
