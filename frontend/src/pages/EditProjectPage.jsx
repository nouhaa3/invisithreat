import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import { getProject, updateProject } from '../services/projectService'

const LANGUAGES = ['Python','JavaScript','TypeScript','Java','C#','Go','PHP','Ruby','Other']
const ANALYSIS_TYPES = [
  ['SAST', 'Static code analysis'],
  ['Secrets', 'Hardcoded credentials & tokens'],
  ['Dependencies', 'Vulnerable packages'],
  ['Full (SAST + Secrets + Dependencies)', 'Everything'],
]

export default function EditProjectPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: '',
    description: '',
    language: 'Other',
    analysis_type: 'SAST',
    visibility: 'private',
  })

  useEffect(() => {
    getProject(id)
      .then(p => {
        setForm({
          name: p.name || '',
          description: p.description || '',
          language: p.language || 'Other',
          analysis_type: p.analysis_type || 'SAST',
          visibility: p.visibility || 'private',
        })
      })
      .catch(() => setError('Failed to load project'))
      .finally(() => setLoading(false))
  }, [id])

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Project name is required'); return }
    setSaving(true)
    setError('')
    try {
      await updateProject(id, {
        name: form.name.trim(),
        description: form.description.trim() || null,
        language: form.language,
        analysis_type: form.analysis_type,
        visibility: form.visibility,
      })
      navigate(`/projects/${id}`)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  const inputStyle = { background: '#1c1c1c', border: '1px solid #2a2a2a' }
  const focusOn  = e => { e.target.style.borderColor = 'rgba(255,107,43,0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(255,107,43,0.1)' }
  const focusOff = e => { e.target.style.borderColor = '#2a2a2a'; e.target.style.boxShadow = '' }

  return (
    <AppLayout>
      <main className="flex-1 overflow-auto">
        <div className="max-w-2xl mx-auto px-8 py-8">

          {/* Header */}
          <div className="mb-8 animate-slide-up">
            <button
              onClick={() => navigate(`/projects/${id}`)}
              className="flex items-center gap-2 text-white/30 hover:text-white/60 text-sm mb-4 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Back to Project
            </button>
            <h1 className="text-2xl font-bold text-white">Edit Project</h1>
            <p className="text-white/30 text-sm mt-1">Update project parameters and settings</p>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <div className="w-8 h-8 rounded-full animate-spin" style={{ border: '2px solid rgba(255,107,43,0.2)', borderTop: '2px solid #FF6B2B' }} />
            </div>
          ) : (
            <div className="rounded-2xl p-6 flex flex-col gap-6 animate-slide-up"
              style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.06)' }}>

              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-white/40 uppercase tracking-widest mb-2">Project Name</label>
                <input
                  className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none transition-all"
                  style={inputStyle}
                  value={form.name}
                  onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setError('') }}
                  onFocus={focusOn} onBlur={focusOff}
                  placeholder="e.g. My API Backend"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-white/40 uppercase tracking-widest mb-2">
                  Description <span className="text-white/20 normal-case font-normal">(optional)</span>
                </label>
                <textarea
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none transition-all resize-none"
                  style={inputStyle}
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  onFocus={focusOn} onBlur={focusOff}
                  placeholder="Short description of this project"
                />
              </div>

              {/* Language */}
              <div>
                <label className="block text-xs font-semibold text-white/40 uppercase tracking-widest mb-2">Language</label>
                <div className="flex flex-wrap gap-2">
                  {LANGUAGES.map(lang => (
                    <button key={lang} type="button"
                      onClick={() => setForm(f => ({ ...f, language: lang }))}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                      style={{
                        background: form.language === lang ? 'rgba(255,107,43,0.12)' : 'rgba(255,255,255,0.03)',
                        border: form.language === lang ? '1px solid rgba(255,107,43,0.35)' : '1px solid rgba(255,255,255,0.07)',
                        color: form.language === lang ? '#FF8C5A' : 'rgba(255,255,255,0.35)',
                      }}>{lang}</button>
                  ))}
                </div>
              </div>

              {/* Analysis Type */}
              <div>
                <label className="block text-xs font-semibold text-white/40 uppercase tracking-widest mb-2">Analysis Type</label>
                <div className="flex flex-col gap-2">
                  {ANALYSIS_TYPES.map(([val, desc]) => (
                    <button key={val} type="button"
                      onClick={() => setForm(f => ({ ...f, analysis_type: val }))}
                      className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-left transition-all"
                      style={{
                        background: form.analysis_type === val ? 'rgba(255,107,43,0.08)' : 'rgba(255,255,255,0.02)',
                        border: form.analysis_type === val ? '1px solid rgba(255,107,43,0.2)' : '1px solid rgba(255,255,255,0.05)',
                      }}>
                      <span className="text-sm font-medium" style={{ color: form.analysis_type === val ? '#FF8C5A' : 'rgba(255,255,255,0.6)' }}>{val}</span>
                      <span className="text-xs text-white/25 ml-auto">{desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Visibility */}
              <div>
                <label className="block text-xs font-semibold text-white/40 uppercase tracking-widest mb-2">Visibility</label>
                <div className="flex gap-2">
                  {[['private','Private'],['public','Public']].map(([val, lbl]) => (
                    <button key={val} type="button"
                      onClick={() => setForm(f => ({ ...f, visibility: val }))}
                      className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all"
                      style={{
                        background: form.visibility === val ? 'rgba(255,107,43,0.1)' : 'rgba(255,255,255,0.03)',
                        border: form.visibility === val ? '1px solid rgba(255,107,43,0.25)' : '1px solid rgba(255,255,255,0.06)',
                        color: form.visibility === val ? '#FF8C5A' : 'rgba(255,255,255,0.35)',
                      }}>{lbl}</button>
                  ))}
                </div>
              </div>

              {error && <p className="text-red-400 text-xs">{error}</p>}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => navigate(`/projects/${id}`)}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-lg active:scale-[0.98] disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #FF6B2B, #C13A00)', boxShadow: '0 4px 16px rgba(255,107,43,0.25)' }}
                >
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </AppLayout>
  )
}
