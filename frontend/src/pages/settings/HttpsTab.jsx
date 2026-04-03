import { useEffect, useRef, useState } from 'react'
import { CheckCircle, FileUp, RefreshCw, Save, ShieldCheck } from 'lucide-react'
import { Alert, Button, Card, CardHeader, Input, Select, Toggle } from '../../components/ui/index'
import { gatewayApi, settingsApi } from '../../services/api'

const MODE_OPTIONS = [
  { value: 'off', label: 'Off - local HTTP only' },
  { value: 'edge', label: 'Edge - proxy or tunnel terminates HTTPS' },
]
const PROVIDER_OPTIONS = [
  { value: 'reverse_proxy', label: 'Reverse Proxy / LB' },
  { value: 'caddy', label: 'Bundled Caddy profile' },
  { value: 'cloudflare_tunnel', label: 'Cloudflare Tunnel' },
  { value: 'custom', label: 'Custom edge / other' },
]
const CERTIFICATE_OPTIONS = [
  { value: 'edge_managed', label: 'Edge-managed certificate' },
  { value: 'self_signed', label: 'Self-signed certificate' },
  { value: 'letsencrypt_http', label: "Let's Encrypt - HTTP challenge" },
  { value: 'letsencrypt_dns', label: "Let's Encrypt - DNS challenge" },
  { value: 'uploaded', label: 'Upload existing certificate' },
]

function MultilineField({ label, hint, value, onChange, placeholder, rows = 4 }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs text-gray-500 font-mono uppercase tracking-wider">{label}</label>
      <textarea
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={onChange}
        className="w-full resize-none rounded-lg border border-cyan-500/15 px-3 py-2 text-sm text-gray-200 font-mono placeholder-gray-600 focus:border-cyan-500/60 focus:outline-none"
        style={{ background: 'rgba(0,0,0,0.6)' }}
      />
      {hint ? <p className="text-xs text-gray-600 font-mono">{hint}</p> : null}
    </div>
  )
}

function listToText(value) {
  return Array.isArray(value) ? value.join('\n') : (value || '')
}

function textToList(value) {
  return String(value || '')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)
}

function AssetStatus({ label, asset }) {
  return (
    <div className="rounded-lg border border-cyan-500/10 bg-black/20 px-3 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-mono text-gray-300 uppercase tracking-wider">{label}</p>
        <span className={`text-[11px] font-mono ${asset?.ready ? 'text-green-400' : 'text-gray-500'}`}>{asset?.ready ? 'Ready' : 'Not ready'}</span>
      </div>
      <p className="mt-1 text-xs text-gray-500">{asset?.updated_at ? `Updated ${new Date(asset.updated_at).toLocaleString()}` : 'No certificate files stored yet.'}</p>
    </div>
  )
}

