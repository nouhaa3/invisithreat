import { useState, useRef, useEffect } from 'react'

/**
 * Custom Select — matches the InvisiThreat dark glass design.
 *
 * Props:
 *   value          — currently selected value
 *   options        — string[] | { value: string, label: string }[]
 *   onChange(val)  — called with the new value string (not an event)
 *   disabled       — disables interaction
 *   loading        — shows spinner instead of chevron (implies disabled)
 *   size           — 'sm' (table cells) | 'md' (forms, default)
 *   className      — extra classes on the wrapper
 *   style          — extra styles on the wrapper
 *   getOptionStyle(value) → { color, bg, border } — per-option colour palette
 */
export default function Select({
  value,
  options = [],
  onChange,
  disabled = false,
  loading  = false,
  size     = 'md',
  className,
  style,
  getOptionStyle,
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  /* ── Close on outside click or Escape ── */
  useEffect(() => {
    if (!open) return
    const onMouse = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const onKey   = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onMouse)
    document.addEventListener('keydown',   onKey)
    return () => {
      document.removeEventListener('mousedown', onMouse)
      document.removeEventListener('keydown',   onKey)
    }
  }, [open])

  /* ── Normalise options ── */
  const opts = options.map(o => (typeof o === 'string' ? { value: o, label: o } : o))
  const selectedOpt   = opts.find(o => o.value === value) ?? opts[0]
  const selectedTheme = getOptionStyle ? getOptionStyle(value) : null

  const isDisabled = disabled || loading
  const pad   = size === 'sm' ? '0.35rem 0.65rem' : '0.55rem 0.8rem'
  const fSize = size === 'sm' ? '0.73rem'          : '0.875rem'

  return (
    <div ref={ref} className={`relative ${className ?? ''}`} style={style}>

      {/* ── Trigger button ── */}
      <button
        type="button"
        disabled={isDisabled}
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-2 outline-none transition-all"
        style={{
          padding:      pad,
          fontSize:     fSize,
          fontWeight:   600,
          borderRadius: '0.75rem',
          background:   selectedTheme?.bg  ?? 'rgba(255,255,255,0.05)',
          border:       `1px solid ${selectedTheme?.border ?? (open ? 'rgba(255,107,43,0.35)' : 'rgba(255,255,255,0.1)')}`,
          color:        selectedTheme?.color ?? 'rgba(255,255,255,0.8)',
          cursor:       isDisabled ? 'not-allowed' : 'pointer',
          opacity:      isDisabled ? 0.55 : 1,
          boxShadow:    open ? '0 0 0 2px rgba(255,107,43,0.12)' : 'none',
          transition:   'border-color 0.15s, box-shadow 0.15s, background 0.15s',
        }}
      >
        {/* colour dot for role-themed selects */}
        {selectedTheme && (
          <span style={{
            width: 7, height: 7, borderRadius: '50%',
            background: selectedTheme.color, flexShrink: 0,
          }} />
        )}

        <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selectedOpt?.label ?? value}
        </span>

        {/* Spinner OR chevron */}
        {loading ? (
          <span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin flex-shrink-0" />
        ) : (
          <svg
            width="11" height="11" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2.5"
            style={{
              flexShrink: 0, opacity: 0.45,
              transform:  open ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s',
            }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        )}
      </button>

      {/* ── Dropdown panel ── */}
      {open && !isDisabled && (
        <div
          className="absolute z-50 mt-1.5 rounded-xl overflow-hidden"
          style={{
            top:    '100%',
            left:   0,
            right:  0,
            minWidth: '100%',
            background:    'rgba(18,18,18,0.97)',
            border:        '1px solid rgba(255,255,255,0.1)',
            boxShadow:     '0 12px 40px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)',
            backdropFilter:'blur(16px)',
          }}
        >
          {opts.map((opt, idx) => {
            const optTheme  = getOptionStyle ? getOptionStyle(opt.value) : null
            const isActive  = opt.value === value
            const isLast    = idx === opts.length - 1

            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false) }}
                className="w-full flex items-center gap-2 transition-colors"
                style={{
                  padding:     pad,
                  fontSize:    fSize,
                  fontWeight:  600,
                  textAlign:   'left',
                  color:       optTheme?.color ?? (isActive ? '#FF8C5A' : 'rgba(255,255,255,0.65)'),
                  background:  isActive
                    ? (optTheme?.bg ?? 'rgba(255,107,43,0.1)')
                    : 'transparent',
                  borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.05)',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = optTheme?.bg ?? 'rgba(255,255,255,0.07)'
                  e.currentTarget.style.color = optTheme?.color ?? '#fff'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = isActive
                    ? (optTheme?.bg ?? 'rgba(255,107,43,0.1)')
                    : 'transparent'
                  e.currentTarget.style.color = optTheme?.color ?? (isActive ? '#FF8C5A' : 'rgba(255,255,255,0.65)')
                }}
              >
                {/* colour dot */}
                {optTheme && (
                  <span style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: optTheme.color, flexShrink: 0,
                  }} />
                )}

                <span style={{ flex: 1 }}>{opt.label}</span>

                {/* checkmark for active option */}
                {isActive && (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                    stroke={optTheme?.color ?? '#FF8C5A'} strokeWidth="2.5"
                    style={{ flexShrink: 0, opacity: 0.9 }}
                  >
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
