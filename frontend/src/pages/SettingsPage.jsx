import { useState, useEffect, useCallback } from 'react'
import { Save, CheckCircle, ShieldOff } from 'lucide-react'
import DashboardLayout from '../components/layout/DashboardLayout'
import { Card, CardHeader, Button, Input, Toggle, Select } from '../components/ui/index'
import { settingsApi } from '../services/api'

const DEFAULT_BLOCK = {
  title: 'ACCESS RESTRICTED', subtitle: 'Your access to this site has been blocked.',
  message: 'This action was taken automatically for security reasons.',
  bg_color: '#050505', accent_color: '#ef4444',
  logo_url: '', contact_email: '', show_request_id: true, show_contact: true,
}

export default function SettingsPage() {
  const [tab, setTab] = useState('general')
  const [settings, setSettings] = useState({})
  const [blockPage, setBlockPage] = useState(DEFAULT_BLOCK)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [sRes, bRes] = await Promise.all([settingsApi.get(), settingsApi.getBlockPage()])
      setSettings(sRes.data)
      setBlockPage({ ...DEFAULT_BLOCK, ...bRes.data })
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

  const saveBlockPage = async () => {
    setSaving(true)
    try {
      await settingsApi.updateBlockPage(blockPage)
      setSaved('block')
      setTimeout(() => setSaved(''), 2000)
    } catch (_) {}
    finally { setSaving(false) }
  }

  const bp = blockPage

  return (
    <DashboardLayout title="Settings">
      {/* Tabs */}
      <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 mb-6 w-fit">
        {[
          { key: 'general',    label: 'General' },
          { key: 'data',       label: 'Data & Retention' },
          { key: 'webhooks',   label: 'Webhooks' },
          { key: 'block-page', label: 'Block Page' },
        ].map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`px-4 py-1.5 rounded-lg text-xs font-mono font-medium tracking-wide transition ${tab === t.key ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40' : 'text-gray-500 hover:text-gray-300'}`}>
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

      {tab === 'block-page' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* Config form */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <p className="text-xs font-mono font-medium text-cyan-400 uppercase tracking-widest">Block Page Content</p>
              </CardHeader>
              <div className="space-y-4">
                <Input label="Title" value={bp.title} onChange={(e) => setBlockPage({...bp, title: e.target.value})} />
                <Input label="Subtitle" value={bp.subtitle} onChange={(e) => setBlockPage({...bp, subtitle: e.target.value})} />
                <div className="space-y-1.5">
                  <label className="block text-xs text-gray-500 font-mono uppercase tracking-wider">Message</label>
                  <textarea rows={3} value={bp.message} onChange={(e) => setBlockPage({...bp, message: e.target.value})}
                    className="w-full border border-cyan-500/15 rounded-lg px-3 py-2 text-sm text-gray-200 font-mono placeholder-gray-600 focus:outline-none focus:border-cyan-500/60 resize-none"
                    style={{ background: 'rgba(0,0,0,0.6)' }} />
                </div>
                <Input label="Logo URL (optional)" placeholder="https://example.com/logo.png" value={bp.logo_url || ''} onChange={(e) => setBlockPage({...bp, logo_url: e.target.value})} />
                <Input label="Contact Email (optional)" type="email" value={bp.contact_email || ''} onChange={(e) => setBlockPage({...bp, contact_email: e.target.value})} />
              </div>
            </Card>
            <Card>
              <CardHeader>
                <p className="text-xs font-mono font-medium text-cyan-400 uppercase tracking-widest">Appearance</p>
              </CardHeader>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex-1 space-y-1.5">
                    <label className="block text-xs text-gray-500 font-mono uppercase tracking-wider">Background</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={bp.bg_color} onChange={(e) => setBlockPage({...bp, bg_color: e.target.value})}
                        className="w-10 h-10 rounded border border-cyan-500/20 cursor-pointer bg-transparent" />
                      <Input value={bp.bg_color} onChange={(e) => setBlockPage({...bp, bg_color: e.target.value})} className="font-mono text-xs" />
                    </div>
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <label className="block text-xs text-gray-500 font-mono uppercase tracking-wider">Accent</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={bp.accent_color} onChange={(e) => setBlockPage({...bp, accent_color: e.target.value})}
                        className="w-10 h-10 rounded border border-cyan-500/20 cursor-pointer bg-transparent" />
                      <Input value={bp.accent_color} onChange={(e) => setBlockPage({...bp, accent_color: e.target.value})} className="font-mono text-xs" />
                    </div>
                  </div>
                </div>
                <div className="divide-y divide-cyan-500/10">
                  <Toggle label="Show Request ID" description="Display a unique request code blocked users can reference" checked={bp.show_request_id} onChange={(v) => setBlockPage({...bp, show_request_id: v})} />
                  <Toggle label="Show Contact Email" description="Show contact email on the block page" checked={bp.show_contact} onChange={(v) => setBlockPage({...bp, show_contact: v})} />
                </div>
              </div>
              <div className="mt-5 flex justify-end">
                <Button loading={saving} onClick={saveBlockPage} icon={saved === 'block' ? CheckCircle : Save}>
                  {saved === 'block' ? 'Saved!' : 'Save Block Page'}
                </Button>
              </div>
            </Card>
          </div>

          {/* Live preview */}
          <Card>
            <CardHeader>
              <p className="text-xs font-mono font-medium text-cyan-400 uppercase tracking-widest">Live Preview</p>
            </CardHeader>
            <div className="rounded-xl overflow-hidden border border-cyan-500/10" style={{ height: '420px' }}>
              <div className="w-full h-full flex items-center justify-center font-mono" style={{ background: bp.bg_color }}>
                <div className="text-center max-w-xs px-6 py-8"
                  style={{ border: `1px solid ${bp.accent_color}33`, background: 'rgba(255,255,255,0.02)', boxShadow: `0 0 30px ${bp.accent_color}15` }}>
                  {bp.logo_url && <img src={bp.logo_url} style={{ height: 36, margin: '0 auto 16px', display: 'block' }} alt="" onError={(e) => (e.target.style.display = 'none')} />}
                  <div className="flex items-center justify-center mx-auto mb-4"
                    style={{ width: 44, height: 44, border: `1.5px solid ${bp.accent_color}`, borderRadius: '50%', color: bp.accent_color, fontSize: 18, boxShadow: `0 0 14px ${bp.accent_color}55` }}>
                    ✕
                  </div>
                  <p style={{ color: bp.accent_color, fontSize: 13, fontWeight: 700, letterSpacing: '0.12em', marginBottom: 8 }}>{bp.title || '—'}</p>
                  <p style={{ color: '#9ca3af', fontSize: 11, marginBottom: 10, lineHeight: 1.5 }}>{bp.subtitle || '—'}</p>
                  <p style={{ color: '#6b7280', fontSize: 10, marginBottom: 14, lineHeight: 1.6 }}>{bp.message || '—'}</p>
                  {bp.show_request_id && <code style={{ color: '#374151', fontSize: 9, display: 'block', marginBottom: 10 }}>REQ#A1B2C3D4</code>}
                  {bp.show_contact && bp.contact_email && (
                    <span style={{ color: bp.accent_color, fontSize: 10 }}>{bp.contact_email}</span>
                  )}
                </div>
              </div>
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
