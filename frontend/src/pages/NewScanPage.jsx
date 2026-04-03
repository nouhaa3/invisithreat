import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import { getProjects, createProject, createScan, getCLIToken } from '../services/projectService'
import { listApiKeys, createApiKey } from '../services/apiKeyService'
import { getGitHubAppInstallUrl, getGitHubOAuthStart, exchangeGitHubOAuthCode } from '../services/integrationService'
import AnalysisTypeSelector from '../components/AnalysisTypeSelector'
import ProjectTypeSelector from '../components/ProjectTypeSelector'

const ACCENT = '#ff8c5a'
const choiceClasses = (active, { compact = false, grow = false } = {}) => [
  'text-left rounded-xl px-4 py-2.5 flex items-center gap-3 transition-all duration-150',
  'border backdrop-blur-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-0',
  `focus-visible:ring-[${ACCENT}] focus-visible:ring-opacity-60`,
  active
    ? `border-[${ACCENT}] border-opacity-50 bg-[rgba(255,140,90,0.08)]`
    : 'border-white/10 bg-white/5 hover:border-[rgba(255,140,90,0.4)] hover:bg-[rgba(255,140,90,0.06)]',
  compact ? '' : 'w-full',
  grow ? 'flex-1' : '',
].filter(Boolean).join(' ')

const primaryButtonClasses = [
  'w-full py-3 rounded-xl text-sm font-semibold text-white',
  'transition-all active:scale-[0.98] hover:shadow-[0_10px_30px_-12px_rgba(255,140,90,0.7)]',
  'bg-gradient-to-r from-[#FF6B2B] to-[#FF8C5A]'
].join(' ')

const primaryButtonDisabled = 'disabled:opacity-40 disabled:cursor-not-allowed'

const getApiBase = () => {
  const env = import.meta.env.VITE_API_URL
  if (env && !env.includes('localhost')) return env
  return `${window.location.protocol}//${window.location.hostname}:8000`
}

