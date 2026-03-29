import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/useAppStore'
import LoginPage from './pages/LoginPage'
import OverviewPage from './pages/OverviewPage'
import VisitorsPage from './pages/VisitorsPage'
import UsersPage from './pages/UsersPage'
import DevicesPage from './pages/DevicesPage'
import BlockingPage from './pages/BlockingPage'
import AntiEvasionPage from './pages/AntiEvasionPage'
import IntegrationPage from './pages/IntegrationPage'
import SettingsPage from './pages/SettingsPage'

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuthStore()
  return isAuthenticated ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<ProtectedRoute><OverviewPage /></ProtectedRoute>} />
        <Route path="/visitors" element={<ProtectedRoute><VisitorsPage /></ProtectedRoute>} />
        <Route path="/users" element={<ProtectedRoute><UsersPage /></ProtectedRoute>} />
        <Route path="/devices" element={<ProtectedRoute><DevicesPage /></ProtectedRoute>} />
        <Route path="/blocking" element={<ProtectedRoute><BlockingPage /></ProtectedRoute>} />
        <Route path="/anti-evasion" element={<ProtectedRoute><AntiEvasionPage /></ProtectedRoute>} />
        <Route path="/integration" element={<ProtectedRoute><IntegrationPage /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
