import { useEffect, useRef, useState } from 'react'
import { CheckCircle, RefreshCw, ShieldCheck, Upload, Wifi, XCircle } from 'lucide-react'
import { Alert, Badge, Button, Card, CardHeader, Input, Select } from '../../components/ui/index'
import { settingsApi } from '../../services/api'

const CONNECTOR_EVENTS = [
  { key: 'high_severity_incident', label: 'High Severity Incident' },
  { key: 'evasion_detected', label: 'Evasion Detected' },
  { key: 'spam_detected', label: 'Spam Detected' },
  { key: 'block_triggered', label: 'Block Triggered' },
]

export default function IntegrationsTab({ settings, setSettings, saving, onSave }) {
  const fileRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState(null) // 'ok' | 'error' | null
  const [probing, setProbing] = useState(false)
  const [probeResult, setProbeResult] = useState(null)
  const [status, setStatus] = useState(null)
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const provider = settings.geoip_provider ?? 'ip-api'

  useEffect(() => { refreshStatus() }, [])

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadResult(null)
    try {
      await settingsApi.uploadMmdb(file)
      setUploadResult('ok')
    } catch {
      setUploadResult('error')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const probe = async () => {
    setProbing(true)
    setProbeResult(null)
    try {
      const r = await settingsApi.geoipStatus()
      setProbeResult(r.data)
    } catch {
      setProbeResult({ ok: false, error: 'Request failed' })
    } finally {
      setProbing(false)
    }
  }

  const refreshStatus = async () => {
    setLoadingStatus(true)
    try {
      const res = await settingsApi.integrationsStatus()
      setStatus(res.data)
      setError('')
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load integrations status')
    } finally {
      setLoadingStatus(false)
    }
  }

  const refreshThreatIntel = async () => {
    setBusy('intel')
    setMessage('')
    setError('')
    try {
      const res = await settingsApi.refreshThreatIntel()
      setMessage(`Threat intel refreshed: ${res.data.updated} entries updated.`)
      await refreshStatus()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to refresh threat intel')
    } finally {
      setBusy('')
    }
  }

  const testConnector = async (connector) => {
    const url = settings[`integration_${connector}_url`]
    if (!url) {
      setError(`Set the ${connector} URL before testing.`)
      return
    }
    setBusy(`test-${connector}`)
    setMessage('')
    setError('')
    try {
      const res = await settingsApi.testIntegrationConnector({
        connector,
        url,
        secret: settings[`integration_${connector}_secret`] || '',
      })
      setMessage(`${connector} connector responded with status ${res.data.status_code}.`)
      await refreshStatus()
    } catch (err) {
      setError(err.response?.data?.detail || `Failed to test ${connector} connector`)
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="space-y-4">
      {message && <Alert type="success">{message}</Alert>}
      {error && <Alert type="danger">{error}</Alert>}

      <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,0.8fr)_minmax(320px,0.45fr)]">
        <Card>
          <CardHeader>
            <p className="text-sm font-medium text-white">GeoIP Provider</p>
            <p className="text-xs text-gray-500">Resolve visitor country, city, and network hints from IP address.</p>
          </CardHeader>

          <div className="space-y-4">
            <Select
              label="Provider"
              value={provider}
              onChange={(e) => setSettings({ ...settings, geoip_provider: e.target.value })}
              options={[
                { value: 'ip-api', label: 'ip-api.com — free, no token (default)' },
                { value: 'local', label: 'Local .mmdb file — offline, no rate limit' },
                { value: 'none', label: 'Disabled' },
              ]}
            />

            {provider === 'ip-api' && (
              <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-3 py-2.5">
                <p className="text-xs text-yellow-400">
                  Rate limit: 45 req/min. Results are cached in Redis for 24 h per IP.
                </p>
              </div>
            )}

            {provider === 'local' && (
              <div className="space-y-2.5">
                <p className="text-xs text-gray-500">
                  Upload any <span className="text-gray-300">.mmdb</span> file — MaxMind GeoLite2-City, DB-IP Community, or ip2location LITE.
                </p>
                <div className="flex items-center gap-3">
                  <input ref={fileRef} type="file" accept=".mmdb" className="hidden" onChange={handleUpload} />
                  <Button icon={Upload} loading={uploading} onClick={() => fileRef.current?.click()}>
                    {uploading ? 'Uploading…' : 'Upload .mmdb'}
                  </Button>
                  {uploadResult === 'ok' && <span className="flex items-center gap-1 text-xs text-green-400"><CheckCircle size={12} /> Uploaded</span>}
                  {uploadResult === 'error' && <span className="flex items-center gap-1 text-xs text-red-400"><XCircle size={12} /> Upload failed</span>}
                </div>
              </div>
            )}

            {provider === 'none' && (
              <div className="rounded-lg border border-gray-700 bg-gray-800/30 px-3 py-2.5">
                <p className="text-xs text-gray-500">GeoIP is disabled. Country, city and flag fields will be empty on new visitors.</p>
              </div>
            )}

            {provider !== 'none' && (
              <div className="flex items-center gap-3 pt-1 border-t border-gray-800">
                <Button variant="ghost" icon={Wifi} loading={probing} onClick={probe}>Test Provider</Button>
                {probeResult && (probeResult.ok
                  ? <span className="text-xs text-green-400">✓ {probeResult.sample?.country_flag} {probeResult.sample?.country} ({probeResult.sample?.city})</span>
                  : <span className="text-xs text-red-400">✗ {probeResult.error}</span>)}
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader action={<Button variant="secondary" size="sm" icon={RefreshCw} loading={loadingStatus} onClick={refreshStatus}>Refresh</Button>}>
            <div>
              <p className="text-sm font-medium text-white">Integration Snapshot</p>
              <p className="mt-1 text-xs text-gray-500">Current programmatic access, connector delivery, and threat-intel posture.</p>
            </div>
          </CardHeader>
          <div className="space-y-3">
            <Snapshot label="Sites" value={`${status?.api_access?.active_site_count ?? 0} active / ${status?.api_access?.site_count ?? 0} total`} />
            <Snapshot label="Threat Intel" value={`${status?.threat_intel?.entry_count ?? 0} entries`} />
            <Snapshot label="SIEM" value={status?.connectors?.siem?.enabled ? `${status?.connectors?.siem?.deliveries_sent ?? 0} deliveries` : 'Disabled'} />
            <Snapshot label="Monitoring" value={status?.connectors?.monitoring?.enabled ? `${status?.connectors?.monitoring?.deliveries_sent ?? 0} deliveries` : 'Disabled'} />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <p className="text-sm font-medium text-white">Programmatic Access</p>
              <p className="text-xs text-gray-500">Govern tracker/API access, key issuance style, and integration-specific rate limits.</p>
            </div>
          </CardHeader>
          <div className="space-y-4">
            <label className="flex items-start gap-3 rounded-xl border border-cyan-500/10 bg-black/20 px-4 py-3">
              <input
                type="checkbox"
                checked={!!settings.integration_api_access_enabled}
                onChange={(e) => setSettings({ ...settings, integration_api_access_enabled: e.target.checked })}
                className="mt-1 accent-cyan-500"
              />
              <div>
                <p className="text-sm text-white">Enable tracker/API access</p>
                <p className="mt-1 text-xs text-gray-500">When disabled, site API keys are rejected at runtime.</p>
              </div>
            </label>
            <Input
              label="API Key Prefix"
              value={settings.integration_api_key_prefix ?? 'sk_'}
              onChange={(e) => setSettings({ ...settings, integration_api_key_prefix: e.target.value })}
              placeholder="sk_"
            />
            <Input
              label="Integration Rate Limit / Minute"
              type="number"
              min="1"
              value={settings.rate_limit_integration_per_minute ?? 120}
              onChange={(e) => setSettings({ ...settings, rate_limit_integration_per_minute: Number(e.target.value) })}
            />
            <div className="rounded-lg border border-cyan-500/10 bg-black/20 px-3 py-3">
              <p className="text-xs text-gray-500">Current prefix</p>
              <p className="mt-1 text-sm text-cyan-300 font-mono">{status?.api_access?.api_key_prefix || settings.integration_api_key_prefix || 'sk_'}</p>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader action={<Button variant="secondary" size="sm" icon={RefreshCw} loading={busy === 'intel'} onClick={refreshThreatIntel}>Refresh Intel</Button>}>
            <div>
              <p className="text-sm font-medium text-white">Threat Intelligence Feed</p>
              <p className="text-xs text-gray-500">Refresh the STIE threat bundle and keep integration-side enrichment current.</p>
            </div>
          </CardHeader>
          <div className="space-y-3">
            <Snapshot label="Entries" value={`${status?.threat_intel?.entry_count ?? 0}`} />
            <Snapshot label="Refresh Interval" value={`${status?.threat_intel?.refresh_interval_hours ?? 24} h`} />
            <Snapshot label="Last Update" value={formatDate(status?.threat_intel?.latest_updated_at)} />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
        <ConnectorCard
          name="siem"
          title="SIEM Connector"
          settings={settings}
          setSettings={setSettings}
          busy={busy}
          onTest={testConnector}
          delivered={status?.connectors?.siem?.deliveries_sent ?? 0}
        />
        <ConnectorCard
          name="monitoring"
          title="Monitoring Connector"
          settings={settings}
          setSettings={setSettings}
          busy={busy}
          onTest={testConnector}
          delivered={status?.connectors?.monitoring?.deliveries_sent ?? 0}
        />
      </div>

      <div className="flex justify-end">
        <Button loading={saving} icon={ShieldCheck} onClick={onSave}>Save Integrations</Button>
      </div>
    </div>
  )
}

function ConnectorCard({ name, title, settings, setSettings, busy, onTest, delivered }) {
  const enabledKey = `integration_${name}_enabled`
  const urlKey = `integration_${name}_url`
  const secretKey = `integration_${name}_secret`
  const eventsKey = `integration_${name}_events`
  const selectedEvents = settings[eventsKey] ?? []

  const toggleEvent = (key) => {
    const next = selectedEvents.includes(key)
      ? selectedEvents.filter((item) => item !== key)
      : [...selectedEvents, key]
    setSettings({ ...settings, [eventsKey]: next })
  }

  return (
    <Card>
      <CardHeader action={<Badge variant={settings[enabledKey] ? 'success' : 'default'}>{settings[enabledKey] ? `${delivered} sent` : 'Disabled'}</Badge>}>
        <div>
          <p className="text-sm font-medium text-white">{title}</p>
          <p className="text-xs text-gray-500">Forward high-signal events to an external webhook with signed delivery.</p>
        </div>
      </CardHeader>
      <div className="space-y-4">
        <label className="flex items-start gap-3 rounded-xl border border-cyan-500/10 bg-black/20 px-4 py-3">
          <input
            type="checkbox"
            checked={!!settings[enabledKey]}
            onChange={(e) => setSettings({ ...settings, [enabledKey]: e.target.checked })}
            className="mt-1 accent-cyan-500"
          />
          <div>
            <p className="text-sm text-white">Enable {title}</p>
            <p className="mt-1 text-xs text-gray-500">Events are dispatched automatically through the shared delivery pipeline.</p>
          </div>
        </label>
        <Input
          label="Webhook URL"
          value={settings[urlKey] ?? ''}
          onChange={(e) => setSettings({ ...settings, [urlKey]: e.target.value })}
          placeholder="https://example.com/ingest"
        />
        <Input
          label="Shared Secret"
          type="password"
          value={settings[secretKey] ?? ''}
          onChange={(e) => setSettings({ ...settings, [secretKey]: e.target.value })}
          placeholder="Optional HMAC secret"
        />
        <div className="space-y-2">
          <p className="text-xs font-mono uppercase tracking-[0.18em] text-gray-500">Forward Events</p>
          {CONNECTOR_EVENTS.map((event) => (
            <label key={`${name}-${event.key}`} className="flex items-center gap-3 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={selectedEvents.includes(event.key)}
                onChange={() => toggleEvent(event.key)}
                className="accent-cyan-500"
              />
              <span>{event.label}</span>
            </label>
          ))}
        </div>
        <div className="flex justify-end">
          <Button variant="secondary" loading={busy === `test-${name}`} onClick={() => onTest(name)}>Send Test</Button>
        </div>
      </div>
    </Card>
  )
}

function Snapshot({ label, value }) {
  return (
    <div className="rounded-xl border border-cyan-500/10 bg-black/25 p-4">
      <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-gray-500">{label}</p>
      <p className="mt-2 text-sm font-medium text-white">{value}</p>
    </div>
  )
}

function formatDate(value) {
  if (!value) return 'Never'
  try {
    return new Date(value).toLocaleString()
  } catch {
    return value
  }
}
