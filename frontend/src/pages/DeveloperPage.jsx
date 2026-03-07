import { useEffect, useState, useRef } from 'react'
import AppLayout from '../components/AppLayout'
import { listApiKeys, createApiKey, revokeApiKey } from '../services/apiKeyService'
import { useAuth } from '../context/AuthContext'

// ─── Helper components ────────────────────────────────────────────────────────

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <button onClick={copy}
      className="flex items-center justify-center w-8 h-8 rounded-lg transition-all"
      style={{
        background: copied ? 'rgba(34,197,94,0.1)' : 'rgba(255,107,43,0.1)',
        color:      copied ? '#22c55e' : '#FF6B2B',
        border:     copied ? '1px solid rgba(34,197,94,0.2)' : '1px solid rgba(255,107,43,0.2)',
      }}>
      {copied ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
      )}
    </button>
  )
}

function StepCard({ n, title, children }) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
        style={{ background: 'rgba(255,107,43,0.12)', color: '#FF6B2B', border: '1px solid rgba(255,107,43,0.2)' }}>
        {n}
      </div>
      <div className="min-w-0 flex-1 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <p className="text-sm font-semibold text-white mb-1">{title}</p>
        <div className="text-sm text-white/40">{children}</div>
      </div>
    </div>
  )
}

function CodeBlock({ children }) {
  return (
    <div className="relative mt-2">
      <pre className="text-xs rounded-xl px-4 py-3 overflow-x-auto"
        style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.06)', color: '#FF8C5A', fontFamily: 'monospace' }}>
        {children}
      </pre>
      <div className="absolute top-2 right-2">
        <CopyButton text={children} />
      </div>
    </div>
  )
}

function Note({ children }) {
  return (
    <div className="flex items-start gap-2 mt-3 rounded-lg px-3 py-2.5"
      style={{ background: 'rgba(255,107,43,0.05)', border: '1px solid rgba(255,107,43,0.12)' }}>
      <svg className="flex-shrink-0 mt-px" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#FF6B2B" strokeWidth="2">
        <circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/>
      </svg>
      <p className="text-xs" style={{ color: 'rgba(255,107,43,0.8)' }}>{children}</p>
    </div>
  )
}

