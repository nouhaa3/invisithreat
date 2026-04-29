import PropTypes from 'prop-types'

const ACCENT = '#ff8c5a'

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
      className="w-full text-left rounded-xl px-4 py-2.5 flex items-center gap-3 transition-all"
      style={{
        background: active ? 'rgba(255,107,43,0.12)' : 'rgba(255,255,255,0.03)',
        border: active ? '1px solid rgba(255,107,43,0.35)' : '1px solid rgba(255,255,255,0.07)',
        color: active ? '#FF8C5A' : 'rgba(255,255,255,0.35)',
      }}
    >
      <div className="flex flex-col">
        <span className="text-sm font-semibold">
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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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