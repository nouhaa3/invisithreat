import { Link } from 'react-router-dom'
import logo from '../assets/logo_invisithreat.png'
import PublicNav from '../components/PublicNav'

const trustBadges = [
  'Local-only mode',
  'No code upload in local mode',
  'Fast setup in minutes',
]

const exploreCards = [
  {
    title: 'Features',
    description: 'SAST, DAST, secrets, and workflows built for security teams.',
    to: '/features',
    cta: 'Explore features',
  },
  {
    title: 'Trust & Security',
    description: 'See exactly what data is collected, stored, and retained.',
    to: '/trust',
    cta: 'Visit trust center',
  },
  {
    title: 'How it works',
    description: 'Choose your mode, run a scan, and prioritize fixes quickly.',
    to: '/how',
    cta: 'View the workflow',
  },
  {
    title: 'Docs',
    description: 'Quick start instructions and setup guidance for your team.',
    to: '/docs',
    cta: 'Read the docs',
  },
]

const footerLinks = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: '/features' },
      { label: 'Trust & Security', href: '/trust' },
      { label: 'How it works', href: '/how' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Docs', href: '/docs' },
      { label: 'Quick start', href: '/docs' },
      { label: 'Contact', href: 'mailto:hello@invisithreat.dev' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy policy', href: '#' },
      { label: 'Terms', href: '#' },
      { label: 'Security', href: '/trust' },
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

function Badge({ children }) {
  return (
    <span className="chip">
      <span className="h-1.5 w-1.5 rounded-full bg-brand-orange" />
      {children}
    </span>
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

function ExploreCard({ title, description, to, cta }) {
  return (
    <GlassCard className="h-full flex flex-col justify-between border-white/10 hover:border-brand-orange/30 transition-colors">
      <div>
        <h3 className="text-lg font-heading">{title}</h3>
        <p className="mt-2 text-sm text-white/55">{description}</p>
      </div>
      <Link to={to} className="mt-6 text-sm text-brand-orange hover:text-brand-orange-light transition-colors">
        {cta}
      </Link>
    </GlassCard>
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
    <div className="app-shell font-body scroll-smooth overflow-x-hidden">
      <PublicNav />
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

        <section className="pt-20 pb-24">
          <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-[1.1fr_0.9fr] gap-12 items-center">
            <div className="animate-slide-up">
              <div className="mt-[70px] inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-xs text-white/60 uppercase tracking-[0.2em]">
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
                <Link to="/features" className="hover:text-white transition-colors">Explore features</Link>
                <span className="text-white/20">|</span>
                <Link to="/trust" className="hover:text-white transition-colors">Trust & security</Link>
                <span className="text-white/20">|</span>
                <Link to="/docs" className="hover:text-white transition-colors">Read docs</Link>
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

      <section className="py-20 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <SectionTitle
            eyebrow="Explore"
            title="Navigate by your goal"
            subtitle="Each page dives deeper so the landing stays focused and fast to scan."
            align="center"
          />
          <div className="mt-10 grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {exploreCards.map((card) => (
              <ExploreCard key={card.title} {...card} />
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-heading">Start scanning in minutes</h2>
          <p className="mt-4 text-sm md:text-base text-white/55 max-w-2xl mx-auto">
            Choose the mode that fits your privacy needs and get prioritized findings fast.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <PrimaryButton to="/signup">Create account</PrimaryButton>
            <SecondaryButton to="/how">See how it works</SecondaryButton>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/5 py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid gap-10 md:grid-cols-[1.2fr_2fr]">
            <div>
              <div className="flex items-center gap-2">
                <img src={logo} alt="InvisiThreat" className="h-8 w-auto" />
                <span className="text-sm font-heading tracking-[0.2em] text-white/70">InvisiThreat</span>
              </div>
              <p className="mt-4 text-sm text-white/45 max-w-xs">
                Privacy-first security scanning for teams who want speed without sacrificing control.
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
              {footerLinks.map((column) => (
                <FooterColumn key={column.title} {...column} />
              ))}
            </div>
          </div>
          <div className="mt-10 border-t border-white/5 pt-6 text-xs text-white/40">
            (c) 2026 InvisiThreat. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}