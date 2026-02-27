/**
 * Reusable Input field with label, orange glow on focus, and error handling
 */
export default function InputField({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  error,
  autoComplete,
  disabled = false,
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-xs font-semibold text-white/40 uppercase tracking-widest">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          disabled={disabled}
          className={`
            w-full px-5 py-4 rounded-xl text-base text-white
            transition-all duration-300 outline-none
            placeholder:text-white/20
            disabled:opacity-40 disabled:cursor-not-allowed
            ${error
              ? 'border border-red-500/50 bg-red-500/5'
              : 'border border-brand-border bg-brand-input hover:border-white/15 focus:border-brand-orange/60'
            }
          `}
          style={!error ? {
            boxShadow: value ? '0 0 0 0 transparent' : undefined,
          } : {}}
          onFocus={(e) => {
            if (!error) {
              e.target.style.boxShadow = '0 0 0 3px rgba(255,107,43,0.15), inset 0 1px 0 rgba(255,255,255,0.04)'
              e.target.style.borderColor = 'rgba(255,107,43,0.5)'
            }
          }}
          onBlur={(e) => {
            if (!error) {
              e.target.style.boxShadow = ''
              e.target.style.borderColor = ''
            }
          }}
        />
      </div>
      {error && (
        <p className="text-xs text-red-400 flex items-center gap-1">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}
    </div>
  )
}
