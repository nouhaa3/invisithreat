import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import AppLayout from '../components/AppLayout'
import { getProjects, deleteProject } from '../services/projectService'

const STATUS_CONFIG = {
  completed: { label: 'Completed', color: '#22c55e', bg: 'rgba(34,197,94,0.08)' },
  running:   { label: 'Running',   color: '#FF6B2B', bg: 'rgba(255,107,43,0.08)' },
  pending:   { label: 'Pending',   color: '#eab308', bg: 'rgba(234,179,8,0.08)'  },
  failed:    { label: 'Failed',    color: '#ef4444', bg: 'rgba(239,68,68,0.08)'  },
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { label: status || 'No scans', color: '#6b7280', bg: 'rgba(107,114,128,0.08)' }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
      style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}30` }}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: cfg.color }} />
      {cfg.label}
    </span>
  )
}

function StatCard({ label, value, sub }) {
  return (
    <div className="rounded-2xl p-5"
      style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.06)' }}>
      <p className="text-xs text-white/30 font-semibold uppercase tracking-widest mb-3">{label}</p>
      <p className="text-3xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-white/25 mt-1">{sub}</p>}
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState(null)

  const load = async () => {
    try {
      const data = await getProjects()
      setProjects(data)
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

  const totalScans = projects.reduce((s, p) => s + p.scan_count, 0)
  const activeProjects = projects.filter(p => p.last_scan_status === 'running').length

  return (
    <AppLayout>
      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto px-8 py-8">

          {/* Page header */}
          <div className="mb-8 animate-slide-up">
            <h1 className="text-2xl font-bold text-white">
              Good {getGreeting()},{' '}
              <span style={{ color: '#FF6B2B' }}>{user?.nom?.split(' ')[0]}</span>
            </h1>
            <p className="text-sm text-white/30 mt-1">
              {projects.length} project{projects.length !== 1 ? 's' : ''} in your workspace
            </p>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4 mb-8 animate-slide-up" style={{ animationDelay: '0.05s' }}>
            <StatCard label="Total Projects" value={projects.length} sub="in your workspace" />
            <StatCard label="Total Scans" value={totalScans} sub="across all projects" />
            <StatCard label="Active Scans" value={activeProjects} sub="currently running" />
          </div>

          {/* Projects section */}
          <div className="animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-white/50 uppercase tracking-widest">Projects</h2>
              <button
                onClick={() => navigate('/scans/new')}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all duration-200 hover:shadow-lg active:scale-[0.97]"
                style={{
                  background: 'linear-gradient(135deg, #FF6B2B 0%, #E84D0E 60%, #C13A00 100%)',
                  boxShadow: '0 4px 16px rgba(255,107,43,0.3)',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                New Scan
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-6 h-6 rounded-full animate-spin"
                  style={{ border: '2px solid rgba(255,107,43,0.2)', borderTop: '2px solid #FF6B2B' }} />
              </div>
            ) : projects.length === 0 ? (
              <EmptyState onNew={() => navigate('/scans/new')} />
            ) : (
              <div className="grid gap-3">
                {projects.map((project) => (
                  <ProjectRow
                    key={project.id}
                    project={project}
                    deleting={deletingId === project.id}
                    onClick={() => navigate(`/projects/${project.id}`)}
                    onDelete={(e) => handleDelete(e, project.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </AppLayout>
  )
}

function ProjectRow({ project, deleting, onClick, onDelete }) {
  return (
    <div
      onClick={onClick}
      className="group flex items-center justify-between px-6 py-4 rounded-2xl cursor-pointer transition-all duration-200 hover:border-white/10"
      style={{
        background: '#111111',
        border: '1px solid rgba(255,255,255,0.05)',
      }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(255,107,43,0.15)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'}
    >
      <div className="flex items-center gap-4 min-w-0">
        {/* Icon */}
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(255,107,43,0.08)', border: '1px solid rgba(255,107,43,0.12)' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF6B2B" strokeWidth="1.8">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        {/* Info */}
        <div className="min-w-0">
          <p className="text-white font-semibold text-sm truncate">{project.name}</p>
          <p className="text-white/30 text-xs mt-0.5 truncate">
            {project.description || 'No description'} — {project.scan_count} scan{project.scan_count !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4 flex-shrink-0 ml-4">
        <StatusBadge status={project.last_scan_status} />
        <span className="text-white/20 text-xs hidden md:block">
          {new Date(project.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
        <button
          onClick={onDelete}
          disabled={deleting}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-white/20 hover:text-red-400 p-1 rounded disabled:opacity-30"
          title="Delete project"
        >
          {deleting ? (
            <div className="w-3.5 h-3.5 rounded-full animate-spin"
              style={{ border: '1.5px solid rgba(255,255,255,0.2)', borderTop: '1.5px solid #ef4444' }} />
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
          )}
        </button>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
          className="text-white/15 group-hover:text-white/30 transition-colors">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>
    </div>
  )
}

function EmptyState({ onNew }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 rounded-2xl"
      style={{ border: '1px dashed rgba(255,255,255,0.08)' }}>
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: 'rgba(255,107,43,0.06)', border: '1px solid rgba(255,107,43,0.1)' }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FF6B2B" strokeWidth="1.5">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          <path d="M12 11v6M9 14h6" />
        </svg>
      </div>
      <p className="text-white font-semibold mb-1">No projects yet</p>
      <p className="text-white/30 text-sm mb-6">Create your first project to start scanning for vulnerabilities</p>
      <button onClick={onNew}
        className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-lg active:scale-[0.97]"
        style={{ background: 'linear-gradient(135deg, #FF6B2B, #C13A00)', boxShadow: '0 4px 16px rgba(255,107,43,0.25)' }}>
        Create first project
      </button>
    </div>
  )
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 18) return 'afternoon'
  return 'evening'
}
