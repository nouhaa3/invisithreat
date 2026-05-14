import { Link } from 'react-router-dom'
import PublicNav from '../components/PublicNav'

const COLLECTED_ITEMS = [
  'Finding metadata (rule id, severity, category, description)',
  'Location context (file path and line number)',
  'Short code excerpt (single line) when provided by the scanner',
  'Project metadata (name, language, scan method, timestamps)',
  'User and access data (roles, API key usage timestamps)',
  'Audit logs for authentication and admin actions',
]

const NOT_COLLECTED_ITEMS = [
  'Full source files or repository history',
  'Build artifacts or compiled binaries',
  'Local environment files outside the scan payload',
  'Secrets vault data not surfaced by a finding',
  'Unscanned files excluded by ignore rules',
  'Local dev machine metadata beyond scan context',
]

const TRUST_GRID = [
  {
    title: 'Demo mode',
    items: [
      { label: 'Scans', value: 'Sample project only' },
      { label: 'Data sent', value: 'None' },
      { label: 'Storage', value: 'No project data stored' },
    ],
  },
  {
    title: 'Platform scan',
    items: [
      { label: 'Scans', value: 'Connected repo or upload' },
      { label: 'Data sent', value: 'Findings metadata and scan stats' },
      { label: 'Storage', value: 'Results and workflow only' },
    ],
  },
  {
    title: 'Local-only',
    items: [
      { label: 'Scans', value: 'Local machine only' },
      { label: 'Data sent', value: 'Nothing leaves your environment' },
      { label: 'Storage', value: 'Local JSON report' },
    ],
    highlight: true,
  },
]

const RETENTION_ITEMS = [
  {
    title: 'Audit logs',
    value: '10 days',
    note: 'Auto cleanup job runs daily on the backend.',
  },
  {
    title: 'Scan results',
    value: 'Until project deletion',
    note: 'Deleting a project removes scans and linked metrics.',
  },
  {
    title: 'Notifications',
    value: 'Permanent',
    note: 'All notifications are kept permanently for audit trail.',
  },
  {
    title: 'API keys',
    value: 'Until revoked',
    note: 'Revoked keys are disabled immediately.',
  },
]

const PURGE_ACTIONS = [
  {
    title: 'Delete a project',
    desc: 'Remove scans, findings, and related metrics for a project you own.',
  },
  {
    title: 'Revoke API keys',
    desc: 'Disable CLI access tokens immediately from the settings page.',
  },
]

function PrimaryButton({ to, children, className = '' }) {
  return (
    <Link
      to={to}
      className={`inline-flex items-center justify-center px-6 py-3 rounded-full text-sm font-semibold text-white transition-all duration-300 hover:shadow-orange-sm ${className}`}
      style={{
        background: 'linear-gradient(135deg, #FF6B2B 0%, #E84D0E 60%, #C13A00 100%)',
        boxShadow: '0 12px 24px rgba(255,107,43,0.25)',
      }}
    >
      {children}
    </Link>
  )
}

function SecondaryButton({ to, children, className = '' }) {
  return (
    <Link
      to={to}
      className={`inline-flex items-center justify-center px-6 py-3 rounded-full text-sm font-semibold border border-white/15 text-white/80 hover:text-white hover:border-brand-orange/40 hover:bg-white/5 transition-all duration-300 ${className}`}
    >
      {children}
    </Link>
  )
}

function SectionTitle({ eyebrow, title, subtitle, align = 'left' }) {
  return (
    <div className={align === 'center' ? 'text-center' : ''}>
      {eyebrow && (
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-xs text-white/60 uppercase tracking-[0.2em]">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-orange" />
          {eyebrow}
        </div>
      )}
      <h2 className={`mt-4 text-3xl md:text-4xl font-heading ${align === 'center' ? 'mx-auto' : ''}`}>
        {title}
      </h2>
      {subtitle && (
        <p className={`mt-4 text-sm md:text-base text-white/55 ${align === 'center' ? 'mx-auto max-w-2xl' : 'max-w-2xl'}`}>
          {subtitle}
        </p>
      )}
    </div>
  )
}

