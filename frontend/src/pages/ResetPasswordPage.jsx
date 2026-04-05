import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Activity, CheckCircle, Lock } from 'lucide-react'
import { authApi } from '../services/api'
import { Input, Button, Alert } from '../components/ui/index'

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''

  const [form, setForm] = useState({ password: '', confirm: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (form.password !== form.confirm) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      await authApi.resetPassword(token, form.password)
      setDone(true)
    } catch (err) {
      const detail = err.response?.data?.detail
      setError(Array.isArray(detail) ? detail.map((d) => d.msg).join(', ') : (detail || 'Reset failed. The link may have expired.'))
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

          {!token && (
            <div className="text-center">
              <p className="text-sm text-gray-400 mb-4">
                No reset token found. Request a new password reset link from the login page.
              </p>
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="text-xs text-cyan-500 hover:text-cyan-400 transition-colors"
              >
                Back to sign in
              </button>
            </div>
          )}

          {token && !done && (
            <>
              <h2 className="text-lg font-semibold text-white mb-1">Set new password</h2>
              <p className="text-sm text-gray-400 mb-6">
                Choose a strong password. You will be signed out of all active sessions.
              </p>

              {error && <div className="mb-4"><Alert type="danger">{error}</Alert></div>}

              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  label="New password"
                  type="password"
                  placeholder="Min. 8 characters"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                />
                <Input
                  label="Confirm password"
                  type="password"
                  placeholder="Repeat new password"
                  value={form.confirm}
                  onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                  required
                />
                <Button type="submit" className="w-full justify-center" loading={loading}>
                  <Lock size={15} />
                  Set password
                </Button>
              </form>
            </>
          )}

          {done && (
            <div className="flex flex-col items-center text-center gap-3 py-2">
              <div className="p-3 bg-green-500/10 rounded-full border border-green-500/20">
                <CheckCircle size={22} className="text-green-400" />
              </div>
              <h2 className="text-lg font-semibold text-white">Password updated</h2>
              <p className="text-sm text-gray-400">
                Your password has been changed and all sessions have been revoked.
                Please sign in with your new password.
              </p>
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="mt-2 text-xs text-cyan-500 hover:text-cyan-400 transition-colors"
              >
                Go to sign in
              </button>
            </div>
          )}

        </div>

        <p className="text-center text-xs text-gray-600 mt-6">
          SkyNet Dashboard — Self-Hosted
        </p>
      </div>
    </div>
  )
}
