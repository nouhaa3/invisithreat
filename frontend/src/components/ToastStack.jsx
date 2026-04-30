const TOAST_TYPES = {
  success: {
    color: '#22c55e',
    icon: 'M5 13l4 4L19 7',
  },
  error: {
    color: '#f87171',
    icon: 'M12 8v4M12 16h.01',
  },
  warning: {
    color: '#fbbf24',
    icon: 'M12 8v4M12 16h.01',
  },
  info: {
    color: '#60a5fa',
    icon: 'M12 8v4M12 16h.01',
  },
}

export default function ToastStack({ toasts = [], onDismiss }) {
  if (!toasts.length) return null

  return (
    <div
      className="fixed top-5 right-5 z-40 flex flex-col gap-2"
      style={{ width: 'min(360px, calc(100vw - 2.5rem))' }}
      aria-live="polite"
      role="status"
    >
      {toasts.map((toast) => {
        const cfg = TOAST_TYPES[toast.type] || TOAST_TYPES.info

        return (
          <div
            key={toast.id}
            className="relative rounded-2xl border px-4 py-3 animate-slide-up"
            style={{
              background: 'rgba(8,8,8,0.98)',
              borderColor: 'rgba(255,107,43,0.25)',
              boxShadow: '0 18px 45px rgba(0,0,0,0.7)',
            }}
          >
            <span
              className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full"
              style={{ background: cfg.color }}
            />
            <div className="flex items-start gap-3">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: cfg.color }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d={cfg.icon} />
                  {toast.type !== 'success' && <circle cx="12" cy="12" r="9" />}
                </svg>
              </div>
              <div className="flex-1">
                {toast.title && <p className="text-xs font-semibold text-white/70">{toast.title}</p>}
                <p className="text-sm text-white/75 leading-relaxed">{toast.message}</p>
              </div>
              <button
                type="button"
                onClick={() => onDismiss?.(toast.id)}
                className="text-white/35 hover:text-white/70 transition-colors"
                aria-label="Dismiss notification"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 6 6 18" />
                  <path d="M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}