import { Link } from 'react-router-dom'
import PublicNav from '../components/PublicNav'
import { ScreenshotShowcase, BenchmarkTable } from '../components/landing'

const FEATURES = [
  {
    title: 'SAST + DAST coverage',
    description: 'Static and dynamic analysis for a complete security picture.',
  },
  {
    title: 'Secrets detection',
    description: 'Identify leaked keys, tokens, and sensitive configs early.',
  },
  {
    title: 'Risk prioritization',
    description: 'Focus on high-impact issues with severity-led ordering.',
  },
  {
    title: 'Team workflows',
    description: 'Assign, track, and validate fixes with shared visibility.',
  },
  {
    title: 'Actionable guidance',
    description: 'Clear remediation hints your developers can implement fast.',
  },
  {
    title: 'Unified dashboard',
    description: 'Monitor posture, progress, and trends across projects.',
  },
]

const TESTIMONIALS = [
  {
    quote: 'Finally a scan workflow that respects privacy without slowing teams down.',
    name: 'Security Lead',
    org: 'Product Studio',
  },
  {
    quote: 'Our developers get clear guidance and less noise from false alarms.',
    name: 'Engineering Manager',
    org: 'Growth SaaS',
  },
  {
    quote: 'Local-only mode was the key to adoption in our pipeline.',
    name: 'DevOps Architect',
    org: 'Cloud Consultancy',
  },
]

const METRICS = [
  { label: 'Median scan time', value: '2.4s' },
  { label: 'Avg. false positives', value: 'Low' },
  { label: 'Supported languages', value: '20+' },
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
        <p className={`mt-4 text-sm md:text-base text-white/55 ${align === 'center' ? 'mx-auto max-w-2xl' : 'max-w-xl'}`}>
          {subtitle}
        </p>
      )}
    </div>
  )
}

function FeatureCard({ title, description }) {
  return (
    <div className="glass rounded-2xl p-6 border border-white/10 hover:border-brand-orange/30 transition-colors duration-300">
      <div className="h-10 w-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
        <div className="h-2 w-2 rounded-full bg-brand-orange" />
      </div>
      <h3 className="mt-4 text-lg font-heading">{title}</h3>
      <p className="mt-2 text-sm text-white/55">{description}</p>
    </div>
  )
}

function MetricCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-center">
      <p className="text-2xl font-heading text-white">{value}</p>
      <p className="mt-2 text-xs text-white/45 uppercase tracking-[0.2em]">{label}</p>
    </div>
  )
}

export default function PublicFeaturesPage() {
  return (
    <div className="app-shell font-body scroll-smooth overflow-x-hidden">
      <PublicNav />

      <section className="pt-24 pb-16">
        <div className="max-w-6xl mx-auto px-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-xs text-white/60 uppercase tracking-[0.2em]">
            Features
          </div>
          <h1 className="mt-4 text-4xl md:text-5xl font-heading leading-tight">
            Features built for modern security teams.
          </h1>
          <p className="mt-4 text-sm md:text-base text-white/55 max-w-2xl">
            Everything you need to scan faster, collaborate better, and keep control of sensitive code.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <PrimaryButton to="/signup">Create account</PrimaryButton>
            <SecondaryButton to="/how">See how it works</SecondaryButton>
          </div>
        </div>
      </section>

      <section className="py-16 border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6">
          <SectionTitle
            eyebrow="Core platform"
            title="Everything you need to ship secure code"
            subtitle="Built for developers, security managers, and growing teams who need clarity, not noise."
          />
          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <FeatureCard key={feature.title} {...feature} />
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6">
          <SectionTitle
            eyebrow="Outcomes"
            title="Fast scans, clear priorities"
            subtitle="Get results you can trust without waiting for heavy pipelines."
          />
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {METRICS.map((metric) => (
              <MetricCard key={metric.label} {...metric} />
            ))}
          </div>
        </div>
      </section>

      <ScreenshotShowcase />

      <BenchmarkTable />

      <section className="py-16 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-white/40">Built for teams</p>
              <h3 className="mt-3 text-2xl font-heading">Trusted by developers and security leaders</h3>
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-white/50">
              <span className="px-4 py-2 rounded-full border border-white/10 bg-white/5">Product Studio</span>
              <span className="px-4 py-2 rounded-full border border-white/10 bg-white/5">Cloud Consultancy</span>
              <span className="px-4 py-2 rounded-full border border-white/10 bg-white/5">Growth SaaS</span>
            </div>
          </div>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {TESTIMONIALS.map((item) => (
              <div key={item.name} className="glass rounded-2xl p-6 border border-white/10">
                <p className="text-sm text-white/70">"{item.quote}"</p>
                <div className="mt-4 text-xs text-white/45">
                  <span className="text-white/70 font-semibold">{item.name}</span> - {item.org}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-heading">Ready to scan with confidence?</h2>
          <p className="mt-4 text-sm md:text-base text-white/55 max-w-2xl mx-auto">
            Start with demo mode, or jump straight into a platform scan with your team.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <PrimaryButton to="/signup">Create account</PrimaryButton>
            <SecondaryButton to="/trust">Trust & security</SecondaryButton>
          </div>
        </div>
      </section>
    </div>
  )
}