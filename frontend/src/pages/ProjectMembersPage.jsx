import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import Select from '../components/Select'
import { getProject } from '../services/projectService'
import { getMembers, inviteMember, updateMemberRole, removeMember } from '../services/projectService'

const ROLES = ['Viewer', 'Editor']

function Avatar({ name }) {
  const initial = name ? name[0].toUpperCase() : '?'
  const colors = ['#FF6B2B', '#a78bfa', '#34d399', '#60a5fa', '#f472b6']
  const color = colors[initial.charCodeAt(0) % colors.length]
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
      style={{ background: `${color}20`, border: `1px solid ${color}40`, color }}
    >
      {initial}
    </div>
  )
}

function RoleBadge({ role }) {
  const map = {
    Owner:  '#FFD700',
    Editor: '#FF6B2B',
    Viewer: 'rgba(255,255,255,0.3)',
  }
  const color = map[role] || 'rgba(255,255,255,0.3)'
  return (
    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
      style={{ background: `${color}15`, color, border: `1px solid ${color}40` }}>
      {role}
    </span>
  )
}

export default function ProjectMembersPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [project, setProject] = useState(null)
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)

  // Invite form
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('Viewer')
  const [inviting, setInviting] = useState(false)
  const [feedback, setFeedback] = useState(null) // { type: 'success'|'warning'|'error', msg }

  // Role updating
  const [updatingId, setUpdatingId] = useState(null)
  const [removingId, setRemovingId] = useState(null)

  const load = useCallback(async () => {
    try {
      const [proj, list] = await Promise.all([getProject(id), getMembers(id)])
      setProject(proj)
      setMembers(list)
    } catch {
      setMembers([])
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const clearFeedback = () => setTimeout(() => setFeedback(null), 4000)

  const handleInvite = async (e) => {
    e.preventDefault()
    if (!email.trim()) return
    setInviting(true)
    setFeedback(null)
    try {
      const res = await inviteMember(id, email.trim(), role)
      if (res.status === 'added') {
        setFeedback({ type: 'success', msg: `${res.member.nom} has been added to the project. An email notification was sent.` })
        setEmail('')
        await load()
      } else if (res.status === 'invited') {
        setFeedback({ type: 'warning', msg: res.message })
        setEmail('')
      } else if (res.status === 'already_member') {
        setFeedback({ type: 'warning', msg: 'This user is already a member of the project.' })
      }
    } catch (err) {
      const detail = err.response?.data?.detail || 'Failed to send invitation.'
      setFeedback({ type: 'error', msg: detail })
    } finally {
      setInviting(false)
      clearFeedback()
    }
  }

  const handleRoleChange = async (userId, newRole) => {
    setUpdatingId(userId)
    try {
      await updateMemberRole(id, userId, newRole)
      setMembers(prev => prev.map(m => m.user_id === userId ? { ...m, role_projet: newRole } : m))
    } catch {
      setFeedback({ type: 'error', msg: 'Failed to update role.' })
      clearFeedback()
    } finally {
      setUpdatingId(null)
    }
  }

  const handleRemove = async (userId, nom) => {
    if (!confirm(`Remove ${nom} from the project?`)) return
    setRemovingId(userId)
    try {
      await removeMember(id, userId)
      setMembers(prev => prev.filter(m => m.user_id !== userId))
    } catch {
      setFeedback({ type: 'error', msg: 'Failed to remove member.' })
      clearFeedback()
    } finally {
      setRemovingId(null)
    }
  }

  const feedbackStyles = {
    success: { bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.2)', color: '#22c55e' },
    warning: { bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.2)', color: '#fbbf24' },
    error:   { bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.2)',  color: '#ef4444' },
  }

  if (loading) {
    return (
      <AppLayout>
        <main className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-6 h-6 border-2 border-white/10 border-t-orange-500 rounded-full animate-spin" />
            <p className="text-white/30 text-sm">Loading members...</p>
          </div>
        </main>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <main className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto px-8 py-8">

          {/* Back */}
          <button
            onClick={() => navigate(`/projects/${id}`)}
            className="flex items-center gap-2 text-white/30 hover:text-white/60 text-sm mb-6 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back to {project?.name || 'Project'}
          </button>

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white">Project Members</h1>
            <p className="text-white/30 text-sm mt-1">Manage who has access to <span className="text-white/50">{project?.name}</span></p>
          </div>

          {/* Invite form */}
          <div className="rounded-2xl p-6 mb-6"
            style={{ background: '#111', border: '1px solid rgba(255,255,255,0.06)' }}>
            <h2 className="text-white font-semibold mb-4 text-sm">Invite a member</h2>
            <form onSubmit={handleInvite} className="flex gap-3 flex-wrap">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="colleague@example.com"
                required
                className="flex-1 min-w-[200px] px-4 py-2.5 rounded-xl text-sm text-white placeholder-white/20 outline-none focus:ring-1"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  '--tw-ring-color': '#FF6B2B',
                }}
              />
              <Select
                value={role}
                options={ROLES}
                onChange={setRole}
                size="md"
              />
              <button
                type="submit"
                disabled={inviting || !email.trim()}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.97] disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg,#FF6B2B,#e85d1e)' }}
              >
                {inviting ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Sending...
                  </span>
                ) : 'Invite'}
              </button>
            </form>

            {/* Feedback */}
            {feedback && (() => {
              const s = feedbackStyles[feedback.type]
              return (
                <div className="mt-3 px-4 py-3 rounded-xl text-sm"
                  style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.color }}>
                  {feedback.msg}
                </div>
              )
            })()}
          </div>

          {/* Members list */}
          <div className="rounded-2xl overflow-hidden"
            style={{ background: '#111', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="px-6 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
              <span className="text-white/40 text-xs font-medium uppercase tracking-wide">
                {members.length} member{members.length !== 1 ? 's' : ''}
              </span>
            </div>

            {members.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                <p className="text-white/20 text-sm">No members yet. Invite someone above.</p>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                {members.map(member => {
                  const isOwner = member.role_projet === 'Owner'
                  return (
                    <div key={member.user_id}
                      className="flex items-center gap-4 px-6 py-4 hover:bg-white/[0.02] transition-colors">
                      <Avatar name={member.nom} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-white text-sm font-medium truncate">{member.nom}</span>
                          {isOwner && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                              style={{ background: 'rgba(255,215,0,0.1)', color: '#FFD700', border: '1px solid rgba(255,215,0,0.2)' }}>
                              Owner
                            </span>
                          )}
                        </div>
                        <p className="text-white/30 text-xs truncate">{member.email}</p>
                      </div>

                      <span className="text-white/20 text-xs hidden sm:block flex-shrink-0">
                        {new Date(member.joined_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>

                      {/* Role selector */}
                      {isOwner ? (
                        <RoleBadge role="Owner" />
                      ) : (
                        <Select
                          value={member.role_projet}
                          options={ROLES}
                          loading={updatingId === member.user_id}
                          onChange={v => handleRoleChange(member.user_id, v)}
                          size="sm"
                        />
                      )}

                      {/* Remove button */}
                      {!isOwner && (
                        <button
                          onClick={() => handleRemove(member.user_id, member.nom)}
                          disabled={removingId === member.user_id}
                          className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:bg-red-500/10 text-white/20 hover:text-red-400 disabled:opacity-30 flex-shrink-0"
                          style={{ border: '1px solid rgba(255,255,255,0.06)' }}
                          title={`Remove ${member.nom}`}
                        >
                          {removingId === member.user_id ? (
                            <span className="w-3 h-3 border border-red-400/50 border-t-red-400 rounded-full animate-spin" />
                          ) : (
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                              <path d="M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                            </svg>
                          )}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

        </div>
      </main>
    </AppLayout>
  )
}
