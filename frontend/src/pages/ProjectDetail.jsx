import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import {
  getProject,
  getScans,
  deleteProject,
  createScan,
  getCLIToken,
  triggerSecurityWorkflowAction,
  getVulnerabilityWorkflow,
  updateVulnerabilityTask,
  addVulnerabilityTaskComment,
} from '../services/projectService'
import { useAuth } from '../context/AuthContext'

// ─── Helpers ────────────────────────────────────────────────────────────────

const getApiBase = () => {
  const env = import.meta.env.VITE_API_URL
  if (env && !env.includes('localhost')) return env
  return `${window.location.protocol}//${window.location.hostname}:8000`
}

const toInt = (value) => {
  const n = Number(value)
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0
}

const normalizeFindingText = (value) => String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ')

const normalizeFindingLine = (value) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 0
  return parsed > 0 ? Math.trunc(parsed) : 0
}

const buildFindingFingerprint = (finding) => {
  const key = `${normalizeFindingText(finding?.rule_id || 'rule')}|${normalizeFindingText(finding?.title || 'untitled')}|${normalizeFindingText(finding?.file || finding?.path || '')}|${normalizeFindingLine(finding?.line)}`
  return key.length <= 190 ? key : key.slice(0, 190)
}

const parseScanResults = (resultsJson) => {
  if (!resultsJson || resultsJson.startsWith('__pending_token:')) return null
  try {
    return JSON.parse(resultsJson)
  } catch {
    return null
  }
}

const summarizeScan = (scan) => {
  if (!scan || scan.status !== 'completed') {
    return {
      total: 0,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      scannedAt: null,
    }
  }

  const parsed = parseScanResults(scan.results_json)
  const findings = Array.isArray(parsed?.findings) ? parsed.findings : []
  const summary = parsed?.summary && typeof parsed.summary === 'object' ? parsed.summary : {}

  const fallbackCounts = findings.reduce(
    (acc, finding) => {
      const sev = String(finding?.severity || 'info').toLowerCase()
      if (sev === 'critical') acc.critical += 1
      else if (sev === 'high') acc.high += 1
      else if (sev === 'medium') acc.medium += 1
      else if (sev === 'low') acc.low += 1
      return acc
    },
    { critical: 0, high: 0, medium: 0, low: 0 }
  )

  return {
    total: toInt(summary.total_findings ?? summary.total ?? findings.length),
    critical: toInt(summary.critical ?? fallbackCounts.critical),
    high: toInt(summary.high ?? fallbackCounts.high),
    medium: toInt(summary.medium ?? fallbackCounts.medium),
    low: toInt(summary.low ?? fallbackCounts.low),
    scannedAt: scan.completed_at || scan.started_at || null,
  }
}

// ─── Constants ──────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  completed: { label: 'Completed', bg: 'rgba(34,197,94,0.1)',  border: 'rgba(34,197,94,0.2)',  color: '#22c55e' },
  running:   { label: 'Running',   bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.2)', color: '#60a5fa' },
  pending:   { label: 'Pending',   bg: 'rgba(234,179,8,0.1)',  border: 'rgba(234,179,8,0.2)',  color: '#eab308' },
  failed:    { label: 'Failed',    bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.2)',  color: '#f87171' },
}

const RECOMMENDATIONS = {
  SEC001: "Remove the hardcoded value and use environment variables — `os.getenv('PASSWORD')` in Python, `process.env.PASSWORD` in Node.js. Store secrets in a `.env` file (add it to `.gitignore`) and never commit credentials to version control.",
  SEC002: "Move this value to an environment variable or a secrets manager (AWS Secrets Manager, HashiCorp Vault, Azure Key Vault). Inject secrets through your CI/CD pipeline, never hardcode them.",
  SEC003: "Revoke this AWS key immediately from the IAM console, then rotate it. Switch to IAM roles for EC2/Lambda. Run `git filter-repo` to purge it from Git history.",
  SEC004: "Remove this file from the repository and rotate the key immediately. Run `git filter-repo` to scrub it from history. Add `*.pem`, `*.key`, `id_rsa` to `.gitignore`.",
  SQL001: "Use parameterized queries: Python: `cursor.execute('SELECT * FROM users WHERE id = %s', (user_id,))`. Node.js: `db.query('SELECT * FROM users WHERE id = $1', [userId])`. Never use string formatting to build SQL queries.",
  CFG001: "Set `DEBUG = False` for all production deployments. Use: `DEBUG = os.getenv('DEBUG', 'false').lower() == 'true'`. Leaving DEBUG enabled exposes full stack traces to attackers.",
  CFG002: "Generate a strong secret key: `python -c \"import secrets; print(secrets.token_hex(32))\"`. Store it as an environment variable: `SECRET_KEY = os.getenv('SECRET_KEY')`.",
  PY001:  "Replace `eval()` with `ast.literal_eval()` for safe parsing. For dynamic dispatch, use a function map: `{'action': fn}[input]()`. Never pass user-controlled data to `eval()`.",
  PY002:  "Redesign to avoid `exec()`. Use a function dispatch table or `importlib`. If unavoidable, restrict the namespace: `exec(code, {'__builtins__': {}})` and validate all inputs.",
  PY003:  "Replace pickle with `json` or `msgpack`. Pickle can execute arbitrary code during deserialization. Never deserialize data from external or untrusted sources using pickle.",
  PY004:  "Use `shell=False` with a list of arguments: `subprocess.run(['cmd', 'arg1'], shell=False, check=True)`. This prevents shell injection through user-controlled arguments.",
  PY005:  "Replace with `subprocess.run(['cmd', 'arg'], shell=False, check=True, capture_output=True)`. It is safer, more portable, and avoids shell interpretation.",
  JS001:  "Use `element.textContent = data` for plain text. If HTML is required, sanitize first: `element.innerHTML = DOMPurify.sanitize(data)`. Install via `npm install dompurify`.",
  JS002:  "Sanitize before rendering: `dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content) }}`. Consider using `react-markdown` with `rehype-sanitize` instead.",
  JS003:  "Replace `eval()` with `JSON.parse()` for JSON data, or use a safe dispatch map: `const fns = { add: (a,b) => a+b }; fns[name]?.(args)`. Never pass user input to `eval()`.",
  CRY001: "Replace MD5 with SHA-256: Python: `hashlib.sha256(data).hexdigest()`, Node.js: `crypto.createHash('sha256').update(data).digest('hex')`. For passwords, use bcrypt or argon2id.",
  CRY002: "Replace SHA-1 with SHA-256 or stronger. For password hashing, use bcrypt or argon2id. SHA-1 has been broken since 2017 and must not be used for security purposes.",
  NET001: "Replace `http://` with `https://`. Get a free TLS certificate from Let's Encrypt. Add HSTS headers: `Strict-Transport-Security: max-age=31536000; includeSubDomains`.",
  ENV001: "Add `.env` to `.gitignore` immediately. If already committed, rotate all exposed secrets now — assume they are compromised. Use CI/CD environment variables (GitHub Secrets, GitLab CI Variables) instead.",
}
const METHOD_CONFIG = {
  cli:    { label: 'CLI',    bg: 'rgba(168,85,247,0.1)',  border: 'rgba(168,85,247,0.2)',  color: '#a78bfa' },
  github: { label: 'GitHub', bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' },
}
const SEVERITY_CONFIG = {
  critical: { label: 'Critical', color: '#f87171', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.2)' },
  high:     { label: 'High',     color: '#fb923c', bg: 'rgba(251,146,60,0.08)',  border: 'rgba(251,146,60,0.2)'  },
  medium:   { label: 'Medium',   color: '#eab308', bg: 'rgba(234,179,8,0.08)',   border: 'rgba(234,179,8,0.2)'   },
  low:      { label: 'Low',      color: '#60a5fa', bg: 'rgba(96,165,250,0.08)',  border: 'rgba(96,165,250,0.2)'  },
  info:     { label: 'Info',     color: '#9ca3af', bg: 'rgba(156,163,175,0.06)', border: 'rgba(156,163,175,0.15)' },
}

const TASK_STATUS_CONFIG = {
  open: {
    label: 'Open',
    color: '#f87171',
    bg: 'rgba(248,113,113,0.12)',
    border: 'rgba(248,113,113,0.3)',
  },
  in_progress: {
    label: 'In Progress',
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.12)',
    border: 'rgba(245,158,11,0.3)',
  },
  fixed: {
    label: 'Fixed',
    color: '#60a5fa',
    bg: 'rgba(96,165,250,0.12)',
    border: 'rgba(96,165,250,0.3)',
  },
  verified: {
    label: 'Verified',
    color: '#22c55e',
    bg: 'rgba(34,197,94,0.12)',
    border: 'rgba(34,197,94,0.3)',
  },
}

