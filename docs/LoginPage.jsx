import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/useAppStore'
import { Card, Input, Button, Alert } from '../components/ui'
import { LogIn, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const login = useAuthStore((state) => state.login)

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden bg-gray-950">
      {/* Animated Background Overlay */}
      <div className="absolute inset-0 z-0" style={{
        background: 'linear-gradient(45deg, rgba(0,255,255,0.05) 0%, rgba(128,0,128,0.05) 100%)',
        animation: 'pulseGlow 15s ease-in-out infinite alternate'
      }}></div>

      {/* Keyframe animations */}
      <style>{`
        @keyframes pulseGlow {
          0% { opacity: 0.05; transform: scale(1); }
          50% { opacity: 0.15; transform: scale(1.05); }
          100% { opacity: 0.05; transform: scale(1); }
        }
      `}</style>

      <Card className="relative z-10 w-full max-w-md text-center p-8 space-y-6"
            style={{
              background: 'var(--theme-panel-bg)',
              borderColor: 'var(--theme-panel-border)',
              boxShadow: '0 0 40px rgba(0,255,255,0.1), 0 0 80px rgba(128,0,128,0.1)',
            }}>
        <h1 className="text-3xl font-bold text-cyan-400 font-mono tracking-wide">SKYNET</h1>
        <p className="text-gray-400 text-sm font-mono">Access Control Interface</p>

        <form onSubmit={handleLogin} className="space-y-4">
          {error && <Alert type="danger">{error}</Alert>}
          <Input
            label="Email"
            type="email"
            placeholder="admin@skynet.local"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button
            type="submit"
            variant="primary"
            className="w-full py-3 text-lg font-bold tracking-wider"
            loading={loading}
            icon={loading ? Loader2 : LogIn}
          >
            {loading ? 'Authenticating...' : 'Login'}
          </Button>
        </form>
        <p className="text-xs text-gray-500 font-mono">
          <a href="/reset-password" className="text-cyan-500 hover:text-cyan-400 transition-colors">Forgot Password?</a>
        </p>
      </Card>
    </div>
  )
}