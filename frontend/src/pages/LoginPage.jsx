import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Activity, Lock, Mail } from 'lucide-react'
import { useAuthStore } from '../store/useAppStore'
import { Input, Button, Alert } from '../components/ui/index'

export default function LoginPage() {
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login({ username: form.email, password: form.password })
      navigate('/')
    } catch (err) {
      const detail = err.response?.data?.detail
      setError(Array.isArray(detail) ? detail.map((d) => d.msg).join(', ') : (detail || 'Invalid credentials'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="p-2.5 bg-cyan-500/10 rounded-xl border border-cyan-500/20">
            <Activity size={24} className="text-cyan-400" />
          </div>
          <span className="text-2xl font-bold text-white tracking-wide">SkyNet</span>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-7">
          <h2 className="text-lg font-semibold text-white mb-1">Sign in</h2>
          <p className="text-sm text-gray-400 mb-6">Access your dashboard</p>

          {error && (
            <div className="mb-4">
              <Alert type="danger">{error}</Alert>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email"
              type="email"
              placeholder="admin@example.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
            <Button type="submit" className="w-full justify-center" loading={loading}>
              <Lock size={15} />
              Sign in
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-600 mt-6">
          SkyNet Dashboard — Self-Hosted
        </p>
      </div>
    </div>
  )
}