function Tip({ children }) {
  return (
    <div className="flex items-start gap-2 mt-3 rounded-lg px-3 py-2.5"
      style={{ background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.12)' }}>
      <svg className="flex-shrink-0 mt-px" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
      <p className="text-xs" style={{ color: 'rgba(34,197,94,0.8)' }}>{children}</p>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DeveloperPage() {
  const { user } = useAuth()
  const [keys,        setKeys]        = useState([])
  const [loading,     setLoading]     = useState(true)
  const [newKeyName,  setNewKeyName]  = useState('')
  const [creating,    setCreating]    = useState(false)
  const [newKeyData,  setNewKeyData]  = useState(null)   // { plaintext, name, key_prefix }
  const [revoking,    setRevoking]    = useState(null)
  const inputRef = useRef(null)

  const load = () => {
    setLoading(true)
    listApiKeys()
      .then(setKeys)
      .catch(() => setKeys([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleGenerate = async () => {
    const name = newKeyName.trim() || 'My Key'
    setCreating(true)
    try {
      const data = await createApiKey(name)
      setNewKeyData(data)
      setNewKeyName('')
      load()
    } finally {
      setCreating(false)
    }
  }

  const handleRevoke = async (id) => {
    if (!confirm('Revoke this API key? Any CLI sessions using it will stop working.')) return
    setRevoking(id)
    try {
      await revokeApiKey(id)
      setKeys(prev => prev.filter(k => k.id !== id))
    } finally {
      setRevoking(null)
    }
  }

  return (
    <AppLayout>
      <main className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto px-8 py-8">

          {/* Header */}
          <div className="mb-8 animate-slide-up">
            <h1 className="text-2xl font-bold text-white">Developer</h1>
            <p className="text-sm text-white/30 mt-1">API keys and CLI scanner tools</p>
          </div>

          {/* ── CLI Scanner section ──────────────────────────────────────── */}
          <section className="mb-6 animate-slide-up" style={{ animationDelay: '0.04s' }}>
            <div className="rounded-2xl overflow-hidden"
              style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.06)' }}>

              {/* Header */}
              <div className="px-6 py-4 flex items-center gap-3"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(255,107,43,0.08)', border: '1px solid rgba(255,107,43,0.12)' }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#FF6B2B" strokeWidth="1.8">
                    <polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">CLI Scanner</p>
                  <p className="text-xs text-white/30">Scan local projects from your terminal</p>
                </div>
                <div className="ml-auto">
                  <span className="text-[10px] font-semibold px-2 py-1 rounded-full"
                    style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.15)' }}>
                    v1.0.0
                  </span>
                </div>
              </div>

              {/* Steps */}
              <div className="px-6 py-5 flex flex-col gap-0">

                {/* ── STEP 1 ── */}
                <StepCard n="1" title="Download invisithreat.exe">
                  <p className="mb-3">No Python, no install, no setup — just download one file and run it.</p>
                  <a
                    href="/downloads/invisithreat.exe"
                    download="invisithreat.exe"
                    className="inline-flex items-center gap-2.5 px-5 py-3 rounded-xl text-sm font-semibold transition-all"
                    style={{ background: 'rgba(255,107,43,0.12)', color: '#FF6B2B', border: '1px solid rgba(255,107,43,0.25)', textDecoration: 'none' }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="7 10 12 15 17 10"/>
                      <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    Download invisithreat.exe
                    <span className="text-[10px] font-normal px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(255,107,43,0.1)', color: 'rgba(255,107,43,0.6)' }}>Windows</span>
                  </a>
                  <p className="mt-3 text-xs text-white/25">Save it anywhere — your Downloads, Desktop, wherever.</p>
                  <Note>The exe is built with PyInstaller — it is fully self-contained and runs on any Windows machine without Python.</Note>
                </StepCard>

                {/* ── STEP 2 ── */}
                <StepCard n="2" title="Create a project on the platform and get its ID">
                  <p className="mb-3">You need to create a project first so you have somewhere to send the scan results. Do this in the browser:</p>
                  <div className="flex flex-col gap-3">
                    <div className="rounded-xl p-3 flex flex-col gap-2.5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div className="flex items-start gap-2.5">
                        <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold" style={{ background: 'rgba(255,107,43,0.15)', color: '#FF6B2B' }}>1</span>
                        <span className="text-xs pt-0.5">Click <span className="font-semibold text-white/70">New Scan</span> in the left sidebar</span>
                      </div>
                      <div className="flex items-start gap-2.5">
                        <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold" style={{ background: 'rgba(255,107,43,0.15)', color: '#FF6B2B' }}>2</span>
                        <span className="text-xs pt-0.5">Enter any project name (e.g. <code className="text-white/50">My App</code>), click <span className="font-semibold text-white/70">Next</span></span>
                      </div>
                      <div className="flex items-start gap-2.5">
                        <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold" style={{ background: 'rgba(255,107,43,0.15)', color: '#FF6B2B' }}>3</span>
                        <span className="text-xs pt-0.5">Select <span className="font-semibold text-white/70">CLI</span> as the scan method, click <span className="font-semibold text-white/70">Next</span></span>
                      </div>
                      <div className="flex items-start gap-2.5">
                        <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold" style={{ background: 'rgba(255,107,43,0.15)', color: '#FF6B2B' }}>4</span>
                        <span className="text-xs pt-0.5">Click <span className="font-semibold text-white/70">Launch Scan</span> — no URL needed, just click it</span>
                      </div>
                      <div className="flex items-start gap-2.5">
                        <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold" style={{ background: 'rgba(34,197,94,0.2)', color: '#22c55e' }}>5</span>
                        <div className="text-xs pt-0.5">
                          <span>You land on the project page. Look at your browser URL bar — it will look like:</span>
                          <div className="mt-1.5 px-3 py-2 rounded-lg font-mono text-[11px] break-all" style={{ background: 'rgba(0,0,0,0.4)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.15)' }}>
                            http://localhost:3000/projects/<span style={{ color: '#FF8C5A', fontWeight: 700 }}>xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx</span>
                          </div>
                          <p className="mt-1.5"><span className="font-semibold text-white/60">Copy the orange part</span> — that is your Project ID. Keep it somewhere handy.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </StepCard>

                {/* ── STEP 3 ── */}
                <StepCard n="3" title="Generate an API key (scroll down on this page)">
                  <p className="mb-2">Scroll down to the <span className="font-semibold text-white/70">API Keys</span> section below. Then:</p>
                  <div className="flex flex-col gap-2 text-xs">
                    <div className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold" style={{ background: 'rgba(255,107,43,0.15)', color: '#FF6B2B' }}>1</span>
                      <span>Type a name like <code className="text-white/50">My Laptop</code> in the text field</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold" style={{ background: 'rgba(255,107,43,0.15)', color: '#FF6B2B' }}>2</span>
                      <span>Click <span className="font-semibold text-white/70">Generate Key</span></span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold" style={{ background: 'rgba(34,197,94,0.2)', color: '#22c55e' }}>3</span>
                      <span>A green box appears with your key starting with <code className="text-white/50">ivt_</code> — <span className="font-semibold text-white/60">copy it immediately</span>, it will never be shown again</span>
                    </div>
                  </div>
                  <Note>If you missed it, just revoke and generate a new one — no problem.</Note>
                </StepCard>

                {/* ── STEP 4 ── */}
                <StepCard n="4" title="Connect the scanner to your account">
                  <p className="mb-2">Open a terminal in the folder where you saved the exe and run:</p>
                  <CodeBlock>{`.\invisithreat.exe login --server http://localhost:8000 --token ivt_YOUR_KEY_HERE`}</CodeBlock>
                  <p className="mt-2">Expected output:</p>
                  <div className="mt-1.5 px-3 py-2 rounded-lg font-mono text-[11px]" style={{ background: 'rgba(0,0,0,0.4)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.1)' }}>
                    ✓ Logged in as <span className="text-white/50">Your Name</span> (your@email.com)
                  </div>
                  <Note>If you get "Connection refused", check that the platform server URL is correct and reachable.</Note>
                </StepCard>

                {/* ── STEP 5 ── */}
                <div className="flex gap-4 pt-1">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{ background: 'rgba(255,107,43,0.12)', color: '#FF6B2B', border: '1px solid rgba(255,107,43,0.2)' }}>
                    5
                  </div>
                  <div className="min-w-0 flex-1 pb-2">
                    <p className="text-sm font-semibold text-white mb-2">Scan your project</p>
                    <div className="text-sm text-white/40 flex flex-col gap-3">
                      <p>Replace the path and project ID with yours:</p>
                      <CodeBlock>{`.\\invisithreat.exe scan "path\\to\\your-project" --project-id YOUR_PROJECT_ID`}</CodeBlock>

                      <div className="rounded-xl p-3 flex flex-col gap-1.5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <p className="text-xs font-semibold text-white/50 mb-0.5">Real example:</p>
                        <CodeBlock>{`.\\invisithreat.exe scan "D:\\MyProjects\\my-app" --project-id abc12345-de67-89fg-hijk-lmnopqrstuvwx`}</CodeBlock>
                      </div>

                      <div>
                        <p className="text-xs font-semibold text-white/50 mb-1.5">The scan will:</p>
                        <div className="flex flex-col gap-1 text-xs">
                          {[
                            'Walk every file in the folder (skipping node_modules, .git, etc.)',
                            'Check for 20 security rules (hardcoded secrets, SQL injection, XSS, etc.)',
                            'Print all findings to the terminal with file + line number',
                            'Upload results to the platform automatically',
                            'Results appear on the project page instantly',
                          ].map((t, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <svg className="flex-shrink-0 mt-0.5" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                              <span>{t}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-3 text-xs pt-1">
                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <code className="text-white/50">--dry-run</code>
                          <span className="text-white/25">→ scan without uploading</span>
                        </div>
                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <code className="text-white/50">--severity high</code>
                          <span className="text-white/25">→ upload critical+high only</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </section>

          {/* ── API Keys section ─────────────────────────────────────────── */}
          <section className="animate-slide-up" style={{ animationDelay: '0.08s' }}>
            <div className="rounded-2xl overflow-hidden"
              style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.06)' }}>

              <div className="px-6 py-4 flex items-center gap-3"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(255,107,43,0.08)', border: '1px solid rgba(255,107,43,0.12)' }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#FF6B2B" strokeWidth="1.8">
                    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3M12 7L7 12" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">API Keys</p>
                  <p className="text-xs text-white/30">Personal tokens for CLI authentication</p>
                </div>
              </div>

              {/* New key shown once */}
              {newKeyData && (
                <div className="mx-6 mt-5 rounded-xl p-4"
                  style={{ background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.15)' }}>
                  <div className="flex items-start gap-3">
                    <svg className="mt-0.5 flex-shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" /><path d="M12 8v4m0 4h.01" />
                    </svg>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-green-400 mb-2">
                        Key "<span className="text-white">{newKeyData.name}</span>" created — copy it now, it will not be shown again
                      </p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-xs px-3 py-2 rounded-lg overflow-x-auto select-all"
                          style={{ background: 'rgba(0,0,0,0.4)', color: '#22c55e', fontFamily: 'monospace', border: '1px solid rgba(34,197,94,0.2)' }}>
                          {newKeyData.plaintext}
                        </code>
                        <CopyButton text={newKeyData.plaintext} />
                      </div>
                    </div>
                  </div>
                  <button onClick={() => setNewKeyData(null)}
                    className="mt-3 text-xs text-white/20 hover:text-white/40 transition-colors">
                    I've copied it, dismiss
                  </button>
                </div>
              )}

              {/* Generate form */}
              <div className="px-6 py-4 flex gap-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <input
                  ref={inputRef}
                  value={newKeyName}
                  onChange={e => setNewKeyName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleGenerate()}
                  placeholder='Key name, e.g. "My Laptop"'
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm text-white placeholder-white/20 outline-none transition-all"
                  style={{
                    background: '#0d0d0d',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                  onFocus={e => e.target.style.borderColor = 'rgba(255,107,43,0.4)'}
                  onBlur={e  => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
                />
                <button
                  onClick={handleGenerate}
                  disabled={creating}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 hover:shadow-lg active:scale-[0.97]"
                  style={{ background: 'linear-gradient(135deg,#FF6B2B,#C13A00)', boxShadow: '0 4px 16px rgba(255,107,43,0.25)' }}>
                  {creating ? (
                    <div className="w-4 h-4 rounded-full animate-spin"
                      style={{ border: '2px solid rgba(255,255,255,0.2)', borderTop: '2px solid white' }} />
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  )}
                  Generate Key
                </button>
              </div>

              {/* Keys list */}
              {loading ? (
                <div className="flex items-center justify-center py-10">
                  <div className="w-5 h-5 rounded-full animate-spin"
                    style={{ border: '2px solid rgba(255,107,43,0.2)', borderTop: '2px solid #FF6B2B' }} />
                </div>
              ) : keys.length === 0 ? (
                <div className="text-center py-10 text-white/20 text-sm">
                  No API keys yet. Generate one above.
                </div>
              ) : (
                <div>
                  {keys.map((k, i) => (
                    <div key={k.id}
                      className="flex items-center gap-4 px-6 py-3.5 transition-colors hover:bg-white/[0.015]"
                      style={{ borderBottom: i < keys.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                      {/* Icon */}
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: 'rgba(255,107,43,0.06)', border: '1px solid rgba(255,107,43,0.1)' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#FF6B2B" strokeWidth="1.8">
                          <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5" />
                        </svg>
                      </div>
                      {/* Name + prefix */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white">{k.name}</p>
                        <p className="text-xs text-white/25 font-mono">{k.key_prefix}••••••••••••••••••••</p>
                      </div>
                      {/* Created */}
                      <div className="text-right hidden sm:block">
                        <p className="text-xs text-white/25">Created</p>
                        <p className="text-xs text-white/40">
                          {new Date(k.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>
                      {/* Last used */}
                      <div className="text-right hidden md:block w-28">
                        <p className="text-xs text-white/25">Last used</p>
                        <p className="text-xs text-white/40">
                          {k.last_used_at
                            ? new Date(k.last_used_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                            : 'Never'}
                        </p>
                      </div>
                      {/* Revoke */}
                      <button
                        onClick={() => handleRevoke(k.id)}
                        disabled={revoking === k.id}
                        className="text-white/15 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-red-500/5 disabled:opacity-50">
                        {revoking === k.id ? (
                          <div className="w-4 h-4 rounded-full animate-spin"
                            style={{ border: '1.5px solid rgba(239,68,68,0.2)', borderTop: '1.5px solid #ef4444' }} />
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                          </svg>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

        </div>
      </main>
    </AppLayout>
  )
}
