/**
 * Primary button with loading state
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
  const base = 'w-full py-3 px-6 rounded-lg font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer'

  const variants = {
    primary: 'bg-brand-yellow text-black hover:brightness-110 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed',
    ghost: 'bg-transparent border border-brand-border text-white hover:border-gray-400 disabled:opacity-60',
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${base} ${variants[variant]} ${className}`}
    >
      {loading ? (
        <>
          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          <span>Patientez...</span>
        </>
      ) : children}
    </button>
  )
}
