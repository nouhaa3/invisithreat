import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import AnalysisTypeSelector from '../components/AnalysisTypeSelector'
import ProjectTypeSelector from '../components/ProjectTypeSelector'
import { getProject, updateProject } from '../services/projectService'

export default function EditProjectPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: '',
    description: '',
    project_type: 'Other',
    analysis_type: 'SAST',
    visibility: 'private',
  })

  useEffect(() => {
    let mounted = true

    const loadProject = async () => {
      try {
        const project = await getProject(id)
        if (!mounted) return

        setForm({
          name: project.name || '',
          description: project.description || '',
          project_type: project.project_type || 'Other',
          analysis_type: project.analysis_type || 'SAST',
          visibility: project.visibility || 'private',
        })
      } catch {
        if (mounted) setError('Failed to load project')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadProject()

    return () => {
      mounted = false
    }
  }, [id])

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError('Project name is required')
      return
    }

    setSaving(true)
    setError('')

    try {
      await updateProject(id, {
        name: form.name.trim(),
        description: form.description.trim() || null,
        project_type: form.project_type,
        language: null,
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

  return (
    <AppLayout>
      <main className="flex-1 overflow-auto">
        <section className="ui-page">
          <div className="ui-container">
            <div className="mb-4">
              <button
                onClick={() => navigate(`/projects/${id}`)}
                className="flex items-center gap-2 text-white/50 hover:text-white/70 text-sm transition-colors"
              >
                <span aria-hidden>←</span>
                Back to project
              </button>
            </div>

            <div className="ui-hero mb-6 animate-slide-up">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-start gap-4">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(255,107,43,0.12)', border: '1px solid rgba(255,107,43,0.25)' }}
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FF8C5A" strokeWidth="1.7">
                      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <div className="ui-chip" style={{ background: 'rgba(255,107,43,0.12)', borderColor: 'rgba(255,107,43,0.35)', color: '#FF8C5A' }}>
                      Project Settings
                    </div>
                    <h1 className="text-2xl md:text-3xl font-semibold text-white mt-3">Edit Project</h1>
                    <p className="text-sm text-white/55 mt-2">Update project parameters, scanning preferences, and access visibility.</p>
                  </div>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="ui-card p-10 flex justify-center">
                <div
                  className="w-8 h-8 rounded-full animate-spin"
                  style={{ border: '2px solid rgba(255,107,43,0.2)', borderTop: '2px solid #FF6B2B' }}
                />
              </div>
            ) : (
              <div className="grid gap-6 w-full animate-slide-up">
                <section className="ui-card p-6 space-y-5">
                  <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                    </svg>
                    General Information
                  </h2>

                  <div>
                    <label className="ui-label mb-3">Project Name</label>
                    <input
                      className="ui-input"
                      value={form.name}
                      onChange={e => {
                        setForm(prev => ({ ...prev, name: e.target.value }))
                        setError('')
                      }}
                      placeholder="e.g. My API Backend"
                    />
                  </div>

                  <div>
                    <label className="ui-label mb-3">
                      Description <span className="text-white/30 normal-case font-normal text-[11px]">(optional)</span>
                    </label>
                    <textarea
                      rows={3}
                      className="ui-input min-h-[96px] resize-none"
                      value={form.description}
                      onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Short description of this project"
                    />
                  </div>

                  <div>
                    <label className="ui-label mb-3">Application Type</label>
                    <ProjectTypeSelector value={form.project_type} onChange={value => setForm(prev => ({ ...prev, project_type: value }))} />
                  </div>
                </section>

                <section className="ui-card p-6 space-y-5">
                  <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    Analysis Configuration
                  </h2>

                  <div>
                    <label className="ui-label mb-3">Analysis Type</label>
                    <p className="text-sm text-white/45 mb-4">Same analysis types as the New Scan flow.</p>
                    <AnalysisTypeSelector value={form.analysis_type} onChange={value => setForm(prev => ({ ...prev, analysis_type: value }))} />
                  </div>
                </section>

                <section className="ui-card p-6 space-y-5">
                  <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 1l9 5v6c0 5.55-3.84 10.74-9 12-5.16-1.26-9-6.45-9-12V6l9-5" />
                    </svg>
                    Access and Visibility
                  </h2>

                  <div>
                    <label className="ui-label mb-3">Project Visibility</label>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      {[
                        ['private', 'Private', 'Only team members can access this project'],
                        ['public', 'Public', 'Visible to everyone in the workspace'],
                      ].map(([value, label, description]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setForm(prev => ({ ...prev, visibility: value }))}
                          className={`rounded-2xl border p-4 text-left transition-all ${
                            form.visibility === value
                              ? 'border-brand-orange/35 bg-brand-orange/10'
                              : 'border-white/10 bg-white/5 hover:border-white/20'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                form.visibility === value ? 'border-brand-orange/70' : 'border-white/20'
                              }`}
                            >
                              {form.visibility === value && <div className="w-2 h-2 rounded-full bg-brand-orange" />}
                            </div>
                            <span className={`font-semibold text-sm ${form.visibility === value ? 'text-brand-orange-light' : 'text-white/70'}`}>
                              {label}
                            </span>
                          </div>
                          <p className="text-sm text-white/35 mt-2 ml-7">{description}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                </section>

                {error && (
                  <div className="rounded-2xl border px-4 py-3" style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.25)' }}>
                    <p className="text-sm text-red-300">{error}</p>
                  </div>
                )}

                <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-end">
                  <button
                    onClick={() => navigate(`/projects/${id}`)}
                    className="px-4 py-2.5 rounded-lg text-sm font-semibold transition-all hover:opacity-80 active:scale-[0.97]"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-all hover:shadow-lg active:scale-[0.98] disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg, #FF6B2B, #C13A00)', boxShadow: '0 4px 14px rgba(255,107,43,0.2)' }}
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
    </AppLayout>
  )
}
