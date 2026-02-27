import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Dashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#080808' }}>
      {/* Navbar */}
      <header className="px-6 py-4 flex items-center justify-between"
        style={{ background: 'rgba(14,14,14,0.95)', borderBottom: '1px solid rgba(255,107,43,0.12)', backdropFilter: 'blur(12px)' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
            style={{ background: 'linear-gradient(135deg, #FF6B2B, #C13A00)', boxShadow: '0 0 16px rgba(255,107,43,0.4)' }}>
            IT
          </div>
          <span className="text-white font-semibold text-lg">InvisiThreat</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-white/30">
            Welcome, <span className="text-white font-medium">{user?.nom}</span>
          </span>
          <button onClick={handleLogout}
            className="px-4 py-2 text-sm text-white/50 hover:text-white transition-colors rounded-lg hover:bg-white/5"
            style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
            Logout
          </button>
        </div>
      </header>

      {/* Content placeholder */}
      <main className="flex-1 flex items-center justify-center p-8">
        <div className="text-center animate-slide-up">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'rgba(255,107,43,0.08)', border: '1px solid rgba(255,107,43,0.15)', boxShadow: '0 0 30px rgba(255,107,43,0.08)' }}>
            <svg className="w-8 h-8" style={{ color: '#FF6B2B' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Dashboard</h2>
          <p className="text-white/30 text-sm max-w-sm">
            Logged in as <span style={{ color: '#FF6B2B' }}>{user?.role_name}</span> — dashboard under construction.
          </p>
        </div>
      </main>
    </div>
  )
}
