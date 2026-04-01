import PropTypes from 'prop-types'

const ACCENT = '#ff8c5a'

const PROJECT_TYPES = [
  { value: 'Web Application', title: 'Web Application', desc: 'Browser-based frontends & SPAs' },
  { value: 'Mobile Application', title: 'Mobile Application', desc: 'iOS/Android clients and APIs' },
  { value: 'Desktop Application', title: 'Desktop Application', desc: 'Native or cross-platform apps' },
  { value: 'API / Backend', title: 'API / Backend', desc: 'Services, microservices, and APIs' },
  { value: 'Other', title: 'Other', desc: 'Scripts, tooling, or mixed workloads' },
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

export default function ProjectTypeSelector({ value, onChange }) {
  return (
    <div className="flex flex-col gap-2">
      {PROJECT_TYPES.map((opt) => (
        <Option key={opt.value} option={opt} active={value === opt.value} onSelect={onChange} />
      ))}
    </div>
  )
}

ProjectTypeSelector.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
}