function StepIndicator({ current, steps }) {
  return (
    <div className="flex items-center gap-5 mb-8 overflow-x-auto pb-2">
      {steps.map((label, i) => {
        const isComplete = i < current
        const isActive = i === current
        return (
          <div key={label} className="flex items-center gap-1.5 flex-shrink-0">
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 flex-shrink-0"
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
                  minWidth: '24px',
                  minHeight: '24px',
                }}
              >
                {isComplete ? (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              <span
                className="text-xs font-medium whitespace-nowrap flex-shrink-0"
                style={{ color: isActive ? '#FF8C5A' : isComplete ? '#22c55e' : 'rgba(255,255,255,0.2)' }}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className="h-px flex-shrink-0"
                style={{ width: '20px', background: isComplete ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.06)' }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

function SectionCard({ children, className = '' }) {
  return (
    <div className={`rounded-2xl p-6 ${className}`} style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.06)' }}>
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
  const [newProjectType, setNewProjectType] = useState('')
  const [newProjectAnalysis, setNewProjectAnalysis] = useState('SAST')
  const [newProjectVisibility, setNewProjectVisibility] = useState('private')
  const [projectError, setProjectError] = useState('')
  const [projectTypeError, setProjectTypeError] = useState('')

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
  const [githubToken, setGithubToken] = useState('')
  const [githubAuthCode, setGitHubAuthCode] = useState('')
  const [githubOAuthState, setGitHubOAuthState] = useState('')
  const [githubOAuthLoading, setGitHubOAuthLoading] = useState(false)
  const [githubExchangeLoading, setGitHubExchangeLoading] = useState(false)
  const [githubInfo, setGitHubInfo] = useState('')
  const [configError, setConfigError] = useState('')

  // Step 3 - Created
  const [createdProject, setCreatedProject] = useState(null)
  const [createdScan, setCreatedScan] = useState(null)
  const [cliToken, setCliToken] = useState(null)
  const [loading, setLoading] = useState(false)

  const isNewProject = projectMode === 'new'
  const configLabel = method === 'exe' ? 'Setup' : 'Configure'
  const steps = isNewProject
    ? ['Project', 'Project Type', 'Analysis', 'Method', configLabel]
    : ['Project', 'Method', configLabel]

  useEffect(() => {
    getProjects().then(setProjects).catch(() => setProjects([]))
  }, [])

  useEffect(() => {
    const isConfigureStep = projectMode === 'new' ? step === 4 : step === 2
    if (isConfigureStep && method === 'exe' && !exeKeysLoaded) {
      listApiKeys().then(k => { setExeKeys(k); setExeKeysLoaded(true) }).catch(() => setExeKeysLoaded(true))
    }
  }, [step, method, projectMode, exeKeysLoaded])

  // Listen for GitHub OAuth callback from popup
  useEffect(() => {
    const handleMessage = (event) => {
      // Only accept messages from same origin
      if (event.origin !== window.location.origin) return
      
      if (event.data?.type === 'GITHUB_OAUTH_CODE') {
        const { code, state } = event.data
        setGitHubAuthCode(code)
        setGitHubOAuthState(state)
        try { window.localStorage.setItem('ivt_github_oauth_state', state) } catch {}
        setGitHubInfo('✓ OAuth code received from GitHub. Ready to exchange.')
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

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

  const handleGitHubOAuth = async () => {
    setConfigError('')
    setGitHubInfo('')
    setGitHubOAuthLoading(true)
    
    // Open popup IMMEDIATELY (synchronous from click) to avoid browser blocking
    const popup = window.open('about:blank', '_blank', 'width=500,height=600')
    if (!popup) {
      setConfigError('Popup blocked by browser. Please allow popups and try again.')
      setGitHubOAuthLoading(false)
      return
    }
    
    try {
      const data = await getGitHubOAuthStart()
      if (!data?.authorize_url) {
        popup.close()
        throw new Error('GitHub OAuth start URL not available')
      }
      setGitHubOAuthState(data.state || '')
      if (data.state) {
        try { window.localStorage.setItem('ivt_github_oauth_state', data.state) } catch {}
      }
      // Redirect popup to GitHub OAuth URL
      popup.location.href = data.authorize_url
    } catch (err) {
      popup.close()
      setConfigError(err.response?.data?.detail || err.message || 'Unable to start GitHub OAuth')
    } finally {
      setGitHubOAuthLoading(false)
    }
  }

  const handleGitHubAppInstall = async () => {
    setConfigError('')
    setGitHubInfo('')
    setGitHubOAuthLoading(true)
    
    // Open popup IMMEDIATELY (synchronous from click) to avoid browser blocking
    const popup = window.open('about:blank', '_blank', 'width=500,height=600')
    if (!popup) {
      setConfigError('Popup blocked by browser. Please allow popups and try again.')
      setGitHubOAuthLoading(false)
      return
    }
    
    try {
      const data = await getGitHubAppInstallUrl()
      if (!data?.install_url) {
        popup.close()
        throw new Error('GitHub App install URL not available')
      }
      // Redirect popup to GitHub App install URL
      popup.location.href = data.install_url
    } catch (err) {
      popup.close()
      setConfigError(err.response?.data?.detail || err.message || 'Unable to open GitHub App install page')
    } finally {
      setGitHubOAuthLoading(false)
    }
  }

  const handleGitHubCodeExchange = async () => {
    if (!githubAuthCode.trim()) {
      setConfigError('Paste the GitHub OAuth code first.')
      return
    }

    setConfigError('')
    setGitHubInfo('')
    setGitHubExchangeLoading(true)

    try {
      let codeValue = githubAuthCode.trim()
      let stateValue = githubOAuthState || ''
      try {
        if (codeValue.includes('://') || codeValue.includes('code=')) {
          const callbackUrl = codeValue.includes('://') ? new URL(codeValue) : new URL(`https://dummy.local/?${codeValue.replace(/^\?/, '')}`)
          codeValue = callbackUrl.searchParams.get('code') || codeValue
          stateValue = callbackUrl.searchParams.get('state') || stateValue
        }
      } catch {
        // Keep raw manual code input when it's not a URL/query-string payload.
      }

      if (!stateValue) {
        try { stateValue = window.localStorage.getItem('ivt_github_oauth_state') || '' } catch {}
      }

      if (!stateValue) {
        throw new Error('OAuth state missing. Click "Connect via OAuth" again before exchanging the code.')
      }

      const payload = {
        code: codeValue,
        state: stateValue,
        project_id: projectMode === 'existing' ? selectedProject?.id : undefined,
        repo_url: repoUrl.trim() || undefined,
        repo_branch: repoBranch.trim() || 'main',
      }
      const data = await exchangeGitHubOAuthCode(payload)
      if (!data?.access_token) {
        throw new Error('No access token returned by GitHub exchange')
      }
      setGithubToken(data.access_token)
      setGitHubAuthCode('')
      setGitHubOAuthState('')
      try { window.localStorage.removeItem('ivt_github_oauth_state') } catch {}
      setGitHubInfo('OAuth token received. Private repository scan is now enabled.')
    } catch (err) {
      setConfigError(err.response?.data?.detail || err.message || 'Unable to exchange GitHub OAuth code')
    } finally {
      setGitHubExchangeLoading(false)
    }
  }

  // ─── Step 0: Project info ───────────────────────────────────────────────────
  const handleStep0 = () => {
    if (projectMode === 'new' && !newProjectName.trim()) {
      setProjectError('Project name is required')
      return
    }
    if (projectMode === 'new' && !newProjectDesc.trim()) {
      setProjectError('Description is required')
      return
    }
    if (projectMode === 'existing' && !selectedProject) {
      setProjectError('Please select a project')
      return
    }
    setProjectError('')
    setStep(1)
  }

  // ─── Step 1 (new only): Project type ───────────────────────────────────────
  const handleStepProjectType = () => {
    if (!newProjectType) {
      setProjectTypeError('Project type is required')
      return
    }
    setProjectTypeError('')
    setStep(2)
  }

  // ─── Step 2 (new): Analysis type ───────────────────────────────────────────
  const handleStepAnalysis = () => setStep(3)

  // ─── Method step (index depends on mode) ───────────────────────────────────
  const handleMethodStep = () => {
    if (!method) return
    const nextStep = projectMode === 'new' ? 4 : 2
    setStep(nextStep)
  }

  // ─── Configure / Setup step ────────────────────────────────────────────────
  const handleConfigure = async () => {
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
            description: newProjectDesc.trim(),
            language: null,
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
          repo_token: method === 'github' ? (githubToken.trim() || null) : null,
        })
        setCreatedScan(scan)

        if (method === 'cli') {
          const tokenData = await getCLIToken(project.id, scan.id)
          setCliToken(tokenData)
          return
        }
      }

      navigate(`/projects/${project.id}`)
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
          {projectMode === 'new'
            ? null
            : null}
          {/* Header */}
          <div className="mb-12 animate-slide-up">
            <button
              onClick={() => step > 0 ? setStep(s => s - 1) : navigate('/dashboard')}
              className="inline-flex items-center gap-2 text-white/40 hover:text-white/70 text-xs mb-6 transition-colors px-3 py-1.5 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              <span>{step === 0 || step === (isNewProject ? 5 : 3) ? 'Back to Dashboard' : 'Back'}</span>
            </button>
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-white mb-1">New Scan</h1>
              <p className="text-white/40 text-sm">Analyse your project for security vulnerabilities</p>
            </div>
          </div>

          <div className="mb-8">
            <StepIndicator current={step} steps={steps} />
          </div>

          {/* ─── STEP 0: Project ─────────────────────────────────────────────── */}
          {step === 0 && (
            <div className="animate-slide-up">
              <SectionCard>
                <h2 className="text-base font-semibold text-white mb-6 flex items-center gap-2">
                  <div className="w-1 h-5 rounded" style={{ background: '#FF8C5A' }} />
                  Tell us about your project
                </h2>

                {/* Toggle */}
                <div className="flex gap-3 mb-6 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  {[['new', 'New project'], ['existing', 'Existing project']].map(([val, lbl]) => (
                    <button
                      key={val}
                      onClick={() => { setProjectMode(val); setProjectError(''); setProjectTypeError(''); setStep(0); setMethod(null) }}
                      className="flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-200"
                      style={{
                        background: projectMode === val ? 'rgba(255,107,43,0.12)' : 'rgba(255,255,255,0.03)',
                        border: projectMode === val ? '1px solid rgba(255,107,43,0.35)' : '1px solid rgba(255,255,255,0.07)',
                        color: projectMode === val ? '#FF8C5A' : 'rgba(255,255,255,0.35)'
                      }}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>

                {isNewProject ? (
                  <div className="flex flex-col gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-white/40 uppercase tracking-widest mb-2">Project Name</label>
                      <input
                        className="w-full px-4 py-3 rounded-xl text-sm text-white bg-[#1c1c1c] border border-white/10 transition-all focus:border-orange-400/50 focus:ring-2 focus:ring-orange-400/20 focus:outline-none hover:border-white/20"
                        placeholder="e.g. My API Backend"
                        value={newProjectName}
                        onChange={e => { setNewProjectName(e.target.value); setProjectError('') }}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-white/40 uppercase tracking-widest mb-2">Description</label>
                      <textarea
                        rows={3}
                        className="w-full px-4 py-3 rounded-xl text-sm text-white bg-[#1c1c1c] border border-white/10 transition-all focus:border-orange-400/50 focus:ring-2 focus:ring-orange-400/20 focus:outline-none hover:border-white/20 resize-none"
                        placeholder="Short description of this project"
                        value={newProjectDesc}
                        onChange={e => { setNewProjectDesc(e.target.value); setProjectError('') }}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-white/40 uppercase tracking-widest mb-3">Visibility</label>
                      <div className="flex gap-3">
                        {[['private','Private'],['public','Public']].map(([val, lbl]) => (
                          <button key={val} type="button"
                            onClick={() => setNewProjectVisibility(val)}
                            className="flex-1 py-2.5 rounded-lg text-sm font-medium transition-all"
                            style={{
                              background: newProjectVisibility === val ? 'rgba(255,107,43,0.12)' : 'rgba(255,255,255,0.03)',
                              border: newProjectVisibility === val ? '1px solid rgba(255,107,43,0.35)' : '1px solid rgba(255,255,255,0.07)',
                              color: newProjectVisibility === val ? '#FF8C5A' : 'rgba(255,255,255,0.35)'
                            }}
                          >
                            {lbl}
                          </button>
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
                            className={`${choiceClasses(selectedProject?.id === p.id)} justify-between`}
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
                  <div className="mt-4 px-4 py-3 rounded-xl border flex items-center gap-2" style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    <p className="text-sm text-red-400">{projectError}</p>
                  </div>
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
          {/* ─── STEP 1 (new): Project Type / STEP 1 (existing): Method ─────── */}
          {isNewProject && step === 1 && (
            <div className="animate-slide-up">
              <SectionCard>
                <h2 className="text-base font-semibold text-white mb-6 flex items-center gap-2">
                  <div className="w-1 h-5 rounded" style={{ background: '#FF8C5A' }} />
                  What type of project is this?
                </h2>
                <p className="text-xs text-white/40 mb-4">Choose the category that best describes your project</p>
                <ProjectTypeSelector value={newProjectType} onChange={(val) => { setNewProjectType(val); setProjectTypeError('') }} />
                {projectTypeError && (
                  <div className="mt-4 px-4 py-3 rounded-xl border flex items-center gap-2" style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    <p className="text-sm text-red-400">{projectTypeError}</p>
                  </div>
                )}
              </SectionCard>
              <button
                onClick={handleStepProjectType}
                className="w-full mt-4 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-lg active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg, #FF6B2B, #C13A00)', boxShadow: '0 4px 16px rgba(255,107,43,0.25)' }}
              >
                Continue
              </button>
            </div>
          )}

          {/* ─── STEP 2 (new): Analysis ─────────────────────────────────────── */}
          {isNewProject && step === 2 && (
            <div className="animate-slide-up">
              <SectionCard>
                <h2 className="text-base font-semibold text-white mb-6 flex items-center gap-2">
                  <div className="w-1 h-5 rounded" style={{ background: '#FF8C5A' }} />
                  What would you like to scan?
                </h2>
                <p className="text-xs text-white/40 mb-4">Select the analysis type that matches your security needs</p>
                <AnalysisTypeSelector value={newProjectAnalysis} onChange={setNewProjectAnalysis} />
              </SectionCard>
              <button
                onClick={handleStepAnalysis}
                className="w-full mt-4 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-lg active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg, #FF6B2B, #C13A00)', boxShadow: '0 4px 16px rgba(255,107,43,0.25)' }}
              >
                Continue
              </button>
            </div>
          )}

          {/* ─── METHOD STEP ──────────────────────────────────────────────── */}
          {((isNewProject && step === 3) || (!isNewProject && step === 1)) && (
            <div className="animate-slide-up">
              <div className="mb-8">
                <h2 className="text-base font-semibold text-white mb-6 flex items-center gap-2">
                  <div className="w-1 h-5 rounded" style={{ background: '#FF8C5A' }} />
                  How would you like to scan?
                </h2>
                <p className="text-xs text-white/40 mb-6">Choose a scanning method that works best for your workflow</p>
              </div>
              <div className="grid grid-cols-3 gap-4 mb-4">
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
                onClick={handleMethodStep}
                disabled={!method}
                className="w-full mt-4 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-lg active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                style={!method ? { background: '#2a2a2a' } : { background: 'linear-gradient(135deg, #FF6B2B, #C13A00)', boxShadow: '0 4px 16px rgba(255,107,43,0.25)' }}
              >
                Continue
              </button>
            </div>
          )}

          {/* ─── CONFIGURE / SETUP (EXE) ───────────────────────────────────── */}
          {((isNewProject && step === 4) || (!isNewProject && step === 2)) && method === 'exe' && (
            <div className="animate-slide-up">
              {/* Step 1: Download */}
              <SectionCard className="mb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-white font-bold"
                      style={{ background: 'linear-gradient(135deg, #FF6B2B, #C13A00)' }}>
                      1
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">Download invisithreat.exe</p>
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
              </SectionCard>

              {/* Step 2: API Key card */}
              <SectionCard className="mb-4">
                <div className="flex items-center gap-3 mb-5 pb-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-white font-bold"
                    style={{ background: 'linear-gradient(135deg, #FF6B2B, #C13A00)' }}>
                    2
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Generate your API key</p>
                    <p className="text-xs text-white/30 mt-0.5">
                      The scanner uses this key to authenticate and send scan results back to your project.
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
                  <div className="mt-4 rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <p className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-3">
                      Your existing keys — still valid
                    </p>
                    <div className="space-y-2">
                      {exeKeys.slice(0, 3).map((k, i) => (
                        <div key={k.id} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'rgba(255,107,43,0.05)', border: '1px solid rgba(255,107,43,0.1)' }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#FF6B2B" strokeWidth="1.8">
                            <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5"/>
                          </svg>
                          <span className="text-xs text-white/60 flex-1">{k.name}</span>
                          <code className="text-xs font-mono text-white/25">{k.key_prefix}••••••</code>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {exeKeys.length === 0 && !exeNewKeyData && exeKeysLoaded && (
                  <div className="mt-4 rounded-xl px-4 py-3 text-center"
                    style={{ background: 'rgba(255,107,43,0.04)', border: '1px solid rgba(255,107,43,0.1)' }}>
                    <p className="text-xs" style={{ color: 'rgba(255,107,43,0.7)' }}>
                      You have no API keys yet. Generate one above to continue.
                    </p>
                  </div>
                )}
              </SectionCard>

              {/* Step 3: Instructions */}
              <SectionCard className="mb-4">
                <div className="flex items-center gap-3 mb-5 pb-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-white font-bold"
                    style={{ background: 'linear-gradient(135deg, #FF6B2B, #C13A00)' }}>
                    3
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Run the scanner</p>
                    <p className="text-xs text-white/30 mt-0.5">Execute the command in your terminal</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <StepCmd n={1} label="Open Command Prompt or PowerShell">
                    <p className="text-xs text-white/40 ml-7 mb-2">Navigate to the folder where you downloaded invisithreat.exe</p>
                  </StepCmd>

                  <StepCmd n={2} label="Authenticate once with your API key">
                    <CodeBlock>
                      {`invisithreat.exe login --server ${getApiBase()} --token "${exeNewKeyData?.plaintext || 'YOUR_API_KEY'}"`}
                    </CodeBlock>
                  </StepCmd>

                  <StepCmd n={3} label="Run a scan">
                    <CodeBlock>
                      {`invisithreat.exe scan "C:\\path\\to\\your-project" --project-id ${projectMode === 'existing' ? selectedProject?.id : 'YOUR_PROJECT_UUID'}`}
                    </CodeBlock>
                  </StepCmd>

                  <StepCmd n={4} label="Check results">
                    <p className="text-xs text-white/40 ml-7">Scan results are uploaded automatically and will appear in your project page.</p>
                  </StepCmd>
                </div>

                <div className="mt-5 p-4 rounded-xl"
                  style={{ background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.15)' }}>
                  <div className="flex items-start gap-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" className="mt-0.5 flex-shrink-0">
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
                    </svg>
                    <p className="text-xs text-blue-400 leading-relaxed">
                      You can run the scanner from any location on your PC. The API key is required for authentication.
                    </p>
                  </div>
                </div>
              </SectionCard>

              <button
                onClick={handleConfigure}
                disabled={loading || (exeKeys.length === 0 && !exeNewKeyData)}
                className="w-full mt-4 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-lg active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg, #FF6B2B, #C13A00)', boxShadow: '0 4px 16px rgba(255,107,43,0.25)' }}
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creating project...
                  </>
                ) : (
                  'Finish'
                )}
              </button>
            </div>
          )}

          {/* ─── CONFIGURE (CLI/GitHub) ───────────────────────────────────── */}
          {((isNewProject && step === 4) || (!isNewProject && step === 2)) && method !== 'exe' && (
            <div className="animate-slide-up">
              {method === 'cli' ? (
                <>
                  {/* CLI: Step 1 - Installation */}
                  <SectionCard className="mb-4">
                    <div className="flex items-center gap-3 mb-5 pb-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-white font-bold"
                        style={{ background: 'linear-gradient(135deg, #FF6B2B, #C13A00)' }}>
                        1
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">Prepare local scanner</p>
                        <p className="text-xs text-white/30 mt-0.5">Requires Python 3.8+ installed</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <StepCmd n={1} label="Ensure Python is installed">
                        <CodeBlock>python --version</CodeBlock>
                      </StepCmd>

                      <StepCmd n={2} label="Download official scan script">
                        <CodeBlock>{`curl "${getApiBase()}/api/scanner/download" -o scan.py`}</CodeBlock>
                      </StepCmd>

                      <StepCmd n={3} label="Install runtime dependency (once)">
                        <CodeBlock>pip install requests</CodeBlock>
                      </StepCmd>
                    </div>

                    <div className="mt-5 p-4 rounded-xl"
                      style={{ background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.15)' }}>
                      <p className="text-xs text-green-400 leading-relaxed">
                        CI-native runner available: use <span className="font-mono text-white/80">./.github/actions/invisithreat-scan</span> in GitHub Actions to run scans automatically.
                      </p>
                    </div>
                  </SectionCard>

                  {/* CLI: Step 2 - Token & config */}
                  <SectionCard className="mb-4">
                    <div className="flex items-center gap-3 mb-5 pb-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-white font-bold"
                        style={{ background: 'linear-gradient(135deg, #FF6B2B, #C13A00)' }}>
                        2
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">Project configuration</p>
                        <p className="text-xs text-white/30 mt-0.5">Confirm your project details</p>
                      </div>
                    </div>

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
                      </div>
                    </div>

                    <button
                      onClick={handleConfigure}
                      disabled={loading || !!cliToken}
                      className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-lg active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ background: 'linear-gradient(135deg, #FF6B2B, #C13A00)', boxShadow: '0 4px 16px rgba(255,107,43,0.25)' }}
                    >
                      {loading ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Creating project...
                        </>
                      ) : cliToken ? (
                        'Token generated'
                      ) : (
                        'Generate upload token'
                      )}
                    </button>
                  </SectionCard>

                  {/* CLI: Step 3 - Execution */}
                  {cliToken && (
                    <SectionCard className="mb-4">
                      <div className="flex items-center gap-3 mb-5 pb-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-white font-bold"
                          style={{ background: 'linear-gradient(135deg, #FF6B2B, #C13A00)' }}>
                          3
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">Run the scanner</p>
                          <p className="text-xs text-white/30 mt-0.5">Execute in your project directory</p>
                        </div>
                      </div>

                      <div className="space-y-3 mb-4">
                        <StepCmd n={1} label="Navigate to your project folder">
                          <CodeBlock>cd /path/to/your/project</CodeBlock>
                        </StepCmd>

                        <StepCmd n={2} label="Run the scan with your token">
                          <CodeBlock>
                            {`python scan.py . --token "${cliToken.upload_token}" --api-url "${getApiBase()}"`}
                          </CodeBlock>
                        </StepCmd>

                        <StepCmd n={3} label="Wait for completion">
                          <p className="text-xs text-white/40 ml-7">The scanner will analyze your code and automatically upload results.</p>
                        </StepCmd>
                      </div>

                      <div className="p-4 rounded-xl"
                        style={{ background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.15)' }}>
                        <div className="flex items-start gap-2">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" className="mt-0.5 flex-shrink-0">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                          <p className="text-xs text-green-400 leading-relaxed">
                            Your CLI token expires in {Math.max(1, Math.round((cliToken.expires_in || 3600) / 60))} minutes.
                          </p>
                        </div>
                      </div>
                    </SectionCard>
                  )}
                </>
              ) : (
                <>
                  {/* GitHub: Configuration */}
                  <SectionCard className="mb-4">
                    <div className="flex items-center gap-3 mb-5 pb-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-white font-bold"
                        style={{ background: 'linear-gradient(135deg, #FF6B2B, #C13A00)' }}>
                        1
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">Connect GitHub repository</p>
                        <p className="text-xs text-white/30 mt-0.5">The scan will run in an isolated sandbox environment</p>
                      </div>
                    </div>

                    <h2 className="text-sm font-semibold text-white mb-1">
                      Configure GitHub repository
                    </h2>
                    <p className="text-xs text-white/30 mb-5">
                      Enter the repository URL to connect. The scan will run automatically on the specified branch.
                    </p>
                    <div className="flex flex-col gap-4 mb-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={handleGitHubOAuth}
                          disabled={githubOAuthLoading}
                          className="px-3 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
                          style={{ background: 'rgba(255,107,43,0.12)', color: '#FF8C5A', border: '1px solid rgba(255,107,43,0.25)' }}
                        >
                          Connect via OAuth
                        </button>
                        <button
                          type="button"
                          onClick={handleGitHubAppInstall}
                          disabled={githubOAuthLoading}
                          className="px-3 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
                          style={{ background: 'rgba(96,165,250,0.12)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.25)' }}
                        >
                          Install GitHub App
                        </button>
                      </div>
                      <p className="text-xs text-white/35">
                        OAuth flow opens GitHub in a new tab. After approval, copy the returned access token and paste it below for private repository scans.
                      </p>
                      <div>
                        <label className="block text-xs font-semibold text-white/40 uppercase tracking-widest mb-2">
                          OAuth code exchange (optional)
                        </label>
                        <div className="flex gap-2">
                          <input
                            className="flex-1 px-4 py-3 rounded-xl text-sm text-white outline-none transition-all"
                            style={{ background: '#1c1c1c', border: '1px solid #2a2a2a' }}
                            placeholder="Paste callback URL or only the code"
                            value={githubAuthCode}
                            onChange={e => setGitHubAuthCode(e.target.value)}
                            onFocus={e => { e.target.style.borderColor = 'rgba(255,107,43,0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(255,107,43,0.1)' }}
                            onBlur={e => { e.target.style.borderColor = '#2a2a2a'; e.target.style.boxShadow = '' }}
                          />
                          <button
                            type="button"
                            onClick={handleGitHubCodeExchange}
                            disabled={githubExchangeLoading}
                            className="px-3 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
                            style={{ background: 'rgba(255,107,43,0.12)', color: '#FF8C5A', border: '1px solid rgba(255,107,43,0.25)' }}
                          >
                            {githubExchangeLoading ? 'Exchanging...' : 'Exchange'}
                          </button>
                        </div>
                        <p className="text-xs text-white/30 mt-2">
                          Alternative: use the access token returned by the callback endpoint directly.
                        </p>
                      </div>
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
                      <div>
                        <label className="block text-xs font-semibold text-white/40 uppercase tracking-widest mb-2">
                          GitHub Access Token (optional)
                        </label>
                        <input
                          className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none transition-all"
                          type="password"
                          style={{ background: '#1c1c1c', border: '1px solid #2a2a2a' }}
                          placeholder="Needed for private repos (fine-grained PAT or OAuth token)"
                          value={githubToken}
                          onChange={e => setGithubToken(e.target.value)}
                          onFocus={e => { e.target.style.borderColor = 'rgba(255,107,43,0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(255,107,43,0.1)' }}
                          onBlur={e => { e.target.style.borderColor = '#2a2a2a'; e.target.style.boxShadow = '' }}
                        />
                        <p className="text-xs text-white/30 mt-2">
                          Leave empty for public repositories.
                        </p>
                      </div>
                    </div>

                    {configError && (
                      <div className="mb-4 px-4 py-3 rounded-xl border flex items-center gap-2" style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                        </svg>
                        <p className="text-sm text-red-400">{configError}</p>
                      </div>
                    )}

                    {githubInfo && (
                      <div className="mb-4 px-4 py-3 rounded-xl border flex items-center gap-2" style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        <p className="text-sm text-green-400">{githubInfo}</p>
                      </div>
                    )}

                    <div className="p-4 rounded-xl"
                      style={{ background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.15)' }}>
                      <div className="flex items-start gap-2">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" className="mt-0.5 flex-shrink-0">
                          <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
                        </svg>
                        <p className="text-xs text-blue-400 leading-relaxed">
                          The scan will start automatically once you confirm. Monitor progress in your project dashboard.
                        </p>
                      </div>
                      <p className="text-xs text-white/35 mt-3">
                        For automatic scans on every push, configure a GitHub webhook to:
                        <span className="text-white/70 font-mono"> {getApiBase()}/api/integrations/github/webhook</span>
                      </p>
                    </div>

                    <button
                      onClick={handleConfigure}
                      disabled={loading}
                      className="w-full mt-4 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-lg active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ background: 'linear-gradient(135deg, #FF6B2B, #C13A00)', boxShadow: '0 4px 16px rgba(255,107,43,0.25)' }}
                    >
                      {loading ? 'Starting GitHub scan...' : 'Start GitHub Scan'}
                    </button>
                  </SectionCard>
                </>
              )}
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
