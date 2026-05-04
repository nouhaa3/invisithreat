import { Link, NavLink } from 'react-router-dom'
import logo from '../assets/logo_invisithreat.png'

const NAV_LINKS = [
  { label: 'Features', to: '/features' },
  { label: 'Trust & Security', to: '/trust' },
  { label: 'How it works', to: '/how' },
  { label: 'Docs', to: '/docs' },
]

export default function PublicNav({ fixed = true }) {
  const baseClass = fixed
    ? 'fixed top-0 left-0 right-0 !z-[9999]'
    : 'sticky top-0 z-50'

  return (
    <nav className={`${baseClass} border-b border-white/5 bg-black/90 backdrop-blur`}
      style={{ WebkitBackdropFilter: 'blur(12px)' }}>
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="InvisiThreat" className="h-8 w-auto" />
            <span className="text-sm font-heading tracking-[0.2em] text-white/70">InvisiThreat</span>
          </Link>
          <div className="hidden md:flex items-center gap-6 text-sm">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.label}
                to={link.to}
                className={({ isActive }) =>
                  `transition-colors ${isActive ? 'text-white' : 'text-white/60 hover:text-white'}`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Link to="/login" className="text-white/70 hover:text-white transition-colors">Login</Link>
            <Link
              to="/signup"
              className="inline-flex items-center justify-center px-4 py-2 rounded-full text-xs font-semibold text-white transition-all duration-300 hover:shadow-orange-sm"
              style={{
                background: 'linear-gradient(135deg, #FF6B2B 0%, #E84D0E 60%, #C13A00 100%)',
                boxShadow: '0 12px 24px rgba(255,107,43,0.25)',
              }}
            >
              Create account
            </Link>
          </div>
        </div>
      </div>
    </nav>
  )
}