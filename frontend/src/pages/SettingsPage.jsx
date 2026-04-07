// ─── InvisiThreat — Settings Page ─────────────────────────────────────────────
import { useState, useRef, useEffect, useCallback } from 'react'
import AppLayout from '../components/AppLayout'
import { useAuth } from '../context/AuthContext'
import { useRelativeTime } from '../hooks/useRelativeTime'
import { updateMyProfile, changeMyPassword } from '../services/authService'
import { listApiKeys, createApiKey, revokeApiKey } from '../services/apiKeyService'
import { getMyAuditLogs } from '../services/auditLogService'
import * as totpService from '../services/totpService'
import ImageCropper from '../components/ImageCropper'

// ─── Primitives ───────────────────────────────────────────────────────────────

const ORANGE = '#FF6B2B'
const ORANGE_LIGHT = '#FF8C5A'

function SectionHeader({ title, subtitle }) {
  return (
    <div className="mb-7">
      <h2 className="text-base font-bold text-white">{title}</h2>
      {subtitle && <p className="text-sm text-white/35 mt-1 leading-relaxed">{subtitle}</p>}
      <div className="mt-4" style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />
    </div>
  )
}

function Field({ label, hint, children, className = '' }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <div className="flex items-baseline justify-between">
        <label className="text-xs font-semibold uppercase tracking-widest text-white/35">{label}</label>
        {hint && <span className="text-[11px] text-white/20">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

function TextInput({ value, onChange, type = 'text', placeholder, disabled, autoComplete, readOnly, extraClassName }) {
  const base = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      readOnly={readOnly}
      autoComplete={autoComplete}
      className={`w-full px-3.5 py-2.5 rounded-xl text-sm text-white outline-none transition-all disabled:opacity-40 read-only:opacity-60 read-only:cursor-default${extraClassName ? ' ' + extraClassName : ''}`}
      style={base}
      onFocus={e => { if (!readOnly) { e.target.style.border = '1px solid rgba(255,107,43,0.4)'; e.target.style.boxShadow = '0 0 0 3px rgba(255,107,43,0.08)' } }}
      onBlur={e => { e.target.style.border = base.border; e.target.style.boxShadow = 'none' }}
    />
  )
}

function SelectInput({ value, onChange, options, disabled }) {
  return (
    <select
      value={value}
      onChange={onChange}
      disabled={disabled}
      className="w-full px-3.5 py-2.5 rounded-xl text-sm text-white outline-none transition-all appearance-none cursor-pointer disabled:opacity-40"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
      onFocus={e => { e.target.style.border = '1px solid rgba(255,107,43,0.4)'; e.target.style.boxShadow = '0 0 0 3px rgba(255,107,43,0.08)' }}
      onBlur={e => { e.target.style.border = '1px solid rgba(255,255,255,0.08)'; e.target.style.boxShadow = 'none' }}>
      {options.map(o => <option key={o.value} value={o.value} style={{ background: '#1a1a1a' }}>{o.label}</option>)}
    </select>
  )
}

function PrimaryBtn({ loading, disabled, onClick, type = 'button', children }) {
  return (
    <button type={type} disabled={loading || disabled} onClick={onClick}
      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-[0.97] disabled:opacity-40"
      style={{ background: `linear-gradient(135deg,${ORANGE},#e85d1e)` }}>
      {loading && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
      {children}
    </button>
  )
}

function GhostBtn({ onClick, children, danger }) {
  return (
    <button type="button" onClick={onClick}
      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:brightness-110 active:scale-[0.97]"
      style={danger
        ? { color: '#f87171', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }
        : { color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
      {children}
    </button>
  )
}

function Toast({ type, msg, onDismiss }) {
  if (!msg) return null
  const cfg = {
    success: { bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.2)', color: '#4ade80', d: 'M5 13l4 4L19 7' },
    error:   { bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)',   color: '#f87171', d: 'M12 8v4M12 16h.01' },
    info:    { bg: 'rgba(96,165,250,0.08)', border: 'rgba(96,165,250,0.2)', color: '#60a5fa', d: 'M12 8v4M12 16h.01' },
  }[type] ?? {}
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm"
      style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}>
      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" className="flex-shrink-0">
        <path d={cfg.d} />
        {type === 'error' && <circle cx="12" cy="12" r="10" />}
      </svg>
      <span className="flex-1">{msg}</span>
      {onDismiss && (
        <button onClick={onDismiss} className="opacity-40 hover:opacity-100 transition-opacity">
          <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      )}
    </div>
  )
}

function Toggle({ checked, onChange, label, desc }) {
  return (
    <div className="flex items-center gap-4 px-4 py-3.5 rounded-xl"
      style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white">{label}</p>
        {desc && <p className="text-xs text-white/35 mt-0.5 leading-relaxed">{desc}</p>}
      </div>
      <button type="button" onClick={() => onChange(!checked)}
        className="relative flex-shrink-0 rounded-full transition-all duration-200"
        style={{ width: 42, height: 24, background: checked ? 'rgba(255,107,43,0.75)' : 'rgba(255,255,255,0.1)' }}>
        <span className="absolute top-[3px] rounded-full bg-white transition-all duration-200"
          style={{ left: checked ? 21 : 3, width: 18, height: 18, boxShadow: '0 1px 4px rgba(0,0,0,0.5)' }} />
      </button>
    </div>
  )
}

function Badge({ children, color }) {
  const map = {
    orange: { bg: 'rgba(255,107,43,0.1)',  border: 'rgba(255,107,43,0.2)',   color: ORANGE_LIGHT },
    green:  { bg: 'rgba(34,197,94,0.08)',  border: 'rgba(34,197,94,0.2)',   color: '#4ade80' },
    blue:   { bg: 'rgba(96,165,250,0.08)', border: 'rgba(96,165,250,0.2)',  color: '#60a5fa' },
    purple: { bg: 'rgba(167,139,250,0.08)',border: 'rgba(167,139,250,0.2)', color: '#a78bfa' },
    gray:   { bg: 'rgba(107,114,128,0.08)',border: 'rgba(107,114,128,0.2)', color: '#9ca3af' },
    red:    { bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.2)',   color: '#f87171' },
  }
  const s = map[color] ?? map.gray
  return (
    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
      style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.color }}>
      {children}
    </span>
  )
}

