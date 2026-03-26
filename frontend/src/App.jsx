import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { NotificationProvider } from './context/NotificationContext'
import { can, PERMISSIONS } from './utils/permissions'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import VerifyEmailPage from './pages/VerifyEmailPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import Dashboard from './pages/Dashboard'
import NewScanPage from './pages/NewScanPage'
import ProjectDetail from './pages/ProjectDetail'
import EditProjectPage from './pages/EditProjectPage'
import AdminPage from './pages/AdminPage'
import ProjectMembersPage from './pages/ProjectMembersPage'
import SettingsPage from './pages/SettingsPage'
import NotificationsPage from './pages/NotificationsPage'

const PrivateRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return <div className="flex items-center justify-center min-h-screen" style={{background:'#080808'}}><div className="w-8 h-8 rounded-full animate-spin" style={{border:'2px solid rgba(255,107,43,0.2)', borderTop:'2px solid #FF6B2B'}} /></div>
  return isAuthenticated ? children : <Navigate to="/login" replace />
}

/** Like PrivateRoute but also checks a permission — redirects to /dashboard if denied. */
const PermissionRoute = ({ permission, children }) => {
  const { isAuthenticated, isLoading, user } = useAuth()
  if (isLoading) return <div className="flex items-center justify-center min-h-screen" style={{background:'#080808'}}><div className="w-8 h-8 rounded-full animate-spin" style={{border:'2px solid rgba(255,107,43,0.2)', borderTop:'2px solid #FF6B2B'}} /></div>
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (permission && !can(user?.role_name, permission)) return <Navigate to="/dashboard" replace />
  return children
}

const PublicRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return null
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : children
}

export default function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/signup" element={<PublicRoute><SignupPage /></PublicRoute>} />
          <Route path="/verify-email" element={<PublicRoute><VerifyEmailPage /></PublicRoute>} />
          <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
          <Route path="/dashboard" element={<PermissionRoute permission={PERMISSIONS.VIEW_DASHBOARD}><Dashboard /></PermissionRoute>} />
          <Route path="/scans/new" element={<PermissionRoute permission={PERMISSIONS.RUN_SCAN}><NewScanPage /></PermissionRoute>} />
          <Route path="/projects/:id" element={<PermissionRoute permission={PERMISSIONS.VIEW_SCAN_RESULTS}><ProjectDetail /></PermissionRoute>} />
          <Route path="/projects/:id/edit" element={<PermissionRoute permission={PERMISSIONS.MANAGE_OWN_PROJECTS}><EditProjectPage /></PermissionRoute>} />
          <Route path="/projects/:id/members" element={<PermissionRoute permission={PERMISSIONS.MANAGE_PROJECT_MEMBERS}><ProjectMembersPage /></PermissionRoute>} />
          <Route path="/admin" element={<PermissionRoute permission={PERMISSIONS.MANAGE_USERS}><AdminPage /></PermissionRoute>} />
          <Route path="/settings" element={<PrivateRoute><SettingsPage /></PrivateRoute>} />
          <Route path="/notifications" element={<PrivateRoute><NotificationsPage /></PrivateRoute>} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
        </BrowserRouter>
      </NotificationProvider>
    </AuthProvider>
  )
}
