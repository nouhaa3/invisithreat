import { Link } from 'react-router-dom'
import PublicNav from '../components/PublicNav'
import { CLISection } from '../components/landing'

const HOW_STEPS = [
  {
    title: 'Choose a scan mode',
    description: 'Pick demo, platform, or local-only based on your risk profile and workflow.',
  },
  {
    title: 'Run a secure scan',
    description: 'Launch SAST/DAST checks with clear progress and zero guesswork.',
  },
  {
    title: 'Prioritize and fix',
    description: 'Get ranked findings with practical guidance your team can act on quickly.',
  },
]

const MODE_CARDS = [
  {
    title: 'Demo mode',
    description: 'Explore the experience on a safe sample project with no risk to your code.',
    cta: { label: 'Try demo project', to: '/scans/new' },
  },
  {
    title: 'Platform scan',
    description: 'Fast scans with collaboration, dashboards, and team-level visibility.',
    cta: { label: 'Create account', to: '/signup' },
  },
  {
    title: 'Local-only scan',
    description: 'Maximum privacy. Run locally and keep the report on your machine.',
    cta: { label: 'Read local-only docs', to: '/docs' },
    highlight: true,
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
        <p className={`mt-4 text-sm md:text-base text-white/55 ${align === 'center' ? 'mx-auto max-w-2xl' : 'max-w-xl'}`}>
          {subtitle}
        </p>
      )}
    </div>
  )
}

function GlassCard({ children, className = '', ...rest }) {
  return (
    <div className={`glass rounded-2xl p-6 border border-white/10 ${className}`} {...rest}>
      {children}
    </div>
  )
}

function ModeCard({ title, description, cta, highlight }) {
  const cardClass = highlight
    ? 'border-brand-orange/40 shadow-orange-sm bg-[#15100c]'
    : 'border-white/10 bg-white/5'
  return (
    <div className={`rounded-2xl p-6 border ${cardClass} transition-all duration-300 hover:-translate-y-1`}>
      {highlight && (
        <span className="text-xs uppercase tracking-[0.2em] text-brand-orange">Recommended for privacy</span>
      )}
      <h3 className="mt-3 text-xl font-heading">{title}</h3>
      <p className="mt-3 text-sm text-white/60">{description}</p>
      <div className="mt-6">
        <PrimaryButton to={cta.to} className="w-full text-center">
          {cta.label}
        </PrimaryButton>
      </div>
    </div>
  )
}

export default function HowItWorksPage() {
  return (
    <div className="app-shell font-body scroll-smooth overflow-x-hidden">
      <PublicNav />

      <section className="pt-24 pb-16">
        <div className="max-w-6xl mx-auto px-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-xs text-white/60 uppercase tracking-[0.2em]">
            How it works
          </div>
          <h1 className="mt-4 text-4xl md:text-5xl font-heading leading-tight">
            Security workflows without the friction.
          </h1>
          <p className="mt-4 text-sm md:text-base text-white/55 max-w-2xl">
            From first scan to actionable remediation, everything is designed to help teams move fast without compromising trust.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <PrimaryButton to="/signup">Create account</PrimaryButton>
            <SecondaryButton to="/trust">Trust & security</SecondaryButton>
          </div>
        </div>
      </section>

      <section className="py-16 border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6">
          <SectionTitle
            eyebrow="Workflow"
            title="Three steps from scan to fix"
            subtitle="A predictable flow your team can run repeatedly with confidence."
          />
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {HOW_STEPS.map((step, idx) => (
              <GlassCard key={step.title} className="animate-slide-up" style={{ animationDelay: `${idx * 120}ms` }}>
                <div className="text-xs text-brand-orange">0{idx + 1}</div>
                <h3 className="mt-3 text-xl font-heading">{step.title}</h3>
                <p className="mt-3 text-sm text-white/55">{step.description}</p>
              </GlassCard>
            ))}
          </div>
        </div>
      </section>

      <CLISection />

      <section className="py-16 border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6">
          <SectionTitle
            eyebrow="Usage modes"
            title="Pick the mode that fits your risk profile"
            subtitle="Every mode uses the same scanning engine, with different data boundaries."
          />
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {MODE_CARDS.map((mode) => (
              <ModeCard key={mode.title} {...mode} />
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-heading">Run your first scan today</h2>
          <p className="mt-4 text-sm md:text-base text-white/55 max-w-2xl mx-auto">
            Start with demo mode or jump straight into a local-only scan.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <PrimaryButton to="/scans/new">Try demo project</PrimaryButton>
            <SecondaryButton to="/docs">Read the docs</SecondaryButton>
          </div>
        </div>
      </section>
    </div>
  )
}