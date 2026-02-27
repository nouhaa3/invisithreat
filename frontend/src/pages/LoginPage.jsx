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
        <p className="text-white text-3xl font-light leading-tight">
          Be a Part of<br />Something <span className="font-bold">Beautiful</span>
        </p>
      }
    >
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-white mb-1">Login</h1>
          <p className="text-sm text-gray-400">Enter your credentials to access your account</p>
        </div>

        {/* Server error */}
        <Alert type="error" message={serverError} />

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
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

          {/* Remember me */}
          <label className="flex items-center gap-2.5 cursor-pointer select-none w-fit">
            <div
              onClick={() => setRememberMe(!rememberMe)}
              className={`w-4 h-4 rounded border flex items-center justify-center transition-colors cursor-pointer
                ${rememberMe ? 'bg-brand-yellow border-brand-yellow' : 'border-brand-border bg-transparent hover:border-gray-400'}`}
            >
              {rememberMe && (
                <svg className="w-3 h-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <span className="text-sm text-gray-400">Remember me</span>
          </label>

          <Button type="submit" loading={loading}>
            Login
          </Button>
        </form>

        {/* Link to signup */}
        <p className="text-center text-sm text-gray-500">
          Not a member?{' '}
          <Link to="/signup" className="text-brand-yellow hover:underline font-medium">
            Create an account
          </Link>
        </p>
      </div>
    </AuthLayout>
  )
}
