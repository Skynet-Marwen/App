import { useState } from 'react'
import { CheckCircle, Radar, Settings2, ShieldAlert } from 'lucide-react'
import DashboardLayout from '../components/layout/DashboardLayout'
import { Alert, Badge, Button, Card, CardHeader, Input, PageToolbar, Select, StatCard, Table, Toggle } from '../components/ui/index'
import { useAntiEvasion } from '../hooks/useAntiEvasion'

export default function AntiEvasionPage() {
  const { config, setConfig, incidents, loading, saving, refresh, saveConfig, resolveIncident } = useAntiEvasion()
  const [saved, setSaved] = useState(false)

  const openIncidents = incidents.filter((incident) => incident.status !== 'resolved')
  const resolvedIncidents = incidents.length - openIncidents.length
  const activeDetections = Object.values(config).filter((value) => typeof value === 'boolean' && value).length
  const openCritical = openIncidents.filter((incident) => ['critical', 'high'].includes(incident.severity)).length

  const handleSave = async () => {
    try {
      await saveConfig(config)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      setSaved(false)
    }
  }

  const handleResolve = async (id) => {
    await resolveIncident(id)
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

  const PIPELINE = [
    { key: 'crawler_signature_detection', label: 'Crawler Signatures', description: 'Match common bot, crawler, and scripted client user-agent patterns' },
    { key: 'click_farm_detection', label: 'Click Farm Heuristics', description: 'Flag repetitive click-heavy sessions with little human context' },
    { key: 'form_honeypot_detection', label: 'Form Honeypot Detection', description: 'Treat hidden-field submissions as immediate abuse signals' },
    { key: 'dnsbl_enabled', label: 'DNSBL Reputation Checks', description: 'Query public abuse lists before deciding on challenge or block' },
    { key: 'challenge_enabled', label: 'Graduated Challenge Flow', description: 'Serve challenge pages instead of immediate block when risk is elevated' },
  ]

  return (
    <DashboardLayout title="Anti-Evasion & Anti-Spam" onRefresh={refresh}>
      <PageToolbar>
        <div className="space-y-2">
          <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-cyan-400/80">Protection Controls</p>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">Anti-evasion console</h1>
            <Badge variant={openIncidents.length ? 'danger' : 'success'}>{openIncidents.length ? `${openIncidents.length} open incident${openIncidents.length === 1 ? '' : 's'}` : 'All clear'}</Badge>
          </div>
          <p className="max-w-3xl text-sm text-gray-400">
            Tune detection modules, fingerprinting, and abuse thresholds from a single operator view. Save commits the current runtime configuration immediately.
          </p>
        </div>
        <Button loading={saving} onClick={handleSave} icon={saved ? CheckCircle : Settings2}>
          {saved ? 'Saved!' : 'Save configuration'}
        </Button>
      </PageToolbar>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <StatCard label="Open incidents" value={openIncidents.length.toLocaleString()} rawValue={openIncidents.length} icon={ShieldAlert} color="red" loading={loading} />
        <StatCard label="Resolved incidents" value={resolvedIncidents.toLocaleString()} rawValue={resolvedIncidents} icon={CheckCircle} color="green" loading={loading} />
        <StatCard label="Active detections" value={activeDetections.toLocaleString()} rawValue={activeDetections} icon={Radar} color="cyan" loading={loading} />
      </div>

      {openCritical > 0 && (
        <Alert type="danger">
          {openCritical} high-priority incident{openCritical === 1 ? '' : 's'} still need attention. Resolve them before broadening detection thresholds.
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.9fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <p className="text-sm font-medium text-white">Detection modules</p>
              <p className="text-xs text-gray-500">VPN, Tor, proxy, datacenter, bot</p>
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

          <Card>
            <CardHeader>
              <p className="text-sm font-medium text-white">Device fingerprinting</p>
              <p className="text-xs text-gray-500">Browser signals for cross-session tracking</p>
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

          <Card>
            <CardHeader>
              <p className="text-sm font-medium text-white">Evasion detection</p>
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
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <p className="text-sm font-medium text-white">Active pipeline</p>
              <p className="text-xs text-gray-500">Challenge, bot, spam, and reputation modules</p>
            </CardHeader>
            <div className="divide-y divide-gray-800">
              {PIPELINE.map(({ key, label, description }) => (
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

          <Card>
            <CardHeader>
              <p className="text-sm font-medium text-white">Challenge response</p>
              <p className="text-xs text-gray-500">Choose how SKYNET slows suspicious sessions</p>
            </CardHeader>
            <div className="space-y-4">
              <Select
                label="Challenge Type"
                value={config.challenge_type || 'js_pow'}
                onChange={(event) => setConfig({ ...config, challenge_type: event.target.value })}
                options={[
                  { value: 'js_pow', label: 'JS proof-of-work' },
                  { value: 'captcha_redirect', label: 'CAPTCHA redirect' },
                  { value: 'honeypot', label: 'Honeypot continue form' },
                ]}
              />
              <Input
                label="Redirect URL"
                value={config.challenge_redirect_url || ''}
                onChange={(event) => setConfig({ ...config, challenge_redirect_url: event.target.value })}
                placeholder="https://challenge.example.com/verify"
              />
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <Input
                  label="PoW Difficulty"
                  type="number"
                  min="1"
                  max="8"
                  value={config.challenge_pow_difficulty ?? 4}
                  onChange={(event) => setConfig({ ...config, challenge_pow_difficulty: Number(event.target.value) || 4 })}
                />
                <Input
                  label="Bypass TTL (sec)"
                  type="number"
                  min="60"
                  step="60"
                  value={config.challenge_bypass_ttl_sec ?? 900}
                  onChange={(event) => setConfig({ ...config, challenge_bypass_ttl_sec: Number(event.target.value) || 900 })}
                />
                <Input
                  label="Honeypot Field"
                  value={config.challenge_honeypot_field || 'website'}
                  onChange={(event) => setConfig({ ...config, challenge_honeypot_field: event.target.value })}
                />
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <p className="text-sm font-medium text-white">Anti-spam thresholds</p>
              <p className="text-xs text-gray-500">Limits per device, IP, forms, and abuse reputation</p>
            </CardHeader>
            <div className="space-y-4">
              {[
                { key: 'spam_rate_threshold', label: 'Max actions per minute', min: 1, max: 1000 },
                { key: 'max_accounts_per_device', label: 'Max accounts per device', min: 1, max: 50 },
                { key: 'max_accounts_per_ip', label: 'Max accounts per IP', min: 1, max: 100 },
                { key: 'form_submission_velocity_threshold', label: 'Form submissions per window', min: 1, max: 20 },
                { key: 'form_content_dedupe_threshold', label: 'Duplicate form content threshold', min: 1, max: 20 },
              ].map(({ key, label, min, max }) => (
                <div key={key}>
                  <div className="mb-1.5 flex items-center justify-between gap-3">
                    <label className="text-sm text-gray-300">{label}</label>
                    <span className="font-mono text-sm text-cyan-400">{config[key]}</span>
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
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <Input
                  label="Form Velocity Window (sec)"
                  type="number"
                  min="60"
                  step="30"
                  value={config.form_submission_velocity_window_sec ?? 300}
                  onChange={(event) => setConfig({ ...config, form_submission_velocity_window_sec: Number(event.target.value) || 300 })}
                />
                <Input
                  label="Dedup Window (sec)"
                  type="number"
                  min="60"
                  step="60"
                  value={config.form_content_dedupe_window_sec ?? 1800}
                  onChange={(event) => setConfig({ ...config, form_content_dedupe_window_sec: Number(event.target.value) || 1800 })}
                />
                <Input
                  label="DNSBL Cache TTL (sec)"
                  type="number"
                  min="60"
                  step="60"
                  value={config.dnsbl_cache_ttl_sec ?? 900}
                  onChange={(event) => setConfig({ ...config, dnsbl_cache_ttl_sec: Number(event.target.value) || 900 })}
                />
              </div>
              <Select
                label="DNSBL Action"
                value={config.dnsbl_action || 'challenge'}
                onChange={(event) => setConfig({ ...config, dnsbl_action: event.target.value })}
                options={[
                  { value: 'challenge', label: 'Challenge listed IPs' },
                  { value: 'block', label: 'Block listed IPs' },
                ]}
              />
              <Input
                label="DNSBL Providers"
                value={Array.isArray(config.dnsbl_providers) ? config.dnsbl_providers.join(', ') : (config.dnsbl_providers || '')}
                onChange={(event) => setConfig({
                  ...config,
                  dnsbl_providers: event.target.value.split(',').map((item) => item.trim()).filter(Boolean),
                })}
                placeholder="zen.spamhaus.org, bl.spamcop.net"
              />
            </div>
          </Card>

          <Card>
            <CardHeader>
              <p className="text-sm font-medium text-white">Recent incidents</p>
              <p className="text-xs text-gray-500">Detected evasion and spam attempts</p>
            </CardHeader>
            <Table columns={incidentColumns} data={incidents} loading={loading} emptyMessage="No incidents detected" />
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}
