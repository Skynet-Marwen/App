import { useState } from 'react'
import { CheckCircle, Save, ShieldAlert, Sparkles, Waypoints } from 'lucide-react'

import { useAuthStore } from '../../store/useAppStore'
import { Badge, Button, Card, CardHeader, Input, SegmentedTabs, Toggle } from '../../components/ui'
import SecurityCenterPanel from './SecurityCenterPanel'
import SettingsRoadmapCard from './SettingsRoadmapCard'

export default function SecurityDetectionTab({ settings, setSettings, saving, savedKey, onSave }) {
  const isAdmin = useAuthStore((state) => state.user?.role === 'admin')
  const [view, setView] = useState('controls')

  const setNumeric = (key, fallback = 0, parser = Number) => (event) => {
    const value = event.target.value
    const parsed = parser(value)
    setSettings({ ...settings, [key]: Number.isNaN(parsed) ? fallback : parsed })
  }

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

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,0.92fr)_minmax(320px,0.48fr)]">
        <Card>
          <CardHeader
            action={
              <div className="flex items-center gap-2">
                <Badge variant="warning">Detection posture</Badge>
                <Button loading={saving} onClick={onSave} icon={savedKey === 'security' ? CheckCircle : Save}>
                  {savedKey === 'security' ? 'Saved!' : 'Save Security'}
                </Button>
              </div>
            }
          >
            <div>
              <p className="text-sm font-medium text-white">Security Runtime Controls</p>
              <p className="mt-1 text-xs text-gray-500">
                Baseline detection controls now sit beside STIE scheduling, safe scanning depth, and adaptive defense posture.
              </p>
            </div>
          </CardHeader>

          <div className="divide-y divide-cyan-500/10">
            <Toggle
              label="Auto-block Tor / VPN"
              description="Use current network intelligence hooks to automatically challenge or block known anonymizers."
              checked={!!settings.auto_block_tor_vpn}
              onChange={(value) => setSettings({ ...settings, auto_block_tor_vpn: value })}
            />
            <Toggle
              label="Require Login for Tracking"
              description="Reduce anonymous signal noise by linking runtime tracking to authenticated sessions only."
              checked={!!settings.require_auth}
              onChange={(value) => setSettings({ ...settings, require_auth: value })}
            />
            <Toggle
              label="Enable Adaptive Defense Hook"
              description="Allow STIE to automatically block suspicious IPs when active exploitation is strongly suspected. Disabled by default."
              checked={!!settings.enable_auto_defense}
              onChange={(value) => setSettings({ ...settings, enable_auto_defense: value })}
            />
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
            <Input
              label="Intel Refresh Interval (hours)"
              type="number"
              min="1"
              value={settings.intel_refresh_interval_hours ?? 24}
              onChange={setNumeric('intel_refresh_interval_hours', 24)}
            />
            <Input
              label="Scan Interval (hours)"
              type="number"
              min="1"
              value={settings.scan_interval_hours ?? 12}
              onChange={setNumeric('scan_interval_hours', 12)}
            />
            <Input
              label="Max Scan Depth"
              type="number"
              min="1"
              max="25"
              value={settings.max_scan_depth ?? 8}
              onChange={setNumeric('max_scan_depth', 8)}
            />
            <Input
              label="Correlation Sensitivity"
              type="number"
              min="0.25"
              max="1.5"
              step="0.05"
              value={settings.correlation_sensitivity ?? 0.7}
              onChange={setNumeric('correlation_sensitivity', 0.7, parseFloat)}
            />
          </div>

          <div className="mt-5 rounded-xl border border-cyan-500/10 bg-black/20 p-4 space-y-4">
            <div>
              <p className="text-xs font-mono uppercase tracking-[0.18em] text-cyan-400">Risk Thresholds</p>
              <p className="mt-1 text-xs text-gray-500">Automatic actions now follow explicit score bands instead of hard-coded risk jumps.</p>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <Input
                label="Auto-Flag Threshold"
                type="number"
                min="0.1"
                max="1"
                step="0.05"
                value={settings.risk_auto_flag_threshold ?? 0.6}
                onChange={setNumeric('risk_auto_flag_threshold', 0.6, parseFloat)}
              />
              <Input
                label="Auto-Challenge Threshold"
                type="number"
                min="0.1"
                max="1"
                step="0.05"
                value={settings.risk_auto_challenge_threshold ?? 0.8}
                onChange={setNumeric('risk_auto_challenge_threshold', 0.8, parseFloat)}
              />
              <Input
                label="Auto-Block Threshold"
                type="number"
                min="0.1"
                max="1"
                step="0.05"
                value={settings.risk_auto_block_threshold ?? 0.95}
                onChange={setNumeric('risk_auto_block_threshold', 0.95, parseFloat)}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Input
                label="Clock Skew Tolerance (minutes)"
                type="number"
                min="0"
                step="15"
                value={settings.fingerprint_clock_skew_tolerance_minutes ?? 90}
                onChange={setNumeric('fingerprint_clock_skew_tolerance_minutes', 90)}
              />
              <div className="flex items-end">
                <Toggle
                  label="Enforce auto-block"
                  description="When enabled, device and gateway decisions can hard-block once the block threshold is crossed."
                  checked={!!settings.risk_auto_block_enforced}
                  onChange={(value) => setSettings({ ...settings, risk_auto_block_enforced: value })}
                />
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-cyan-500/10 bg-black/25 p-4">
            <p className="text-xs font-mono uppercase tracking-[0.18em] text-gray-500">Safe Scanning Policy</p>
            <p className="mt-2 text-sm text-gray-300">
              STIE uses non-destructive GET-based probes, header inspection, and response heuristics only. It is designed to surface exposure without
              performing aggressive exploitation.
            </p>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <p className="text-sm font-medium text-white">Current Coverage</p>
              <p className="mt-1 text-xs text-gray-500">What is live now versus what this domain is preparing for.</p>
            </div>
          </CardHeader>

          <div className="space-y-3">
            <Metric icon={ShieldAlert} tone="text-yellow-300" label="Runtime rules" value="Baseline toggles live" />
            <Metric icon={Sparkles} tone="text-cyan-300" label="Threat intelligence" value="STIE live in Security Center" />
            <Metric icon={Waypoints} tone="text-gray-300" label="Risk engine" value="Correlated finding scores active" />
          </div>
        </Card>
      </div>

      <SettingsRoadmapCard
        eyebrow="Detection Map"
        title="Security & Detection Organization"
        description="This domain is now split by signal source so future controls can grow without turning settings into one long list again."
        groups={[
          {
            title: 'Risk & Automation',
            items: [
              { label: 'Risk thresholds', status: 'live', note: 'Auto-flag, auto-challenge, and auto-block score bands are configurable now.' },
              { label: 'Risk weights', status: 'planned', note: 'Signal weighting by source and severity.' },
              { label: 'Headless / behavior tracking', status: 'live', note: 'Headless, crawler, click-farm, and low-entropy behavior signals now feed incidents.' },
              { label: 'Challenge (PoW)', status: 'live', note: 'Gateway challenge pages now support proof-of-work, redirect, and honeypot flows.' },
              { label: 'Threat intelligence engine', status: 'live', note: 'External intel + safe scanner + recommendations are now grouped in Security Center.' },
            ],
          },
          {
            title: 'Network & Identity',
            items: [
              { label: 'VPN / Proxy detection', status: 'partial', note: 'Current auto-block toggle is live.' },
              { label: 'DNSBL reputation checks', status: 'live', note: 'Public DNS blocklists can now challenge or block abusive IPs.' },
              { label: 'Datacenter ASN rules', status: 'planned', note: 'Provider and ASN policy controls.' },
              { label: 'Geo rules', status: 'planned', note: 'Country and region-aware policy tuning.' },
              { label: 'Fingerprint matching / grouping', status: 'live', note: 'Composite fingerprint scoring and drift tracking are already active.' },
            ],
          },
        ]}
      />
    </div>
  )
}

function Metric({ icon: Icon, tone, label, value }) {
  return (
    <div className="rounded-xl border border-cyan-500/10 bg-black/25 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-gray-500">{label}</p>
        <Icon size={15} className={tone} />
      </div>
      <p className={`mt-2 text-sm font-medium ${tone}`}>{value}</p>
    </div>
  )
}
