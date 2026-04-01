import PropTypes from 'prop-types'

const OPTIONS = [
  { value: 'SAST', title: 'SAST', desc: 'Static code analysis' },
  { value: 'DAST', title: 'DAST', desc: 'Runtime / HTTP security checks' },
  { value: 'Secrets', title: 'Secrets', desc: 'Hardcoded credentials & tokens' },
  { value: 'Dependencies', title: 'Dependencies', desc: 'Vulnerable packages detection' },
  { value: 'Full', title: 'Full Scan', desc: 'SAST + DAST + Secrets + Dependencies' },
]

function Option({ option, active, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(option.value)}
      aria-pressed={active}
      className={[
        'w-full text-left rounded-xl px-4 py-2.5 flex items-center gap-3 transition-all duration-150',
        'border backdrop-blur-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-0 focus-visible:ring-orange-400/70',
        active
          ? 'border-orange-400/40 bg-orange-500/10 focus-visible:ring-orange-400/80'
          : 'border-white/10 bg-white/5 hover:border-orange-400/30 hover:bg-orange-500/5',
      ].join(' ')}
    >
      <div className="flex flex-col">
        <span className={`text-sm font-semibold ${active ? 'text-orange-300' : 'text-white/80'}`}>
          {option.title}
        </span>
        <span className="text-xs text-white/40">{option.desc}</span>
      </div>
    </button>
  )
}

Option.propTypes = {
  option: PropTypes.shape({ value: PropTypes.string, title: PropTypes.string, desc: PropTypes.string }).isRequired,
  active: PropTypes.bool,
  onSelect: PropTypes.func.isRequired,
}

export default function AnalysisTypeSelector({ value, onChange }) {
  return (
    <div className="flex flex-col gap-2">
      {OPTIONS.map((opt) => (
        <Option key={opt.value} option={opt} active={value === opt.value} onSelect={onChange} />
      ))}
    </div>
  )
}

AnalysisTypeSelector.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
}