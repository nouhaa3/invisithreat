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

  /* Password strength indicator */
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
  const strengthColors = ['', 'bg-red-500', 'bg-yellow-500', 'bg-blue-400', 'bg-green-500']

  return (
    <AuthLayout
      imageContent={
        <p className="text-white text-3xl font-light leading-tight">
          Join the Future of <span className="font-bold">DevSecOps</span>
        </p>
      }
    >
      <div className="flex flex-col gap-5">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-white mb-1">Create Account</h1>
          <p className="text-sm text-gray-400">Start securing your DevOps pipeline today</p>
        </div>

        {/* Server error */}
        <Alert type="error" message={serverError} />

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
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
              <div className="flex items-center gap-2 mt-1">
                <div className="flex gap-1 flex-1">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= strength ? strengthColors[strength] : 'bg-brand-border'}`}
                    />
                  ))}
                </div>
                <span className="text-xs text-gray-400">{strengthLabel}</span>
              </div>
            )}
          </div>

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

          <Button type="submit" loading={loading} className="mt-1">
            Create Account
          </Button>
        </form>

        {/* Link to login */}
        <p className="text-center text-sm text-gray-500">
          Already have an account?{' '}
          <Link to="/login" className="text-brand-yellow hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </AuthLayout>
  )
}