export default function HttpsTab({ settings, setSettings }) {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [status, setStatus] = useState(null)
  const [loadingStatus, setLoadingStatus] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [gatewayStatus, setGatewayStatus] = useState(null)
  const certRef = useRef(null)
  const keyRef = useRef(null)
  const chainRef = useRef(null)
  const s = settings
  const strategy = s.https_certificate_strategy ?? 'edge_managed'

  const loadStatus = async () => {
    setLoadingStatus(true)
    try {
      const res = await settingsApi.getHttpsStatus()
      setStatus(res.data)
    } catch {
      setStatus(null)
    } finally {
      setLoadingStatus(false)
    }
  }

  useEffect(() => { loadStatus() }, [])

  useEffect(() => {
    gatewayApi.status().then((res) => setGatewayStatus(res.data)).catch(() => setGatewayStatus(null))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const res = await settingsApi.update(s)
      setSettings(res.data)
      setSaved(true)
      setMessage('Access & Network settings saved.')
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save Access & Network settings')
    } finally {
      setSaving(false)
    }
  }

  const handleSelfSigned = async () => {
    setGenerating(true)
    setError('')
    setMessage('')
    try {
      await settingsApi.generateSelfSignedCertificate({
        common_name: s.https_self_signed_common_name || 'localhost',
        valid_days: Number(s.https_self_signed_valid_days || 30),
      })
      const res = await settingsApi.get()
      setSettings(res.data)
      await loadStatus()
      setMessage('Self-signed certificate generated.')
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to generate self-signed certificate')
    } finally {
      setGenerating(false)
    }
  }

  const handleUpload = async () => {
    const certificate = certRef.current?.files?.[0]
    const privateKey = keyRef.current?.files?.[0]
    const chain = chainRef.current?.files?.[0]
    if (!certificate || !privateKey) {
      setError('Certificate and private key files are required')
      return
    }
    setUploading(true)
    setError('')
    setMessage('')
    try {
      await settingsApi.uploadHttpsCertificate({ certificate, privateKey, chain })
      const res = await settingsApi.get()
      setSettings(res.data)
      await loadStatus()
      setMessage('Certificate files uploaded.')
      if (certRef.current) certRef.current.value = ''
      if (keyRef.current) keyRef.current.value = ''
      if (chainRef.current) chainRef.current.value = ''
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to upload certificate files')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <p className="text-xs font-mono font-medium text-cyan-400 uppercase tracking-widest">Public Access</p>
          <p className="text-xs text-gray-500">Controls the public URL used in tracker snippets, API examples, and deployment guidance.</p>
        </CardHeader>
        <div className="space-y-4">
          <Input
            label="Public Base URL"
            placeholder="https://skynet.example.com"
            value={s.base_url ?? ''}
            onChange={(e) => setSettings({ ...s, base_url: e.target.value })}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Select
              label="HTTPS Mode"
              value={s.https_mode ?? 'off'}
              onChange={(e) => setSettings({ ...s, https_mode: e.target.value })}
              options={MODE_OPTIONS}
            />
            <Select
              label="Edge Provider"
              value={s.https_provider ?? 'reverse_proxy'}
              onChange={(e) => setSettings({ ...s, https_provider: e.target.value })}
              options={PROVIDER_OPTIONS}
            />
          </div>
          <div className="divide-y divide-gray-800">
            <Toggle
              label="Trust Proxy Headers"
              description="Use forwarded host, scheme, and client IP headers only when requests come from a proxy or tunnel you control."
              checked={!!s.trust_proxy_headers}
              onChange={(v) => setSettings({ ...s, trust_proxy_headers: v })}
            />
            <Toggle
              label="Enable HSTS"
              description="Send Strict-Transport-Security only on the configured HTTPS host."
              checked={!!s.hsts_enabled}
              onChange={(v) => setSettings({ ...s, hsts_enabled: v })}
            />
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <p className="text-xs font-mono font-medium text-cyan-400 uppercase tracking-widest">Certificate Strategy</p>
          <p className="text-xs text-gray-500">Choose how SkyNet should source or stage HTTPS certificates.</p>
        </CardHeader>
        <div className="space-y-4">
          <Select
            label="Certificate Mode"
            value={strategy}
            onChange={(e) => setSettings({ ...s, https_certificate_strategy: e.target.value })}
            options={CERTIFICATE_OPTIONS}
          />
          {strategy === 'self_signed' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                label="Common Name"
                placeholder="localhost"
                value={s.https_self_signed_common_name ?? 'localhost'}
                onChange={(e) => setSettings({ ...s, https_self_signed_common_name: e.target.value })}
              />
              <Input
                label="Validity Days"
                type="number"
                min={1}
                max={825}
                value={s.https_self_signed_valid_days ?? 30}
                onChange={(e) => setSettings({ ...s, https_self_signed_valid_days: Number(e.target.value) })}
              />
            </div>
          )}
          {(strategy === 'letsencrypt_http' || strategy === 'letsencrypt_dns') && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input
                  label="Primary Domain"
                  placeholder="skynet.example.com"
                  value={s.https_letsencrypt_domain ?? ''}
                  onChange={(e) => setSettings({ ...s, https_letsencrypt_domain: e.target.value })}
                />
                <Input
                  label="ACME Email"
                  type="email"
                  placeholder="admin@example.com"
                  value={s.https_letsencrypt_email ?? ''}
                  onChange={(e) => setSettings({ ...s, https_letsencrypt_email: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Select
                  label="Challenge Type"
                  value={s.https_letsencrypt_challenge ?? (strategy === 'letsencrypt_dns' ? 'dns' : 'http')}
                  onChange={(e) => setSettings({ ...s, https_letsencrypt_challenge: e.target.value })}
                  options={[
                    { value: 'http', label: 'HTTP challenge' },
                    { value: 'dns', label: 'DNS challenge' },
                  ]}
                />
                <Input
                  label="DNS Provider"
                  placeholder="cloudflare, route53, porkbun..."
                  value={s.https_letsencrypt_dns_provider ?? ''}
                  onChange={(e) => setSettings({ ...s, https_letsencrypt_dns_provider: e.target.value })}
                />
              </div>
              <Input
                label="DNS API Token (optional)"
                type="password"
                placeholder={strategy === 'letsencrypt_dns' ? 'Provider API token' : 'Only needed for DNS challenge'}
                value={s.https_letsencrypt_dns_api_token ?? ''}
                onChange={(e) => setSettings({ ...s, https_letsencrypt_dns_api_token: e.target.value })}
              />
              <Alert type="info">
                {strategy === 'letsencrypt_http'
                  ? 'HTTP challenge is automatic when you use the bundled Caddy edge profile with a public hostname and ports 80/443 open.'
                  : 'DNS challenge settings are stored here, but actual issuance still depends on an ACME-capable DNS client or custom Caddy build at the edge.'}
              </Alert>
            </div>
          )}
          {strategy === 'uploaded' && (
            <Alert type="info">
              Upload PEM files below. SkyNet stores them under <code className="text-cyan-400">backend/data/certs/uploaded</code> so they can be reused by a custom edge or future direct TLS mode.
            </Alert>
          )}
        </div>
        <div className="mt-5 flex justify-end">
          <Button loading={saving} icon={saved ? CheckCircle : Save} onClick={handleSave}>
            {saved ? 'Saved!' : 'Save HTTPS Settings'}
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <p className="text-xs font-mono font-medium text-cyan-400 uppercase tracking-widest">Domains & Browser Trust</p>
          <p className="text-xs text-gray-500">Control which hosts may serve SkyNet and which browser origins may call the API.</p>
        </CardHeader>
        <div className="space-y-4">
          <MultilineField
            label="Allowed Domains"
            hint="Optional. One host per line. Leave empty to allow any host. Wildcards like *.skynet.tn are supported."
            placeholder={'skynet.tn\nadmin.skynet.tn\n*.trusted-edge.local'}
            value={listToText(s.allowed_domains)}
            onChange={(event) => setSettings({ ...s, allowed_domains: textToList(event.target.value) })}
          />
          <MultilineField
            label="CORS Allowed Origins"
            hint="One origin per line, for example https://admin.skynet.tn. Use * to allow any origin."
            placeholder={'https://skynet.tn\nhttps://admin.skynet.tn'}
            value={listToText(s.cors_allowed_origins)}
            onChange={(event) => setSettings({ ...s, cors_allowed_origins: textToList(event.target.value) })}
          />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <MultilineField
              label="Allowed Methods"
              hint="Use * to mirror all requested methods."
              placeholder={'GET\nPOST\nPUT\nDELETE'}
              rows={3}
              value={listToText(s.cors_allowed_methods)}
              onChange={(event) => setSettings({ ...s, cors_allowed_methods: textToList(event.target.value) })}
            />
            <MultilineField
              label="Allowed Headers"
              hint="Use * to mirror requested headers on preflight."
              placeholder={'Authorization\nContent-Type\nX-SkyNet-Key'}
              rows={3}
              value={listToText(s.cors_allowed_headers)}
              onChange={(event) => setSettings({ ...s, cors_allowed_headers: textToList(event.target.value) })}
            />
          </div>
          <Toggle
            label="Allow CORS credentials"
            description="Echo the request origin instead of * so authenticated browser requests remain valid."
            checked={!!s.cors_allow_credentials}
            onChange={(value) => setSettings({ ...s, cors_allow_credentials: value })}
          />
          <div className="flex justify-end">
            <Button loading={saving} icon={saved ? CheckCircle : Save} onClick={handleSave}>
              {saved ? 'Saved!' : 'Save Domain Policy'}
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <p className="text-xs font-mono font-medium text-cyan-400 uppercase tracking-widest">IP Policy & Rate Limits</p>
          <p className="text-xs text-gray-500">Apply coarse edge restrictions before the request enters auth, tracking, or gateway logic.</p>
        </CardHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <MultilineField
              label="IP Allowlist"
              hint="Optional. One IP or CIDR per line. When set, all other IPs are denied."
              placeholder={'10.0.0.0/24\n203.0.113.10'}
              value={listToText(s.network_ip_allowlist)}
              onChange={(event) => setSettings({ ...s, network_ip_allowlist: textToList(event.target.value) })}
            />
            <MultilineField
              label="IP Denylist"
              hint="One IP or CIDR per line. These requests are rejected before application processing."
              placeholder={'198.51.100.0/24\n203.0.113.55'}
              value={listToText(s.network_ip_denylist)}
              onChange={(event) => setSettings({ ...s, network_ip_denylist: textToList(event.target.value) })}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Input
              label="Default req/min"
              type="number"
              min="1"
              value={s.rate_limit_default_per_minute ?? 300}
              onChange={(event) => setSettings({ ...s, rate_limit_default_per_minute: Number(event.target.value) || 300 })}
            />
            <Input
              label="Track req/min"
              type="number"
              min="1"
              value={s.rate_limit_track_per_minute ?? 200}
              onChange={(event) => setSettings({ ...s, rate_limit_track_per_minute: Number(event.target.value) || 200 })}
            />
            <Input
              label="Auth req/min"
              type="number"
              min="1"
              value={s.rate_limit_auth_per_minute ?? 30}
              onChange={(event) => setSettings({ ...s, rate_limit_auth_per_minute: Number(event.target.value) || 30 })}
            />
            <Input
              label="Login req/min"
              type="number"
              min="1"
              value={s.rate_limit_auth_login_per_minute ?? 10}
              onChange={(event) => setSettings({ ...s, rate_limit_auth_login_per_minute: Number(event.target.value) || 10 })}
            />
          </div>
          <Alert type="info">
            These limits are now enforced from runtime settings using Redis-backed counters. Track routes, auth routes, and all other requests each use their own per-IP bucket.
          </Alert>
          <div className="flex justify-end">
            <Button loading={saving} icon={saved ? CheckCircle : Save} onClick={handleSave}>
              {saved ? 'Saved!' : 'Save Network Policy'}
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader action={<Button variant="ghost" size="sm" icon={RefreshCw} loading={loadingStatus} onClick={loadStatus}>Refresh</Button>}>
          <p className="text-xs font-mono font-medium text-cyan-400 uppercase tracking-widest">Certificate Files</p>
        </CardHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <AssetStatus label="Self-Signed Store" asset={status?.self_signed} />
            <AssetStatus label="Uploaded Store" asset={status?.uploaded} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              ['Certificate PEM', '.pem,.crt,.cer', certRef],
              ['Private Key PEM', '.pem,.key', keyRef],
              ['Chain PEM (optional)', '.pem,.crt,.cer', chainRef],
            ].map(([label, accept, refObj]) => (
              <div key={label} className="space-y-1.5">
                <label className="block text-xs text-gray-500 font-mono uppercase tracking-wider">{label}</label>
                <input ref={refObj} type="file" accept={accept} className="w-full border border-cyan-500/15 rounded-lg px-3 py-2 text-sm text-gray-200 font-mono file:mr-3 file:border-0 file:bg-cyan-500/10 file:px-2 file:py-1 file:text-cyan-300" style={{ background: 'rgba(0,0,0,0.6)' }} />
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon={FileUp} loading={uploading} onClick={handleUpload}>Upload Certificate</Button>
            <Button variant="secondary" icon={ShieldCheck} loading={generating} onClick={handleSelfSigned}>Generate Self-Signed</Button>
          </div>
          {message && <Alert type="success">{message}</Alert>}
          {error && <Alert type="danger">{error}</Alert>}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <p className="text-xs font-mono font-medium text-cyan-400 uppercase tracking-widest">Gateway Mode</p>
          <p className="text-xs text-gray-500">Route requests through SKYNET before origin and apply the new allow / challenge / block decision layer.</p>
        </CardHeader>
        <div className="space-y-4">
          <div className="divide-y divide-gray-800">
            <Toggle
              label="Enable reverse proxy mode"
              description="Turns on `/api/v1/gateway/proxy/*` forwarding to the configured upstream origin."
              checked={!!s.gateway_enabled}
              onChange={(value) => setSettings({ ...s, gateway_enabled: value })}
            />
            <Toggle
              label="Forward trusted IP headers"
              description="Add `X-Forwarded-*` headers to upstream requests so the origin can preserve client context."
              checked={!!s.gateway_forward_ip_headers}
              onChange={(value) => setSettings({ ...s, gateway_forward_ip_headers: value })}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Input
              label="Gateway Target Origin"
              placeholder="https://mouwaten.example.com"
              value={s.gateway_target_origin ?? ''}
              onChange={(e) => setSettings({ ...s, gateway_target_origin: e.target.value })}
            />
            <Input
              label="Gateway Timeout (ms)"
              type="number"
              min="1000"
              step="500"
              value={s.gateway_timeout_ms ?? 10000}
              onChange={(e) => setSettings({ ...s, gateway_timeout_ms: Number(e.target.value) || 10000 })}
            />
          </div>
          <Input
            label="Gateway Site ID (optional)"
            placeholder="Bind gateway requests to an existing site UUID for future analytics"
            value={s.gateway_site_id ?? ''}
            onChange={(e) => setSettings({ ...s, gateway_site_id: e.target.value })}
          />
          {gatewayStatus ? (
            <Alert type={gatewayStatus.upstream?.reachable ? 'success' : 'info'}>
              Gateway {gatewayStatus.configured ? 'configured' : 'not configured'}.
              {gatewayStatus.target_origin ? ` Target: ${gatewayStatus.target_origin}.` : ''}
              {gatewayStatus.upstream?.status_code ? ` Upstream status: ${gatewayStatus.upstream.status_code}.` : ''}
            </Alert>
          ) : null}
          <Alert type="info">
            Gateway requests inherit the Access & Network domain policy first: allowed domains, trusted proxy handling, IP allow/deny lists, and runtime rate limits all run before proxy forwarding.
          </Alert>
          <div className="flex justify-end">
            <Button loading={saving} icon={saved ? CheckCircle : Save} onClick={handleSave}>
              {saved ? 'Saved!' : 'Save Gateway Settings'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
