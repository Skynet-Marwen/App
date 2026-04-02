import { useEffect, useState } from 'react'
import { Save, CheckCircle, Plus, Trash2 } from 'lucide-react'
import { Alert, Card, CardHeader, Button, Input, Toggle } from '../../components/ui/index'
import { identityApi, settingsApi } from '../../services/api'
import AuthOperatorsPanel from './AuthOperatorsPanel'

const EMPTY_PROVIDER = {
  name: '',
  enabled: true,
  jwks_url: '',
  issuer: '',
  audience: '',
  cache_ttl_sec: 300,
}

export default function AuthTab({ settings, setSettings }) {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncStatus, setSyncStatus] = useState(null)
  const [syncError, setSyncError] = useState('')
  const [syncMessage, setSyncMessage] = useState('')

  const s = settings
  const providers = Array.isArray(s.idp_providers) && s.idp_providers.length
    ? s.idp_providers
    : (s.keycloak_enabled || s.keycloak_jwks_url
        ? [{
            name: 'keycloak',
            enabled: !!s.keycloak_enabled,
            jwks_url: s.keycloak_jwks_url ?? '',
            issuer: s.keycloak_issuer ?? '',
            audience: s.keycloak_audience ?? '',
            cache_ttl_sec: s.keycloak_cache_ttl_sec ?? 300,
          }]
        : [])

  const updateProviders = (nextProviders) => {
    setSettings({ ...s, idp_providers: nextProviders })
  }

  const loadSyncStatus = async () => {
    try {
      const res = await identityApi.keycloakSyncStatus()
      setSyncStatus(res.data)
    } catch (_) {
      setSyncStatus(null)
    }
  }

  useEffect(() => {
    loadSyncStatus()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await settingsApi.update(s)
      setSettings(res.data)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      await loadSyncStatus()
    } finally {
      setSaving(false)
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    setSyncError('')
    setSyncMessage('')
    try {
      const saveRes = await settingsApi.update(s)
      setSettings(saveRes.data)
      const res = await identityApi.syncKeycloakUsers()
      setSyncStatus((prev) => ({ ...(prev || {}), last_summary: res.data, last_run_at: res.data.synced_at }))
      setSyncMessage(`Fetched ${res.data.fetched} Keycloak users from realm ${res.data.realm}.`)
    } catch (err) {
      setSyncError(err?.response?.data?.detail || err?.message || 'Failed to sync Keycloak users')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="space-y-4">

      {/* ── Password Policy ──────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <p className="text-xs font-mono font-medium text-cyan-400 uppercase tracking-widest">Password Policy</p>
          <p className="text-xs text-gray-500">Applied to SkyNet operator accounts on creation and reset</p>
        </CardHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-48">
              <label className="block text-xs text-gray-500 font-mono uppercase tracking-wider mb-1">
                Min Length
              </label>
              <div className="flex items-center gap-3">
                <input type="range" min={6} max={32}
                  value={s.auth_password_min_length ?? 8}
                  onChange={(e) => setSettings({ ...s, auth_password_min_length: Number(e.target.value) })}
                  className="flex-1 accent-cyan-500" />
                <span className="text-sm text-cyan-400 font-mono w-6 text-right">
                  {s.auth_password_min_length ?? 8}
                </span>
              </div>
            </div>
          </div>
          <div className="divide-y divide-gray-800">
            <Toggle label="Require uppercase letter" checked={!!s.auth_password_require_uppercase}
              onChange={(v) => setSettings({ ...s, auth_password_require_uppercase: v })} />
            <Toggle label="Require number" checked={!!s.auth_password_require_numbers}
              onChange={(v) => setSettings({ ...s, auth_password_require_numbers: v })} />
            <Toggle label="Require symbol" checked={!!s.auth_password_require_symbols}
              onChange={(v) => setSettings({ ...s, auth_password_require_symbols: v })} />
          </div>
        </div>
      </Card>

      {/* ── Session Settings ─────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <p className="text-xs font-mono font-medium text-cyan-400 uppercase tracking-widest">Session Settings</p>
        </CardHeader>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="flex justify-between mb-1">
              <label className="text-xs text-gray-500 font-mono uppercase tracking-wider">JWT Expiry</label>
              <span className="text-xs text-cyan-400 font-mono">
                {s.auth_jwt_expire_minutes ?? 1440} min
                ({Math.round((s.auth_jwt_expire_minutes ?? 1440) / 60)}h)
              </span>
            </div>
            <input type="range" min={30} max={10080} step={30}
              value={s.auth_jwt_expire_minutes ?? 1440}
              onChange={(e) => setSettings({ ...s, auth_jwt_expire_minutes: Number(e.target.value) })}
              className="w-full accent-cyan-500" />
          </div>
          <div>
            <div className="flex justify-between mb-1">
              <label className="text-xs text-gray-500 font-mono uppercase tracking-wider">Max Sessions / User</label>
              <span className="text-xs text-cyan-400 font-mono">{s.auth_max_sessions ?? 5}</span>
            </div>
            <input type="range" min={1} max={20}
              value={s.auth_max_sessions ?? 5}
              onChange={(e) => setSettings({ ...s, auth_max_sessions: Number(e.target.value) })}
              className="w-full accent-cyan-500" />
          </div>
        </div>
      </Card>

      {/* ── External JWT Providers (end-user IdP, not for operators) ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-mono font-medium text-cyan-400 uppercase tracking-widest">External JWT Providers</p>
              <p className="text-xs text-gray-500">
                Configure one or more JWKS-backed identity providers for `/identity/link` and `/track/activity`.
                SKYNET operators still authenticate locally.
              </p>
            </div>
            <Button
              variant="secondary"
              icon={Plus}
              onClick={() => updateProviders([...(providers || []), { ...EMPTY_PROVIDER }])}
            >
              Add Provider
            </Button>
          </div>
        </CardHeader>
        <div className="space-y-4">
          {providers.length === 0 ? (
            <div className="rounded-xl border border-dashed border-cyan-500/15 bg-black/20 px-4 py-5 text-sm text-gray-400">
              No external provider configured yet. Add one to validate end-user JWTs from Keycloak, Google, GitHub, or any JWKS-backed OIDC issuer.
            </div>
          ) : providers.map((provider, index) => (
            <div key={`${provider.name || 'provider'}-${index}`} className="rounded-xl border border-cyan-500/10 bg-black/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-white">Provider {index + 1}</p>
                <Button
                  variant="ghost"
                  icon={Trash2}
                  onClick={() => updateProviders(providers.filter((_, itemIndex) => itemIndex !== index))}
                >
                  Remove
                </Button>
              </div>
              <div className="mt-4 space-y-3">
                <Toggle
                  label="Enabled"
                  description="Only enabled providers participate in JWT validation."
                  checked={provider.enabled !== false}
                  onChange={(value) => updateProviders(providers.map((item, itemIndex) => itemIndex === index ? { ...item, enabled: value } : item))}
                />
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <Input
                    label="Provider Name"
                    placeholder="google"
                    value={provider.name ?? ''}
                    onChange={(e) => updateProviders(providers.map((item, itemIndex) => itemIndex === index ? { ...item, name: e.target.value } : item))}
                  />
                  <Input
                    label="Cache TTL (sec)"
                    type="number"
                    min="60"
                    value={provider.cache_ttl_sec ?? 300}
                    onChange={(e) => updateProviders(providers.map((item, itemIndex) => itemIndex === index ? { ...item, cache_ttl_sec: Number(e.target.value) || 300 } : item))}
                  />
                </div>
                <Input
                  label="JWKS URL"
                  placeholder="https://issuer.example/.well-known/jwks.json"
                  value={provider.jwks_url ?? ''}
                  onChange={(e) => updateProviders(providers.map((item, itemIndex) => itemIndex === index ? { ...item, jwks_url: e.target.value } : item))}
                />
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <Input
                    label="Issuer (iss claim)"
                    placeholder="https://issuer.example"
                    value={provider.issuer ?? ''}
                    onChange={(e) => updateProviders(providers.map((item, itemIndex) => itemIndex === index ? { ...item, issuer: e.target.value } : item))}
                  />
                  <Input
                    label="Audience (optional)"
                    placeholder="skynet-api"
                    value={provider.audience ?? ''}
                    onChange={(e) => updateProviders(providers.map((item, itemIndex) => itemIndex === index ? { ...item, audience: e.target.value } : item))}
                  />
                </div>
              </div>
            </div>
          ))}
          <p className="text-xs text-gray-500">
            Legacy single-provider Keycloak settings are still honored, but new work should use the provider list above so multiple IdPs stay coordinated on the page.
          </p>
        </div>
        <div className="mt-5 rounded-xl border border-cyan-500/10 bg-black/20 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-mono font-medium text-cyan-400 uppercase tracking-widest">Keycloak Realm Sync</p>
              <p className="mt-1 text-xs text-gray-500">
                Import users from a Keycloak realm into SKYNET `user_profiles` even before they hit `/identity/link`.
              </p>
            </div>
            <Button variant="secondary" onClick={handleSync} loading={syncing}>
              Sync Now
            </Button>
          </div>
          <div className="mt-4 divide-y divide-cyan-500/10">
            <Toggle
              label="Enable Keycloak sync"
              description="Turns on realm user ingestion through the Keycloak Admin API."
              checked={!!s.keycloak_sync_enabled}
              onChange={(value) => setSettings({ ...s, keycloak_sync_enabled: value })}
            />
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <Input
              label="Base URL"
              placeholder="https://keycloak.example.com"
              value={s.keycloak_sync_base_url ?? ''}
              onChange={(e) => setSettings({ ...s, keycloak_sync_base_url: e.target.value })}
            />
            <Input
              label="Auth Realm"
              placeholder="master"
              value={s.keycloak_sync_auth_realm ?? ''}
              onChange={(e) => setSettings({ ...s, keycloak_sync_auth_realm: e.target.value })}
            />
            <Input
              label="Target Realm"
              placeholder="mouwaten"
              value={s.keycloak_sync_realm ?? ''}
              onChange={(e) => setSettings({ ...s, keycloak_sync_realm: e.target.value })}
            />
            <Input
              label="Client ID"
              placeholder="admin-cli"
              value={s.keycloak_sync_client_id ?? 'admin-cli'}
              onChange={(e) => setSettings({ ...s, keycloak_sync_client_id: e.target.value })}
            />
            <Input
              label="Client Secret"
              type="password"
              placeholder="optional if using admin username/password"
              value={s.keycloak_sync_client_secret ?? ''}
              onChange={(e) => setSettings({ ...s, keycloak_sync_client_secret: e.target.value })}
            />
            <Input
              label="Admin Username"
              placeholder="optional"
              value={s.keycloak_sync_username ?? ''}
              onChange={(e) => setSettings({ ...s, keycloak_sync_username: e.target.value })}
            />
            <Input
              label="Admin Password"
              type="password"
              placeholder="optional"
              value={s.keycloak_sync_password ?? ''}
              onChange={(e) => setSettings({ ...s, keycloak_sync_password: e.target.value })}
            />
            <Input
              label="User Limit"
              type="number"
              min="1"
              value={s.keycloak_sync_user_limit ?? 500}
              onChange={(e) => setSettings({ ...s, keycloak_sync_user_limit: Number(e.target.value) || 500 })}
            />
          </div>
          {syncStatus?.last_summary ? (
            <div className="mt-4 rounded-lg border border-cyan-500/10 bg-black/25 px-3 py-3 text-xs font-mono text-gray-300">
              Last sync: {syncStatus.last_summary.synced_at || syncStatus.last_run_at || '—'}
              <br />
              Auth realm: {syncStatus.last_summary.auth_realm || syncStatus.auth_realm || syncStatus.realm || '—'} · target realm: {syncStatus.last_summary.realm || syncStatus.realm || '—'} · fetched {syncStatus.last_summary.fetched ?? 0} · created {syncStatus.last_summary.created ?? 0} · updated {syncStatus.last_summary.updated ?? 0}
            </div>
          ) : null}
          {syncMessage ? <Alert type="success">{syncMessage}</Alert> : null}
          {syncError ? <Alert type="danger">{syncError}</Alert> : null}
        </div>
        <div className="mt-5 flex justify-end">
          <Button loading={saving} icon={saved ? CheckCircle : Save} onClick={handleSave}>
            {saved ? 'Saved!' : 'Save Auth Settings'}
          </Button>
        </div>
      </Card>

      {/* ── Operators List ───────────────────────────────────────── */}
      <AuthOperatorsPanel />

    </div>
  )
}