function CopyBtn({ text }) {
  const [done, setDone] = useState(false)
  const copy = () => { navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 2000) }
  return (
    <button type="button" onClick={copy}
      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all"
      style={{ background: done ? 'rgba(34,197,94,0.1)' : 'rgba(255,107,43,0.08)', color: done ? '#4ade80' : ORANGE, border: done ? '1px solid rgba(34,197,94,0.2)' : '1px solid rgba(255,107,43,0.15)' }}>
      {done
        ? <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" /></svg>
        : <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>}
    </button>
  )
}

const ROLE_COLOR = {
  Admin: 'orange', Developer: 'blue', 'Security Manager': 'purple', Viewer: 'gray',
}

// ─── GENERAL ─────────────────────────────────────────────────────────────────

const LS_GENERAL = 'ivt_general_prefs'
const DEFAULT_GENERAL = { appName: 'InvisiThreat', language: 'en', timezone: 'UTC', dateFormat: 'DD/MM/YYYY', theme: 'dark' }

function GeneralTab() {
  const [prefs, setPrefs] = useState(() => {
    try { return { ...DEFAULT_GENERAL, ...JSON.parse(localStorage.getItem(LS_GENERAL) ?? '{}') } }
    catch { return DEFAULT_GENERAL }
  })
  const [saved, setSaved] = useState(false)

  const set = (k, v) => setPrefs(p => ({ ...p, [k]: v }))

  const save = () => {
    localStorage.setItem(LS_GENERAL, JSON.stringify(prefs))
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const LANGS = [
    { value: 'en', label: 'English' },
    { value: 'fr', label: 'Français' },
    { value: 'ar', label: 'العربية' },
    { value: 'es', label: 'Español' },
    { value: 'de', label: 'Deutsch' },
  ]
  const TZONES = [
    'UTC', 'Africa/Tunis', 'Europe/Paris', 'Europe/London',
    'America/New_York', 'America/Los_Angeles', 'Asia/Dubai',
  ].map(v => ({ value: v, label: v }))
  const DATE_FMTS = [
    { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (31/12/2025)' },
    { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (12/31/2025)' },
    { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (2025-12-31)' },
  ]

  return (
    <div>
      <SectionHeader title="General Settings" subtitle="Configure the platform's basic display and regional preferences." />
      <div className="flex flex-col gap-5">
        <Field label="Application Name" hint="Shown in the browser tab and emails">
          <TextInput value={prefs.appName} onChange={e => set('appName', e.target.value)} placeholder="InvisiThreat" />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Language">
            <SelectInput value={prefs.language} onChange={e => set('language', e.target.value)} options={LANGS} />
          </Field>
          <Field label="Timezone">
            <SelectInput value={prefs.timezone} onChange={e => set('timezone', e.target.value)} options={TZONES} />
          </Field>
        </div>

        <Field label="Date Format">
          <SelectInput value={prefs.dateFormat} onChange={e => set('dateFormat', e.target.value)} options={DATE_FMTS} />
        </Field>

        <div className="mt-2 p-4 rounded-xl" style={{ background: 'rgba(255,107,43,0.04)', border: '1px solid rgba(255,107,43,0.1)' }}>
          <p className="text-xs text-white/35 leading-relaxed">
            <span className="text-white/50 font-semibold">Note:</span> These preferences are stored in your browser. Language and timezone settings will apply across the platform on next refresh.
          </p>
        </div>

        {saved && <Toast type="success" msg="General preferences saved." />}

        <div className="flex justify-end pt-2">
          <PrimaryBtn onClick={save}>Save Preferences</PrimaryBtn>
        </div>
      </div>
    </div>
  )
}

// ─── PROFILE ──────────────────────────────────────────────────────────────────

function ProfileTab({ user, updateUser }) {
  const [nom, setNom]     = useState(user?.nom ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [profilePicture, setProfilePicture] = useState(user?.profile_picture ?? null)
  const [previewImage, setPreviewImage] = useState(user?.profile_picture ?? null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast]   = useState(null)
  const [showCropper, setShowCropper] = useState(false)
  const [cropperImage, setCropperImage] = useState(null)
  const fileInputRef = useRef(null)

  const dirty = nom !== (user?.nom ?? '') || email !== (user?.email ?? '') || profilePicture !== (user?.profile_picture ?? null)

  const handleImageChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setToast({ type: 'error', msg: 'Please select a valid image file.' })
      return
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      setToast({ type: 'error', msg: 'Image must be smaller than 5MB.' })
      return
    }

    // Convert to base64 and show cropper
    const reader = new FileReader()
    reader.onload = (event) => {
      const base64Data = event.target.result
      setCropperImage(base64Data)
      setShowCropper(true)
      setToast(null)
    }
    reader.onerror = () => {
      setToast({ type: 'error', msg: 'Failed to read image file.' })
    }
    reader.readAsDataURL(file)
  }

  const handleCropConfirm = (croppedImageData) => {
    setProfilePicture(croppedImageData)
    setPreviewImage(croppedImageData)
    setShowCropper(false)
    setCropperImage(null)
    setToast(null)
  }

  const handleCropCancel = () => {
    setShowCropper(false)
    setCropperImage(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const removeProfilePicture = () => {
    setProfilePicture(null)
    setPreviewImage(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    setToast(null)
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!nom.trim()) return
    setSaving(true); setToast(null)
    try {
      const updatePayload = { nom: nom.trim(), email: email.trim() || undefined }
      if (profilePicture !== (user?.profile_picture ?? null)) {
        updatePayload.profile_picture = profilePicture
      }
      const updated = await updateMyProfile(updatePayload)
      updateUser(updated)
      setToast({ type: 'success', msg: 'Profile updated successfully.' })
    } catch (err) {
      setToast({ type: 'error', msg: err?.response?.data?.detail ?? 'Failed to save profile.' })
    } finally { setSaving(false) }
  }

  const roleColor = ROLE_COLOR[user?.role_name] ?? 'gray'
  const initials  = (user?.nom ?? '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const joined    = user?.date_creation
    ? new Date(user.date_creation).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : '—'

  return (
    <div>
      {showCropper && (
        <ImageCropper
          imageData={cropperImage}
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
        />
      )}

      <SectionHeader title="Account Profile" subtitle="Your personal information visible to team members." />

      {/* Identity card */}
      <div className="flex items-center gap-5 p-5 rounded-2xl mb-7"
        style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div 
          className="relative w-16 h-16 rounded-2xl flex-shrink-0 overflow-hidden flex items-center justify-center text-xl font-bold"
          style={{ 
            backgroundImage: previewImage ? `url('${previewImage}')` : 'none',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundColor: 'rgba(255,107,43,0.1)',
            border: '1px solid rgba(255,107,43,0.2)',
            color: ORANGE_LIGHT
          }}>
          {!previewImage && initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-lg font-bold text-white truncate">{user?.nom}</p>
          <p className="text-sm text-white/40 truncate">{user?.email}</p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Badge color={roleColor}>{user?.role_name}</Badge>
            <span className="text-xs text-white/25">Member since {joined}</span>
          </div>
        </div>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-5">
        <Field label="Profile Picture">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className="hidden"
          />
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
              style={{ background: ORANGE, border: `1px solid ${ORANGE}` }}
            >
              Choose Image
            </button>
            {previewImage && (
              <button
                type="button"
                onClick={removeProfilePicture}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white/60 transition-all"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                Remove
              </button>
            )}
          </div>
          {previewImage && (
            <p className="text-xs text-white/40 mt-2">Image selected and ready to save</p>
          )}
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Full Name">
            <TextInput value={nom} onChange={e => setNom(e.target.value)} placeholder="Your name" autoComplete="name" />
          </Field>
          <Field label="Email Address">
            <TextInput type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
          </Field>
        </div>
        <Field label="Role" hint="Contact an admin to change your role">
          <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm text-white/30"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: ROLE_COLOR[user?.role_name] === 'orange' ? ORANGE_LIGHT : ROLE_COLOR[user?.role_name] === 'blue' ? '#60a5fa' : ROLE_COLOR[user?.role_name] === 'purple' ? '#a78bfa' : '#6b7280' }} />
            {user?.role_name ?? '—'}
          </div>
        </Field>

        {toast && <Toast {...toast} onDismiss={() => setToast(null)} />}
        <div className="flex justify-end">
          <PrimaryBtn type="submit" loading={saving} disabled={!dirty || !nom.trim()}>Save Profile</PrimaryBtn>
        </div>
      </form>
    </div>
  )
}

// ─── SECURITY ─────────────────────────────────────────────────────────────────

function EyeIcon({ visible }) {
  return visible
    ? <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
    : <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
}

function PasswordInput({ value, onChange, placeholder, autoComplete }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <TextInput
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        extraClassName="pr-10"
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
        tabIndex={-1}
      >
        <EyeIcon visible={show} />
      </button>
    </div>
  )
}

// ─── TWO-FACTOR AUTH SECTION ───────────────────────────────────────────────────────

function TwoFASection() {
  const [enabled, setEnabled] = useState(null) // null = loading
  const [step, setStep]       = useState('idle')  // idle | setup | disabling
  const [setupData, setSetupData] = useState(null)
  const [qrDataUrl, setQrDataUrl] = useState(null)
  const [code, setCode]       = useState('')
  const [saving, setSaving]   = useState(false)
  const [toast, setToast]     = useState(null)

  useEffect(() => {
    totpService.getStatus()
      .then(d => setEnabled(d.totp_enabled))
      .catch(() => setEnabled(false))
  }, [])

  const handleSetup = async () => {
    setSaving(true)
    try {
      const data = await totpService.setup()
      setSetupData(data)
      setQrDataUrl(data.qr_image)
      setStep('setup')
      setCode('')
    } catch {
      setToast({ type: 'error', msg: 'Failed to initialise 2FA setup.' })
    } finally { setSaving(false) }
  }

  const handleEnable = async () => {
    if (code.length !== 6) return
    setSaving(true)
    try {
      await totpService.enable(code)
      setEnabled(true); setStep('idle'); setSetupData(null); setQrDataUrl(null); setCode('')
      setToast({ type: 'success', msg: '2FA enabled. Your account is now more secure.' })
    } catch (err) {
      setToast({ type: 'error', msg: err?.response?.data?.detail ?? 'Invalid code. Try again.' })
    } finally { setSaving(false) }
  }

  const handleDisable = async () => {
    if (code.length !== 6) return
    setSaving(true)
    try {
      await totpService.disable(code)
      setEnabled(false); setStep('idle'); setCode('')
      setToast({ type: 'success', msg: '2FA has been disabled.' })
    } catch (err) {
      setToast({ type: 'error', msg: err?.response?.data?.detail ?? 'Invalid code.' })
    } finally { setSaving(false) }
  }

  const cancel = () => { setStep('idle'); setCode(''); setSetupData(null); setQrDataUrl(null) }

  if (enabled === null) return null

  return (
    <div>
      <SectionHeader title="Two-Factor Authentication" subtitle="Add an extra layer of security to your account." />

      {/* Status row */}
      <div className="flex items-center gap-4 p-4 rounded-xl mb-4"
        style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{
            background: enabled ? 'rgba(34,197,94,0.08)' : 'rgba(96,165,250,0.08)',
            border: `1px solid ${enabled ? 'rgba(34,197,94,0.15)' : 'rgba(96,165,250,0.15)'}`,
          }}>
          <svg width="18" height="18" fill="none" stroke={enabled ? '#4ade80' : '#60a5fa'} strokeWidth="1.8" viewBox="0 0 24 24">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            {enabled && <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />}
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-white">Authenticator App (TOTP)</p>
          <p className="text-xs text-white/35 mt-0.5">Google Authenticator, Authy or any TOTP-compatible app</p>
        </div>
        <Badge color={enabled ? 'green' : 'gray'}>{enabled ? 'Active' : 'Not enabled'}</Badge>
      </div>

      {/* — Disabled: start setup */}
      {!enabled && step === 'idle' && (
        <PrimaryBtn onClick={handleSetup} loading={saving}>Set up 2FA</PrimaryBtn>
      )}

      {/* — Setup flow: QR + verify */}
      {!enabled && step === 'setup' && setupData && (
        <div className="flex flex-col gap-5">
          <div>
            <p className="text-[11px] font-semibold text-white/40 uppercase tracking-wider mb-3">Step 1 — Scan with your authenticator app</p>
            <div className="flex flex-col items-center gap-4">
              {qrDataUrl && (
                <div className="p-3 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <img src={qrDataUrl} alt="2FA QR Code" className="w-44 h-44 rounded" />
                </div>
              )}
              <div className="flex flex-col gap-1.5 w-full">
                <p className="text-xs text-white/35 text-center">Or enter the secret manually:</p>
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <code className="text-xs font-mono text-white/60 flex-1 break-all text-center">{setupData.secret}</code>
                  <CopyBtn text={setupData.secret} />
                </div>
              </div>
            </div>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-white/40 uppercase tracking-wider mb-3">Step 2 — Enter the 6-digit code to confirm</p>
            <div className="flex gap-3" style={{ maxWidth: '100%' }}>
              <TextInput
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                autoComplete="one-time-code"
                extraClassName="text-center tracking-[0.4em] text-base font-mono"
              />
              <PrimaryBtn onClick={handleEnable} loading={saving} disabled={code.length !== 6}>Enable</PrimaryBtn>
            </div>
          </div>
          {toast && <Toast {...toast} onDismiss={() => setToast(null)} />}
          <button onClick={cancel} className="text-xs text-white/30 hover:text-white/50 transition-colors self-start">Cancel setup</button>
        </div>
      )}

      {/* — Enabled: offer to disable */}
      {enabled && step === 'idle' && (
        <>
          {toast && <Toast {...toast} onDismiss={() => setToast(null)} />}
          <button
            onClick={() => { setStep('disabling'); setCode('') }}
            className="text-xs text-red-400/60 hover:text-red-400 transition-colors font-medium"
          >
            Disable 2FA
          </button>
        </>
      )}

      {/* — Disable confirmation */}
      {enabled && step === 'disabling' && (
        <div className="flex flex-col gap-3 max-w-md">
          <p className="text-xs text-white/40">Enter your current TOTP code to confirm.</p>
          <div className="flex gap-3">
            <TextInput
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              autoComplete="one-time-code"
              extraClassName="text-center tracking-[0.4em] text-base font-mono"
            />
            <button
              onClick={handleDisable}
              disabled={code.length !== 6 || saving}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-40"
              style={{ color: '#f87171', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}
            >
              {saving ? '…' : 'Disable'}
            </button>
          </div>
          {toast && <Toast {...toast} onDismiss={() => setToast(null)} />}
          <button onClick={cancel} className="text-xs text-white/30 hover:text-white/50 transition-colors self-start">Cancel</button>
        </div>
      )}
    </div>
  )
}

function SecurityTab() {
  const [cur, setCur] = useState('')
  const [nw,  setNw]  = useState('')
  const [cnf, setCnf] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast]   = useState(null)

  const strength = !nw ? 0
    : nw.length >= 12 && /[A-Z]/.test(nw) && /[0-9]/.test(nw) && /[^A-Za-z0-9]/.test(nw) ? 3
    : nw.length >= 8  && (/[A-Z]/.test(nw) || /[0-9]/.test(nw)) ? 2 : 1
  const sColor = ['', '#ef4444', '#f59e0b', '#22c55e'][strength]
  const sLabel = ['', 'Weak', 'Fair', 'Strong'][strength]

  const submit = async (e) => {
    e.preventDefault()
    if (nw !== cnf)    { setToast({ type: 'error', msg: 'New passwords do not match.' }); return }
    if (nw.length < 8) { setToast({ type: 'error', msg: 'Password must be at least 8 characters.' }); return }
    setSaving(true); setToast(null)
    try {
      await changeMyPassword(cur, nw)
      setCur(''); setNw(''); setCnf('')
      setToast({ type: 'success', msg: 'Password changed successfully.' })
    } catch (err) {
      setToast({ type: 'error', msg: err?.response?.data?.detail ?? 'Failed to change password.' })
    } finally { setSaving(false) }
  }

  // Simulated sessions — real sessions table would require a backend endpoint
  const SESSIONS = [
    { id: 1, device: 'Chrome on Windows', location: 'Tunis, TN', ip: '197.x.x.x', active: true, last: 'Now' },
    { id: 2, device: 'Firefox on Windows', location: 'Tunis, TN', ip: '197.x.x.x', active: false, last: '2 days ago' },
  ]

  return (
    <div className="flex flex-col gap-10">
      {/* Password */}
      <div>
        <SectionHeader title="Change Password" subtitle="Use a strong password with letters, numbers and symbols." />
        <form onSubmit={submit} className="flex flex-col gap-4 max-w-md">
          <Field label="Current Password">
            <PasswordInput value={cur} onChange={e => setCur(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
          </Field>
          <Field label="New Password">
            <PasswordInput value={nw} onChange={e => setNw(e.target.value)} placeholder="Min. 8 characters" autoComplete="new-password" />
          </Field>
          {nw.length > 0 && (
            <div className="flex items-center gap-2 -mt-1">
              {[1,2,3].map(i => (
                <div key={i} className="flex-1 h-1 rounded-full transition-all duration-300"
                  style={{ background: i <= strength ? sColor : 'rgba(255,255,255,0.08)' }} />
              ))}
              <span className="text-xs w-10 font-medium" style={{ color: sColor }}>{sLabel}</span>
            </div>
          )}
          <Field label="Confirm New Password">
            <PasswordInput value={cnf} onChange={e => setCnf(e.target.value)} placeholder="Repeat new password" autoComplete="new-password" />
          </Field>
          {toast && <Toast {...toast} onDismiss={() => setToast(null)} />}
          <div className="flex justify-end">
            <PrimaryBtn type="submit" loading={saving} disabled={!cur || !nw || !cnf}>Update Password</PrimaryBtn>
          </div>
        </form>
      </div>

      {/* 2FA */}
      <TwoFASection />

      {/* Sessions */}
      <div>
        <SectionHeader title="Active Sessions" subtitle="Devices currently signed in to your account." />
        <div className="flex flex-col gap-2">
          {SESSIONS.map(s => (
            <div key={s.id} className="flex items-center gap-4 px-4 py-3.5 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <svg width="16" height="16" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">{s.device}</p>
                <p className="text-xs text-white/30">{s.location} · {s.ip} · {s.last}</p>
              </div>
              {s.active ? <Badge color="green">Current</Badge> : (
                <button className="text-xs text-red-400/60 hover:text-red-400 transition-colors font-medium">Revoke</button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── API KEYS ─────────────────────────────────────────────────────────────────

function ApiKeysTab() {
  const [keys,     setKeys]     = useState([])
  const [loading,  setLoading]  = useState(true)
  const [name,     setName]     = useState('')
  const [creating, setCreating] = useState(false)
  const [newKey,   setNewKey]   = useState(null)
  const [revoking, setRevoking] = useState(null)
  const inputRef = useRef(null)

  const load = useCallback(() => {
    setLoading(true)
    listApiKeys().then(setKeys).catch(() => setKeys([])).finally(() => setLoading(false))
  }, [])
  useEffect(load, [load])

  const handleCreate = async () => {
    setCreating(true)
    try {
      const d = await createApiKey(name.trim() || 'My Key')
      setNewKey(d); setName(''); load()
    } finally { setCreating(false) }
  }

  const handleRevoke = async (id, keyName) => {
    if (!window.confirm(`Revoke "${keyName}"? Any CLI using it will stop working.`)) return
    setRevoking(id)
    try { await revokeApiKey(id); setKeys(p => p.filter(k => k.id !== id)) }
    finally { setRevoking(null) }
  }

  const activeCount  = keys.filter(k => k.is_active).length

  return (
    <div>
      <SectionHeader
        title="API Keys"
        subtitle="Authenticate the InvisiThreat CLI scanner. Each key starts with ivt_ and is shown only once." />

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-7">
        {[
          { label: 'Total Keys',    value: keys.length },
          { label: 'Active',        value: activeCount },
          { label: 'Revoked',       value: keys.length - activeCount },
        ].map(({ label, value }) => (
          <div key={label} className="p-4 rounded-xl text-center"
            style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-2xl font-bold text-white">{loading ? '—' : value}</p>
            <p className="text-xs text-white/35 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* One-time reveal */}
      {newKey && (
        <div className="p-4 rounded-xl mb-5" style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.18)' }}>
          <p className="text-xs font-semibold text-green-400 mb-2">
            ⚠ Copy "<span className="text-white">{newKey.name}</span>" now — won't be shown again.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs px-3 py-2 rounded-lg font-mono overflow-x-auto select-all"
              style={{ background: 'rgba(0,0,0,0.5)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.2)' }}>
              {newKey.plaintext}
            </code>
            <CopyBtn text={newKey.plaintext} />
          </div>
          <button onClick={() => setNewKey(null)} className="mt-2 text-xs text-white/20 hover:text-white/40 transition-colors">
            Dismiss
          </button>
        </div>
      )}

      {/* Generate row */}
      <div className="flex gap-3 mb-6">
        <input ref={inputRef} value={name} onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleCreate()}
          placeholder="Key name (e.g. CI Pipeline, My Laptop)"
          className="flex-1 px-3.5 py-2.5 rounded-xl text-sm text-white outline-none"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
          onFocus={e => { e.target.style.border = '1px solid rgba(255,107,43,0.4)'; e.target.style.boxShadow = '0 0 0 3px rgba(255,107,43,0.08)' }}
          onBlur={e =>  { e.target.style.border = '1px solid rgba(255,255,255,0.08)'; e.target.style.boxShadow = 'none' }}
        />
        <PrimaryBtn loading={creating} onClick={handleCreate}>
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
          Generate
        </PrimaryBtn>
      </div>

      {/* List */}
      <div className="flex flex-col gap-2">
        {loading ? (
          <div className="flex justify-center py-10">
            <span className="w-6 h-6 rounded-full animate-spin border-2 border-white/10 border-t-white/40" />
          </div>
        ) : keys.length === 0 ? (
          <div className="text-center py-12 text-white/20 text-sm">No API keys yet. Generate one above.</div>
        ) : keys.map(k => (
          <div key={k.id} className="flex items-center gap-4 px-4 py-3.5 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(255,107,43,0.07)', border: '1px solid rgba(255,107,43,0.12)' }}>
              <svg width="15" height="15" fill="none" stroke={ORANGE} strokeWidth="1.8" viewBox="0 0 24 24">
                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3M12 7L7 12"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">{k.name}</p>
              <p className="text-xs text-white/30">
                <code className="font-mono">{k.key_prefix}••••••••</code>
                {' · '}{k.last_used_at ? `Last used ${new Date(k.last_used_at).toLocaleDateString()}` : 'Never used'}
              </p>
            </div>
            <Badge color={k.is_active ? 'green' : 'gray'}>{k.is_active ? 'Active' : 'Revoked'}</Badge>
            {k.is_active && (
              <button onClick={() => handleRevoke(k.id, k.name)} disabled={revoking === k.id}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-all text-white/20 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-30"
                style={{ border: '1px solid rgba(255,255,255,0.06)' }} title="Revoke key">
                {revoking === k.id
                  ? <span className="w-3 h-3 border border-red-400/50 border-t-red-400 rounded-full animate-spin" />
                  : <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────

const LS_NOTIF = 'ivt_notif_prefs'
const DEFAULT_NOTIF = { scan_complete: true, new_vuln: true, critical_only: false, project_invite: true, weekly_report: false, system_alerts: true }

function NotificationsTab() {
  const [prefs, setPrefs] = useState(() => {
    try { return { ...DEFAULT_NOTIF, ...JSON.parse(localStorage.getItem(LS_NOTIF) ?? '{}') } }
    catch { return DEFAULT_NOTIF }
  })
  const [saved, setSaved] = useState(false)

  const toggle = key => setPrefs(p => ({ ...p, [key]: !p[key] }))

  const save = () => {
    localStorage.setItem(LS_NOTIF, JSON.stringify(prefs))
    setSaved(true); setTimeout(() => setSaved(false), 2500)
  }

  const GROUPS = [
    {
      title: 'Scan Alerts', items: [
        { key: 'scan_complete', label: 'Scan completed',          desc: 'Notify when a CLI or GitHub scan finishes.' },
        { key: 'new_vuln',      label: 'New vulnerability found', desc: 'Notify when a scan detects new security findings.' },
        { key: 'critical_only', label: 'Critical findings only',  desc: 'Limit vulnerability alerts to Critical severity only.' },
      ],
    },
    {
      title: 'Platform Alerts', items: [
        { key: 'project_invite',  label: 'Project invitations', desc: 'Notify when you are added to a new project.' },
        { key: 'system_alerts',   label: 'System alerts',       desc: 'Important notices from platform administrators.' },
        { key: 'weekly_report',   label: 'Weekly digest',       desc: 'Receive a weekly summary of your security posture.' },
      ],
    },
  ]

  return (
    <div>
      <SectionHeader title="Notification Settings" subtitle="Control how and when InvisiThreat sends you alerts." />
      {GROUPS.map(g => (
        <div key={g.title} className="mb-7">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/30 mb-3">{g.title}</p>
          <div className="flex flex-col gap-2">
            {g.items.map(item => (
              <Toggle key={item.key} checked={prefs[item.key]} onChange={() => toggle(item.key)} label={item.label} desc={item.desc} />
            ))}
          </div>
        </div>
      ))}
      {saved && <Toast type="success" msg="Notification preferences saved." />}
      <div className="flex justify-end pt-2">
        <PrimaryBtn onClick={save}>Save Preferences</PrimaryBtn>
      </div>
    </div>
  )
}

// ─── INTEGRATIONS ─────────────────────────────────────────────────────────────

function IntegrationsTab() {
  const CARDS = [
    {
      id: 'github', name: 'GitHub', status: 'connected', color: '#e2e8f0',
      desc: 'Scan repositories for secrets and vulnerabilities automatically on push.',
      icon: <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/>,
      meta: 'nouha/invisithreat connected',
    },
    {
      id: 'gitlab', name: 'GitLab', status: 'coming_soon', color: '#fc6d26',
      desc: 'Integrate with GitLab CI/CD pipelines to scan merge requests.',
      icon: <><path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0 1 18.6 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.51L23 13.45a.84.84 0 0 1-.35.94z"/></>,
      meta: null,
    },
    {
      id: 'slack', name: 'Slack', status: 'coming_soon', color: '#4A154B',
      desc: 'Receive scan alerts and security notifications directly in Slack channels.',
      icon: <><path d="M14.5 10c-.83 0-1.5-.67-1.5-1.5v-5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5z"/><path d="M20.5 10H19V8.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/><path d="M9.5 14c.83 0 1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5S8 21.33 8 20.5v-5c0-.83.67-1.5 1.5-1.5z"/><path d="M3.5 14H5v1.5c0 .83-.67 1.5-1.5 1.5S2 16.33 2 15.5 2.67 14 3.5 14z"/><path d="M14 14.5c0-.83.67-1.5 1.5-1.5h5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-5c-.83 0-1.5-.67-1.5-1.5z"/><path d="M15.5 19H14v1.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5-.67-1.5-1.5-1.5z"/><path d="M10 9.5C10 8.67 9.33 8 8.5 8H3.5C2.67 8 2 8.67 2 9.5S2.67 11 3.5 11h5c.83 0 1.5-.67 1.5-1.5z"/><path d="M8.5 5H10V3.5C10 2.67 9.33 2 8.5 2S7 2.67 7 3.5 7.67 5 8.5 5z"/></>,
      meta: null,
    },
    {
      id: 'jira', name: 'Jira', status: 'coming_soon', color: '#0052CC',
      desc: 'Automatically create Jira tickets for critical vulnerabilities found in scans.',
      icon: <><path d="M11.53 2c0 2.4 1.97 4.35 4.35 4.35h1.78v1.7c0 2.4 1.95 4.34 4.34 4.35V2.84a.84.84 0 0 0-.84-.84H11.53z"/><path d="M6.77 6.8a4.362 4.362 0 0 0 4.34 4.34h1.79v1.71a4.362 4.362 0 0 0 4.34 4.34V7.63a.839.839 0 0 0-.84-.83H6.77z"/><path d="M2 11.6c0 2.4 1.95 4.34 4.35 4.34h1.78v1.72c.01 2.39 1.95 4.34 4.35 4.34v-9.57a.84.84 0 0 0-.84-.84L2 11.59z"/></>,
      meta: null,
    },
    {
      id: 'webhook', name: 'Webhooks', status: 'partial', color: '#a78bfa',
      desc: 'Send real-time scan events to your own endpoints via HTTP POST.',
      icon: <><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"/></>,
      meta: 'Docs available',
    },
  ]

  return (
    <div>
      <SectionHeader title="Integrations" subtitle="Connect InvisiThreat with your development and security toolchain." />
      <div className="grid grid-cols-2 gap-3">
        {CARDS.map(c => (
          <div key={c.id} className="flex flex-col gap-3 p-4 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${c.color}12`, border: `1px solid ${c.color}20` }}>
                  <svg width="18" height="18" fill="none" stroke={c.color} strokeWidth="1.8" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">{c.icon}</svg>
                </div>
                <span className="text-sm font-bold text-white">{c.name}</span>
              </div>
              {c.status === 'connected' && <Badge color="green">Connected</Badge>}
              {c.status === 'partial'   && <Badge color="blue">Available</Badge>}
              {c.status === 'coming_soon' && <Badge color="gray">Coming Soon</Badge>}
            </div>
            <p className="text-xs text-white/35 leading-relaxed">{c.desc}</p>
            {c.meta && <p className="text-xs text-white/25">{c.meta}</p>}
            {c.status === 'connected' && (
              <button className="text-xs text-red-400/50 hover:text-red-400 transition-colors text-left font-medium">Disconnect</button>
            )}
            {c.status === 'partial' && (
              <button className="text-xs font-medium transition-colors text-left" style={{ color: ORANGE_LIGHT }}>Configure →</button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── LOGS / AUDIT ─────────────────────────────────────────────────────────────

function LogsTab({ user }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getMyAuditLogs()
      .then(setLogs)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const ACTION_MAP = {
    login:            { label: 'Login successful',  type: 'auth' },
    logout:           { label: 'Logged out',         type: 'auth' },
    password_changed: { label: 'Password changed',  type: 'auth' },
    profile_updated:  { label: 'Profile updated',   type: 'profile' },
    api_key_created:  { label: 'API key created',   type: 'apikey' },
    api_key_revoked:  { label: 'API key revoked',   type: 'apikey' },
  }

  const TYPE_CFG = {
    auth:    { color: 'blue',   icon: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></>, },
    apikey:  { color: 'orange', icon: <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3M12 7L7 12"/> },
    scan:    { color: 'green',  icon: <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></> },
    profile: { color: 'purple', icon: <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></> },
  }

  const fmt = iso => {
    const d = new Date(iso)
    const now  = Date.now()
    const diff = now - d.getTime()
    if (diff < 60000)    return 'Just now'
    if (diff < 3600000)  return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  // Component for real-time relative time
  function RelativeTime({ iso }) {
    const relativeTime = useRelativeTime(iso)
    return <span>{relativeTime}</span>
  }

  const BAD_CFG = { blue: '#60a5fa', orange: ORANGE_LIGHT, green: '#4ade80', purple: '#a78bfa' }

  return (
    <div>
      <SectionHeader title="Activity Logs" subtitle="Your last 100 account and security events, stored persistently on the server." />
      {loading ? (
        <p className="text-sm text-white/30 py-8 text-center">Loading…</p>
      ) : logs.length === 0 ? (
        <p className="text-sm text-white/30 py-8 text-center">No activity recorded yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {logs.map(log => {
            const mapped = ACTION_MAP[log.action] ?? { label: log.action, type: 'auth' }
            const cfg = TYPE_CFG[mapped.type] ?? TYPE_CFG.auth
            const col = BAD_CFG[cfg.color] ?? '#9ca3af'
            return (
              <div key={log.id} className="flex items-center gap-4 px-4 py-3 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: `${col}12`, border: `1px solid ${col}20` }}>
                  <svg width="13" height="13" fill="none" stroke={col} strokeWidth="1.8" viewBox="0 0 24 24">{cfg.icon}</svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white">{mapped.label}</p>
                  {log.detail && <p className="text-xs text-white/30">{log.detail}</p>}
                </div>
                <span className="text-xs text-white/20 flex-shrink-0"><RelativeTime iso={log.created_at} /></span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── ABOUT ────────────────────────────────────────────────────────────────────

function AboutTab() {
  const ROWS = [
    { label: 'Application',   value: 'InvisiThreat' },
    { label: 'Version',       value: 'v1.0.0' },
    { label: 'Release Date',  value: 'March 2026' },
    { label: 'Environment',   value: 'Development' },
    { label: 'Backend',       value: 'FastAPI + Python 3.12' },
    { label: 'Database',      value: 'PostgreSQL 16 (Docker)' },
    { label: 'Frontend',      value: 'React 18 + Vite 5' },
    { label: 'CLI Scanner',   value: 'invisithreat.exe (PyInstaller)' },
    { label: 'Email Service', value: 'Brevo Transactional API' },
    { label: 'Auth',          value: 'JWT RS256 + API Key (SHA-256)' },
  ]
  const LINKS = [
    { label: 'Documentation',  href: '#' },
    { label: 'CLI Reference',  href: '#' },
    { label: 'API Reference',  href: '#' },
    { label: 'Report an Issue',href: '#' },
  ]
  return (
    <div>
      <SectionHeader title="About InvisiThreat" subtitle="Platform information, versions, and resources." />
      <div className="flex flex-col gap-6">
        {/* Logo card */}
        <div className="flex items-center gap-4 p-5 rounded-2xl"
          style={{ background: 'rgba(255,107,43,0.04)', border: '1px solid rgba(255,107,43,0.1)' }}>
          <div className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(255,107,43,0.12)', border: '1px solid rgba(255,107,43,0.2)' }}>
            <svg width="22" height="22" fill="none" stroke={ORANGE_LIGHT} strokeWidth="1.8" viewBox="0 0 24 24">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <div>
            <p className="text-base font-bold text-white">InvisiThreat</p>
            <p className="text-xs text-white/35">DevSecOps Security Platform · v1.0.0</p>
          </div>
          <div className="ml-auto"><Badge color="green">Healthy</Badge></div>
        </div>

        {/* Info table */}
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
          {ROWS.map((r, i) => (
            <div key={r.label} className="flex items-center justify-between px-4 py-3 text-sm"
              style={{ borderTop: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.04)', background: i % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
              <span className="text-white/35">{r.label}</span>
              <span className="text-white/70 font-medium">{r.value}</span>
            </div>
          ))}
        </div>

        {/* Links */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-white/25 mb-3">Resources</p>
          <div className="grid grid-cols-2 gap-2">
            {LINKS.map(l => (
              <a key={l.label} href={l.href}
                className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all hover:brightness-125"
                style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}>
                {l.label}
                <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="ml-auto opacity-40"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Sidebar navigation ───────────────────────────────────────────────────────

const NAV_GROUPS = [
  {
    label: 'Account',
    items: [
      { id: 'general',  label: 'General',  icon: <><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></> },
      { id: 'profile',  label: 'Profile',  icon: <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></> },
      { id: 'security', label: 'Security', icon: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/> },
    ],
  },
  {
    label: 'Developer',
    items: [
      { id: 'apikeys',       label: 'API Keys',      icon: <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3M12 7L7 12"/> },
      { id: 'integrations',  label: 'Integrations',  icon: <><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></> },
    ],
  },
  {
    label: 'Preferences',
    items: [
      { id: 'notifications', label: 'Notifications', icon: <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></> },
    ],
  },
  {
    label: 'System',
    items: [
      { id: 'logs',  label: 'Audit Logs', icon: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></> },
      { id: 'about', label: 'About',      icon: <><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></> },
    ],
  },
]

function SidebarItem({ item, active, onClick }) {
  return (
    <button onClick={() => onClick(item.id)}
      className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-sm font-medium text-left transition-all"
      style={active
        ? { background: 'rgba(255,107,43,0.1)', border: '1px solid rgba(255,107,43,0.18)', color: ORANGE_LIGHT }
        : { color: 'rgba(255,255,255,0.38)', border: '1px solid transparent' }}>
      <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth={active ? '2' : '1.8'}
        strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" className="flex-shrink-0">
        {item.icon}
      </svg>
      {item.label}
    </button>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { user, updateUser } = useAuth()
  const [tab, setTab] = useState('general')

  const PANELS = {
    general:       <GeneralTab />,
    profile:       <ProfileTab user={user} updateUser={updateUser} />,
    security:      <SecurityTab />,
    apikeys:       <ApiKeysTab />,
    integrations:  <IntegrationsTab />,
    notifications: <NotificationsTab />,
    logs:          <LogsTab user={user} />,
    about:         <AboutTab />,
  }

  return (
    <AppLayout>
      <div className="flex flex-col" style={{ flex: 1, minHeight: 0, background: '#080808' }}>

        {/* Top header */}
        <div className="flex-shrink-0 px-8 py-6" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <h1 className="text-xl font-bold text-white">Settings</h1>
          <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Manage your account, integrations, and platform preferences.
          </p>
        </div>

        {/* Sidebar + content */}
        <div className="flex" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>

          {/* Sidebar */}
          <div className="flex-shrink-0 flex flex-col gap-4 p-4 overflow-y-auto"
            style={{ width: 210, borderRight: '1px solid rgba(255,255,255,0.05)' }}>
            {NAV_GROUPS.map(g => (
              <div key={g.label}>
                <p className="text-[10px] font-bold uppercase tracking-widest px-3 mb-1.5"
                  style={{ color: 'rgba(255,255,255,0.2)' }}>{g.label}</p>
                <div className="flex flex-col gap-0.5">
                  {g.items.map(item => (
                    <SidebarItem key={item.id} item={item} active={tab === item.id} onClick={setTab} />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto" style={{ minWidth: 0, padding: '40px 100px' }}>
            <div style={{ maxWidth: 720 }}>
              {PANELS[tab]}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

