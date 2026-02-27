import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Button from '../components/Button'

export default function Dashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-brand-dark flex flex-col">
      {/* Navbar */}
      <header className="border-b border-brand-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-brand-yellow rounded-lg flex items-center justify-center">
            <span className="text-black font-bold text-sm">IT</span>
          </div>
          <span className="text-white font-semibold text-lg">InvisiThreat</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">
            Welcome, <span className="text-white font-medium">{user?.nom}</span>
          </span>
          <Button variant="ghost" onClick={handleLogout} className="w-auto px-4 py-2 text-sm">
            Logout
          </Button>
        </div>
      </header>

      {/* Content placeholder */}
      <main className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <div className="w-16 h-16 bg-brand-yellow/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-brand-yellow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>
          <h2 className="text-2xl font-semibold text-white mb-2">Dashboard</h2>
          <p className="text-gray-400 text-sm max-w-sm">
            You are logged in as <span className="text-brand-yellow">{user?.role_name}</span>. The dashboard is under construction.
          </p>
        </div>
      </main>
    </div>
  )
}
