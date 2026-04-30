import { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import usePermissions from '../hooks/usePermissions'
import { ProfileAvatar } from './ProfileAvatar'
import NotificationBell from './NotificationBell'
import logo from '../assets/logo_invisithreat.png'

function SectionLabel({ children, collapsed }) {
  if (collapsed) {
    return (
      <p
        className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-widest select-none"
        style={{ visibility: 'hidden' }}
      >
        {children}
      </p>
    )
  }
  return (
    <p
      className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-widest select-none"
      style={{ color: 'rgba(255,255,255,0.32)' }}
    >
      {children}
    </p>
  )
}

function NavItem({ to, icon, children, label, end, collapsed, onNavigate }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        `flex items-center ${collapsed ? 'justify-center' : 'gap-3'} px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 border ${
          isActive
            ? 'text-brand-orange-light border-brand-orange/30 bg-brand-orange/10 shadow-orange-sm'
            : 'text-white/45 border-transparent hover:text-white/80 hover:border-white/10 hover:bg-white/[0.04]'
        }`
      }
    >
      {icon}
      {!collapsed && children}
    </NavLink>
  )
}

export default function AppLayout({ children }) {
  const { user, logout } = useAuth()
  const { can: check, canManageUsers } = usePermissions()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === 'undefined') return true
    const cached = window.localStorage.getItem('invisithreat:sidebar-open')
    return cached === null ? true : cached === '1'
  })
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('invisithreat:sidebar-open', sidebarOpen ? '1' : '0')
    }
  }, [sidebarOpen])

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

  const sidebarWidth = sidebarOpen ? 272 : 88
  const toggleSidebar = () => setSidebarOpen(prev => !prev)
  const handleLogoClick = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setMobileOpen(prev => !prev)
      return
    }
    toggleSidebar()
  }

  return (
    <div className="app-shell h-screen flex overflow-hidden relative">
      {/* Mobile backdrop */}
      {mobileOpen && (
        <button
          className="md:hidden fixed inset-0 bg-black/55 backdrop-blur-[2px] z-30"
          onClick={() => setMobileOpen(false)}
          aria-label="Close sidebar overlay"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed md:relative z-40 h-screen flex flex-col transition-all duration-300 ease-out ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
        style={{
          width: `${mobileOpen ? 272 : sidebarWidth}px`,
          background: 'rgba(9,9,9,0.9)',
          borderRight: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 24px 70px rgba(0,0,0,0.6)',
          backdropFilter: 'blur(18px)',
        }}
      >
        {/* Logo */}
        <div
          className={`py-4 flex items-center flex-shrink-0 ${sidebarOpen ? 'px-5 justify-between' : 'px-3 justify-center'}`}
          style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
        >
          <button
            onClick={handleLogoClick}
            className={`group ${sidebarOpen ? 'w-full flex items-center justify-center' : 'w-full flex items-center justify-center'} transition-opacity hover:opacity-90`}
            title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {sidebarOpen ? (
              <img src={logo} alt="InvisiThreat" className="h-[58px] w-auto object-contain" />
            ) : (
              <img src={logo} alt="InvisiThreat" className="h-[38px] w-auto object-contain" />
            )}
          </button>
        </div>

        {/* Navigation — scrollable if content overflows */}
        <nav className="flex-1 px-3 py-2 flex flex-col overflow-y-auto">

          {/* ── Overview ──────────────────────────────── */}
          <SectionLabel collapsed={!sidebarOpen}>Overview</SectionLabel>

          {check('view_dashboard') && (
            <NavItem to="/dashboard" end icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            } label="Dashboard" collapsed={!sidebarOpen} onNavigate={() => setMobileOpen(false)}>
              Dashboard
            </NavItem>
          )}

          {check('view_dashboard') && (
            <NavItem to="/projects" end icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
            } label="Projects" collapsed={!sidebarOpen} onNavigate={() => setMobileOpen(false)}>
              Projects
            </NavItem>
          )}

          {canManageUsers && (
            <NavItem to="/admin" icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            } label="User Management" collapsed={!sidebarOpen} onNavigate={() => setMobileOpen(false)}>
              User Management
            </NavItem>
          )}

          {check('run_scan') && (
            <NavItem to="/scans/new" icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
                <path d="M11 8v6M8 11h6" />
              </svg>
            } label="New Scan" collapsed={!sidebarOpen} onNavigate={() => setMobileOpen(false)}>
              New Scan
            </NavItem>
          )}

          {/* ── Activity ──────────────────────────────── */}
          <SectionLabel collapsed={!sidebarOpen}>Activity</SectionLabel>

          {/* Notifications — bell dropdown inline in sidebar */}
          <NotificationBell collapsed={!sidebarOpen} onNavigate={() => setMobileOpen(false)} />

          {/* ── Account ───────────────────────────────── */}
          <SectionLabel collapsed={!sidebarOpen}>Account</SectionLabel>

          <NavItem to="/settings" icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          } label="Settings" collapsed={!sidebarOpen} onNavigate={() => setMobileOpen(false)}>
            Settings
          </NavItem>

          {/* Spacer pushes user card to bottom */}
          <div className="flex-1" />
        </nav>

        {/* User card — always at bottom */}
        <div className="px-3 py-3 flex-shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div
            className={`flex items-center ${sidebarOpen ? 'gap-3 px-3 py-2.5' : 'justify-center px-2 py-2'} rounded-xl`}
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <ProfileAvatar user={user} size={32} className="flex-shrink-0" />
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-white text-xs font-semibold truncate">{user?.nom}</p>
                <p className="text-xs font-medium truncate" style={{ color: roleColor }}>{user?.role_name}</p>
              </div>
            )}
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

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <div className="md:hidden sticky top-0 z-20 px-3 py-2" style={{ background: 'rgba(8,8,8,0.88)', backdropFilter: 'blur(14px)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <button
            onClick={() => setMobileOpen(true)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-white/80"
            style={{ border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
            Menu
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
