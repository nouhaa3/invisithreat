import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout'
import InputField from '../components/InputField'
import Button from '../components/Button'
import Alert from '../components/Alert'
import { register } from '../services/authService'
import { useAuth } from '../context/AuthContext'

export default function SignupPage() {
  const navigate = useNavigate()
  const { loginSuccess } = useAuth()

  const [form, setForm] = useState({ nom: '', email: '', password: '', confirmPassword: '' })
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [loading, setLoading] = useState(false)

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
      loginSuccess(data)
      navigate('/dashboard')
    } catch (err) {
      const detail = err.response?.data?.detail
      setServerError(
        typeof detail === 'string' ? detail : 'Registration failed. Please try again.'
      )
    } finally {
      setLoading(false)
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
          <p className="text-base text-white/35">Start securing your DevOps pipeline today</p>
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