function BulletList({ items, tone }) {
  const color = tone === 'positive' ? '#4ade80' : '#f87171'
  const bg = tone === 'positive' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)'
  const border = tone === 'positive' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.22)'

  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2">
          <span
            className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: bg, border: `1px solid ${border}`, color }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <polyline points={tone === 'positive' ? '20 6 9 17 4 12' : '6 6 18 18'} />
              {tone !== 'positive' && <polyline points="18 6 6 18" />}
            </svg>
          </span>
          <span className="text-sm text-white/70 leading-relaxed">{item}</span>
        </li>
      ))}
    </ul>
  )
}

function RetentionRow({ title, value, note }) {
  return (
    <div className="flex flex-col md:flex-row md:items-center gap-2 py-3 border-b border-white/5 last:border-b-0">
      <div className="md:w-48 text-sm font-semibold text-white/80">{title}</div>
      <div className="flex-1 text-sm text-white/60">{value}</div>
      {note && <div className="text-xs text-white/35 md:text-right md:w-64">{note}</div>}
    </div>
  )
}

function ActionCard({ title, desc }) {
  return (
    <div className="flex flex-col gap-3 p-4 rounded-2xl border"
      style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)' }}>
      <div>
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="text-xs text-white/45 mt-1 leading-relaxed">{desc}</p>
      </div>
      <span className="text-[11px] text-white/40 uppercase tracking-widest">Available in dashboard</span>
    </div>
  )
}

