import { useState, useEffect, useCallback } from 'react'
import { Settings, Save, CheckCircle } from 'lucide-react'
import DashboardLayout from '../components/layout/DashboardLayout'
import { Card, CardHeader, Button, Input, Toggle, Select } from '../components/ui/index'
import { settingsApi } from '../services/api'

export default function SettingsPage() {
  const [tab, setTab] = useState('general')
  const [settings, setSettings] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await settingsApi.get()
      setSettings(res.data)
    } catch (_) {}
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const saveGeneral = async () => {
    setSaving(true)
    try {
      await settingsApi.update(settings)
      setSaved('general')
      setTimeout(() => setSaved(''), 2000)
    } catch (_) {}
    finally { setSaving(false) }
  }

  return (
    <DashboardLayout title="Settings">
      {/* Tabs */}
      <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 mb-6 w-fit">
        {[
          { key: 'general', label: 'General' },
          { key: 'data', label: 'Data & Retention' },
          { key: 'webhooks', label: 'Webhooks' },
        ].map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${tab === t.key ? 'bg-cyan-500 text-white' : 'text-gray-400 hover:text-white'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'general' && (
        <div className="space-y-4 max-w-2xl">
          <Card>
            <CardHeader>
              <p className="text-sm font-medium text-white">General Settings</p>
            </CardHeader>
            <div className="space-y-4">
              <Input label="Instance Name" placeholder="My SkyNet Instance" value={settings.instance_name ?? ''} onChange={(e) => setSettings({ ...settings, instance_name: e.target.value })} />
              <Input label="Base URL" placeholder="https://skynet.example.com" value={settings.base_url ?? ''} onChange={(e) => setSettings({ ...settings, base_url: e.target.value })} />
              <Select
                label="Default Timezone"
                value={settings.timezone ?? 'UTC'}
                onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                options={['UTC', 'Europe/Paris', 'Europe/London', 'America/New_York', 'Asia/Tokyo'].map((tz) => ({ value: tz, label: tz }))}
              />
              <div className="divide-y divide-gray-800">
                <Toggle
                  label="Real-time Tracking"
                  description="Enable live visitor tracking via WebSocket"
                  checked={!!settings.realtime_enabled}
                  onChange={(v) => setSettings({ ...settings, realtime_enabled: v })}
                />
                <Toggle
                  label="Auto-block Tor/VPN"
                  description="Automatically block Tor and VPN traffic"
                  checked={!!settings.auto_block_tor_vpn}
                  onChange={(v) => setSettings({ ...settings, auto_block_tor_vpn: v })}
                />
                <Toggle
                  label="Require Login for Tracking"
                  description="Only track authenticated users"
                  checked={!!settings.require_auth}
                  onChange={(v) => setSettings({ ...settings, require_auth: v })}
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end">
              <Button loading={saving} onClick={saveGeneral} icon={saved === 'general' ? CheckCircle : Save}>
                {saved === 'general' ? 'Saved!' : 'Save Settings'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {tab === 'data' && (
        <div className="space-y-4 max-w-2xl">
          <Card>
            <CardHeader>
              <p className="text-sm font-medium text-white">Data Retention</p>
              <p className="text-xs text-gray-500">Control how long data is stored</p>
            </CardHeader>
            <div className="space-y-4">
              {[
                { key: 'visitor_retention_days', label: 'Visitor logs retention', unit: 'days' },
                { key: 'event_retention_days', label: 'Event logs retention', unit: 'days' },
                { key: 'incident_retention_days', label: 'Incident logs retention', unit: 'days' },
              ].map(({ key, label, unit }) => (
                <div key={key}>
                  <div className="flex justify-between mb-1">
                    <label className="text-sm text-gray-300">{label}</label>
                    <span className="text-sm text-cyan-400 font-medium">{settings[key] ?? 90} {unit}</span>
                  </div>
                  <input
                    type="range" min={7} max={365}
                    value={settings[key] ?? 90}
                    onChange={(e) => setSettings({ ...settings, [key]: Number(e.target.value) })}
                    className="w-full accent-cyan-500"
                  />
                </div>
              ))}
              <Toggle
                label="Anonymize IPs after retention"
                description="Replace full IPs with anonymized versions after retention period"
                checked={!!settings.anonymize_ips}
                onChange={(v) => setSettings({ ...settings, anonymize_ips: v })}
              />
            </div>
            <div className="mt-5 flex justify-end">
              <Button loading={saving} onClick={saveGeneral} icon={Save}>Save Retention Settings</Button>
            </div>
          </Card>
        </div>
      )}

      {tab === 'webhooks' && (
        <div className="space-y-4 max-w-2xl">
          <Card>
            <CardHeader>
              <p className="text-sm font-medium text-white">Webhooks</p>
              <p className="text-xs text-gray-500">Receive real-time HTTP callbacks on events</p>
            </CardHeader>
            <div className="space-y-4">
              <Input label="Webhook URL" type="url" placeholder="https://hooks.example.com/skynet" value={settings.webhook_url ?? ''} onChange={(e) => setSettings({ ...settings, webhook_url: e.target.value })} />
              <Input label="Secret" type="password" placeholder="Signing secret" value={settings.webhook_secret ?? ''} onChange={(e) => setSettings({ ...settings, webhook_secret: e.target.value })} />
              <div className="divide-y divide-gray-800">
                {['on_block', 'on_evasion_detected', 'on_new_user', 'on_spam_detected'].map((ev) => (
                  <Toggle
                    key={ev}
                    label={ev.replace('on_', 'On ').replace(/_/g, ' ')}
                    checked={!!(settings.webhook_events ?? {})[ev]}
                    onChange={(v) => setSettings({ ...settings, webhook_events: { ...(settings.webhook_events ?? {}), [ev]: v } })}
                  />
                ))}
              </div>
            </div>
            <div className="mt-5 flex justify-end">
              <Button loading={saving} onClick={saveGeneral} icon={Save}>Save Webhook</Button>
            </div>
          </Card>
        </div>
      )}
    </DashboardLayout>
  )
}
