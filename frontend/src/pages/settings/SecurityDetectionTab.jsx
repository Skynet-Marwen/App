import { useMemo, useState } from 'react'
import { CheckCircle, Save, ShieldAlert, Sparkles, Waypoints } from 'lucide-react'

import { useAuthStore } from '../../store/useAppStore'
import { Badge, Button, Card, CardHeader, Input, SegmentedTabs, Select, Toggle } from '../../components/ui'
import SecurityCenterPanel from './SecurityCenterPanel'
import SettingsRoadmapCard from './SettingsRoadmapCard'

const DETECTION_TOGGLES = [
  { key: 'vpn_detection', label: 'VPN Detection', description: 'Flag VPN-style egress providers when network metadata supports it.' },
  { key: 'tor_detection', label: 'Tor Detection', description: 'Keep Tor detection enabled alongside the broader network policy hooks.' },
  { key: 'proxy_detection', label: 'Proxy Detection', description: 'Use upstream proxy signals when the GeoIP/network provider exposes them.' },
  { key: 'datacenter_detection', label: 'Datacenter Detection', description: 'Identify hosting/cloud traffic and apply the configured network policy.' },
  { key: 'timezone_mismatch', label: 'Timezone Mismatch', description: 'Raise incidents when browser offset and GeoIP timezone diverge beyond tolerance.' },
  { key: 'language_mismatch', label: 'Language Mismatch', description: 'Flag sessions whose browser locale region contradicts GeoIP country.' },
]

const DEVICE_IDENTITY_TOGGLES = [
  { key: 'canvas_fingerprint', label: 'Canvas Fingerprint', description: 'Collect browser canvas rendering entropy.' },
  { key: 'webgl_fingerprint', label: 'WebGL Fingerprint', description: 'Collect GPU/WebGL rendering entropy.' },
  { key: 'font_fingerprint', label: 'Font Fingerprint', description: 'Track font availability changes across sessions.' },
  { key: 'audio_fingerprint', label: 'Audio Fingerprint', description: 'Track AudioContext fingerprint drift.' },
]

const NETWORK_ACTION_OPTIONS = [
  { value: 'observe', label: 'Observe only' },
  { value: 'flag', label: 'Flag' },
  { value: 'challenge', label: 'Challenge' },
  { value: 'block', label: 'Block' },
]

const RISK_WEIGHT_FIELDS = [
  ['shared_device', 'Shared Device'],
  ['new_device', 'New Device'],
  ['geo_jump', 'Geo Jump'],
  ['tor_vpn', 'Tor / VPN'],
  ['multi_account', 'Multi Account'],
  ['behavior_drift', 'Behavior Drift'],
]

const SIGNAL_WEIGHT_FIELDS = [
  ['canvas_hash', 'Canvas'],
  ['webgl_hash', 'WebGL'],
  ['screen', 'Screen'],
  ['language', 'Language'],
  ['timezone', 'Timezone'],
  ['hardware_concurrency', 'CPU Threads'],
  ['device_memory', 'Device Memory'],
  ['platform', 'Platform'],
]

function commaSeparated(value) {
  if (Array.isArray(value)) return value.join(', ')
  return value || ''
}

