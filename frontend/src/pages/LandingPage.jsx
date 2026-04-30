import { Link } from 'react-router-dom'
import logo from '../assets/logo_invisithreat.png'
import {
  CLISection,
  ScreenshotShowcase,
  BenchmarkTable,
} from '../components/landing'

const navLinks = [
  { label: 'Features', href: '#features' },
  { label: 'Trust & Security', href: '#trust' },
  { label: 'How it works', href: '#how' },
  { label: 'Docs', href: '#docs' },
]

const trustBadges = [
  'Local-only mode',
  'No code upload in local mode',
  'Fast setup in minutes',
]

const howSteps = [
  {
    title: 'Choose a scan mode',
    description: 'Pick demo, platform, or local-only based on your risk profile and workflow.',
  },
  {
    title: 'Run a secure scan',
    description: 'Launch SAST/DAST checks with clear progress and zero guesswork.',
  },
  {
    title: 'Prioritize & fix',
    description: 'Get ranked findings with practical guidance your team can act on quickly.',
  },
]

const modeCards = [
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
    cta: { label: 'View local-only docs', href: '#docs' },
    highlight: true,
  },
]

const trustGrid = [
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
      { label: 'Scans', value: 'Your connected repo or uploads' },
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

const features = [
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

const testimonials = [
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

const footerLinks = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: '#features' },
      { label: 'Pricing', href: '#pricing' },
      { label: 'Trust & Security', href: '#trust' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Docs', href: '#docs' },
      { label: 'How it works', href: '#how' },
      { label: 'Contact', href: 'mailto:hello@invisithreat.dev' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy policy', href: '#' },
      { label: 'Terms', href: '#' },
      { label: 'Security', href: '#trust' },
    ],
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

function OutlineAnchor({ href, children, className = '' }) {
  return (
    <a
      href={href}
      className={`inline-flex items-center justify-center px-5 py-2.5 rounded-full text-xs font-semibold border border-white/15 text-white/70 hover:text-white hover:border-brand-orange/40 hover:bg-white/5 transition-all duration-300 ${className}`}
    >
      {children}
    </a>
  )
}

function Badge({ children }) {
  return (
    <span className="chip">
      <span className="h-1.5 w-1.5 rounded-full bg-brand-orange" />
      {children}
    </span>
  )
}

function SectionTitle({ eyebrow, title, subtitle, align = 'left', color = 'orange' }) {
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
        {cta.to ? (
          <PrimaryButton to={cta.to} className="w-full text-center">
            {cta.label}
          </PrimaryButton>
        ) : (
          <OutlineAnchor href={cta.href} className="w-full text-center">
            {cta.label}
          </OutlineAnchor>
        )}
      </div>
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

function FooterColumn({ title, links }) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-white/70">{title}</h4>
      <div className="mt-3 flex flex-col gap-2 text-sm text-white/45">
        {links.map((link) => (
          <a key={link.label} href={link.href} className="hover:text-white/80 transition-colors">
            {link.label}
          </a>
        ))}
      </div>
    </div>
  )
}

export default function LandingPage() {
  return (
    <div className="app-shell font-body scroll-smooth">
      <div className="relative overflow-hidden">
        <div className="absolute -top-40 -left-32 w-[520px] h-[520px] rounded-full animate-float-slow"
          style={{ background: 'radial-gradient(circle, rgba(255,107,43,0.2) 0%, transparent 70%)' }}
        />
        <div className="absolute top-40 right-[-120px] w-[420px] h-[420px] rounded-full animate-float-med animation-delay-2000"
          style={{ background: 'radial-gradient(circle, rgba(255,140,90,0.18) 0%, transparent 70%)' }}
        />
        <div className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)', backgroundSize: '80px 80px' }}
        />

        <nav className="sticky top-0 z-50 backdrop-blur-xl border-b border-white/5 bg-black/50">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex items-center justify-between h-16">
              <Link to="/" className="flex items-center gap-2">
                <img src={logo} alt="InvisiThreat" className="h-9 w-auto" />
                <span className="text-sm font-heading tracking-[0.2em] text-white/70">InvisiThreat</span>
              </Link>
              <div className="hidden md:flex items-center gap-6 text-sm text-white/60">
                {navLinks.map((link) => (
                  <a key={link.label} href={link.href} className="hover:text-white transition-colors">
                    {link.label}
                  </a>
                ))}
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Link to="/login" className="text-white/70 hover:text-white transition-colors">Login</Link>
                <PrimaryButton to="/signup" className="px-4 py-2 text-xs">Create account</PrimaryButton>
              </div>
            </div>
          </div>
        </nav>

        <section className="pt-20 pb-24">
          <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-[1.1fr_0.9fr] gap-12 items-center">
            <div className="animate-slide-up">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-xs text-white/60 uppercase tracking-[0.2em]">
                Trust-first DevSecOps
              </div>
              <h1 className="mt-5 text-4xl md:text-6xl font-heading leading-tight">
                Scan fast. <span className="text-gradient">Keep control</span> of your code.
              </h1>
              <p className="mt-5 text-base md:text-lg text-white/55 max-w-xl">
                InvisiThreat delivers security scans that respect developer privacy. Choose demo, platform, or local-only mode to meet every risk profile.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4">
                <PrimaryButton to="/signup">Create account</PrimaryButton>
                <SecondaryButton to="/scans/new">Try demo project</SecondaryButton>
              </div>
              <p className="mt-3 text-xs text-white/40">No credit card required. Set up in minutes.</p>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-white/50">
                <a href="#features" className="hover:text-white transition-colors">Learn more</a>
                <span className="text-white/20">|</span>
                <a href="#pricing" className="hover:text-white transition-colors">View pricing</a>
              </div>
              <div className="mt-8 flex flex-wrap gap-2">
                {trustBadges.map((badge) => (
                  <Badge key={badge}>{badge}</Badge>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="absolute -top-6 -left-6 w-24 h-24 rounded-3xl bg-brand-orange/20 blur-2xl" />
              <div className="glass rounded-3xl border border-white/10 p-6 shadow-2xl animate-fade-in">
                <div className="flex items-center justify-between text-xs text-white/50">
                  <span>Scan summary</span>
                  <span>Mode: Local-only</span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3">
                  <div className="rounded-2xl bg-white/5 p-3 text-center">
                    <p className="text-2xl font-heading">12</p>
                    <p className="text-[11px] text-white/45">High</p>
                  </div>
                  <div className="rounded-2xl bg-white/5 p-3 text-center">
                    <p className="text-2xl font-heading">38</p>
                    <p className="text-[11px] text-white/45">Medium</p>
                  </div>
                  <div className="rounded-2xl bg-white/5 p-3 text-center">
                    <p className="text-2xl font-heading">76</p>
                    <p className="text-[11px] text-white/45">Low</p>
                  </div>
                </div>
                <div className="mt-6">
                  <p className="text-sm text-white/70 font-semibold">Top recommendations</p>
                  <div className="mt-3 space-y-2 text-xs text-white/50">
                    <div className="flex items-center justify-between">
                      <span>Rotate exposed API tokens</span>
                      <span className="text-brand-orange">Critical</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Harden auth session handling</span>
                      <span className="text-brand-orange-light">High</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Fix CORS wildcard policy</span>
                      <span className="text-white/50">Medium</span>
                    </div>
                  </div>
                </div>
                <div className="mt-6 rounded-2xl border border-white/10 bg-black/40 p-4 text-xs text-white/55">
                  Local-only mode keeps source code on your machine. Exported report stays private.
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <section id="how" className="py-20 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <SectionTitle
            eyebrow="How it works"
            title="Security workflows without the friction"
            subtitle="From first scan to actionable remediation, everything is designed to help teams move fast without compromising trust."
          />
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {howSteps.map((step, idx) => (
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

      <section id="modes" className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <SectionTitle
            eyebrow="Usage modes"
            title="Three modes. One security standard."
            subtitle="Choose the right balance of speed, collaboration, and privacy for every team."
          />
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {modeCards.map((mode) => (
              <ModeCard key={mode.title} {...mode} />
            ))}
          </div>
        </div>
      </section>

      <section id="trust" className="py-20 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <SectionTitle
            eyebrow="Trust & security"
            title="You decide what leaves your environment"
            subtitle="Local-only mode never uploads code. Platform scans share only the minimum required metadata for collaboration and reporting."
          />
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {trustGrid.map((item) => (
              <TrustCard key={item.title} {...item} />
            ))}
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-3 text-xs text-white/50">
            <span className="px-3 py-1 rounded-full border border-white/10 bg-white/5">SOC 2 (planned)</span>
            <span className="px-3 py-1 rounded-full border border-white/10 bg-white/5">ISO 27001 (planned)</span>
            <span className="px-3 py-1 rounded-full border border-white/10 bg-white/5">GDPR-ready controls</span>
          </div>
        </div>
      </section>

      <section id="features" className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <SectionTitle
            eyebrow="Features"
            title="Everything you need to ship secure code"
            subtitle="Built for developers, security managers, and growing teams who need clarity, not noise."
          />
          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <FeatureCard key={feature.title} {...feature} />
            ))}
          </div>
        </div>
      </section>

      <ScreenshotShowcase />

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
            {testimonials.map((item) => (
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

      <section id="pricing" className="py-20">
        <div className="max-w-5xl mx-auto px-6">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-10 text-center">
            <p className="text-xs uppercase tracking-[0.3em] text-white/45">Pricing</p>
            <h3 className="mt-4 text-3xl font-heading">Simple pricing, transparent plans</h3>
            <p className="mt-4 text-sm text-white/55">Pricing details will be published soon. Talk to us for early access and team onboarding.</p>
            <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
              <PrimaryButton to="/signup">Request access</PrimaryButton>
              <OutlineAnchor href="mailto:hello@invisithreat.dev">Contact sales</OutlineAnchor>
            </div>
          </div>
        </div>
      </section>

      <BenchmarkTable />

      <section id="docs" className="py-16 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 grid gap-8 md:grid-cols-[1.1fr_0.9fr] items-center">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-white/40">Docs</p>
            <h3 className="mt-3 text-3xl font-heading">Ship with confidence</h3>
            <p className="mt-4 text-sm text-white/55">Documentation for local-only scans, platform setup, and security workflows will live here.</p>
          </div>
          <div className="glass rounded-2xl border border-white/10 p-6">
            <div className="text-sm text-white/70">Quick start</div>
            <ul className="mt-4 space-y-3 text-sm text-white/50">
              <li>Install CLI and run your first local-only scan</li>
              <li>Connect a GitHub repository for platform scans</li>
              <li>Invite collaborators and track remediation</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="rounded-[32px] border border-brand-orange/30 bg-[#140b06] p-10 md:p-14 text-center shadow-orange-sm">
            <h3 className="text-3xl md:text-4xl font-heading">Test safely. Move fast. Keep control.</h3>
            <p className="mt-4 text-sm md:text-base text-white/55">Join teams who want real security outcomes without compromising privacy.</p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <PrimaryButton to="/signup">Create account</PrimaryButton>
              <SecondaryButton to="/login">Login</SecondaryButton>
              <SecondaryButton to="/scans/new">Try demo</SecondaryButton>
            </div>
            <p className="mt-4 text-xs text-white/40">Choose the scan mode that fits your risk profile.</p>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/5 py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8">
            <div>
              <div className="flex items-center gap-2">
                <img src={logo} alt="InvisiThreat" className="h-8 w-auto" />
                <span className="text-sm font-heading tracking-[0.2em] text-white/70">InvisiThreat</span>
              </div>
              <p className="mt-3 text-sm text-white/45 max-w-sm">Trust-first DevSecOps scanning for teams that value privacy and velocity.</p>
            </div>
            <div className="grid gap-6 sm:grid-cols-3">
              {footerLinks.map((column) => (
                <FooterColumn key={column.title} {...column} />
              ))}
            </div>
          </div>
          <div className="mt-10 text-xs text-white/35">(c) 2026 InvisiThreat. All rights reserved.</div>
        </div>
      </footer>
    </div>
  )
}