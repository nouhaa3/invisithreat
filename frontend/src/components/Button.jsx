/**
 * Primary button with loading state + orange glow
 */
export default function Button({
  children,
  type = 'button',
  onClick,
  loading = false,
  disabled = false,
  variant = 'primary',
  size = 'md',
  className = '',
}) {
  const base = 'w-full inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all duration-300 relative overflow-hidden focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed'

  const sizes = {
    sm: 'px-4 py-2 text-xs',
    md: 'px-5 py-3 text-sm',
    lg: 'px-6 py-3.5 text-base',
  }

  const variants = {
    primary: `
      text-white active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed
      hover:shadow-orange-sm focus-visible:ring-2 focus-visible:ring-brand-orange/50
    `,
    secondary: 'bg-white/5 border border-white/15 text-white/80 hover:text-white hover:border-brand-orange/40 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-brand-orange/40',
    ghost: 'bg-transparent border border-white/10 text-white/60 hover:text-white hover:border-brand-orange/40 hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-brand-orange/40',
    danger: 'bg-red-500/15 border border-red-500/40 text-red-200 hover:bg-red-500/25 hover:text-white focus-visible:ring-2 focus-visible:ring-red-400/50',
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      style={variant === 'primary' ? {
        background: 'linear-gradient(135deg, #FF6B2B 0%, #E84D0E 60%, #C13A00 100%)',
        boxShadow: disabled || loading ? 'none' : '0 12px 28px rgba(255,107,43,0.28), inset 0 1px 0 rgba(255,255,255,0.2)',
      } : {}}
    >
      {/* Shimmer effect on hover */}
      {variant === 'primary' && !disabled && !loading && (
        <span className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-300"
          style={{ background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.12) 50%, transparent 60%)' }} />
      )}
      {loading ? (
        <>
          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          <span>Patientez...</span>
        </>
      ) : children}
    </button>
  )
}
