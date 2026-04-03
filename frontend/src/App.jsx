import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/useAppStore'
import { useThemeStore } from './store/themeStore'
import LoginPage from './pages/LoginPage'
import OverviewPage from './pages/OverviewPage'
import VisitorsPage from './pages/VisitorsPage'
import PortalUsersPage from './pages/PortalUsersPage'
import DevicesPage from './pages/DevicesPage'
import BlockingPage from './pages/BlockingPage'
import AntiEvasionPage from './pages/AntiEvasionPage'
import AuditPage from './pages/AuditPage'
import IntegrationPage from './pages/IntegrationPage'
import SettingsPage from './pages/SettingsPage'

function ThemeBootScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: 'var(--theme-bg)', color: 'var(--theme-text)' }}>
      <div className="rounded-2xl border px-6 py-5 text-center font-mono text-sm" style={{ background: 'var(--theme-surface)', borderColor: 'var(--theme-border-strong)' }}>
        Initializing dashboard theme...
      </div>
    </div>
  )
}

function ProtectedRoute({ children }) {
  const { isAuthenticated, token } = useAuthStore()
  const loading = useThemeStore((state) => state.loading)
  const isBootstrapped = useThemeStore((state) => state.isBootstrapped)
  const loadThemeContext = useThemeStore((state) => state.loadThemeContext)
  const clearThemeState = useThemeStore((state) => state.clearThemeState)

  useEffect(() => {
    if (!isAuthenticated || !token) {
      clearThemeState()
      return
    }
    if (isBootstrapped || loading) return

    ;(async () => {
      const authState = useAuthStore.getState()
      if (!authState.user) {
        try {
          await authState.fetchMe()
        } catch {
          return
        }
      }
      try {
        await loadThemeContext()
      } catch {
        clearThemeState()
      }
    })()
  }, [clearThemeState, isAuthenticated, isBootstrapped, loadThemeContext, loading, token])

  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!isBootstrapped) return <ThemeBootScreen />
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<ProtectedRoute><OverviewPage /></ProtectedRoute>} />
        <Route path="/visitors" element={<ProtectedRoute><VisitorsPage /></ProtectedRoute>} />
        <Route path="/users" element={<ProtectedRoute><PortalUsersPage /></ProtectedRoute>} />
        <Route path="/devices" element={<ProtectedRoute><DevicesPage /></ProtectedRoute>} />
        <Route path="/blocking" element={<ProtectedRoute><BlockingPage /></ProtectedRoute>} />
        <Route path="/anti-evasion" element={<ProtectedRoute><AntiEvasionPage /></ProtectedRoute>} />
        <Route path="/audit" element={<ProtectedRoute><AuditPage /></ProtectedRoute>} />
        <Route path="/integration" element={<ProtectedRoute><IntegrationPage /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
