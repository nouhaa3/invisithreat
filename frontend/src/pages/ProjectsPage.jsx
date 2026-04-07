import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import AppLayout from '../components/AppLayout'
import { getProjects, deleteProject } from '../services/projectService'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ onNew }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: 'rgba(255,107,43,0.08)', border: '1px solid rgba(255,107,43,0.12)' }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FF6B2B" strokeWidth="1.8">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-white mb-1">No projects yet</h3>
      <p className="text-sm text-white/50 mb-6 max-w-xs">
        Launch your first scan to create a project. Projects help you organize and track your security findings.
      </p>
      <button
        onClick={onNew}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-lg active:scale-[0.97]"
        style={{ background: 'linear-gradient(135deg,#FF6B2B,#C13A00)', boxShadow: '0 4px 16px rgba(255,107,43,0.3)' }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Launch New Scan
      </button>
    </div>
  )
}

// ─── Severity pill ────────────────────────────────────────────────────────────

function SevPill({ n, c, label }) {
  return (
    <span className="flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded"
      style={{ background: `${c}15`, color: c, border: `1px solid ${c}30` }}>
      {n} {label}
    </span>
  )
}

// ─── Project row ──────────────────────────────────────────────────────────────

function ProjectRow({ project, deleting, onClick, onDelete }) {
  const userRoleBadge = project.user_role && project.user_role !== 'owner'
  return (
    <div
      onClick={onClick}
      className="group flex items-center justify-between px-5 py-4 rounded-2xl cursor-pointer transition-all"
      style={{ background: 'linear-gradient(170deg, rgba(255,255,255,0.025), rgba(255,255,255,0.008))', border: '1px solid rgba(255,255,255,0.055)' }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(255,107,43,0.15)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'}
    >
      <div className="flex items-center gap-4 min-w-0">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(255,107,43,0.08)', border: '1px solid rgba(255,107,43,0.12)' }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#FF6B2B" strokeWidth="1.8">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-white font-semibold text-sm truncate">{project.name}</p>
            {userRoleBadge && (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0"
                style={{
                  background: project.user_role === 'editor' ? 'rgba(255,107,43,0.1)' : 'rgba(107,114,128,0.1)',
                  color:      project.user_role === 'editor' ? '#FF8C5A' : '#9ca3af',
                }}>
                {project.user_role}
              </span>
            )}
          </div>
          <p className="text-[11px] text-white/40">{project.description || 'No description'}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          {project.critical > 0 && <SevPill n={project.critical} c="#f87171" label="crit" />}
          {project.high     > 0 && <SevPill n={project.high}     c="#fb923c" label="high" />}
          {project.medium   > 0 && <SevPill n={project.medium}   c="#eab308" label="med"  />}
          {project.low      > 0 && <SevPill n={project.low}      c="#60a5fa" label="low"  />}
        </div>
        <button
          onClick={onDelete}
          disabled={deleting}
          className="opacity-0 group-hover:opacity-100 p-1.5 rounded transition-all active:scale-95 disabled:opacity-50"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.12)' }}
          title="Delete project"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <line x1="10" y1="11" x2="10" y2="17" />
            <line x1="14" y1="11" x2="14" y2="17" />
          </svg>
        </button>
      </div>
    </div>
  )
}

// ─── Main Projects Page ───────────────────────────────────────────────────────

export default function ProjectsPage() {
  const { user } = useAuth()
  const navigate  = useNavigate()

  const [projects,   setProjects]   = useState([])
  const [loading,    setLoading]    = useState(true)
  const [deletingId, setDeletingId] = useState(null)

  const load = async () => {
    try {
      const proj = await getProjects()
      setProjects(proj)
    } catch {
      setProjects([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleDelete = async (e, id) => {
    e.stopPropagation()
    if (!confirm('Delete this project?')) return
    setDeletingId(id)
    try {
      await deleteProject(id)
      setProjects(prev => prev.filter(p => p.id !== id))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <>
    <AppLayout>
      <main className="flex-1 overflow-auto">
        <div className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
          {/* Header */}
          <div className="mb-6 animate-slide-up flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight">
                {getGreeting()}, <span style={{ color: '#FF8C5A' }}>{user?.nom?.split(' ')[0]}</span>
              </h1>
              <p className="text-sm text-white/45 mt-2">
                {loading ? 'Loading projects...' : `${projects.length} project${projects.length !== 1 ? 's' : ''} in your workspace`}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => navigate('/scans/new')}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
                style={{ background: 'linear-gradient(135deg,#FF6B2B,#C13A00)' }}
              >
                Launch New Scan
              </button>
            </div>
          </div>

          {/* ── Projects list ──────────────────────────────────────────────── */}
          <div className="animate-slide-up" style={{ animationDelay: '0.04s' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-white/30">All Projects</h2>
              <button
                onClick={() => navigate('/scans/new')}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-lg active:scale-[0.97]"
                style={{ background: 'linear-gradient(135deg,#FF6B2B,#C13A00)', boxShadow: '0 4px 16px rgba(255,107,43,0.3)' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                New Scan
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-6 h-6 rounded-full animate-spin"
                  style={{ border: '2px solid rgba(255,107,43,0.2)', borderTop: '2px solid #FF6B2B' }} />
              </div>
            ) : projects.length === 0 ? (
              <EmptyState onNew={() => navigate('/scans/new')} />
            ) : (
              <div className="flex flex-col gap-3">
                {projects.map(p => (
                  <ProjectRow
                    key={p.id}
                    project={p}
                    deleting={deletingId === p.id}
                    onClick={() => navigate(`/projects/${p.id}`)}
                    onDelete={e => handleDelete(e, p.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </AppLayout>
    </>
  )
}
