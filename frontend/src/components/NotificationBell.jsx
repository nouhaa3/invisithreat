import { NavLink } from 'react-router-dom'
import { useNotifications } from '../context/NotificationContext'

export default function NotificationBell({ collapsed = false, onNavigate }) {
  const { unreadCount } = useNotifications()

  return (
    <NavLink
      to="/notifications"
      onClick={onNavigate}
      title={collapsed ? 'Notifications' : undefined}
      className={({ isActive }) =>
        `flex items-center ${collapsed ? 'justify-center' : 'gap-3'} px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
          isActive ? 'text-white' : 'text-white/40 hover:text-white/70 hover:bg-white/[0.03]'
        }`
      }
      style={({ isActive }) =>
        isActive
          ? { background: 'rgba(255,107,43,0.1)', border: '1px solid rgba(255,107,43,0.15)', color: '#FF8C5A' }
          : {}
      }
    >
      {/* Bell icon with unread badge */}
      <div className="relative flex-shrink-0">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span
            className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 rounded-full text-[9px] font-bold flex items-center justify-center px-1"
            style={{ background: '#FF6B2B', color: 'white', lineHeight: 1 }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </div>

      {!collapsed && <span className="flex-1">Notifications</span>}

      {!collapsed && unreadCount > 0 && (
        <span
          className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
          style={{ background: 'rgba(255,107,43,0.15)', color: '#FF8C5A' }}
        >
          {unreadCount}
        </span>
      )}
    </NavLink>
  )
}