const DARK_SELECT_STYLE = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.08)',
  colorScheme: 'dark',
}

const DARK_OPTION_STYLE = {
  background: '#141414',
  color: 'rgba(255,255,255,0.9)',
}

// ─── Small Components ────────────────────────────────────────────────────────

function Badge({ config }) {
  if (!config) return null
  return (
    <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: config.bg, border: `1px solid ${config.border}`, color: config.color }}>
      {config.label}
    </span>
  )
}

function PulseDot({ color }) {
  return (
    <span className="relative flex h-2 w-2">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-50"
        style={{ background: color }} />
      <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: color }} />
    </span>
  )
}

// ─── Findings Panel ──────────────────────────────────────────────────────────

function FindingsPanel({ results }) {
  const [filter, setFilter] = useState('all')
  const summary = results.summary || {}
  const findings = results.findings || []

  const filtered = filter === 'all' ? findings : findings.filter(f => f.severity === filter)
  const severities = ['critical', 'high', 'medium', 'low']

  return (
    <div className="mt-4">
      {/* Summary bar */}
      <div className="flex gap-2 flex-wrap mb-4">
        <button
          onClick={() => setFilter('all')}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
          style={{
            background: filter === 'all' ? 'rgba(255,107,43,0.1)' : 'rgba(255,255,255,0.03)',
            border: filter === 'all' ? '1px solid rgba(255,107,43,0.25)' : '1px solid rgba(255,255,255,0.06)',
            color: filter === 'all' ? '#FF8C5A' : 'rgba(255,255,255,0.3)',
          }}
        >
          All ({summary.total_findings ?? summary.total ?? findings.length})
        </button>
        {severities.map(sev => {
          const cnt = summary[sev] ?? findings.filter(f => f.severity === sev).length
          if (cnt === 0) return null
          const cfg = SEVERITY_CONFIG[sev]
          return (
            <button
              key={sev}
              onClick={() => setFilter(sev)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: filter === sev ? cfg.bg : 'rgba(255,255,255,0.03)',
                border: filter === sev ? `1px solid ${cfg.border}` : '1px solid rgba(255,255,255,0.06)',
                color: filter === sev ? cfg.color : 'rgba(255,255,255,0.3)',
              }}
            >
              {cfg.label} ({cnt})
            </button>
          )
        })}
      </div>

      {/* No findings */}
      {filtered.length === 0 && (
        <div className="text-center py-8">
          <p className="text-white/30 text-sm">No findings in this category.</p>
        </div>
      )}

      {/* Finding rows */}
      <div className="flex flex-col gap-2">
        {filtered.map((f, i) => {
          const cfg = SEVERITY_CONFIG[f.severity] || SEVERITY_CONFIG.info
          return (
            <FindingRow key={f.id || i} finding={f} cfg={cfg} />
          )
        })}
      </div>

      {/* Footer stats */}
      {summary.scanned_files && (
        <p className="text-xs text-white/20 mt-4 text-right">
          {summary.scanned_files} files scanned — {summary.tool} v{summary.version}
        </p>
      )}
    </div>
  )
}

