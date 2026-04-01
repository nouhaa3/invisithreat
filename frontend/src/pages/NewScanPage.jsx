import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import { getProjects, createProject, createScan, getCLIToken } from '../services/projectService'
import { listApiKeys, createApiKey } from '../services/apiKeyService'

const getApiBase = () => {
  const env = import.meta.env.VITE_API_URL
  if (env && !env.includes('localhost')) return env
  return `${window.location.protocol}//${window.location.hostname}:8000`
}

function StepIndicator({ current, steps }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {steps.map((label, i) => {
        const isComplete = i < current
        const isActive = i === current
        return (
          <div key={label} className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300"
                style={{
                  background: isComplete
                    ? 'rgba(34,197,94,0.15)'
                    : isActive
                    ? 'rgba(255,107,43,0.15)'
                    : 'rgba(255,255,255,0.04)',
                  border: isComplete
                    ? '1px solid rgba(34,197,94,0.3)'
                    : isActive
                    ? '1px solid rgba(255,107,43,0.3)'
                    : '1px solid rgba(255,255,255,0.08)',
                  color: isComplete ? '#22c55e' : isActive ? '#FF6B2B' : '#ffffff40',
                }}
              >
                {isComplete ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              <span
                className="text-xs font-medium"
                style={{ color: isActive ? '#FF8C5A' : isComplete ? '#22c55e' : 'rgba(255,255,255,0.2)' }}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className="w-8 h-px"
                style={{ background: isComplete ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.06)' }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

function SectionCard({ children }) {
  return (
    <div className="rounded-2xl p-6" style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.06)' }}>
      {children}
    </div>
  )
}

export default function NewScanPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)

  // Step 0 - Project
  const [projects, setProjects] = useState([])
  const [projectMode, setProjectMode] = useState('new') // 'new' | 'existing'
  const [selectedProject, setSelectedProject] = useState(null)
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectDesc, setNewProjectDesc] = useState('')
  const [newProjectLanguage, setNewProjectLanguage] = useState('Other')
  const [newProjectAnalysis, setNewProjectAnalysis] = useState('SAST')
  const [newProjectVisibility, setNewProjectVisibility] = useState('private')
  const [projectError, setProjectError] = useState('')

  // Step 1 - Method
  const [method, setMethod] = useState(null) // 'cli' | 'github' | 'exe'

  // Step 2 - EXE: API key generation
  const [exeKeys, setExeKeys] = useState([])
  const [exeNewKeyName, setExeNewKeyName] = useState('')
  const [exeCreating, setExeCreating] = useState(false)
  const [exeNewKeyData, setExeNewKeyData] = useState(null)
  const [exeKeysLoaded, setExeKeysLoaded] = useState(false)

  // Step 2 - Configure
  const [repoUrl, setRepoUrl] = useState('')
  const [repoBranch, setRepoBranch] = useState('main')
  const [configError, setConfigError] = useState('')

  // Step 3 - Created
  const [createdProject, setCreatedProject] = useState(null)
  const [createdScan, setCreatedScan] = useState(null)
  const [cliToken, setCliToken] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    getProjects().then(setProjects).catch(() => setProjects([]))
  }, [])

  useEffect(() => {
    if (step === 2 && method === 'exe' && !exeKeysLoaded) {
      listApiKeys().then(k => { setExeKeys(k); setExeKeysLoaded(true) }).catch(() => setExeKeysLoaded(true))
    }
  }, [step, method])

  const handleExeGenerateKey = async () => {
    const name = exeNewKeyName.trim() || 'My Key'
    setExeCreating(true)
    try {
      const data = await createApiKey(name)
      setExeNewKeyData(data)
      setExeNewKeyName('')
      listApiKeys().then(setExeKeys).catch(() => {})
    } finally {
      setExeCreating(false)
    }
  }

  // ─── Step 0: Project ────────────────────────────────────────────────────────
  const handleStep0 = () => {
    if (projectMode === 'new' && !newProjectName.trim()) {
      setProjectError('Project name is required')
      return
    }
    if (projectMode === 'existing' && !selectedProject) {
      setProjectError('Please select a project')
      return
    }
    setProjectError('')
    setStep(1)
  }

  // ─── Step 1: Method ─────────────────────────────────────────────────────────
  const handleStep1 = () => {
    if (!method) return
    setStep(2)
  }

  // ─── Step 2: Configure ──────────────────────────────────────────────────────
  const handleStep2 = async () => {
    if (method === 'github' && !repoUrl.trim()) {
      setConfigError('Repository URL is required')
      return
    }
    setConfigError('')
    setLoading(true)
    try {
      let project
      if (projectMode === 'new') {
        project = await createProject({
            name: newProjectName.trim(),
            description: newProjectDesc.trim() || null,
            language: newProjectLanguage,
            analysis_type: newProjectAnalysis,
            visibility: newProjectVisibility,
          })
      } else {
        project = selectedProject
      }
      setCreatedProject(project)

      if (method !== 'exe') {
        const scan = await createScan(project.id, {
          method,
          repo_url: method === 'github' ? repoUrl.trim() : null,
          repo_branch: method === 'github' ? (repoBranch.trim() || 'main') : null,
        })
        setCreatedScan(scan)

        if (method === 'cli') {
          const tokenData = await getCLIToken(project.id, scan.id)
          setCliToken(tokenData)
        }
      }

      setStep(3)
    } catch (err) {
      setConfigError(err.response?.data?.detail || 'An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppLayout>
      <main className="flex-1 overflow-auto">
        <div className="max-w-2xl mx-auto px-8 py-8">
          {/* Header */}
          <div className="mb-8 animate-slide-up">
            <button
              onClick={() => step > 0 && step < 3 ? setStep(s => s - 1) : navigate('/dashboard')}
              className="flex items-center gap-2 text-white/30 hover:text-white/60 text-sm mb-4 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              {step === 0 || step === 3 ? 'Back to Dashboard' : 'Back'}
            </button>
            <h1 className="text-2xl font-bold text-white">New Scan</h1>
            <p className="text-white/30 text-sm mt-1">Analyse your project for security vulnerabilities</p>
          </div>

          <StepIndicator current={step} steps={method === 'exe' ? ['Project', 'Method', 'Setup', 'Done'] : ['Project', 'Method', 'Configure', 'Done']} />

          {/* ─── STEP 0: Project ─────────────────────────────────────────────── */}
          {step === 0 && (
            <div className="animate-slide-up">
              <SectionCard>
                <h2 className="text-sm font-semibold text-white mb-4">Select or create a project</h2>

                {/* Toggle */}
                <div className="flex gap-2 mb-5">
                  {[['new', 'New project'], ['existing', 'Existing project']].map(([val, lbl]) => (
                    <button
                      key={val}
                      onClick={() => { setProjectMode(val); setProjectError('') }}
                      className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
                      style={{
                        background: projectMode === val ? 'rgba(255,107,43,0.1)' : 'rgba(255,255,255,0.03)',
                        border: projectMode === val ? '1px solid rgba(255,107,43,0.25)' : '1px solid rgba(255,255,255,0.06)',
                        color: projectMode === val ? '#FF8C5A' : 'rgba(255,255,255,0.35)',
                      }}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>

                {projectMode === 'new' ? (
                  <div className="flex flex-col gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-white/40 uppercase tracking-widest mb-2">
                        Project Name
                      </label>
                      <input
                        className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none transition-all"
                        style={{ background: '#1c1c1c', border: '1px solid #2a2a2a' }}
                        placeholder="e.g. My API Backend"
                        value={newProjectName}
                        onChange={e => { setNewProjectName(e.target.value); setProjectError('') }}
                        onFocus={e => { e.target.style.borderColor = 'rgba(255,107,43,0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(255,107,43,0.1)' }}
                        onBlur={e => { e.target.style.borderColor = '#2a2a2a'; e.target.style.boxShadow = '' }}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-white/40 uppercase tracking-widest mb-2">
                        Description <span className="text-white/20 normal-case font-normal">(optional)</span>
                      </label>
                      <input
                        className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none transition-all"
                        style={{ background: '#1c1c1c', border: '1px solid #2a2a2a' }}
                        placeholder="Short description of this project"
                        value={newProjectDesc}
                        onChange={e => setNewProjectDesc(e.target.value)}
                        onFocus={e => { e.target.style.borderColor = 'rgba(255,107,43,0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(255,107,43,0.1)' }}
                        onBlur={e => { e.target.style.borderColor = '#2a2a2a'; e.target.style.boxShadow = '' }}
                      />
                    </div>
                    {/* Language */}
                    <div>
                      <label className="block text-xs font-semibold text-white/40 uppercase tracking-widest mb-2">Language</label>
                      <div className="flex flex-wrap gap-2">
                        {['Python','JavaScript','TypeScript','Java','C#','Go','PHP','Ruby','Other'].map(lang => (
                          <button key={lang} type="button"
                            onClick={() => setNewProjectLanguage(lang)}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                            style={{
                              background: newProjectLanguage === lang ? 'rgba(255,107,43,0.12)' : 'rgba(255,255,255,0.03)',
                              border: newProjectLanguage === lang ? '1px solid rgba(255,107,43,0.35)' : '1px solid rgba(255,255,255,0.07)',
                              color: newProjectLanguage === lang ? '#FF8C5A' : 'rgba(255,255,255,0.35)',
                            }}>{lang}</button>
                        ))}
                      </div>
                    </div>
                    {/* Analysis Type */}
                    <div>
                      <label className="block text-xs font-semibold text-white/40 uppercase tracking-widest mb-2">Analysis Type</label>
                      <div className="flex flex-col gap-2">
                        {[
                          ['SAST', 'Static code analysis'],
                          ['Secrets', 'Hardcoded credentials & tokens'],
                          ['Dependencies', 'Vulnerable packages'],
                          ['Full (SAST + Secrets + Dependencies)', 'Everything'],
                        ].map(([val, desc]) => (
                          <button key={val} type="button"
                            onClick={() => setNewProjectAnalysis(val)}
                            className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-left transition-all"
                            style={{
                              background: newProjectAnalysis === val ? 'rgba(255,107,43,0.08)' : 'rgba(255,255,255,0.02)',
                              border: newProjectAnalysis === val ? '1px solid rgba(255,107,43,0.2)' : '1px solid rgba(255,255,255,0.05)',
                            }}>
                            <span className="text-sm font-medium" style={{ color: newProjectAnalysis === val ? '#FF8C5A' : 'rgba(255,255,255,0.6)' }}>{val}</span>
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
                            onClick={() => setNewProjectVisibility(val)}
                            className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all"
                            style={{
                              background: newProjectVisibility === val ? 'rgba(255,107,43,0.1)' : 'rgba(255,255,255,0.03)',
                              border: newProjectVisibility === val ? '1px solid rgba(255,107,43,0.25)' : '1px solid rgba(255,255,255,0.06)',
                              color: newProjectVisibility === val ? '#FF8C5A' : 'rgba(255,255,255,0.35)',
                            }}>{lbl}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    {projects.length === 0 ? (
                      <p className="text-white/30 text-sm text-center py-6">No projects found. Create one instead.</p>
                    ) : (
                      <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                        {projects.map(p => (
                          <button
                            key={p.id}
                            onClick={() => { setSelectedProject(p); setProjectError('') }}
                            className="flex items-center justify-between px-4 py-3 rounded-xl text-left transition-all"
                            style={{
                              background: selectedProject?.id === p.id ? 'rgba(255,107,43,0.08)' : 'rgba(255,255,255,0.02)',
                              border: selectedProject?.id === p.id ? '1px solid rgba(255,107,43,0.2)' : '1px solid rgba(255,255,255,0.05)',
                            }}
                          >
                            <span className="text-sm text-white font-medium">{p.name}</span>
                            <span className="text-xs text-white/30">{p.scan_count} scans</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {projectError && (
                  <p className="text-red-400 text-xs mt-3">{projectError}</p>
                )}
              </SectionCard>

              <button
                onClick={handleStep0}
                className="w-full mt-4 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-lg active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg, #FF6B2B, #C13A00)', boxShadow: '0 4px 16px rgba(255,107,43,0.25)' }}
              >
                Continue
              </button>
            </div>
          )}

          {/* ─── STEP 1: Method ──────────────────────────────────────────────── */}
          {step === 1 && (
            <div className="animate-slide-up">
              <div className="grid grid-cols-3 gap-3 mb-4">
                <MethodCard
                  active={method === 'exe'}
                  onClick={() => setMethod('exe')}
                  recommended
                  title="EXE Scanner"
                  description="Download invisithreat.exe and scan locally. No Python needed — one file, instant results."
                  badge="Recommended"
                  icon={
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <rect x="3" y="3" width="7" height="7" rx="1"/>
                      <rect x="14" y="3" width="7" height="7" rx="1"/>
                      <rect x="3" y="14" width="7" height="7" rx="1"/>
                      <path d="M14 17h7M17 14v7"/>
                    </svg>
                  }
                />
                <MethodCard
                  active={method === 'cli'}
                  onClick={() => setMethod('cli')}
                  title="CLI (Python)"
                  description="Run the Python scanner script. Requires Python installed on your machine."
                  badge=""
                  icon={
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <polyline points="4 17 10 11 4 5" />
                      <line x1="12" y1="19" x2="20" y2="19" />
                    </svg>
                  }
                />
                <MethodCard
                  active={method === 'github'}
                  onClick={() => setMethod('github')}
                  title="GitHub"
                  description="Connect your GitHub repo. Scan runs in an isolated sandbox."
                  badge=""
                  icon={
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-1-2.6c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
                    </svg>
                  }
                />
              </div>

              <button
                onClick={handleStep1}
                disabled={!method}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-lg active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                style={method ? { background: 'linear-gradient(135deg, #FF6B2B, #C13A00)', boxShadow: '0 4px 16px rgba(255,107,43,0.25)' } : { background: '#2a2a2a' }}
              >
                Continue
              </button>
            </div>
          )}

          {/* ─── STEP 2: API Key (EXE) / Configure (others) ──────────────── */}
          {step === 2 && method === 'exe' && (
            <div className="animate-slide-up">
              {/* Download card */}
              <div className="flex items-center justify-between p-4 rounded-2xl mb-3"
                style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.15)' }}>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="1.8">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="7 10 12 15 17 10"/>
                      <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Step 1 — Download invisithreat.exe</p>
                    <p className="text-xs text-white/30 mt-0.5">Windows x64 · ~12 MB</p>
                  </div>
                </div>
                <a
                  href="/downloads/invisithreat.exe"
                  download="invisithreat.exe"
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95"
                  style={{ background: 'rgba(96,165,250,0.1)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.2)' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  Download
                </a>
              </div>

              {/* API Key card */}
              <SectionCard>
                <div className="flex items-center gap-3 mb-5 pb-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(255,107,43,0.08)', border: '1px solid rgba(255,107,43,0.12)' }}>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#FF6B2B" strokeWidth="1.8">
                      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3M12 7L7 12" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Get your API key</p>
                    <p className="text-xs text-white/30 mt-0.5">
                      The scanner needs this key to send results to your project.
                    </p>
                  </div>
                </div>

                {/* Newly generated key — shown once */}
                {exeNewKeyData && (
                  <div className="mb-4 rounded-xl p-4"
                    style={{ background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.2)' }}>
                    <div className="flex items-center gap-2 mb-2">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      <p className="text-xs font-semibold text-green-400">
                        Key "<span className="text-white">{exeNewKeyData.name}</span>" created — copy it now, it won't be shown again
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs px-3 py-2 rounded-lg select-all font-mono overflow-x-auto"
                        style={{ background: 'rgba(0,0,0,0.5)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)' }}>
                        {exeNewKeyData.plaintext}
                      </code>
                      <button
                        onClick={() => navigator.clipboard.writeText(exeNewKeyData.plaintext)}
                        className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all"
                        style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="9" y="9" width="13" height="13" rx="2"/>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                )}

                {/* Generate key form */}
                <div className="flex gap-3 mb-4">
                  <input
                    value={exeNewKeyName}
                    onChange={e => setExeNewKeyName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleExeGenerateKey()}
                    placeholder='Key name, e.g. "My Laptop"'
                    className="flex-1 px-4 py-2.5 rounded-xl text-sm text-white placeholder-white/20 outline-none transition-all"
                    style={{ background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.08)' }}
                    onFocus={e => e.target.style.borderColor = 'rgba(255,107,43,0.4)'}
                    onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
                  />
                  <button
                    onClick={handleExeGenerateKey}
                    disabled={exeCreating}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg,#FF6B2B,#C13A00)', boxShadow: '0 4px 16px rgba(255,107,43,0.25)' }}>
                    {exeCreating
                      ? <span className="w-4 h-4 rounded-full animate-spin" style={{ border: '2px solid rgba(255,255,255,0.2)', borderTop: '2px solid white' }} />
                      : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                    }
                    Generate Key
                  </button>
                </div>

                {/* Existing keys list */}
                {exeKeys.length > 0 && !exeNewKeyData && (
                  <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-white/25 px-4 py-2.5"
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.01)' }}>
                      Your existing keys — still valid
                    </p>
                    {exeKeys.slice(0, 3).map((k, i) => (
                      <div key={k.id} className="flex items-center gap-3 px-4 py-3"
                        style={{ borderBottom: i < Math.min(exeKeys.length, 3) - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#FF6B2B" strokeWidth="1.8">
                          <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5"/>
                        </svg>
                        <span className="text-xs text-white/60 flex-1">{k.name}</span>
                        <code className="text-xs font-mono text-white/25">{k.key_prefix}••••••</code>
                      </div>
                    ))}
                  </div>
                )}

                {exeKeys.length === 0 && !exeNewKeyData && exeKeysLoaded && (
                  <div className="rounded-xl px-4 py-3 text-center"
                    style={{ background: 'rgba(255,107,43,0.04)', border: '1px solid rgba(255,107,43,0.1)' }}>
                    <p className="text-xs" style={{ color: 'rgba(255,107,43,0.7)' }}>
                      You have no API keys yet. Generate one above to continue.
                    </p>
                  </div>
                )}
              </SectionCard>

              <button
                onClick={handleStep2}
                disabled={loading || (exeKeys.length === 0 && !exeNewKeyData)}
                className="w-full mt-4 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-lg active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg, #FF6B2B, #C13A00)', boxShadow: '0 4px 16px rgba(255,107,43,0.25)' }}
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creating project...
                  </>
                ) : (
                  <>
                    I have my key — Create Project
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </>
                )}
              </button>
            </div>
          )}

          {step === 2 && method !== 'exe' && (
            <div className="animate-slide-up">
              <SectionCard>
                <h2 className="text-sm font-semibold text-white mb-1">
                  {method === 'cli' ? 'Confirm scan configuration' : 'Configure GitHub repository'}
                </h2>
                <p className="text-xs text-white/30 mb-5">
                  {method === 'cli'
                    ? 'A CLI token will be generated after confirmation. Use it to upload your scan results.'
                    : 'Enter the repository URL to connect. The scan will run in an isolated environment.'}
                </p>

                {/* Summary */}
                <div className="rounded-xl px-4 py-3 mb-4 flex items-center gap-3"
                  style={{ background: 'rgba(255,107,43,0.05)', border: '1px solid rgba(255,107,43,0.1)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FF6B2B" strokeWidth="2">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                  <div>
                    <span className="text-xs text-white/50">Project: </span>
                    <span className="text-xs text-white font-medium">
                      {projectMode === 'new' ? newProjectName : selectedProject?.name}
                    </span>
                    <span className="text-xs text-white/30 ml-3">
                      Method: <span className="text-white/50">{method === 'cli' ? 'Local CLI' : 'GitHub'}</span>
                    </span>
                  </div>
                </div>

                {method === 'github' && (
                  <div className="flex flex-col gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-white/40 uppercase tracking-widest mb-2">
                        Repository URL
                      </label>
                      <input
                        className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none transition-all"
                        style={{ background: '#1c1c1c', border: '1px solid #2a2a2a' }}
                        placeholder="https://github.com/username/repository"
                        value={repoUrl}
                        onChange={e => { setRepoUrl(e.target.value); setConfigError('') }}
                        onFocus={e => { e.target.style.borderColor = 'rgba(255,107,43,0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(255,107,43,0.1)' }}
                        onBlur={e => { e.target.style.borderColor = '#2a2a2a'; e.target.style.boxShadow = '' }}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-white/40 uppercase tracking-widest mb-2">
                        Branch
                      </label>
                      <input
                        className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none transition-all"
                        style={{ background: '#1c1c1c', border: '1px solid #2a2a2a' }}
                        placeholder="main"
                        value={repoBranch}
                        onChange={e => setRepoBranch(e.target.value)}
                        onFocus={e => { e.target.style.borderColor = 'rgba(255,107,43,0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(255,107,43,0.1)' }}
                        onBlur={e => { e.target.style.borderColor = '#2a2a2a'; e.target.style.boxShadow = '' }}
                      />
                    </div>
                  </div>
                )}

                {configError && (
                  <p className="text-red-400 text-xs mt-3">{configError}</p>
                )}
              </SectionCard>

              <button
                onClick={handleStep2}
                disabled={loading}
                className="w-full mt-4 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-lg active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #FF6B2B, #C13A00)', boxShadow: '0 4px 16px rgba(255,107,43,0.25)' }}
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creating scan...
                  </>
                ) : (
                  'Launch Scan'
                )}
              </button>
            </div>
          )}

          {/* ─── STEP 3: Ready ───────────────────────────────────────────────── */}
          {step === 3 && (
            <div className="animate-slide-up">
              <SectionCard>
                {/* Success header */}
                <div className="flex items-center gap-3 mb-5 pb-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-white font-semibold">
                      {method === 'exe' ? 'Project created successfully' : 'Scan created successfully'}
                    </p>
                    <p className="text-white/30 text-xs mt-0.5">
                      Project: <span className="text-white/50">{createdProject?.name}</span>
                    </p>
                  </div>
                </div>

                {method === 'exe' && createdProject && (
                  <div>
                    <p className="text-sm text-white/50 mb-4">Your project is ready. Follow these steps to run your first scan:</p>

                    {/* Project ID */}
                    <div className="mb-1 rounded-xl px-4 py-3" style={{ background: 'rgba(96,165,250,0.05)', border: '1px solid rgba(96,165,250,0.15)' }}>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-1">Your Project ID</p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-xs font-mono" style={{ color: '#60a5fa' }}>{createdProject.id}</code>
                        <button onClick={() => navigator.clipboard.writeText(createdProject.id)}
                          className="flex-shrink-0 text-white/20 hover:text-white/60 transition-colors">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="9" y="9" width="13" height="13" rx="2"/>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                    <p className="text-[11px] text-white/30 mb-4 mt-2 flex items-center gap-1.5">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0">
                        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                      </svg>
                      Run the commands below from the folder where <span className="text-white/50 font-medium mx-0.5">invisithreat.exe</span> is saved. Replace <span className="font-mono text-white/50 mx-0.5">YOUR_PROJECT_ID</span> with the ID above.
                    </p>

                    <StepCmd n={1} label="Login (once — skip if already logged in)">
                      <CodeBlock>{`.\\invisithreat.exe login --server ${getApiBase()} --token YOUR_API_KEY`}</CodeBlock>
                    </StepCmd>

                    <StepCmd n={2} label="Run the scan">
                      <CodeBlock>{`.\\invisithreat.exe scan "path\\to\\your-project" --project-id YOUR_PROJECT_ID`}</CodeBlock>
                    </StepCmd>

                    <div className="mt-3 rounded-xl px-4 py-3"
                      style={{ background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.12)' }}>
                      <p className="text-xs" style={{ color: 'rgba(34,197,94,0.8)' }}>
                        Results will appear on the project page automatically once the scan completes.
                      </p>
                    </div>
                  </div>
                )}

                {method === 'cli' && cliToken && (
                  <div>
                    <p className="text-sm text-white/50 mb-3">
                      Run these commands from your project directory:
                    </p>

                    <StepCmd n={1} label="Download the scanner">
                      <CodeBlock>{`curl "${getApiBase()}/api/scanner/download" -o scan.py`}</CodeBlock>
                    </StepCmd>

                    <StepCmd n={2} label="Install dependency (one time)">
                      <CodeBlock>pip install requests</CodeBlock>
                    </StepCmd>

                    <StepCmd n={3} label="Run the scan">
                      <CodeBlock>{`python scan.py . "--token=${cliToken.upload_token}" --api-url ${getApiBase()}`}</CodeBlock>
                    </StepCmd>

                    <div className="mt-4 rounded-xl px-4 py-3"
                      style={{ background: 'rgba(234,179,8,0.05)', border: '1px solid rgba(234,179,8,0.15)' }}>
                      <p className="text-xs text-yellow-400/80">
                        Token expires in 1 hour. Source code never leaves your machine — only the scan results are uploaded.
                      </p>
                    </div>
                  </div>
                )}

                {method === 'github' && (
                  <div>
                    <p className="text-sm text-white/50 mb-3">
                      Your GitHub repository is being scanned in an isolated environment.
                    </p>
                    <div className="flex flex-col gap-2">
                      <InfoRow label="Repository" value={repoUrl} />
                      <InfoRow label="Branch" value={repoBranch || 'main'} />
                      <InfoRow label="Status" value="Pending" valueColor="#eab308" />
                    </div>
                  </div>
                )}
              </SectionCard>

              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => navigate(`/projects/${createdProject?.id}`)}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-lg active:scale-[0.98]"
                  style={{ background: 'linear-gradient(135deg, #FF6B2B, #C13A00)', boxShadow: '0 4px 16px rgba(255,107,43,0.25)' }}
                >
                  View Project
                </button>
                <button
                  onClick={() => navigate('/dashboard')}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)' }}
                >
                  Back to Dashboard
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </AppLayout>
  )
}

function MethodCard({ active, onClick, title, description, badge, icon, recommended }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-start gap-3 p-5 rounded-2xl text-left transition-all duration-200 w-full relative"
      style={{
        background: active ? 'rgba(255,107,43,0.07)' : '#111111',
        border: active ? '1px solid rgba(255,107,43,0.25)' : '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {recommended && (
        <span className="absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={{ background: 'rgba(255,107,43,0.12)', color: '#FF8C5A', border: '1px solid rgba(255,107,43,0.2)' }}>
          Recommended
        </span>
      )}
      <div className="w-10 h-10 rounded-xl flex items-center justify-center"
        style={{
          background: active ? 'rgba(255,107,43,0.12)' : 'rgba(255,255,255,0.04)',
          color: active ? '#FF6B2B' : 'rgba(255,255,255,0.3)',
          border: active ? '1px solid rgba(255,107,43,0.2)' : '1px solid rgba(255,255,255,0.08)',
        }}>
        {icon}
      </div>
      <div>
        <p className="text-sm font-semibold mb-1" style={{ color: active ? '#ffffff' : 'rgba(255,255,255,0.6)' }}>
          {title}
        </p>
        <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.25)' }}>
          {description}
        </p>
      </div>
    </button>
  )
}

function CodeBlock({ children, className = '' }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(children)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className={`flex items-center justify-between px-4 py-3 rounded-xl group ${className}`}
      style={{ background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.06)' }}>
      <code className="text-xs font-mono text-white/60 truncate">{children}</code>
      <button
        onClick={copy}
        className="ml-3 flex-shrink-0 text-white/20 hover:text-white/60 transition-colors"
      >
        {copied ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        )}
      </button>
    </div>
  )
}

function StepCmd({ n, label, children }) {
  return (
    <div className="mb-3">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
          style={{ background: 'rgba(255,107,43,0.1)', border: '1px solid rgba(255,107,43,0.2)', color: '#FF8C5A' }}>
          {n}
        </span>
        <span className="text-xs text-white/35">{label}</span>
      </div>
      {children}
    </div>
  )
}

function InfoRow({ label, value, valueColor = 'rgba(255,255,255,0.6)' }) {
  return (
    <div className="flex items-center justify-between py-2"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <span className="text-xs text-white/30">{label}</span>
      <span className="text-xs font-medium" style={{ color: valueColor }}>{value}</span>
    </div>
  )
}
