import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../components/Button'
import Alert from '../components/Alert'
import { requestRole } from '../services/authService'

export default function RoleRequestModal({ isOpen, onClose, currentRole }) {
  const navigate = useNavigate()
  const [selectedRole, setSelectedRole] = useState('Developer')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  if (!isOpen) return null

  const roles = [
    { value: 'Developer', label: 'Developer', desc: 'Create & run scans on projects' },
    { value: 'Security Manager', label: 'Security Manager', desc: 'Review all findings & manage team' },
    { value: 'Admin', label: 'Admin', desc: 'Full platform access' },
  ]

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await requestRole(selectedRole)
      setSuccess(true)
      setTimeout(() => {
        onClose()
        setSuccess(false)
        setSelectedRole('Developer')
      }, 2000)
    } catch (err) {
      const detail = err.response?.data?.detail || 'Request failed. Please try again.'
      setError(typeof detail === 'string' ? detail : 'Request failed')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="panel-strong max-w-sm w-full p-8">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(255,107,43,0.12)', border: '1px solid rgba(255,107,43,0.3)' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#FF8C5A" strokeWidth="2">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
          </div>
          <h3 className="text-2xl font-bold text-white text-center mb-2">Request Sent!</h3>
          <p className="text-white/60 text-sm text-center">
            Your role request has been submitted. An administrator will review it shortly.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="panel-strong max-w-sm w-full">
        <div className="p-6" style={{ borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
          <h2 className="text-2xl font-bold text-white">Request Role Upgrade</h2>
          <p className="text-white/40 text-sm mt-1">
            Select the role you'd like to upgrade to
          </p>
        </div>

        <div className="p-6">
          <Alert type="error" message={error} />

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Role selection */}
            <div className="space-y-2">
              {roles.map(({ value, label, desc }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSelectedRole(value)}
                  disabled={loading}
                  className={`w-full flex items-start p-3 rounded-xl text-left transition-all border ${
                    selectedRole === value
                      ? 'border-brand-orange/40 bg-brand-orange/10'
                      : 'border-white/10 bg-white/5 hover:border-white/20'
                  }`}
                >
                  <div className="flex-1">
                    <div className={`text-sm font-semibold ${selectedRole === value ? 'text-brand-orange-light' : 'text-white/70'}`}>
                      {label}
                    </div>
                    <div className="text-xs text-white/40 mt-0.5">{desc}</div>
                  </div>
                  <div className={`hidden w-5 h-5 rounded border-2 mt-0.5 ${selectedRole === value ? 'flex' : ''}`}
                    style={{ 
                      borderColor: '#FF8C5A',
                      background: selectedRole === value ? '#FF8C5A' : 'transparent'
                    }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3" className="m-auto">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </div>
                </button>
              ))}
            </div>

            {/* Buttons */}
            <div className="flex gap-3 mt-2 pt-2">
              <Button type="button" onClick={onClose} disabled={loading} variant="secondary" className="flex-1">
                Cancel
              </Button>
              <Button type="submit" loading={loading} className="flex-1">
                Request
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
