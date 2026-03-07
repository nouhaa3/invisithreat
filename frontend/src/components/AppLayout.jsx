import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import usePermissions from '../hooks/usePermissions'
import logo from '../assets/logo_invisithreat.png'

const NAV_ITEMS = [
  {
    to: '/dashboard',
    label: 'Dashboard',
    permission: 'view_dashboard',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    to: '/scans/new',
    label: 'New Scan',
    permission: 'run_scan',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
        <path d="M11 8v6M8 11h6" />
      </svg>
    ),
  },
  {
    to: '/settings',
    label: 'Settings',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },

]

export default function AppLayout({ children }) {
  const { user, logout } = useAuth()
  const { can: check, canManageUsers } = usePermissions()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const roleColor = {
    Admin: '#FF6B2B',
    Developer: '#60a5fa',
    'Security Manager': '#a78bfa',
    Viewer: '#6b7280',
  }[user?.role_name] || '#6b7280'

  const visibleNavItems = NAV_ITEMS.filter(item => !item.permission || check(item.permission))

  return (
    <div className="h-screen flex overflow-hidden" style={{ background: '#080808' }}>
      {/* Sidebar — fixed height, never scrolls with page */}
      <aside
        className="w-64 flex-shrink-0 flex flex-col h-screen"
        style={{
          background: 'rgba(12,12,12,0.98)',
          borderRight: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        {/* Logo */}
        <div className="px-5 py-4 flex items-center" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <img src={logo} alt="InvisiThreat" className="h-[70px] w-auto object-contain" />
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
          {visibleNavItems.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/dashboard'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'text-white'
                    : 'text-white/40 hover:text-white/70 hover:bg-white/[0.03]'
                }`
              }
              style={({ isActive }) =>
                isActive
                  ? {
                      background: 'rgba(255,107,43,0.1)',
                      border: '1px solid rgba(255,107,43,0.15)',
                      color: '#FF8C5A',
                    }
                  : {}
              }
            >
              {icon}
              {label}
            </NavLink>
          ))}

          {/* Divider */}
          <div className="my-2" style={{ height: '1px', background: 'rgba(255,255,255,0.04)' }} />

          {/* Admin panel — only visible to users with MANAGE_USERS */}
          {canManageUsers && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive ? 'text-white' : 'text-white/40 hover:text-white/70 hover:bg-white/[0.03]'
                }`
              }
              style={({ isActive }) =>
                isActive
                  ? { background: 'rgba(255,107,43,0.1)', border: '1px solid rgba(255,107,43,0.15)', color: '#FF8C5A' }
                  : {}
              }
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              User Management
            </NavLink>
          )}
        </nav>

        {/* User card at bottom */}
        <div className="px-3 pb-4">
          <div
            className="flex items-center gap-3 px-3 py-3 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)' }}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-semibold text-xs flex-shrink-0"
              style={{ background: 'rgba(255,107,43,0.15)', border: '1px solid rgba(255,107,43,0.2)' }}
            >
              {user?.nom?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-semibold truncate">{user?.nom}</p>
              <p className="text-xs font-medium truncate" style={{ color: roleColor }}>{user?.role_name}</p>
            </div>
            <button
              onClick={handleLogout}
              className="flex-shrink-0 text-white/20 hover:text-white/60 transition-colors"
              title="Logout"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Main content — scrolls independently */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {children}
      </div>
    </div>
  )
}
