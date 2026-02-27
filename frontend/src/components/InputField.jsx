/**
 * Reusable Input field with label and error handling
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
        <label className="text-sm font-medium text-gray-300">
          {label}
        </label>
      )}
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        disabled={disabled}
        className={`
          w-full px-4 py-3 rounded-lg text-sm text-white
          bg-brand-input border transition-all duration-200 outline-none
          placeholder:text-gray-500
          focus:ring-2 focus:ring-brand-yellow focus:border-transparent
          disabled:opacity-50 disabled:cursor-not-allowed
          ${error ? 'border-red-500 focus:ring-red-500' : 'border-brand-border hover:border-gray-500'}
        `}
      />
      {error && (
        <p className="text-xs text-red-400 mt-0.5">{error}</p>
      )}
    </div>
  )
}
