import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout'
import { verifyEmail } from '../services/authService'

export default function VerifyEmailPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState('loading') // loading, success, error
  const [message, setMessage] = useState('')
  const token = searchParams.get('token')

  useEffect(() => {
    const verify = async () => {
      if (!token) {
        setStatus('error')
        setMessage('No verification token found')
        return
      }

      try {
        await verifyEmail(token)
        setStatus('success')
        setMessage('Your email has been verified!')
        setTimeout(() => navigate('/login'), 3000)
      } catch (err) {
        setStatus('error')
        const detail = err.response?.data?.detail || 'Verification failed'
        setMessage(detail)
      }
    }

    verify()
  }, [token, navigate])

  return (
    <AuthLayout
      imageContent={
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, rgba(255,107,43,0.6), transparent)' }} />
            <span className="text-brand-orange text-xs font-semibold tracking-widest uppercase">Verification</span>
          </div>
          <p className="text-white text-3xl font-light leading-tight mb-3">
            Email<br />
            <span className="font-bold shimmer-text">Confirmation</span>
          </p>
          <p className="text-white/35 text-sm leading-relaxed">
            {status === 'loading' && 'Verifying your email...'}
            {status === 'success' && 'Your account is ready!'}
            {status === 'error' && 'Something went wrong'}
          </p>
        </div>
      }
    >
      <div className="flex flex-col items-center gap-7 text-center py-4">
        <div className="relative">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(145deg, rgba(255,107,43,0.14), rgba(255,107,43,0.05))',
              border: '1px solid rgba(255,107,43,0.24)',
              boxShadow: '0 0 28px rgba(255,107,43,0.15)',
            }}>
            {status === 'loading' && (
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#FF8C5A" strokeWidth="1.5" className="animate-spin">
                <circle cx="12" cy="12" r="10" fill="none" strokeDasharray="60" strokeDashoffset="0" />
              </svg>
            )}
            {status === 'success' && (
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.2">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            )}
            {status === 'error' && (
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4M12 16h.01" />
              </svg>
            )}
          </div>
          {status === 'success' && (
            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-emerald-400 flex items-center justify-center">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
          )}
        </div>

        <div className="max-w-sm">
          <h2 className="text-2xl font-bold text-white mb-2">
            {status === 'loading' && 'Verifying...'}
            {status === 'success' && 'Email Verified!'}
            {status === 'error' && 'Verification Failed'}
          </h2>
          <p className="text-white/45 text-sm leading-relaxed">{message}</p>
        </div>

        {status === 'loading' && (
          <div className="w-full rounded-2xl px-5 py-5 text-left"
            style={{ background: 'linear-gradient(160deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))', border: '1px solid rgba(255,107,43,0.14)' }}>
            <p className="text-sm text-white/60">
              We are validating your email address. This should only take a moment.
            </p>
          </div>
        )}

        {status === 'success' && (
          <div className="w-full rounded-2xl px-5 py-5 text-left"
            style={{ background: 'linear-gradient(160deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))', border: '1px solid rgba(34,197,94,0.2)' }}>
            <p className="text-sm text-white/60">
              Your account is now ready. You will be redirected to sign in in a few seconds.
            </p>
          </div>
        )}

        {status === 'error' && (
          <div className="w-full rounded-2xl px-5 py-5">
            <button
              onClick={() => navigate('/signup')}
              className="w-full px-4 py-3 rounded-lg font-medium transition-all"
              style={{
                background: 'rgba(255,107,43,0.08)',
                border: '1px solid rgba(255,107,43,0.3)',
                color: '#FF8C5A',
              }}
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </AuthLayout>
  )
}