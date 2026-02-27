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
  className = '',
}) {
  const base = 'w-full py-3 px-6 rounded-xl font-semibold text-sm transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer relative overflow-hidden'

  const variants = {
    primary: `
      text-white active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed
      hover:shadow-orange focus:outline-none focus:ring-2 focus:ring-brand-orange/50
    `,
    ghost: 'bg-transparent border border-brand-border text-white/70 hover:text-white hover:border-brand-orange/40 hover:bg-white/5 disabled:opacity-60',
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${base} ${variants[variant]} ${className}`}
      style={variant === 'primary' ? {
        background: 'linear-gradient(135deg, #FF6B2B 0%, #E84D0E 60%, #C13A00 100%)',
        boxShadow: disabled || loading ? 'none' : '0 4px 24px rgba(255,107,43,0.35), inset 0 1px 0 rgba(255,255,255,0.15)',
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
