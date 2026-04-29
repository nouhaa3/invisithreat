/**
 * Reusable Input field with label, orange glow on focus, and error handling
 */
import { useState } from 'react'

function EyeIcon({ visible }) {
  return visible ? (
    // eye-off
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ) : (
    // eye
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

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
  const [showPassword, setShowPassword] = useState(false)
  const isPassword = type === 'password'
  const resolvedType = isPassword ? (showPassword ? 'text' : 'password') : type

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="ui-label">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          type={resolvedType}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          disabled={disabled}
          className={`ui-input ${isPassword ? 'pl-5 pr-12' : 'px-5'} ${error ? 'border-red-500/50 bg-red-500/10 focus:border-red-400/80' : ''}`}
        />
        {isPassword && (
          <button
            type="button"
            tabIndex={-1}
            disabled={disabled}
            onClick={() => setShowPassword(v => !v)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors disabled:pointer-events-none"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            <EyeIcon visible={showPassword} />
          </button>
        )}
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