function FindingRow({ finding, cfg }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="rounded-xl overflow-hidden transition-all"
      style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid rgba(255,255,255,0.05)` }}>
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-start gap-3 px-4 py-3 text-left"
      >
        <span className="mt-0.5 flex-shrink-0 px-2 py-0.5 rounded text-[10px] font-bold uppercase"
          style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}>
          {finding.severity}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white/80 font-medium">{finding.title}</p>
          <p className="text-xs text-white/30 mt-0.5 truncate">
            {finding.file}{finding.line ? `:${finding.line}` : ''}
          </p>
        </div>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="rgba(255,255,255,0.2)" strokeWidth="2"
          className={`flex-shrink-0 mt-1 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {expanded && (
        <div className="px-4 pb-4 pt-0" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>

          {/* Vulnerability */}
          <p className="text-[11px] font-semibold uppercase tracking-widest text-white/20 mt-3 mb-1">Vulnerability</p>
          <p className="text-xs text-white/45 leading-relaxed">{finding.description}</p>

          {finding.code && (
            <div className="rounded-lg px-3 py-2.5 mt-2.5"
              style={{ background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-xs text-white/20 mb-1 font-semibold uppercase tracking-widest">
                {finding.rule_id} — Line {finding.line}
              </p>
              <code className="text-xs font-mono text-amber-400/70 break-all">{finding.code}</code>
            </div>
          )}

          {/* Recommendation */}
          {(finding.recommendation || RECOMMENDATIONS[finding.rule_id]) && (
            <div className="mt-3 rounded-lg px-3 py-2.5"
              style={{ background: 'rgba(255,107,43,0.05)', border: '1px solid rgba(255,107,43,0.15)' }}>
              <p className="text-[11px] font-semibold uppercase tracking-widest mb-1.5"
                style={{ color: 'rgba(255,107,43,0.6)' }}>Recommendation</p>
              <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
                {finding.recommendation || RECOMMENDATIONS[finding.rule_id]}
              </p>
            </div>
          )}

          <p className="text-[10px] text-white/15 mt-3 uppercase tracking-widest">Category: {finding.category}</p>
        </div>
      )}
    </div>
  )
}

// ─── Current Finding Row (persistent, with recurring badge) ─────────────────

function CurrentFindingRow({
  finding,
  cfg,
  isRecurring,
  recommendation,
  workflowTask,
  assignees,
  canManageTask,
  canAdjustStatus,
  canComment,
  onSaveTask,
  onSendComment,
  currentUserId,
}) {
  const [expanded, setExpanded] = useState(false)
  const [localStatus, setLocalStatus] = useState(workflowTask?.status || 'open')
  const [localAssigneeId, setLocalAssigneeId] = useState(workflowTask?.assignee_id || '')
  const [localDueDate, setLocalDueDate] = useState(workflowTask?.due_date || '')
  const [commentDraft, setCommentDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [commenting, setCommenting] = useState(false)
  const [rowFeedback, setRowFeedback] = useState('')
  const [rowError, setRowError] = useState('')

  useEffect(() => {
    setLocalStatus(workflowTask?.status || 'open')
    setLocalAssigneeId(workflowTask?.assignee_id || '')
    setLocalDueDate(workflowTask?.due_date || '')
  }, [workflowTask?.id, workflowTask?.status, workflowTask?.assignee_id, workflowTask?.due_date])

  const taskStatus = workflowTask?.status || 'open'
  const taskStatusCfg = TASK_STATUS_CONFIG[taskStatus] || TASK_STATUS_CONFIG.open
  const comments = Array.isArray(workflowTask?.comments) ? workflowTask.comments : []
  const hasWorkflowTask = Boolean(workflowTask?.id)
  const statusLabel = hasWorkflowTask ? taskStatusCfg.label : 'Syncing'
  const statusStyle = hasWorkflowTask
    ? { background: taskStatusCfg.bg, border: `1px solid ${taskStatusCfg.border}`, color: taskStatusCfg.color }
    : { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.55)' }
  const statusOptions = canManageTask
    ? Object.entries(TASK_STATUS_CONFIG)
    : Object.entries(TASK_STATUS_CONFIG).filter(([value]) => value !== 'verified')

  const submitTaskChanges = async () => {
    if (!hasWorkflowTask) return

    const payload = {}
    const previousStatus = workflowTask?.status || 'open'
    const previousAssignee = workflowTask?.assignee_id || ''
    const previousDueDate = workflowTask?.due_date || ''

    if (canAdjustStatus && localStatus !== previousStatus) {
      payload.status = localStatus
    }

    if (canManageTask) {
      if (localAssigneeId !== previousAssignee) {
        if (localAssigneeId) payload.assignee_id = localAssigneeId
        else payload.clear_assignee = true
      }
      if (localDueDate !== previousDueDate) {
        if (localDueDate) payload.due_date = localDueDate
        else payload.clear_due_date = true
      }
    }

    if (Object.keys(payload).length === 0) {
      setRowFeedback('No changes to save.')
      setRowError('')
      return
    }

    setSaving(true)
    setRowFeedback('')
    setRowError('')
    try {
      await onSaveTask(workflowTask.id, payload)
      setRowFeedback('Task updated successfully.')
    } catch (err) {
      setRowError(err.response?.data?.detail || 'Failed to update vulnerability task.')
    } finally {
      setSaving(false)
    }
  }

  const submitComment = async () => {
    if (!hasWorkflowTask || !canComment || !commentDraft.trim()) return
    setCommenting(true)
    setRowFeedback('')
    setRowError('')
    try {
      await onSendComment(workflowTask.id, commentDraft.trim())
      setCommentDraft('')
      setRowFeedback('Comment added.')
    } catch (err) {
      setRowError(err.response?.data?.detail || 'Failed to post comment.')
    } finally {
      setCommenting(false)
    }
  }

  return (
    <div className="rounded-xl overflow-hidden transition-all"
      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
      <button onClick={() => setExpanded(v => !v)}
        className="w-full flex items-start gap-3 px-4 py-3 text-left">
        <span className="mt-0.5 flex-shrink-0 px-2 py-0.5 rounded text-[10px] font-bold uppercase"
          style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}>
          {finding.severity}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <p className="text-sm text-white/80 font-medium">{finding.title}</p>
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase"
              style={statusStyle}
            >
              {statusLabel}
            </span>
            {isRecurring && !hasWorkflowTask && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
                Not Fixed
              </span>
            )}
          </div>
          <p className="text-xs text-white/25 truncate">
            {finding.file}{finding.line ? `:${finding.line}` : ''}
          </p>
          {workflowTask?.assignee_name && (
            <p className="text-[11px] text-white/35 mt-0.5">Assigned to {workflowTask.assignee_name}</p>
          )}
          {workflowTask?.due_date && (
            <p className="text-[11px] mt-0.5" style={{ color: workflowTask.is_overdue ? '#f87171' : workflowTask.is_due_soon ? '#f59e0b' : 'rgba(255,255,255,0.35)' }}>
              Due {workflowTask.due_date}{workflowTask.is_overdue ? ' (overdue)' : workflowTask.is_due_soon ? ' (due soon)' : ''}
            </p>
          )}
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="rgba(255,255,255,0.2)" strokeWidth="2"
          className={`flex-shrink-0 mt-1 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-0" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-white/20 mt-3 mb-1">Vulnerability</p>
          <p className="text-xs text-white/45 leading-relaxed">{finding.description}</p>
          {finding.code && (
            <div className="rounded-lg px-3 py-2.5 mt-2.5"
              style={{ background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-xs text-white/20 mb-1 font-semibold uppercase tracking-widest">
                {finding.rule_id} — Line {finding.line}
              </p>
              <code className="text-xs font-mono text-amber-400/70 break-all">{finding.code}</code>
            </div>
          )}
          {recommendation && (
            <div className="mt-3 rounded-lg px-3 py-2.5"
              style={{ background: 'rgba(255,107,43,0.05)', border: '1px solid rgba(255,107,43,0.15)' }}>
              <p className="text-[11px] font-semibold uppercase tracking-widest mb-1.5"
                style={{ color: 'rgba(255,107,43,0.6)' }}>Recommendation</p>
              <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
                {recommendation}
              </p>
            </div>
          )}

          <div className="mt-3 rounded-lg px-3 py-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-white/30 mb-2">Action Tracking</p>
            {hasWorkflowTask ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] text-white/35 mb-1">Status</label>
                    <select
                      value={localStatus}
                      onChange={(e) => setLocalStatus(e.target.value)}
                      disabled={!canAdjustStatus || saving}
                      className="w-full px-2.5 py-2 rounded-lg text-xs text-white focus:outline-none disabled:opacity-60"
                      style={DARK_SELECT_STYLE}
                    >
                      {statusOptions.map(([value, item]) => (
                        <option key={value} value={value} style={DARK_OPTION_STYLE}>{item.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-white/35 mb-1">Assign to</label>
                    <select
                      value={localAssigneeId}
                      onChange={(e) => setLocalAssigneeId(e.target.value)}
                      disabled={!canManageTask || saving}
                      className="w-full px-2.5 py-2 rounded-lg text-xs text-white focus:outline-none disabled:opacity-60"
                      style={DARK_SELECT_STYLE}
                    >
                      <option value="" style={DARK_OPTION_STYLE}>Unassigned</option>
                      {(assignees || []).map((person) => (
                        <option key={person.user_id} value={person.user_id} style={DARK_OPTION_STYLE}>{person.nom}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-white/35 mb-1">Deadline</label>
                    <input
                      type="date"
                      value={localDueDate || ''}
                      onChange={(e) => setLocalDueDate(e.target.value)}
                      disabled={!canManageTask || saving}
                      className="w-full px-2.5 py-2 rounded-lg text-xs text-white focus:outline-none disabled:opacity-60"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
                    />
                  </div>
                </div>

                {(canManageTask || canAdjustStatus) && (
                  <div className="mt-2.5 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={submitTaskChanges}
                      disabled={saving}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-55"
                      style={{ background: 'linear-gradient(135deg, #FF6B2B, #C13A00)' }}
                    >
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <p className="text-xs text-white/35">Workflow task is still syncing from the latest scan.</p>
            )}

            {rowError && <p className="text-xs mt-2" style={{ color: '#f87171' }}>{rowError}</p>}
            {!rowError && rowFeedback && <p className="text-xs text-white/45 mt-2">{rowFeedback}</p>}
          </div>

          <div className="mt-3 rounded-lg px-3 py-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-white/30 mb-2">Discussion</p>
            <div className="max-h-44 overflow-auto pr-1 flex flex-col gap-2">
              {comments.length === 0 ? (
                <p className="text-xs text-white/35">No discussion yet.</p>
              ) : (
                comments.map((comment) => {
                  const isOwnComment = comment.author_id === currentUserId
                  return (
                    <div
                      key={comment.id}
                      className="px-2.5 py-2 rounded-lg"
                      style={{
                        background: isOwnComment ? 'rgba(255,107,43,0.08)' : 'rgba(255,255,255,0.03)',
                        border: isOwnComment ? '1px solid rgba(255,107,43,0.18)' : '1px solid rgba(255,255,255,0.06)',
                      }}
                    >
                      <p className="text-[11px] text-white/55 mb-1">{comment.author_name}</p>
                      <p className="text-xs text-white/75 leading-relaxed">{comment.message}</p>
                    </div>
                  )
                })
              )}
            </div>

            {canComment && hasWorkflowTask && (
              <div className="mt-2.5 flex gap-2">
                <input
                  type="text"
                  value={commentDraft}
                  onChange={(e) => setCommentDraft(e.target.value)}
                  placeholder="Write a message"
                  className="flex-1 px-2.5 py-2 rounded-lg text-xs text-white placeholder:text-white/30 focus:outline-none"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
                />
                <button
                  type="button"
                  onClick={submitComment}
                  disabled={commenting || !commentDraft.trim()}
                  className="px-3 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-55"
                  style={{ background: 'rgba(96,165,250,0.2)', border: '1px solid rgba(96,165,250,0.35)' }}
                >
                  {commenting ? 'Sending...' : 'Send'}
                </button>
              </div>
            )}
          </div>

          <p className="text-[10px] text-white/15 mt-3 uppercase tracking-widest">Category: {finding.category}</p>
        </div>
      )}
    </div>
  )
}

// ─── Scan Row ────────────────────────────────────────────────────────────────

function ScanRow({ scan, onRescan, rescanning }) {
  const [expanded, setExpanded] = useState(false)
  const status = STATUS_CONFIG[scan.status] || STATUS_CONFIG.pending
  const method = METHOD_CONFIG[scan.method] || METHOD_CONFIG.cli
  const isActive = scan.status === 'pending' || scan.status === 'running'

  const results = (() => {
    if (!scan.results_json || scan.results_json.startsWith('__pending_token:')) return null
    try { return JSON.parse(scan.results_json) } catch { return null }
  })()

  const findingCount = results?.findings?.length ?? null
  const summary = results?.summary

  const formatDate = (iso) => {
    if (!iso) return '—'
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
      ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  }
  const duration = () => {
    if (!scan.started_at || !scan.completed_at) return null
    const diff = Math.round((new Date(scan.completed_at) - new Date(scan.started_at)) / 1000)
    return diff < 60 ? `${diff}s` : `${Math.floor(diff / 60)}m ${diff % 60}s`
  }

  return (
    <div style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      {/* Row header */}
      <div
        role={scan.status === 'completed' ? 'button' : undefined}
        tabIndex={scan.status === 'completed' ? 0 : undefined}
        onClick={() => scan.status === 'completed' && setExpanded(v => !v)}
        onKeyDown={e => e.key === 'Enter' && scan.status === 'completed' && setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left transition-colors"
        style={{ cursor: scan.status === 'completed' ? 'pointer' : 'default' }}
        onMouseEnter={e => { if (scan.status === 'completed') e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <div className="flex items-center gap-4 min-w-0">
          {/* Status icon */}
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
            {isActive ? (
              <PulseDot color={status.color} />
            ) : scan.status === 'completed' ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            )}
          </div>

          {/* Badges + date */}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <Badge config={method} />
              <Badge config={status} />
              {summary && (
                <>
                  {summary.critical > 0 && <SevChip label={`${summary.critical} crit`} color="#f87171" />}
                  {summary.high > 0 && <SevChip label={`${summary.high} high`} color="#fb923c" />}
                  {summary.medium > 0 && <SevChip label={`${summary.medium} med`} color="#eab308" />}
                  {summary.low > 0 && <SevChip label={`${summary.low} low`} color="#60a5fa" />}
                  {(summary.total_findings ?? summary.total) === 0 && <SevChip label="No findings" color="#22c55e" />}
                </>
              )}
              {isActive && (
                <span className="text-xs text-white/25 italic">waiting for CLI upload...</span>
              )}
            </div>
            <p className="text-xs text-white/25">{formatDate(scan.created_at)}</p>
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {duration() && <span className="text-xs text-white/25">{duration()}</span>}
          {scan.repo_url && (
            <span className="text-xs text-white/20 truncate max-w-[100px]">{scan.repo_url}</span>
          )}
          {!isActive && onRescan && (
            <button
              onClick={e => { e.stopPropagation(); onRescan(scan) }}
              disabled={rescanning}
              title="Re-run this scan"
              className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-lg transition-all"
              style={{ color: 'rgba(255,107,43,0.5)', background: 'rgba(255,107,43,0.06)', border: '1px solid rgba(255,107,43,0.12)' }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(255,107,43,0.12)'
                e.currentTarget.style.color = 'rgba(255,107,43,0.9)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(255,107,43,0.06)'
                e.currentTarget.style.color = 'rgba(255,107,43,0.5)'
              }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              Re-scan
            </button>
          )}
          {scan.status === 'completed' && (
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="rgba(255,255,255,0.2)" strokeWidth="2"
              className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          )}
        </div>
      </div>

      {/* Expanded results */}
      {expanded && results && (
        <div className="px-5 pb-5" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <FindingsPanel results={results} />
        </div>
      )}
    </div>
  )
}

function SevChip({ label, color }) {
  return (
    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
      style={{ background: `${color}14`, color, border: `1px solid ${color}30` }}>
      {label}
    </span>
  )
}

function RescanCmd({ label, children }) {
  const [copied, setCopied] = useState(false)
  const text = typeof children === 'string' ? children.trim() : children
  const copy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div>
      <p className="text-[10px] text-white/25 mb-1 uppercase tracking-widest">{label}</p>
      <div className="flex items-center justify-between px-3 py-2 rounded-lg"
        style={{ background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.06)' }}>
        <code className="text-xs font-mono text-white/50 truncate flex-1">{text}</code>
        <button onClick={copy} className="ml-3 flex-shrink-0 text-white/20 hover:text-white/60 transition-colors">
          {copied
            ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
            : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          }
        </button>
      </div>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function ProjectDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [project, setProject] = useState(null)
  const [scans, setScans] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [rescanning, setRescanning] = useState(false)
  const [rescanPanel, setRescanPanel] = useState(null) // { method, cliToken? }
  const [workflowNote, setWorkflowNote] = useState('')
  const [workflowSubmitting, setWorkflowSubmitting] = useState(null)
  const [workflowFeedback, setWorkflowFeedback] = useState(null)
  const [vulnerabilityWorkflow, setVulnerabilityWorkflow] = useState({
    scan_id: null,
    tasks: [],
    assignees: [],
  })
  const pollRef = useRef(null)
  const vulnerabilityPollRef = useRef(null)

  const loadScans = useCallback(async () => {
    try {
      const list = await getScans(id)
      setScans(list)
      return list
    } catch { return [] }
  }, [id])

  const loadVulnerabilityWorkflow = useCallback(async () => {
    try {
      const snapshot = await getVulnerabilityWorkflow(id)
      setVulnerabilityWorkflow({
        scan_id: snapshot?.scan_id || null,
        tasks: Array.isArray(snapshot?.tasks) ? snapshot.tasks : [],
        assignees: Array.isArray(snapshot?.assignees) ? snapshot.assignees : [],
      })
      return snapshot
    } catch (err) {
      console.debug('Workflow snapshot error:', err)
      return null
    }
  }, [id])

  // Initial load
  useEffect(() => {
    const init = async () => {
      setLoading(true)
      try {
        const [proj, scanList, workflowSnapshot] = await Promise.all([
          getProject(id),
          getScans(id),
          getVulnerabilityWorkflow(id).catch(() => null),
        ])
        setProject(proj)
        setScans(scanList)
        if (workflowSnapshot) {
          setVulnerabilityWorkflow({
            scan_id: workflowSnapshot?.scan_id || null,
            tasks: Array.isArray(workflowSnapshot?.tasks) ? workflowSnapshot.tasks : [],
            assignees: Array.isArray(workflowSnapshot?.assignees) ? workflowSnapshot.assignees : [],
          })
        }
      } catch (err) {
        setError(err.response?.data?.detail || 'Failed to load project')
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [id])

  // Polling: refresh scans every 5s while any scan is pending/running
  useEffect(() => {
    const hasActive = scans.some(s => s.status === 'pending' || s.status === 'running')
    if (hasActive && !pollRef.current) {
      pollRef.current = setInterval(loadScans, 5000)
    }
    if (!hasActive && pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    }
  }, [scans, loadScans])

  useEffect(() => {
    if (!vulnerabilityPollRef.current) {
      vulnerabilityPollRef.current = setInterval(loadVulnerabilityWorkflow, 8000)
    }
    return () => {
      if (vulnerabilityPollRef.current) {
        clearInterval(vulnerabilityPollRef.current)
        vulnerabilityPollRef.current = null
      }
    }
  }, [loadVulnerabilityWorkflow])

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await deleteProject(id)
      navigate('/dashboard')
    } catch {
      setDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  const handleRescan = async (prevScan) => {
    setRescanning(true)
    setRescanPanel(null)
    try {
      const scan = await createScan(id, {
        method: prevScan.method,
        repo_url: prevScan.repo_url || null,
        repo_branch: prevScan.repo_branch || 'main',
      })
      await loadScans()
      if (prevScan.method === 'cli') {
        const tokenData = await getCLIToken(id, scan.id)
        setRescanPanel({ method: 'cli', cliToken: tokenData })
      } else {
        setRescanPanel({ method: 'github' })
      }
    } catch (e) {
      console.error('Rescan error:', e)
    } finally {
      setRescanning(false)
    }
  }

  const statsData = [
    { label: 'Total Scans',      value: scans.length },
    { label: 'Completed',        value: scans.filter(s => s.status === 'completed').length },
    { label: 'Failed',           value: scans.filter(s => s.status === 'failed').length },
    { label: 'Pending / Running', value: scans.filter(s => ['pending', 'running'].includes(s.status)).length },
  ]

  const hasActive = scans.some(s => s.status === 'pending' || s.status === 'running')
  const isSecurityManagerView = user?.role_name === 'Security Manager'

  const isOwner = project?.user_role === 'owner'
  const canEdit = isOwner || project?.user_role === 'editor'

  const completedScans = scans.filter(s => s.status === 'completed')
  const latestCompletedScan = completedScans[0] || null
  const previousCompletedScan = completedScans[1] || null
  const latestSummary = summarizeScan(latestCompletedScan)
  const previousSummary = summarizeScan(previousCompletedScan)

  const hasTrendBaseline = Boolean(latestCompletedScan && previousCompletedScan)
  const findingsDelta = hasTrendBaseline ? latestSummary.total - previousSummary.total : 0
  const criticalDelta = hasTrendBaseline ? latestSummary.critical - previousSummary.critical : 0

  const trendState = (() => {
    if (!latestCompletedScan) return { label: 'No baseline', color: '#9ca3af', hint: 'No completed scan yet.' }
    if (!hasTrendBaseline) return { label: 'Baseline', color: '#60a5fa', hint: 'Need one more completed scan for trend.' }
    if (findingsDelta < 0 || criticalDelta < 0) {
      return {
        label: 'Improving',
        color: '#22c55e',
        hint: `${Math.abs(findingsDelta)} fewer findings, ${Math.abs(criticalDelta)} fewer critical.`,
      }
    }
    if (findingsDelta > 0 || criticalDelta > 0) {
      return {
        label: 'Worsening',
        color: '#ef4444',
        hint: `${findingsDelta > 0 ? `+${findingsDelta}` : '+0'} findings, ${criticalDelta > 0 ? `+${criticalDelta}` : '+0'} critical.`,
      }
    }
    return { label: 'Stable', color: '#eab308', hint: 'No measurable change since previous scan.' }
  })()

  const priorityState = (() => {
    if (!latestCompletedScan) {
      return {
        label: 'Awaiting Scan',
        color: '#9ca3af',
        hint: 'Request an initial scan from the project team.',
      }
    }
    if (latestSummary.critical > 0) {
      return {
        label: 'Immediate',
        color: '#ef4444',
        hint: `${latestSummary.critical} critical issue${latestSummary.critical !== 1 ? 's' : ''} to triage first.`,
      }
    }
    if (latestSummary.high > 0) {
      return {
        label: 'High',
        color: '#fb923c',
        hint: `${latestSummary.high} high issue${latestSummary.high !== 1 ? 's' : ''} pending mitigation.`,
      }
    }
    if (latestSummary.total > 0) {
      return {
        label: 'Medium',
        color: '#eab308',
        hint: `${latestSummary.total} finding${latestSummary.total !== 1 ? 's' : ''} remain to be tracked.`,
      }
    }
    return {
      label: 'Low',
      color: '#22c55e',
      hint: 'No open findings in latest completed scan.',
    }
  })()

  const canConfirmValidation = Boolean(
    latestCompletedScan && (
      latestSummary.total === 0 ||
      (hasTrendBaseline && findingsDelta < 0 && latestSummary.critical === 0)
    )
  )

  const workflowTaskByFingerprint = (vulnerabilityWorkflow.tasks || []).reduce((acc, task) => {
    if (task?.fingerprint) acc[task.fingerprint] = task
    return acc
  }, {})

  const canManageWorkflowTask = user?.role_name === 'Security Manager' || user?.role_name === 'Admin'

  const handleSecurityWorkflowAction = async (action) => {
    if (!project?.id) return
    setWorkflowSubmitting(action)
    setWorkflowFeedback(null)

    try {
      const payload = {
        action,
        note: workflowNote.trim() || undefined,
      }
      const result = await triggerSecurityWorkflowAction(project.id, payload)
      const notifiedCount = Number(result?.notified_count || 0)
      const baseMessage = result?.message || 'Security workflow action sent.'
      setWorkflowFeedback(`${baseMessage} ${notifiedCount > 0 ? `${notifiedCount} recipient${notifiedCount > 1 ? 's were' : ' was'} notified.` : ''}`.trim())
      if (action !== 'confirm_validation') setWorkflowNote('')
    } catch (err) {
      setWorkflowFeedback(err.response?.data?.detail || 'Failed to send security workflow action.')
    } finally {
      setWorkflowSubmitting(null)
    }
  }

  const saveVulnerabilityTask = async (taskId, payload) => {
    const updated = await updateVulnerabilityTask(id, taskId, payload)
    setVulnerabilityWorkflow((prev) => ({
      ...prev,
      tasks: (prev.tasks || []).map((task) => (task.id === updated.id ? updated : task)),
    }))
    return updated
  }

  const sendVulnerabilityComment = async (taskId, message) => {
    const comment = await addVulnerabilityTaskComment(id, taskId, message)
    setVulnerabilityWorkflow((prev) => ({
      ...prev,
      tasks: (prev.tasks || []).map((task) => {
        if (task.id !== taskId) return task
        return {
          ...task,
          comments: [...(task.comments || []), comment],
        }
      }),
    }))
    return comment
  }

  if (loading) {
    return (
      <AppLayout>
        <main className="flex-1 overflow-auto flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-6 h-6 border-2 border-white/10 border-t-orange-500 rounded-full animate-spin" />
            <p className="text-white/30 text-sm">Loading project...</p>
          </div>
        </main>
      </AppLayout>
    )
  }

  if (error) {
    return (
      <AppLayout>
        <main className="flex-1 overflow-auto flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-400 text-sm mb-4">{error}</p>
            <button onClick={() => navigate('/dashboard')} className="text-white/40 text-sm hover:text-white/70 transition-colors">
              Back to Dashboard
            </button>
          </div>
        </main>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <main className="flex-1 overflow-auto">
        <div className="px-8 py-8">

          {/* Header */}
          <div className="mb-8 animate-slide-up">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 text-white/30 hover:text-white/60 text-sm mb-5 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Back to Dashboard
            </button>

            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(255,107,43,0.1)', border: '1px solid rgba(255,107,43,0.15)' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FF6B2B" strokeWidth="1.7">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <h1 className="text-2xl font-bold text-white truncate">{project.name}</h1>
                  {project.description && (
                    <p className="text-white/30 text-sm mt-0.5 truncate">{project.description}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {isOwner && (
                  <button
                    onClick={() => navigate(`/projects/${project.id}/members`)}
                    className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:bg-white/5 text-white/20 hover:text-white/60"
                    style={{ border: '1px solid rgba(255,255,255,0.06)' }}
                    title="Manage members"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                  </button>
                )}

                {canEdit && (
                  <button
                    onClick={() => navigate('/scans/new')}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-lg active:scale-[0.98]"
                    style={{ background: 'linear-gradient(135deg, #FF6B2B, #C13A00)', boxShadow: '0 4px 14px rgba(255,107,43,0.2)' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    New Scan
                  </button>
                )}

                {isOwner && (
                  <button
                    onClick={() => navigate(`/projects/${project.id}/edit`)}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all hover:bg-white/5 text-white/60 hover:text-white"
                    style={{ border: '1px solid rgba(255,255,255,0.06)' }}
                    title="Edit project"
                  >
                    Edit
                  </button>
                )}

                {isOwner && (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all hover:bg-red-500/10 text-red-400/60 hover:text-red-400"
                    style={{ border: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Re-scan panel */}
          {rescanPanel && (
            <div className="mb-4 rounded-xl overflow-hidden animate-slide-up"
              style={{ background: 'rgba(255,107,43,0.04)', border: '1px solid rgba(255,107,43,0.15)' }}>
              <div className="flex items-center justify-between px-4 py-3"
                style={{ borderBottom: rescanPanel.method === 'cli' ? '1px solid rgba(255,107,43,0.1)' : 'none' }}>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                  <span className="text-xs font-semibold" style={{ color: 'rgba(255,107,43,0.8)' }}>
                    {rescanPanel.method === 'github' ? 'GitHub scan started — results will appear below' : 'New scan created — run these commands to upload results'}
                  </span>
                </div>
                <button onClick={() => setRescanPanel(null)} className="text-white/20 hover:text-white/50 transition-colors">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              {rescanPanel.method === 'cli' && rescanPanel.cliToken && (
                <div className="px-4 pb-4 pt-3 flex flex-col gap-2">
                  <RescanCmd label="1. Download the scanner">
                    {`curl "${getApiBase()}/api/scanner/download" -o scan.py`}
                  </RescanCmd>
                  <RescanCmd label="2. Install dependency (once)">
                    pip install requests
                  </RescanCmd>
                  <RescanCmd label="3. Run the scan">
                    {`python scan.py . "--token=${rescanPanel.cliToken.upload_token}" --api-url ${getApiBase()}`}
                  </RescanCmd>
                </div>
              )}
            </div>
          )}

          {/* Active scan banner */}
          {hasActive && (
            <div className="mb-4 px-4 py-3 rounded-xl flex items-center gap-3 animate-slide-up"
              style={{ background: 'rgba(234,179,8,0.06)', border: '1px solid rgba(234,179,8,0.15)' }}>
              <div className="w-4 h-4 border-2 border-yellow-400/30 border-t-yellow-400 rounded-full animate-spin flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-yellow-400/80">
                  A scan is waiting for results. Run the CLI in your project directory to upload them. Status refreshes automatically every 5s.
                </p>
              </div>
            </div>
          )}

          {/* Stats row */}
          <div className="grid grid-cols-4 gap-3 mb-6 animate-slide-up" style={{ animationDelay: '0.05s' }}>
            {statsData.map(({ label, value }) => (
              <div key={label} className="rounded-2xl px-4 py-4"
                style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.05)' }}>
                <p className="text-2xl font-bold text-white mb-1">{value}</p>
                <p className="text-xs text-white/30">{label}</p>
              </div>
            ))}
          </div>

          {/* Security manager workflow */}
          {isSecurityManagerView && (
            <div className="rounded-2xl px-5 py-5 mb-6 animate-slide-up"
              style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.06)', animationDelay: '0.06s' }}>
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <p className="text-xs font-semibold text-white/35 uppercase tracking-widest">Security Workflow</p>
                  <p className="text-xs text-white/28 mt-1">Review latest scan, prioritize, trigger team actions, and validate risk reduction.</p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/notifications')}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                  style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.25)', color: '#60a5fa' }}
                >
                  Open Notifications
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                <div className="rounded-xl px-3 py-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Latest Scan</p>
                  <p className="text-sm font-semibold text-white">
                    {latestSummary.scannedAt
                      ? new Date(latestSummary.scannedAt).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                      : 'No completed scan'}
                  </p>
                  <p className="text-xs text-white/35 mt-1">Status: {latestCompletedScan?.status || 'n/a'}</p>
                </div>

                <div className="rounded-xl px-3 py-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Findings Volume</p>
                  <p className="text-sm font-semibold text-white">{latestSummary.total} total findings</p>
                  <p className="text-xs text-white/35 mt-1">
                    C:{latestSummary.critical} · H:{latestSummary.high} · M:{latestSummary.medium} · L:{latestSummary.low}
                  </p>
                </div>

                <div className="rounded-xl px-3 py-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Trend</p>
                  <p className="text-sm font-semibold" style={{ color: trendState.color }}>{trendState.label}</p>
                  <p className="text-xs text-white/35 mt-1">{trendState.hint}</p>
                </div>
              </div>

              <div className="rounded-xl px-3 py-3 mb-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Priority</p>
                <p className="text-sm font-semibold" style={{ color: priorityState.color }}>{priorityState.label}</p>
                <p className="text-xs text-white/35 mt-1">{priorityState.hint}</p>
              </div>

              <div className="flex flex-col gap-2 mb-3">
                <label htmlFor="workflow-note" className="text-xs text-white/35">Action note (optional)</label>
                <textarea
                  id="workflow-note"
                  value={workflowNote}
                  onChange={(e) => setWorkflowNote(e.target.value)}
                  placeholder="Ex: Focus critical auth findings first, then rerun scan before tomorrow 17:00."
                  className="w-full px-3 py-2.5 rounded-lg text-sm text-white placeholder:text-white/25 resize-none focus:outline-none"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                  rows={2}
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSecurityWorkflowAction('request_rescan')}
                  disabled={workflowSubmitting !== null}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                  style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.25)', color: '#60a5fa' }}
                >
                  {workflowSubmitting === 'request_rescan' ? 'Sending...' : 'Trigger Re-scan'}
                </button>

                <button
                  type="button"
                  onClick={() => handleSecurityWorkflowAction('confirm_validation')}
                  disabled={workflowSubmitting !== null || !canConfirmValidation}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
                  style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', color: '#4ade80' }}
                  title={canConfirmValidation ? 'Confirm validation closeout' : 'Requires reduced findings and no critical issues'}
                >
                  {workflowSubmitting === 'confirm_validation' ? 'Sending...' : 'Validate Project'}
                </button>
              </div>

              {!canConfirmValidation && latestCompletedScan && (
                <p className="text-xs text-white/30 mt-3">
                  Validation closure unlocks when risk decreases versus previous scan and critical findings are cleared.
                </p>
              )}

              {workflowFeedback && (
                <p className="text-xs mt-3" style={{ color: 'rgba(255,255,255,0.62)' }}>
                  {workflowFeedback}
                </p>
              )}
            </div>
          )}

          {/* Scan History — Top */}
          <div className="rounded-2xl overflow-hidden animate-slide-up mb-6"
            style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.06)', animationDelay: '0.07s' }}>
            <div className="flex items-center justify-between px-5 py-4"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <span className="text-xs font-semibold text-white/40 uppercase tracking-widest">Scan History</span>
              <div className="flex items-center gap-3">
                {hasActive && (
                  <span className="flex items-center gap-1.5 text-xs text-yellow-400/60">
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
                    Live
                  </span>
                )}
                {scans.length > 0 && (
                  <span className="text-xs text-white/20">{scans.length} scan{scans.length !== 1 ? 's' : ''}</span>
                )}
              </div>
            </div>

            {scans.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5">
                    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </div>
                <p className="text-white/40 text-sm font-medium mb-1">No scans yet</p>
                <p className="text-white/20 text-xs mb-5 text-center max-w-xs">
                  Start your first scan to detect vulnerabilities in this project.
                </p>
                {canEdit && (
                <button
                  onClick={() => navigate('/scans/new')}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
                  style={{ background: 'linear-gradient(135deg, #FF6B2B, #C13A00)', boxShadow: '0 4px 14px rgba(255,107,43,0.2)' }}
                >
                  Start Scan
                </button>
                )}
              </div>
            ) : (
              scans.map(scan => (
                <ScanRow key={scan.id} scan={scan} onRescan={canEdit ? handleRescan : null} rescanning={rescanning} />
              ))
            )}
          </div>

          {/* Current Vulnerabilities — always visible, latest completed scan */}
          {(() => {
            const completed = scans.filter(s => s.status === 'completed')
            if (completed.length === 0) return null
            const latest = completed[0]
            const prev = completed[1] || null
            let latestResults = null
            try { latestResults = JSON.parse(latest.results_json) } catch { return null }
            if (!latestResults?.findings?.length) return null

            // Build a set of "rule_id:file:line" from the prev scan to detect recurring findings
            const prevKeys = new Set()
            if (prev?.results_json) {
              try {
                const r = JSON.parse(prev.results_json)
                ;(r.findings || []).forEach(f => prevKeys.add(`${f.rule_id}:${f.file}:${f.line}`))
              } catch {}
            }

            const findings = latestResults.findings
            const summary = latestResults.summary || {}
            const hasNewScanRunning = scans.some(s => s.status === 'pending' || s.status === 'running')
            const scannedAt = latest.completed_at
              ? new Date(latest.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
              : null

            return (
              <div className="rounded-2xl overflow-hidden mb-4 animate-slide-up"
                style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.06)', animationDelay: '0.08s' }}>
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-white/40 uppercase tracking-widest">Current Vulnerabilities</span>
                    {hasNewScanRunning && (
                      <span className="flex items-center gap-1.5 text-[10px] text-yellow-400/50">
                        <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
                        new scan running
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {scannedAt && <span className="text-xs text-white/20">Last scanned {scannedAt}</span>}
                    <div className="flex items-center gap-1.5">
                      {summary.critical > 0 && <SevChip label={`${summary.critical} critical`} color="#f87171" />}
                      {summary.high > 0 && <SevChip label={`${summary.high} high`} color="#fb923c" />}
                      {summary.medium > 0 && <SevChip label={`${summary.medium} medium`} color="#eab308" />}
                      {summary.low > 0 && <SevChip label={`${summary.low} low`} color="#60a5fa" />}
                      {findings.length === 0 && <SevChip label="Clean" color="#22c55e" />}
                    </div>
                  </div>
                </div>

                {/* Findings list */}
                <div className="px-5 py-4">
                  <div className="flex flex-col gap-2">
                    {findings.map((f, i) => {
                      const isRecurring = prev && prevKeys.has(`${f.rule_id}:${f.file}:${f.line}`)
                      const cfg = SEVERITY_CONFIG[f.severity] || SEVERITY_CONFIG.info
                      const rec = f.recommendation || RECOMMENDATIONS[f.rule_id]
                      const fingerprint = buildFindingFingerprint(f)
                      const workflowTask = workflowTaskByFingerprint[fingerprint] || null
                      const canAdjustStatus =
                        canManageWorkflowTask ||
                        project?.user_role === 'owner' ||
                        project?.user_role === 'editor' ||
                        workflowTask?.assignee_id === user?.id
                      const canComment = canAdjustStatus || workflowTask?.assignee_id === user?.id
                      return (
                        <CurrentFindingRow
                          key={f.id || i}
                          finding={f}
                          cfg={cfg}
                          isRecurring={isRecurring && prev !== null}
                          recommendation={rec}
                          workflowTask={workflowTask}
                          assignees={vulnerabilityWorkflow.assignees || []}
                          canManageTask={canManageWorkflowTask}
                          canAdjustStatus={canAdjustStatus}
                          canComment={canComment}
                          onSaveTask={saveVulnerabilityTask}
                          onSendComment={sendVulnerabilityComment}
                          currentUserId={user?.id}
                        />
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          })()}

          {/* Project meta */}
          <div className="mt-4 rounded-2xl px-5 py-4 animate-slide-up"
            style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.05)', animationDelay: '0.15s' }}>
            <p className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-3">Project Details</p>
            <div className="grid grid-cols-2 gap-y-2">
              <MetaRow label="Project ID" value={`${project.id.slice(0, 8)}...`} />
              <MetaRow label="Created"
                value={new Date(project.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} />
            </div>
          </div>
        </div>
      </main>

      {/* Delete modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-sm mx-4 rounded-2xl p-6"
            style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.08)' }}>
            <h3 className="text-white font-semibold mb-2">Delete project?</h3>
            <p className="text-white/40 text-sm mb-5">
              This will permanently delete <span className="text-white font-medium">{project.name}</span> and all
              associated scans. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ background: '#ef4444' }}
              >
                {deleting
                  ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Deleting...</>
                  : 'Delete'}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}

function MetaRow({ label, value }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-white/25 w-24 flex-shrink-0">{label}</span>
      <span className="text-xs text-white/50 font-mono">{value}</span>
    </div>
  )
}
