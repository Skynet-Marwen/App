import { useState, useEffect, useCallback } from 'react'
import { AlertTriangle, CheckCircle, XCircle, Settings2, RefreshCw } from 'lucide-react'
import DashboardLayout from '../components/layout/DashboardLayout'
import { Card, CardHeader, Table, Badge, Button, Toggle, Alert } from '../components/ui/index'
import { antiEvasionApi } from '../services/api'

const DEFAULT_CONFIG = {
  vpn_detection: true,
  tor_detection: true,
  proxy_detection: true,
  datacenter_detection: true,
  headless_browser_detection: true,
  bot_detection: true,
  canvas_fingerprint: true,
  webgl_fingerprint: true,
  font_fingerprint: true,
  audio_fingerprint: true,
  timezone_mismatch: true,
  language_mismatch: true,
  cookie_evasion: true,
  ip_rotation_detection: true,
  spam_rate_threshold: 10,
  max_accounts_per_device: 3,
  max_accounts_per_ip: 5,
}

export default function AntiEvasionPage() {
  const [config, setConfig] = useState(DEFAULT_CONFIG)
  const [incidents, setIncidents] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [cfgRes, incRes] = await Promise.all([
        antiEvasionApi.config(),
        antiEvasionApi.incidents({ page_size: 30 }),
      ])
      setConfig({ ...DEFAULT_CONFIG, ...cfgRes.data })
      setIncidents(incRes.data.items ?? [])
    } catch (_) {}
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSave = async () => {
    setSaving(true)
    try {
      await antiEvasionApi.updateConfig(config)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (_) {}
    finally { setSaving(false) }
  }

  const handleResolve = async (id) => {
    await antiEvasionApi.resolveIncident(id)
    setIncidents((prev) => prev.map((i) => i.id === id ? { ...i, status: 'resolved' } : i))
  }

  const severityBadge = (s) => {
    if (s === 'critical') return <Badge variant="danger">Critical</Badge>
    if (s === 'high') return <Badge variant="danger">High</Badge>
    if (s === 'medium') return <Badge variant="warning">Medium</Badge>
    return <Badge variant="info">Low</Badge>
  }

  const incidentColumns = [
    { key: 'type', label: 'Type', render: (v) => <span className="text-xs font-medium text-white">{v}</span> },
    { key: 'description', label: 'Description', render: (v) => <span className="text-xs text-gray-400">{v}</span> },
    { key: 'ip', label: 'IP', render: (v) => <code className="text-xs text-cyan-400">{v}</code> },
    { key: 'severity', label: 'Severity', render: (v) => severityBadge(v) },
    { key: 'status', label: 'Status', render: (v) => (
      v === 'resolved' ? <Badge variant="success">Resolved</Badge> : <Badge variant="warning">Open</Badge>
    )},
    { key: 'detected_at', label: 'Detected', render: (v) => <span className="text-xs text-gray-400">{v}</span> },
    { key: 'actions', label: '', width: '90px', render: (_, row) => (
      row.status !== 'resolved' && (
        <Button variant="secondary" size="sm" icon={CheckCircle} onClick={() => handleResolve(row.id)}>
          Resolve
        </Button>
      )
    )},
  ]

  const DETECTIONS = [
    { key: 'vpn_detection', label: 'VPN Detection', description: 'Detect and flag/block VPN usage' },
    { key: 'tor_detection', label: 'Tor Detection', description: 'Detect Tor exit nodes' },
    { key: 'proxy_detection', label: 'Proxy Detection', description: 'HTTP/SOCKS proxy detection' },
    { key: 'datacenter_detection', label: 'Datacenter Detection', description: 'Flag traffic from datacenters/cloud IPs' },
    { key: 'headless_browser_detection', label: 'Headless Browser', description: 'Detect Puppeteer, Playwright, PhantomJS' },
    { key: 'bot_detection', label: 'Bot Detection', description: 'Behavioral analysis for bots and crawlers' },
  ]

  const FINGERPRINTS = [
    { key: 'canvas_fingerprint', label: 'Canvas Fingerprinting', description: 'Browser canvas rendering fingerprint' },
    { key: 'webgl_fingerprint', label: 'WebGL Fingerprinting', description: 'GPU-based rendering fingerprint' },
    { key: 'font_fingerprint', label: 'Font Fingerprinting', description: 'Available system fonts detection' },
    { key: 'audio_fingerprint', label: 'Audio Fingerprinting', description: 'AudioContext API fingerprint' },
  ]

  const EVASION = [
    { key: 'timezone_mismatch', label: 'Timezone Mismatch', description: 'Flag when timezone doesn\'t match IP geolocation' },
    { key: 'language_mismatch', label: 'Language Mismatch', description: 'Flag when browser language contradicts geolocation' },
    { key: 'cookie_evasion', label: 'Cookie Evasion Detection', description: 'Detect private browsing / cookie deletion patterns' },
    { key: 'ip_rotation_detection', label: 'IP Rotation Detection', description: 'Detect rapid IP changes from same device' },
  ]

  return (
    <DashboardLayout title="Anti-Evasion & Anti-Spam" onRefresh={fetchData}>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Open Incidents', value: incidents.filter((i) => i.status !== 'resolved').length, color: 'text-red-400' },
          { label: 'Resolved Today', value: incidents.filter((i) => i.status === 'resolved').length, color: 'text-green-400' },
          { label: 'Active Detections', value: Object.entries(config).filter(([k, v]) => typeof v === 'boolean' && v).length, color: 'text-cyan-400' },
        ].map((s) => (
          <Card key={s.label}>
            <p className="text-xs text-gray-500 mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
        {/* Detection Modules */}
        <Card>
          <CardHeader>
            <p className="text-sm font-medium text-white">Detection Modules</p>
            <p className="text-xs text-gray-500">VPN, Tor, Proxy, Bot</p>
          </CardHeader>
          <div className="divide-y divide-gray-800">
            {DETECTIONS.map(({ key, label, description }) => (
              <Toggle
                key={key}
                label={label}
                description={description}
                checked={!!config[key]}
                onChange={(v) => setConfig({ ...config, [key]: v })}
              />
            ))}
          </div>
        </Card>

        {/* Fingerprinting */}
        <Card>
          <CardHeader>
            <p className="text-sm font-medium text-white">Device Fingerprinting</p>
            <p className="text-xs text-gray-500">Browser signals for device tracking</p>
          </CardHeader>
          <div className="divide-y divide-gray-800">
            {FINGERPRINTS.map(({ key, label, description }) => (
              <Toggle
                key={key}
                label={label}
                description={description}
                checked={!!config[key]}
                onChange={(v) => setConfig({ ...config, [key]: v })}
              />
            ))}
          </div>
        </Card>

        {/* Evasion */}
        <Card>
          <CardHeader>
            <p className="text-sm font-medium text-white">Evasion Detection</p>
            <p className="text-xs text-gray-500">Mismatch and rotation patterns</p>
          </CardHeader>
          <div className="divide-y divide-gray-800">
            {EVASION.map(({ key, label, description }) => (
              <Toggle
                key={key}
                label={label}
                description={description}
                checked={!!config[key]}
                onChange={(v) => setConfig({ ...config, [key]: v })}
              />
            ))}
          </div>
        </Card>

        {/* Anti-Spam Thresholds */}
        <Card>
          <CardHeader>
            <p className="text-sm font-medium text-white">Anti-Spam Thresholds</p>
            <p className="text-xs text-gray-500">Limits per device / IP</p>
          </CardHeader>
          <div className="space-y-4">
            {[
              { key: 'spam_rate_threshold', label: 'Max actions per minute', min: 1, max: 1000 },
              { key: 'max_accounts_per_device', label: 'Max accounts per device', min: 1, max: 50 },
              { key: 'max_accounts_per_ip', label: 'Max accounts per IP', min: 1, max: 100 },
            ].map(({ key, label, min, max }) => (
              <div key={key}>
                <div className="flex justify-between mb-1.5">
                  <label className="text-sm text-gray-300">{label}</label>
                  <span className="text-sm font-medium text-cyan-400">{config[key]}</span>
                </div>
                <input
                  type="range"
                  min={min}
                  max={max}
                  value={config[key] ?? min}
                  onChange={(e) => setConfig({ ...config, [key]: Number(e.target.value) })}
                  className="w-full accent-cyan-500"
                />
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Save Button */}
      <div className="flex justify-end mb-6">
        <Button loading={saving} onClick={handleSave} icon={saved ? CheckCircle : Settings2}>
          {saved ? 'Saved!' : 'Save Configuration'}
        </Button>
      </div>

      {/* Incidents Table */}
      <Card>
        <CardHeader>
          <p className="text-sm font-medium text-white">Recent Incidents</p>
          <p className="text-xs text-gray-500">Detected evasion and spam attempts</p>
        </CardHeader>
        <Table columns={incidentColumns} data={incidents} loading={loading} emptyMessage="No incidents detected" />
      </Card>
    </DashboardLayout>
  )
}
