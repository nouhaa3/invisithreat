import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout'
import InputField from '../components/InputField'
import Button from '../components/Button'
import Alert from '../components/Alert'
import { register, resendVerificationEmail } from '../services/authService'

export default function SignupPage() {
  const navigate = useNavigate()

  const [form, setForm] = useState({ nom: '', email: '', password: '', confirmPassword: '' })
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendMessage, setResendMessage] = useState('')
  const [verificationData, setVerificationData] = useState(null) // set after successful registration

  const validate = () => {
    const errs = {}
    if (!form.nom || form.nom.trim().length < 2) errs.nom = 'Full name must be at least 2 characters'
    if (!form.email) errs.email = 'Email is required'
    else if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Invalid email address'
    if (!form.password) errs.password = 'Password is required'
    else if (form.password.length < 8) errs.password = 'Password must be at least 8 characters'
    if (!form.confirmPassword) errs.confirmPassword = 'Please confirm your password'
    else if (form.password !== form.confirmPassword) errs.confirmPassword = 'Passwords do not match'
    return errs
  }

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }))
    if (serverError) setServerError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }

    setLoading(true)
    setServerError('')
    try {
      const data = await register({ nom: form.nom, email: form.email, password: form.password })
      // Backend now returns { status: 'email_verification_required', ... }
      if (data?.status === 'email_verification_required') {
        setVerificationData({
          nom: data.nom,
          email: data.email,
          emailSent: data.email_sent !== false,
          verificationUrl: data.verification_url || '',
        })
      } else {
        // Fallback: should not happen, but redirect gracefully
        navigate('/login')
      }
    } catch (err) {
      const detail = err.response?.data?.detail
      setServerError(
        typeof detail === 'string' ? detail : 'Registration failed. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  const handleResendVerification = async () => {
    if (!verificationData?.email) return
    setResending(true)
    setResendMessage('')
    try {
      const data = await resendVerificationEmail(verificationData.email)
      setResendMessage(data?.message || 'Verification email sent.')
    } catch (err) {
      const detail = err.response?.data?.detail
      setResendMessage(typeof detail === 'string' ? detail : 'Could not resend email right now.')
    } finally {
      setResending(false)
    }
  }

  /* Password strength */
  const getStrength = () => {
    const p = form.password
    if (!p) return 0
    let score = 0
    if (p.length >= 8) score++
    if (/[A-Z]/.test(p)) score++
    if (/[0-9]/.test(p)) score++
    if (/[^A-Za-z0-9]/.test(p)) score++
    return score
  }
  const strength = getStrength()
  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][strength]
  const strengthGradients = [
    '',
    'linear-gradient(90deg, #ef4444, #f87171)',
    'linear-gradient(90deg, #f97316, #fb923c)',
    'linear-gradient(90deg, #3b82f6, #60a5fa)',
    'linear-gradient(90deg, #FF6B2B, #FF8C5A)',
  ]

  // ── Email verification screen ──────────────────────────────────────────
  if (verificationData) {
    return (
      <AuthLayout
        imageContent={
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, rgba(255,107,43,0.6), transparent)' }} />
              <span className="text-brand-orange text-xs font-semibold tracking-widest uppercase">Verify Email</span>
            </div>
            <p className="text-white text-3xl font-light leading-tight mb-3">
              Confirm Your<br />
              <span className="font-bold shimmer-text">Email Address</span>
            </p>
            <p className="text-white/30 text-sm leading-relaxed">We've sent you a verification link</p>
          </div>
        }
      >
        <div className="flex flex-col items-center gap-7 text-center py-2">
          {/* Icon */}
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center"
              style={{
                background: 'linear-gradient(145deg, rgba(255,107,43,0.14), rgba(255,107,43,0.05))',
                border: '1px solid rgba(255,107,43,0.24)',
                boxShadow: '0 0 28px rgba(255,107,43,0.15)',
              }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#FF8C5A" strokeWidth="1.5">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="M2 6l10 7.5L22 6" />
              </svg>
            </div>
            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-emerald-400 flex items-center justify-center">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
          </div>

          {/* Text */}
          <div className="max-w-sm">
            <h2 className="text-3xl font-bold text-white mb-2">Check your email</h2>
            <p className="text-white/45 text-sm leading-relaxed">
              Hi <span className="text-white font-medium">{verificationData.nom}</span>, we've sent a verification link to<br />
              <span className="text-brand-orange-light font-semibold">{verificationData.email}</span>
            </p>
          </div>

          {/* Info card */}
          <div className="w-full rounded-2xl px-5 py-5 text-left"
            style={{
              background: 'linear-gradient(160deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))',
              border: '1px solid rgba(255,107,43,0.16)',
            }}>
            <p className="text-sm text-white/65 leading-relaxed">
              Click the verification button in your email to activate your account. The link expires in <span className="text-white">24 hours</span>.
            </p>
          </div>

          <button
            type="button"
            onClick={handleResendVerification}
            disabled={resending}
            className="w-full text-center px-4 py-3 rounded-xl text-sm font-semibold transition-all hover:shadow-lg active:scale-[0.97] disabled:opacity-60"
            style={{
              background: 'rgba(255,107,43,0.08)',
              color: '#FF8C5A',
              border: '1px solid rgba(255,107,43,0.28)',
            }}
          >
            {resending ? 'Resending...' : 'Resend Verification Email'}
          </button>

          {verificationData.verificationUrl && (
            <a
              href={verificationData.verificationUrl}
              className="w-full text-center px-4 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-lg active:scale-[0.97]"
              style={{
                background: 'linear-gradient(135deg,#FF6B2B,#C13A00)',
                boxShadow: '0 8px 24px rgba(255,107,43,0.3)',
              }}
            >
              Open Verification Link
            </a>
          )}

          {resendMessage && (
            <p className="text-xs text-white/55">{resendMessage}</p>
          )}

          <Link to="/login"
            className="text-sm text-white/30 hover:text-brand-orange transition-colors">
            ← Back to sign in
          </Link>
        </div>
      </AuthLayout>
    )
  }

  // ── Registration form ────────────────────────────────────────────────────
  return (
    <AuthLayout
      imageContent={
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, rgba(255,107,43,0.6), transparent)' }} />
            <span className="text-brand-orange text-xs font-semibold tracking-widest uppercase">Join Us</span>
          </div>
          <p className="text-white text-3xl font-light leading-tight mb-3">
            Secure Your{' '}
            <span className="font-bold shimmer-text">Pipeline</span><br />
            from Day One
          </p>
          <p className="text-white/30 text-sm leading-relaxed">Detect. Protect. Deploy with confidence.</p>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        {/* Header */}
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-4"
            style={{ background: 'rgba(255,107,43,0.08)', border: '1px solid rgba(255,107,43,0.15)' }}>
            <div className="w-1.5 h-1.5 rounded-full bg-brand-orange animate-pulse" />
            <span className="text-brand-orange-light text-xs font-medium">New Account</span>
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">Create Account</h1>
          <p className="text-base text-white/35">Get instant access with your VIEWER trial</p>
        </div>

        {/* Server error */}
        <Alert type="error" message={serverError} />

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
          <div className="animate-slide-up">
            <InputField
              label="Full Name"
              type="text"
              value={form.nom}
              onChange={handleChange('nom')}
              placeholder="John Doe"
              error={errors.nom}
              autoComplete="name"
              disabled={loading}
            />
          </div>

          <div className="animate-slide-up animation-delay-200">
            <InputField
              label="Email"
              type="email"
              value={form.email}
              onChange={handleChange('email')}
              placeholder="you@example.com"
              error={errors.email}
              autoComplete="email"
              disabled={loading}
            />
          </div>

          <div className="animate-slide-up animation-delay-400">
            <div className="flex flex-col gap-1.5">
              <InputField
                label="Password"
                type="password"
                value={form.password}
                onChange={handleChange('password')}
                placeholder="••••••••"
                error={errors.password}
                autoComplete="new-password"
                disabled={loading}
              />
              {/* Strength bar */}
              {form.password && (
                <div className="flex items-center gap-2">
                  <div className="flex gap-1 flex-1">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="h-1 flex-1 rounded-full transition-all duration-500"
                        style={{
                          background: i <= strength ? strengthGradients[strength] : 'rgba(255,255,255,0.06)',
                          boxShadow: i <= strength && strength === 4 ? '0 0 6px rgba(255,107,43,0.5)' : 'none',
                        }}
                      />
                    ))}
                  </div>
                  <span className="text-xs" style={{ color: strength === 4 ? '#FF8C5A' : strength === 3 ? '#60a5fa' : '#fb923c' }}>
                    {strengthLabel}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="animate-slide-up animation-delay-600">
            <InputField
              label="Confirm Password"
              type="password"
              value={form.confirmPassword}
              onChange={handleChange('confirmPassword')}
              placeholder="••••••••"
              error={errors.confirmPassword}
              autoComplete="new-password"
              disabled={loading}
            />
          </div>

          <div className="animate-slide-up animation-delay-800 mt-1">
            <Button type="submit" loading={loading}>
              Create Account
            </Button>
          </div>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-brand-border" />
          <span className="text-xs text-white/20">or</span>
          <div className="flex-1 h-px bg-brand-border" />
        </div>

        {/* Link to login */}
        <p className="text-center text-sm text-white/30">
          Already have an account?{' '}
          <Link to="/login" className="text-brand-orange hover:text-brand-orange-light transition-colors font-semibold">
            Sign in
          </Link>
        </p>
      </div>
    </AuthLayout>
  )
}
