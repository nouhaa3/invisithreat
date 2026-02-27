import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthLayout from '../components/AuthLayout'
import InputField from '../components/InputField'
import Button from '../components/Button'
import Alert from '../components/Alert'
import { login } from '../services/authService'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const navigate = useNavigate()
  const { loginSuccess } = useAuth()

  const [form, setForm] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [loading, setLoading] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)

  const validate = () => {
    const errs = {}
    if (!form.email) errs.email = 'Email is required'
    else if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Invalid email address'
    if (!form.password) errs.password = 'Password is required'
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
      const data = await login(form.email, form.password)
      loginSuccess(data)
      navigate('/dashboard')
    } catch (err) {
      const detail = err.response?.data?.detail
      setServerError(
        typeof detail === 'string' ? detail : 'Invalid email or password. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      imageContent={
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, rgba(255,107,43,0.6), transparent)' }} />
            <span className="text-brand-orange text-xs font-semibold tracking-widest uppercase">DevSecOps</span>
          </div>
          <p className="text-white text-3xl font-light leading-tight mb-3">
            Be a Part of<br />Something{' '}
            <span className="font-bold shimmer-text">Beautiful</span>
          </p>
          <p className="text-white/30 text-sm leading-relaxed">
            Intelligent threat detection for your entire pipeline.
          </p>
        </div>
      }
    >
      <div className="flex flex-col gap-7">
        {/* Header */}
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-4"
            style={{ background: 'rgba(255,107,43,0.08)', border: '1px solid rgba(255,107,43,0.15)' }}>
            <div className="w-1.5 h-1.5 rounded-full bg-brand-orange animate-pulse" />
            <span className="text-brand-orange-light text-xs font-medium">Secure Access</span>
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">Welcome back</h1>
          <p className="text-base text-white/35">Sign in to your InvisiThreat account</p>
        </div>

        {/* Server error */}
        <Alert type="error" message={serverError} />

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
          <div className="animate-slide-up">
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

          <div className="animate-slide-up animation-delay-200">
            <InputField
              label="Password"
              type="password"
              value={form.password}
              onChange={handleChange('password')}
              placeholder="••••••••"
              error={errors.password}
              autoComplete="current-password"
              disabled={loading}
            />
          </div>

          {/* Remember me + Forgot */}
          <div className="flex items-center justify-between animate-slide-up animation-delay-400">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <div
                onClick={() => setRememberMe(!rememberMe)}
                className="w-4 h-4 rounded-md flex items-center justify-center transition-all duration-200 cursor-pointer"
                style={{
                  background: rememberMe ? 'linear-gradient(135deg, #FF6B2B, #E84D0E)' : 'transparent',
                  border: rememberMe ? '1px solid #FF6B2B' : '1px solid rgba(255,255,255,0.15)',
                  boxShadow: rememberMe ? '0 0 10px rgba(255,107,43,0.3)' : 'none',
                }}
              >
                {rememberMe && (
                  <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <span className="text-xs text-white/40">Remember me</span>
            </label>
            <button type="button" className="text-xs text-brand-orange/70 hover:text-brand-orange transition-colors">
              Forgot password?
            </button>
          </div>

          <div className="animate-slide-up animation-delay-600 mt-1">
            <Button type="submit" loading={loading}>
              Sign In
            </Button>
          </div>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-brand-border" />
          <span className="text-xs text-white/20">or</span>
          <div className="flex-1 h-px bg-brand-border" />
        </div>

        {/* Link to signup */}
        <p className="text-center text-sm text-white/30">
          Not a member?{' '}
          <Link to="/signup" className="text-brand-orange hover:text-brand-orange-light transition-colors font-semibold">
            Create an account
          </Link>
        </p>
      </div>
    </AuthLayout>
  )
}
