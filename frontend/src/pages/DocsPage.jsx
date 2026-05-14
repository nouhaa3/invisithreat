import { Link } from 'react-router-dom'
import PublicNav from '../components/PublicNav'

const DOC_CARDS = [
  {
    title: 'Authentication API',
    description: 'Token usage, login flows, and access control guidance.',
  },
  {
    title: 'HTTPS setup',
    description: 'Local certificates, dev proxies, and secure defaults.',
  },
  {
    title: 'Roles & permissions',
    description: 'Understand admin, manager, and viewer capabilities.',
  },
  {
    title: 'Testing',
    description: 'Run scans locally and validate findings with confidence.',
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

function DocCard({ title, description }) {
  return (
    <div className="glass rounded-2xl p-6 border border-white/10 hover:border-brand-orange/30 transition-colors">
      <h3 className="text-lg font-heading">{title}</h3>
      <p className="mt-2 text-sm text-white/55">{description}</p>
      <div className="mt-6 text-sm text-brand-orange">Coming in docs hub</div>
    </div>
  )
}

export default function DocsPage() {
  return (
    <div className="app-shell font-body scroll-smooth overflow-x-hidden">
      <PublicNav />

      <section className="pt-24 pb-16">
        <div className="max-w-6xl mx-auto px-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-xs text-white/60 uppercase tracking-[0.2em]">
            Docs
          </div>
          <h1 className="mt-4 text-4xl md:text-5xl font-heading leading-tight">
            Documentation for every security workflow.
          </h1>
          <p className="mt-4 text-sm md:text-base text-white/55 max-w-2xl">
            Everything you need to install, configure, and run InvisiThreat with confidence.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <PrimaryButton to="/signup">Create account</PrimaryButton>
            <SecondaryButton to="/how">See how it works</SecondaryButton>
          </div>
        </div>
      </section>

      <section className="py-16 border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6 grid gap-8 md:grid-cols-[1.1fr_0.9fr] items-start">
          <div>
            <SectionTitle
              eyebrow="Quick start"
              title="Run your first scan in minutes"
              subtitle="Follow the steps below or jump into demo mode to see results fast."
            />
            <div className="mt-6 space-y-3 text-sm text-white/55">
              <div className="flex items-start gap-3">
                <span className="text-brand-orange">01</span>
                <span>Download the scanner and authenticate with your token.</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-brand-orange">02</span>
                <span>Run a local-only scan or connect a repo for platform scans.</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-brand-orange">03</span>
                <span>Review findings and prioritize fixes from the dashboard.</span>
              </div>
            </div>
          </div>
          <div className="glass rounded-2xl border border-white/10 p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-white/40">CLI example</p>
            <pre className="mt-4 text-xs text-white/70 whitespace-pre-wrap break-words">
curl "https://app.invisithreat.dev/api/scanner/download" -o invisithreat-scan.py
pip install requests
python invisithreat-scan.py . --token=YOUR_TOKEN --api-url https://app.invisithreat.dev
            </pre>
            <p className="mt-4 text-xs text-white/45">Local-only mode keeps your source code on your machine.</p>
          </div>
        </div>
      </section>

      <section className="py-16 border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6">
          <SectionTitle
            eyebrow="Guides"
            title="Reference material for every team"
            subtitle="From authentication to testing, each guide covers the essentials for setup and maintenance."
          />
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {DOC_CARDS.map((doc) => (
              <DocCard key={doc.title} {...doc} />
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-heading">Need help setting up?</h2>
          <p className="mt-4 text-sm md:text-base text-white/55 max-w-2xl mx-auto">
            Our team can help you choose the right scan mode and configure secure defaults.
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