function TrustCard({ title, items, highlight }) {
  const cardClass = highlight
    ? 'border-brand-orange/40 shadow-orange-sm bg-[#15100c]'
    : 'border-white/10 bg-white/5'
  return (
    <div className={`rounded-2xl p-6 border ${cardClass}`}>
      <h3 className="text-lg font-heading">{title}</h3>
      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <div key={item.label} className="flex items-start justify-between gap-4 text-sm">
            <span className="text-white/50">{item.label}</span>
            <span className="text-white/80 text-right">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function FlowStep({ title, desc, highlight }) {
  return (
    <div
      className="flex flex-col gap-2 p-4 rounded-2xl border min-w-[180px]"
      style={{
        background: highlight ? 'rgba(255,107,43,0.08)' : 'rgba(255,255,255,0.03)',
        borderColor: highlight ? 'rgba(255,107,43,0.3)' : 'rgba(255,255,255,0.08)',
      }}
    >
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="text-xs text-white/45 leading-relaxed">{desc}</p>
      {highlight && (
        <span className="text-[11px] font-semibold text-orange-300 uppercase tracking-widest">source stays here</span>
      )}
    </div>
  )
}

function FlowArrow() {
  return (
    <div className="flex items-center justify-center text-white/30 rotate-90 md:rotate-0">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M5 12h14" />
        <polyline points="13 6 19 12 13 18" />
      </svg>
    </div>
  )
}

export default function TrustCenterPage() {
  return (
    <div className="app-shell font-body scroll-smooth overflow-x-hidden">
      <PublicNav />

      <section className="pt-24 pb-16">
        <div className="max-w-6xl mx-auto px-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-xs text-white/60 uppercase tracking-[0.2em]">
            Trust center
          </div>
          <h1 className="mt-4 text-4xl md:text-5xl font-heading leading-tight">
            Trust & Security <span className="text-gradient">before you commit</span>.
          </h1>
          <p className="mt-4 text-sm md:text-base text-white/55 max-w-2xl">
            This page explains exactly what data is collected, what is never collected, how long it is retained,
            and how it can be removed once you join the platform.
          </p>
          <div className="mt-6 flex flex-wrap gap-2 text-xs text-white/60">
            <span className="chip">Results-only payloads</span>
            <span className="chip">Local-first scanning</span>
            <span className="chip">Audit-ready controls</span>
          </div>
          <div className="mt-6 flex flex-wrap gap-3 text-xs text-white/60">
            <a href="#modes" className="hover:text-white transition-colors">Modes</a>
            <span className="text-white/20">|</span>
            <a href="#data" className="hover:text-white transition-colors">Data</a>
            <span className="text-white/20">|</span>
            <a href="#retention" className="hover:text-white transition-colors">Retention</a>
            <span className="text-white/20">|</span>
            <a href="#purge" className="hover:text-white transition-colors">Purge</a>
            <span className="text-white/20">|</span>
            <a href="#flow" className="hover:text-white transition-colors">Flow</a>
          </div>
        </div>
      </section>

      <section id="modes" className="py-14 border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6">
          <SectionTitle
            eyebrow="Trust & security"
            title="Three modes. Clear boundaries."
            subtitle="Pick the right balance of speed, collaboration, and privacy for every scan."
          />
          <div className="mt-8 grid md:grid-cols-3 gap-6">
            {TRUST_GRID.map((item) => (
              <TrustCard key={item.title} {...item} />
            ))}
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3 text-xs text-white/50">
            <span className="px-3 py-1 rounded-full border border-white/10 bg-white/5">SOC 2 (planned)</span>
            <span className="px-3 py-1 rounded-full border border-white/10 bg-white/5">ISO 27001 (planned)</span>
            <span className="px-3 py-1 rounded-full border border-white/10 bg-white/5">GDPR-ready controls</span>
          </div>
        </div>
      </section>

      <section id="data" className="py-14 border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6">
          <SectionTitle
            eyebrow="Data transparency"
            title="What we collect vs. what we never touch"
            subtitle="We keep the minimum required to show risk and remediation progress. Source code stays in your environment."
          />
          <div className="mt-10 grid lg:grid-cols-2 gap-6">
            <div className="glass rounded-2xl p-6">
              <h3 className="text-lg font-heading">Collected data</h3>
              <p className="mt-2 text-sm text-white/50">Minimal metadata required for dashboards and reports.</p>
              <div className="mt-5">
                <BulletList items={COLLECTED_ITEMS} tone="positive" />
              </div>
            </div>
            <div className="glass rounded-2xl p-6">
              <h3 className="text-lg font-heading">Never collected</h3>
              <p className="mt-2 text-sm text-white/50">We do not store or retain source code artifacts.</p>
              <div className="mt-5">
                <BulletList items={NOT_COLLECTED_ITEMS} tone="negative" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="retention" className="py-14">
        <div className="max-w-6xl mx-auto px-6">
          <SectionTitle
            eyebrow="Retention"
            title="Clear retention windows"
            subtitle="Retention defaults are documented and enforced by scheduled cleanup jobs."
          />
          <div className="mt-8 glass rounded-2xl p-6">
            {RETENTION_ITEMS.map((item) => (
              <RetentionRow key={item.title} {...item} />
            ))}
            <p className="mt-4 text-xs text-white/40">Custom retention can be configured for enterprise agreements.</p>
          </div>
        </div>
      </section>

      <section id="purge" className="py-14 border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6">
          <SectionTitle
            eyebrow="Purge controls"
            title="You control removal"
            subtitle="Once signed in, you can remove projects, disable keys, and clear notifications." 
          />
          <div className="mt-8 grid md:grid-cols-3 gap-4">
            {PURGE_ACTIONS.map((action) => (
              <ActionCard key={action.title} {...action} />
            ))}
          </div>
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <PrimaryButton to="/signup">Create account</PrimaryButton>
            <SecondaryButton to="/login">Login to manage</SecondaryButton>
          </div>
        </div>
      </section>

      <section id="flow" className="py-14 border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6">
          <SectionTitle
            eyebrow="Data flow"
            title="Source stays with you"
            subtitle="Local scans and DAST run on your side. Only findings metadata reaches the platform."
          />
          <div className="mt-8 flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
            <FlowStep title="Client environment" desc="Source code lives here." highlight />
            <FlowArrow />
            <FlowStep title="Local scanner / DAST" desc="Scans run locally or against a target URL." />
            <FlowArrow />
            <FlowStep title="Findings JSON" desc="Only results and metadata are transmitted." />
            <FlowArrow />
            <FlowStep title="InvisiThreat platform" desc="Dashboards, alerts, and reports." />
          </div>
          <div className="mt-6 rounded-2xl border border-brand-orange/25 bg-[#140b06] p-5 text-xs text-white/55">
            Git-based scans are optional and require explicit integration with restricted tokens.
          </div>
        </div>
      </section>

      <footer className="border-t border-white/5 py-10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="text-sm text-white/55">(c) 2026 InvisiThreat. All rights reserved.</div>
          <Link to="/" className="text-sm text-white/60 hover:text-white">Back to home</Link>
        </div>
      </footer>
    </div>
  )
}