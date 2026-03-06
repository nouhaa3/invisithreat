import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout'
import InputField from '../components/InputField'
import Button from '../components/Button'
import Alert from '../components/Alert'
import { forgotPassword, verifyResetCode, resetPassword } from '../services/authService'

// ── Step indicators ───────────────────────────────────────────────────────────
const STEPS = ['Email', 'Verification', 'New Password']

function StepBar({ current }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {STEPS.map((label, i) => {
        const done    = i < current
        const active  = i === current
        return (
          <div key={i} className="flex items-center gap-2 flex-1">
            <div className="flex items-center gap-2 flex-shrink-0">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all"
                style={{
                  background: done    ? '#22c55e'
                            : active  ? 'linear-gradient(135deg,#FF6B2B,#E84D0E)'
                                      : 'rgba(255,255,255,0.05)',
                  border: done || active ? 'none' : '1px solid rgba(255,255,255,0.12)',
                  color: done || active ? '#fff' : 'rgba(255,255,255,0.25)',
                }}
              >
                {done ? (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : i + 1}
              </div>
              <span className="text-xs font-medium hidden sm:block"
                style={{ color: active ? '#fff' : done ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)' }}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className="flex-1 h-px"
                style={{ background: done ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.07)' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── 6-digit code input ────────────────────────────────────────────────────────
function CodeInput({ value, onChange, disabled }) {
  const refs = Array.from({ length: 6 }, () => useRef(null))
  const digits = value.split('').concat(Array(6).fill('')).slice(0, 6)

  const handleKey = (i, e) => {
    if (e.key === 'Backspace') {
      const next = value.slice(0, i) + value.slice(i + 1)
      onChange(next)
      if (i > 0) refs[i - 1].current?.focus()
    } else if (/^\d$/.test(e.key)) {
      const next = (value.slice(0, i) + e.key + value.slice(i + 1)).slice(0, 6)
      onChange(next)
      if (i < 5) refs[i + 1].current?.focus()
    } else if (e.key === 'ArrowLeft' && i > 0) {
      refs[i - 1].current?.focus()
    } else if (e.key === 'ArrowRight' && i < 5) {
      refs[i + 1].current?.focus()
    }
  }

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted) { onChange(pasted); refs[Math.min(pasted.length, 5)].current?.focus() }
    e.preventDefault()
  }

  return (
    <div className="flex gap-2 justify-center my-2">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={refs[i]}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d}
          disabled={disabled}
          onChange={() => {}}
          onKeyDown={(e) => handleKey(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          className="w-11 h-13 text-center text-lg font-bold text-white rounded-xl outline-none transition-all"
          style={{
            height: '52px',
            background: d ? 'rgba(255,107,43,0.08)' : 'rgba(255,255,255,0.04)',
            border: d ? '1px solid rgba(255,107,43,0.35)' : '1px solid rgba(255,255,255,0.1)',
            caretColor: 'transparent',
          }}
        />
      ))}
    </div>
  )
}


// ── Main page ─────────────────────────────────────────────────────────────────
export default function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [step, setStep]             = useState(0)
  const [email, setEmail]           = useState('')
  const [code, setCode]             = useState('')
  const [resetToken, setResetToken] = useState('')
  const [newPassword, setNewPassword]     = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const [success, setSuccess]       = useState('')

  // ── Step 0: submit email ──────────────────────────────────────────────────
  const handleEmailSubmit = async (e) => {
    e.preventDefault()
    if (!email || !/\S+@\S+\.\S+/.test(email)) { setError('Please enter a valid email address'); return }
    setLoading(true); setError('')
    try {
      await forgotPassword(email)
      setStep(1)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // ── Step 1: verify code ───────────────────────────────────────────────────
  const handleCodeSubmit = async (e) => {
    e.preventDefault()
    if (code.length !== 6) { setError('Please enter the full 6-digit code'); return }
    setLoading(true); setError('')
    try {
      const data = await verifyResetCode(email, code)
      setResetToken(data.reset_token)
      setStep(2)
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid or expired code')
      setCode('')
    } finally {
      setLoading(false)
    }
  }

  // ── Step 2: reset password ────────────────────────────────────────────────
  const handleResetSubmit = async (e) => {
    e.preventDefault()
    if (newPassword.length < 8) { setError('Password must be at least 8 characters'); return }
    if (newPassword !== confirmPassword) { setError('Passwords do not match'); return }
    setLoading(true); setError('')
    try {
      await resetPassword(resetToken, newPassword)
      setSuccess('Password updated successfully! Redirecting to login...')
      setTimeout(() => navigate('/login'), 2000)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to reset password. Please start over.')
    } finally {
      setLoading(false)
    }
  }

  const sideContent = (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, rgba(255,107,43,0.6), transparent)' }} />
        <span className="text-brand-orange text-xs font-semibold tracking-widest uppercase">Security</span>
      </div>
      <p className="text-white text-3xl font-light leading-tight mb-3">
        Reset your<br />
        <span className="font-bold shimmer-text">password</span>
      </p>
      <p className="text-white/30 text-sm leading-relaxed">
        {step === 0 && 'Enter your email and we will send you a 6-digit verification code.'}
        {step === 1 && 'A 6-digit code was sent to your email address.'}
        {step === 2 && 'Choose a strong new password to secure your account.'}
      </p>
    </div>
  )

  return (
    <AuthLayout imageContent={sideContent}>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-4"
            style={{ background: 'rgba(255,107,43,0.08)', border: '1px solid rgba(255,107,43,0.15)' }}>
            <div className="w-1.5 h-1.5 rounded-full bg-brand-orange animate-pulse" />
            <span className="text-brand-orange-light text-xs font-medium">Password Recovery</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-1">
            {step === 0 && 'Forgot password?'}
            {step === 1 && 'Enter the code'}
            {step === 2 && 'New password'}
          </h1>
          <p className="text-sm text-white/35">
            {step === 0 && "We'll send a reset code to your inbox"}
            {step === 1 && `Code sent to ${email} — check your inbox`}
            {step === 2 && 'Choose a strong password'}
          </p>
        </div>

        <StepBar current={step} />

        <Alert type="error"   message={error}   />
        <Alert type="success" message={success} />

        {/* ── Step 0 ── email */}
        {step === 0 && (
          <form onSubmit={handleEmailSubmit} className="flex flex-col gap-5" noValidate>
            <InputField
              label="Email address"
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setError('') }}
              placeholder="you@example.com"
              autoComplete="email"
              disabled={loading}
            />
            <Button type="submit" loading={loading}>Send verification code</Button>
            <p className="text-center text-sm text-white/30">
              Remember it?{' '}
              <Link to="/login" className="text-brand-orange hover:text-brand-orange-light transition-colors font-semibold">
                Back to login
              </Link>
            </p>
          </form>
        )}

        {/* ── Step 1 ── code */}
        {step === 1 && (
          <form onSubmit={handleCodeSubmit} className="flex flex-col gap-5" noValidate>
            <div>
              <p className="text-xs text-white/40 mb-3 text-center">
                Check your inbox for the 6-digit code we sent to <span className="text-white/60">{email}</span>
              </p>
              <CodeInput value={code} onChange={v => { setCode(v); setError('') }} disabled={loading} />
            </div>
            <Button type="submit" loading={loading} disabled={code.length !== 6}>Verify code</Button>
            <button type="button" onClick={() => { setStep(0); setCode(''); setError('') }}
              className="text-center text-xs text-white/30 hover:text-white/50 transition-colors">
              ← Use a different email
            </button>
          </form>
        )}

        {/* ── Step 2 ── new password */}
        {step === 2 && (
          <form onSubmit={handleResetSubmit} className="flex flex-col gap-5" noValidate>
            <InputField
              label="New password"
              type="password"
              value={newPassword}
              onChange={e => { setNewPassword(e.target.value); setError('') }}
              placeholder="Minimum 8 characters"
              autoComplete="new-password"
              disabled={loading}
            />
            <InputField
              label="Confirm password"
              type="password"
              value={confirmPassword}
              onChange={e => { setConfirmPassword(e.target.value); setError('') }}
              placeholder="Repeat your password"
              autoComplete="new-password"
              disabled={loading}
            />
            <Button type="submit" loading={loading}>Update password</Button>
          </form>
        )}
      </div>
    </AuthLayout>
  )
}