export default function SecurityDetectionTab({
  settings,
  setSettings,
  securityConfig,
  setSecurityConfig,
  saving,
  savedKey,
  showFeatureStatusDetails,
  onSave,
}) {
  const isAdmin = useAuthStore((state) => ['admin', 'superadmin'].includes(state.user?.role))
  const [view, setView] = useState('controls')

  const runtimeWeights = settings.risk_modifier_weights || {}
  const fingerprintWeights = settings.fingerprint_signal_weights || {}
  const config = securityConfig || {}

  const setNumeric = (key, fallback = 0, parser = Number) => (event) => {
    const value = event.target.value
    const parsed = parser(value)
    setSettings({ ...settings, [key]: Number.isNaN(parsed) ? fallback : parsed })
  }

  const setRiskWeight = (key) => (event) => {
    const parsed = parseFloat(event.target.value)
    setSettings({
      ...settings,
      risk_modifier_weights: {
        ...runtimeWeights,
        [key]: Number.isNaN(parsed) ? 0 : parsed,
      },
    })
  }

  const setSignalWeight = (key) => (event) => {
    const parsed = parseFloat(event.target.value)
    setSettings({
      ...settings,
      fingerprint_signal_weights: {
        ...fingerprintWeights,
        [key]: Number.isNaN(parsed) ? 0 : parsed,
      },
    })
  }

  const setSecurityToggle = (key, value) => {
    setSecurityConfig({ ...config, [key]: value })
  }

  const coverageMetrics = useMemo(() => ([
    { icon: ShieldAlert, tone: 'text-green-300', label: 'Runtime rules', value: 'Risk, network, and edge policy live' },
    { icon: Sparkles, tone: 'text-cyan-300', label: 'Threat intelligence', value: 'STIE, DNSBL, provider and country heuristics live' },
    { icon: Waypoints, tone: 'text-yellow-300', label: 'Device identity', value: 'Fingerprint weights, clock skew, and mismatch tuning live' },
  ]), [])

  if (view === 'center') {
    return (
      <div className="space-y-4">
        <SegmentedTabs
          items={[
            { value: 'controls', label: 'Runtime Controls' },
            { value: 'center', label: 'Security Center' },
          ]}
          value={view}
          onChange={setView}
        />
        <SecurityCenterPanel isAdmin={isAdmin} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <SegmentedTabs
        items={[
          { value: 'controls', label: 'Runtime Controls' },
          { value: 'center', label: 'Security Center' },
        ]}
        value={view}
        onChange={setView}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(320px,0.45fr)]">
        <Card>
          <CardHeader
            action={
              <div className="flex items-center gap-2">
                <Badge variant="success">Unified posture</Badge>
                <Button loading={saving} onClick={onSave} icon={savedKey === 'security' ? CheckCircle : Save}>
                  {savedKey === 'security' ? 'Saved!' : 'Save Security'}
                </Button>
              </div>
            }
          >
            <div>
              <p className="text-sm font-medium text-white">Security Runtime Controls</p>
              <p className="mt-1 text-xs text-gray-500">
                This domain now owns runtime scoring, network intelligence policy, and device identity tuning in one place.
              </p>
            </div>
          </CardHeader>

          <div className="space-y-4">
            <div className="divide-y divide-cyan-500/10">
              <Toggle
                label="Auto-block Tor / VPN"
                description="When network intelligence confirms anonymized egress, edge policy can block immediately."
                checked={!!settings.auto_block_tor_vpn}
                onChange={(value) => setSettings({ ...settings, auto_block_tor_vpn: value })}
              />
              <Toggle
                label="Require Login for Tracking"
                description="Reduce anonymous noise by linking runtime tracking to authenticated sessions only."
                checked={!!settings.require_auth}
                onChange={(value) => setSettings({ ...settings, require_auth: value })}
              />
              <Toggle
                label="Enable Adaptive Defense Hook"
                description="Allow STIE to auto-block abusive sources when exploitation is strongly suspected."
                checked={!!settings.enable_auto_defense}
                onChange={(value) => setSettings({ ...settings, enable_auto_defense: value })}
              />
            </div>

            <div className="rounded-xl border border-cyan-500/10 bg-black/20 p-4">
              <p className="text-xs font-mono uppercase tracking-[0.18em] text-cyan-400">Network Intelligence Modules</p>
              <div className="mt-3 divide-y divide-gray-800">
                {DETECTION_TOGGLES.map(({ key, label, description }) => (
                  <Toggle
                    key={key}
                    label={label}
                    description={description}
                    checked={!!config[key]}
                    onChange={(value) => setSecurityToggle(key, value)}
                  />
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-cyan-500/10 bg-black/20 p-4">
              <p className="text-xs font-mono uppercase tracking-[0.18em] text-cyan-400">Device Identity Modules</p>
              <div className="mt-3 divide-y divide-gray-800">
                {DEVICE_IDENTITY_TOGGLES.map(({ key, label, description }) => (
                  <Toggle
                    key={key}
                    label={label}
                    description={description}
                    checked={!!config[key]}
                    onChange={(value) => setSecurityToggle(key, value)}
                  />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Input label="Intel Refresh Interval (hours)" type="number" min="1" value={settings.intel_refresh_interval_hours ?? 24} onChange={setNumeric('intel_refresh_interval_hours', 24)} />
              <Input label="Scan Interval (hours)" type="number" min="1" value={settings.scan_interval_hours ?? 12} onChange={setNumeric('scan_interval_hours', 12)} />
              <Input label="Max Scan Depth" type="number" min="1" max="25" value={settings.max_scan_depth ?? 8} onChange={setNumeric('max_scan_depth', 8)} />
              <Input label="Correlation Sensitivity" type="number" min="0.25" max="1.5" step="0.05" value={settings.correlation_sensitivity ?? 0.7} onChange={setNumeric('correlation_sensitivity', 0.7, parseFloat)} />
            </div>

            <div className="rounded-xl border border-cyan-500/10 bg-black/20 p-4 space-y-4">
              <div>
                <p className="text-xs font-mono uppercase tracking-[0.18em] text-cyan-400">Risk Thresholds & Weights</p>
                <p className="mt-1 text-xs text-gray-500">Automatic actions and user-level modifier weights are now configurable here.</p>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <Input label="Auto-Flag Threshold" type="number" min="0.1" max="1" step="0.05" value={settings.risk_auto_flag_threshold ?? 0.6} onChange={setNumeric('risk_auto_flag_threshold', 0.6, parseFloat)} />
                <Input label="Auto-Challenge Threshold" type="number" min="0.1" max="1" step="0.05" value={settings.risk_auto_challenge_threshold ?? 0.8} onChange={setNumeric('risk_auto_challenge_threshold', 0.8, parseFloat)} />
                <Input label="Auto-Block Threshold" type="number" min="0.1" max="1" step="0.05" value={settings.risk_auto_block_threshold ?? 0.95} onChange={setNumeric('risk_auto_block_threshold', 0.95, parseFloat)} />
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {RISK_WEIGHT_FIELDS.map(([key, label]) => (
                  <Input
                    key={key}
                    label={label}
                    type="number"
                    min="0"
                    max="1"
                    step="0.05"
                    value={runtimeWeights[key] ?? 0}
                    onChange={setRiskWeight(key)}
                  />
                ))}
              </div>
              <Toggle
                label="Enforce auto-block"
                description="Allow device and gateway flows to hard-block when the block threshold is crossed."
                checked={!!settings.risk_auto_block_enforced}
                onChange={(value) => setSettings({ ...settings, risk_auto_block_enforced: value })}
              />
            </div>

            <div className="rounded-xl border border-cyan-500/10 bg-black/20 p-4 space-y-4">
              <div>
                <p className="text-xs font-mono uppercase tracking-[0.18em] text-cyan-400">Network Policy Rules</p>
                <p className="mt-1 text-xs text-gray-500">These rules now feed both incident generation and edge decisions when configured for challenge or block.</p>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <Select label="Proxy Action" value={settings.network_proxy_action || 'observe'} onChange={(event) => setSettings({ ...settings, network_proxy_action: event.target.value })} options={NETWORK_ACTION_OPTIONS} />
                <Select label="VPN Action" value={settings.network_vpn_action || 'observe'} onChange={(event) => setSettings({ ...settings, network_vpn_action: event.target.value })} options={NETWORK_ACTION_OPTIONS} />
                <Select label="Datacenter Action" value={settings.network_datacenter_action || 'observe'} onChange={(event) => setSettings({ ...settings, network_datacenter_action: event.target.value })} options={NETWORK_ACTION_OPTIONS} />
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
                <Input
                  label="Country Watchlist"
                  placeholder="RU, CN, IR"
                  value={commaSeparated(settings.network_country_watchlist)}
                  onChange={(event) => setSettings({
                    ...settings,
                    network_country_watchlist: event.target.value.split(',').map((item) => item.trim().toUpperCase()).filter(Boolean),
                  })}
                />
                <Select label="Country Rule Action" value={settings.network_country_action || 'observe'} onChange={(event) => setSettings({ ...settings, network_country_action: event.target.value })} options={NETWORK_ACTION_OPTIONS} />
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
                <Input
                  label="Provider / ASN Keywords"
                  placeholder="aws, digitalocean, hetzner"
                  value={commaSeparated(settings.network_provider_watchlist)}
                  onChange={(event) => setSettings({
                    ...settings,
                    network_provider_watchlist: event.target.value.split(',').map((item) => item.trim().toLowerCase()).filter(Boolean),
                  })}
                />
                <Select label="Provider Rule Action" value={settings.network_provider_action || 'observe'} onChange={(event) => setSettings({ ...settings, network_provider_action: event.target.value })} options={NETWORK_ACTION_OPTIONS} />
              </div>
            </div>

            <div className="rounded-xl border border-cyan-500/10 bg-black/20 p-4 space-y-4">
              <div>
                <p className="text-xs font-mono uppercase tracking-[0.18em] text-cyan-400">Device Identity Tuning</p>
                <p className="mt-1 text-xs text-gray-500">Fingerprint confidence, stability, and clock-skew tuning can now be adjusted from Settings.</p>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <Input label="Clock Skew Tolerance (minutes)" type="number" min="0" step="15" value={settings.fingerprint_clock_skew_tolerance_minutes ?? 90} onChange={setNumeric('fingerprint_clock_skew_tolerance_minutes', 90)} />
                {SIGNAL_WEIGHT_FIELDS.slice(0, 2).map(([key, label]) => (
                  <Input key={key} label={`${label} Weight`} type="number" min="0" max="1" step="0.01" value={fingerprintWeights[key] ?? 0} onChange={setSignalWeight(key)} />
                ))}
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                {SIGNAL_WEIGHT_FIELDS.slice(2).map(([key, label]) => (
                  <Input key={key} label={`${label} Weight`} type="number" min="0" max="1" step="0.01" value={fingerprintWeights[key] ?? 0} onChange={setSignalWeight(key)} />
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-cyan-500/10 bg-black/25 p-4">
              <p className="text-xs font-mono uppercase tracking-[0.18em] text-gray-500">Safe Scanning Policy</p>
              <p className="mt-2 text-sm text-gray-300">
                STIE remains non-destructive: GET-based probing, header inspection, and response heuristics only. New edge network rules influence challenge/block posture without introducing active exploitation.
              </p>
            </div>
          </div>
        </Card>

        {showFeatureStatusDetails ? (
          <Card>
            <CardHeader>
              <div>
                <p className="text-sm font-medium text-white">Current Coverage</p>
                <p className="mt-1 text-xs text-gray-500">This section is now complete across scoring, network intelligence, and device identity.</p>
              </div>
            </CardHeader>

            <div className="space-y-3">
              {coverageMetrics.map(({ icon, tone, label, value }) => (
                <Metric key={label} icon={icon} tone={tone} label={label} value={value} />
              ))}
            </div>
          </Card>
        ) : null}
      </div>

      {showFeatureStatusDetails ? (
        <SettingsRoadmapCard
          eyebrow="Detection Map"
          title="Security & Detection Organization"
          description="Risk tuning, network intelligence, and device identity controls are now first-class settings instead of being split between isolated pages."
          groups={[
            {
              title: 'Risk & Automation',
              items: [
                { label: 'Risk thresholds', status: 'live', note: 'Auto-flag, auto-challenge, and auto-block score bands are configurable now.' },
                { label: 'Risk weights', status: 'live', note: 'User-level modifier weights can now be tuned from Settings.' },
                { label: 'Headless / behavior tracking', status: 'live', note: 'Headless, crawler, click-farm, and low-entropy behavior signals feed incidents.' },
                { label: 'Challenge (PoW)', status: 'live', note: 'Gateway challenge pages support proof-of-work, redirect, and honeypot flows.' },
                { label: 'Threat intelligence engine', status: 'live', note: 'External intel + safe scanner + recommendations are grouped in Security Center.' },
              ],
            },
            {
              title: 'Network & Identity',
              items: [
                { label: 'VPN / Proxy detection', status: 'live', note: 'Network-provider proxy/VPN signals now feed incidents and optional edge actions.' },
                { label: 'DNSBL reputation checks', status: 'live', note: 'Public DNS blocklists can challenge or block abusive IPs.' },
                { label: 'Datacenter ASN rules', status: 'live', note: 'Provider / ASN keyword watchlists and hosting heuristics are configurable now.' },
                { label: 'Geo rules', status: 'live', note: 'Country watchlists can now observe, flag, challenge, or block.' },
                { label: 'Fingerprint matching / grouping', status: 'live', note: 'Composite fingerprint scoring, signal weights, and drift tracking are active.' },
              ],
            },
          ]}
        />
      ) : null}
    </div>
  )
}

function Metric({ icon, tone, label, value }) {
  const IconComponent = icon

  return (
    <div className="rounded-xl border border-cyan-500/10 bg-black/25 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-gray-500">{label}</p>
        <IconComponent size={15} className={tone} />
      </div>
      <p className={`mt-2 text-sm font-medium ${tone}`}>{value}</p>
    </div>
  )
}
