import { useState } from 'react'
import { Save, CheckCircle, Eye, EyeOff, Send } from 'lucide-react'
import { Card, CardHeader, Button, Input, Toggle } from '../../components/ui/index'
import { settingsApi } from '../../services/api'

const MASKED = '••••••••'

export default function SmtpTab({ settings, setSettings }) {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [localPass, setLocalPass] = useState(settings.smtp_password ?? MASKED)
  const [testEmail, setTestEmail] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null) // 'ok' | 'error' | null
  const [testError, setTestError] = useState('')

  const s = settings

  const handleSave = async () => {
    setSaving(true)
    try {
      await settingsApi.updateSmtp({ ...s, smtp_password: localPass })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      await settingsApi.testSmtp({
        host: s.smtp_host,
        port: s.smtp_port ?? 587,
        user: s.smtp_user,
        password: localPass,
        from_name: s.smtp_from_name ?? 'SkyNet',
        from_email: s.smtp_from_email,
        tls: s.smtp_tls ?? true,
        ssl: s.smtp_ssl ?? false,
        to_email: testEmail || s.smtp_from_email,
      })
      setTestResult('ok')
    } catch (e) {
      setTestResult('error')
      setTestError(e.response?.data?.detail ?? 'Connection failed')
    } finally {
      setTesting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <p className="text-sm font-medium text-white">SMTP Configuration</p>
        <p className="text-xs text-gray-500">Outbound email for user creation and password resets</p>
      </CardHeader>

      <div className="space-y-4">
        <Toggle
          label="Enable SMTP"
          description="Send credentials email when a user is created or password is reset"
          checked={!!s.smtp_enabled}
          onChange={(v) => setSettings({ ...s, smtp_enabled: v })}
        />

        {!!s.smtp_enabled && (
          <div className="space-y-3 pt-2 border-t border-gray-800">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Input
                  label="SMTP Host"
                  placeholder="smtp.example.com"
                  value={s.smtp_host ?? ''}
                  onChange={(e) => setSettings({ ...s, smtp_host: e.target.value })}
                />
              </div>
              <Input
                label="Port"
                type="number"
                placeholder="587"
                value={s.smtp_port ?? 587}
                onChange={(e) => setSettings({ ...s, smtp_port: Number(e.target.value) })}
              />
            </div>

            <Input
              label="Username"
              placeholder="user@example.com"
              value={s.smtp_user ?? ''}
              onChange={(e) => setSettings({ ...s, smtp_user: e.target.value })}
            />

            <div className="relative">
              <Input
                label="Password"
                type={showPass ? 'text' : 'password'}
                value={localPass}
                onChange={(e) => setLocalPass(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className="absolute right-3 top-8 text-gray-500 hover:text-gray-300"
              >
                {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="From Name"
                value={s.smtp_from_name ?? 'SkyNet'}
                onChange={(e) => setSettings({ ...s, smtp_from_name: e.target.value })}
              />
              <Input
                label="From Email"
                type="email"
                value={s.smtp_from_email ?? ''}
                onChange={(e) => setSettings({ ...s, smtp_from_email: e.target.value })}
              />
            </div>

            <div className="flex gap-6 divide-x divide-gray-800">
              <Toggle
                label="STARTTLS"
                description="Port 587"
                checked={!!s.smtp_tls}
                onChange={(v) => setSettings({ ...s, smtp_tls: v })}
              />
              <div className="pl-6">
                <Toggle
                  label="SSL / TLS"
                  description="Port 465"
                  checked={!!s.smtp_ssl}
                  onChange={(v) => setSettings({ ...s, smtp_ssl: v })}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {!!s.smtp_enabled && (
        <div className="mt-4 pt-4 border-t border-gray-800 space-y-2">
          <p className="text-xs font-mono text-gray-500 uppercase tracking-wider">
            Test — uses current form values, nothing is saved
          </p>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Input
                label="Send test to"
                type="email"
                placeholder="your@email.com"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
              />
            </div>
            <Button loading={testing} icon={Send} onClick={handleTest}>
              Send Test
            </Button>
          </div>
          {testResult === 'ok' && (
            <p className="text-xs text-green-400">✓ Test email sent successfully</p>
          )}
          {testResult === 'error' && (
            <p className="text-xs text-red-400">✗ {testError}</p>
          )}
        </div>
      )}

      <div className="mt-5 flex justify-end">
        <Button loading={saving} icon={saved ? CheckCircle : Save} onClick={handleSave}>
          {saved ? 'Saved!' : 'Save SMTP'}
        </Button>
      </div>
    </Card>
  )
}
