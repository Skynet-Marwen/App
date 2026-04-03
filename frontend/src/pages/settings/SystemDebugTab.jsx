import { useEffect, useState } from 'react'
import { CheckCircle, RefreshCw, RotateCcw, Save, Activity, Cpu, Wrench } from 'lucide-react'

import { Alert, Badge, Button, Card, CardHeader, Input, Select, Toggle } from '../../components/ui'
import { systemApi } from '../../services/api'
import { mergeUiVisibility } from '../../services/uiVisibility'
import SettingsRoadmapCard from './SettingsRoadmapCard'

const TIMEZONE_OPTIONS = ['UTC', 'Europe/Paris', 'Europe/London', 'America/New_York', 'Asia/Tokyo']

export default function SystemDebugTab({ settings, setSettings, saving, savedKey, onSave, showFeatureStatusDetails }) {
  const [diagnostics, setDiagnostics] = useState(null)
  const [loadingDiagnostics, setLoadingDiagnostics] = useState(true)
  const [busyAction, setBusyAction] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    refreshDiagnostics()
  }, [])

  async function refreshDiagnostics() {
    setLoadingDiagnostics(true)
    setError('')
    try {
      const res = await systemApi.diagnostics()
      setDiagnostics(res.data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load diagnostics')
    } finally {
      setLoadingDiagnostics(false)
    }
  }

  async function runMaintenance(action) {
    setBusyAction(action)
    setError('')
    setMessage('')
    try {
      const response =
        action === 'reload'
          ? await systemApi.reloadRuntime()
          : await systemApi.resetOnboarding()
      setMessage(response.data?.message || 'System maintenance completed.')
      await refreshDiagnostics()
    } catch (err) {
      setError(err.response?.data?.detail || 'Maintenance action failed')
    } finally {
      setBusyAction('')
    }
  }

  const featureFlags = settings.feature_flags || {}
  const uiVisibility = mergeUiVisibility(settings.ui_visibility)

  const updateUiVisibility = (group, key, value) => {
    setSettings({
      ...settings,
      ui_visibility: {
        ...uiVisibility,
        [group]: {
          ...uiVisibility[group],
          [key]: value,
        },
      },
    })
  }

  return (
    <div className="space-y-4">
      {message ? <Alert type="success">{message}</Alert> : null}
      {error ? <Alert type="danger">{error}</Alert> : null}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(320px,0.45fr)]">
        <Card>
          <CardHeader
            action={
              <div className="flex items-center gap-2">
                <Badge variant="info">Runtime</Badge>
                <Button loading={saving} onClick={onSave} icon={savedKey === 'system' ? CheckCircle : Save}>
                  {savedKey === 'system' ? 'Saved!' : 'Save Runtime'}
                </Button>
              </div>
            }
          >
            <div>
              <p className="text-sm font-medium text-white">Instance Runtime</p>
              <p className="mt-1 text-xs text-gray-500">
                Core deployment metadata and shell-level runtime behavior live here instead of being mixed into unrelated settings.
              </p>
            </div>
          </CardHeader>

            <div className="space-y-4">
            <Input
              label="Instance Name"
              placeholder="My SkyNet Instance"
              value={settings.instance_name ?? ''}
              onChange={(event) => setSettings({ ...settings, instance_name: event.target.value })}
            />
            <Select
              label="Default Timezone"
              value={settings.timezone ?? 'UTC'}
              onChange={(event) => setSettings({ ...settings, timezone: event.target.value })}
              options={TIMEZONE_OPTIONS.map((timezone) => ({ value: timezone, label: timezone }))}
            />
            <div className="divide-y divide-cyan-500/10">
              <Toggle
                label="Real-time Tracking"
                description="Enable live visitor tracking updates for the dashboard runtime."
                checked={!!settings.realtime_enabled}
                onChange={(value) => setSettings({ ...settings, realtime_enabled: value })}
              />
              <Toggle
                label="Developer Mode"
                description="Enable deeper diagnostics, support-oriented debug panels, and experimental runtime tooling."
                checked={!!settings.developer_mode_enabled}
                onChange={(value) => setSettings({ ...settings, developer_mode_enabled: value })}
              />
            </div>

            <div className="space-y-3 rounded-xl border border-cyan-500/10 bg-black/20 p-4">
              <div>
                <p className="text-xs font-mono uppercase tracking-widest text-cyan-400">Feature Flags</p>
                <p className="mt-1 text-xs text-gray-500">Roll out developer and maintenance features without changing the wider policy surface.</p>
              </div>
              {[
                ['advanced_diagnostics', 'Advanced Diagnostics', 'Expose deeper runtime panels and support details.'],
                ['maintenance_console', 'Maintenance Console', 'Enable runtime reload and onboarding reset tooling.'],
                ['response_ladder', 'Response Ladder', 'Keep advanced blocking/response controls visible in operator settings.'],
              ].map(([key, label, description]) => (
                <Toggle
                  key={key}
                  label={label}
                  description={description}
                  checked={!!featureFlags[key]}
                  onChange={(value) =>
                    setSettings({
                      ...settings,
                      feature_flags: {
                        ...featureFlags,
                        [key]: value,
                      },
                    })
                  }
                />
              ))}
            </div>

            <div className="space-y-3 rounded-xl border border-cyan-500/10 bg-black/20 p-4">
              <div>
                <p className="text-xs font-mono uppercase tracking-widest text-cyan-400">UI Surface Controls</p>
                <p className="mt-1 text-xs text-gray-500">
                  Use developer mode to hide or reveal advanced cards, status surfaces, and navigation entries without editing themes or routes.
                </p>
              </div>

              {!settings.developer_mode_enabled ? (
                <Alert type="warning">Enable Developer Mode to manage advanced UI visibility from this panel.</Alert>
              ) : null}

              <div className="space-y-2 rounded-xl border border-cyan-500/10 bg-black/25 p-3">
                <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-cyan-300">Settings</p>
                <Toggle
                  label="Feature Status Summary"
                  description="Show or hide the coordinated product state card at the top of Settings."
                  checked={!!uiVisibility.settings.feature_status_summary}
                  onChange={(value) => updateUiVisibility('settings', 'feature_status_summary', value)}
                  disabled={!settings.developer_mode_enabled}
                />
                <Toggle
                  label="Feature Planning Cards"
                  description="Show or hide the live / partial / planned details, capability chips, and roadmap cards across Settings."
                  checked={!!uiVisibility.settings.feature_status_details}
                  onChange={(value) => updateUiVisibility('settings', 'feature_status_details', value)}
                  disabled={!settings.developer_mode_enabled}
                />
              </div>

              <div className="space-y-2 rounded-xl border border-cyan-500/10 bg-black/25 p-3">
                <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-cyan-300">Overview Cards</p>
                {[
                  ['realtime_banner', 'Realtime Banner', 'Top live socket banner with active visitor pressure.'],
                  ['stat_cards', 'Stat Cards', 'Primary dashboard totals for visitors, users, devices, blocking, evasion, and spam.'],
                  ['traffic_heatmap', 'Traffic Heatmap', 'Traffic intensity chart on the overview surface.'],
                  ['threat_hotspots', 'Threat Hotspots', 'Country and reason hotspot card.'],
                  ['enforcement_pressure', 'Enforcement Pressure', 'Response mix and protection pressure summary.'],
                  ['gateway_operations', 'Gateway Operations', 'Proxy decision, latency, and gateway analytics card.'],
                  ['risk_leaderboard', 'Risk Leaderboard', 'Highest-risk visitors and identities card.'],
                  ['priority_investigations', 'Priority Investigations', 'Investigation queue card for suspicious entities.'],
                ].map(([key, label, description]) => (
                  <Toggle
                    key={key}
                    label={label}
                    description={description}
                    checked={!!uiVisibility.overview[key]}
                    onChange={(value) => updateUiVisibility('overview', key, value)}
                    disabled={!settings.developer_mode_enabled}
                  />
                ))}
              </div>

              <div className="space-y-2 rounded-xl border border-cyan-500/10 bg-black/25 p-3">
                <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-cyan-300">Sidebar Menu</p>
                {[
                  ['overview', 'Overview', 'Keep the dashboard entry visible in the main navigation.'],
                  ['visitors', 'Visitors', 'Show or hide the visitor exploration surface.'],
                  ['users', 'Portal Users', 'Control visibility of the synced user directory.'],
                  ['devices', 'Devices', 'Toggle the device intelligence screen in the sidebar.'],
                  ['blocking', 'Blocking', 'Show or hide the blocking operations section.'],
                  ['anti-evasion', 'Anti-Evasion', 'Control access to anti-evasion incidents and tuning.'],
                  ['audit', 'Audit', 'Show or hide the operator audit trail surface.'],
                  ['integration', 'Integration', 'Toggle the integration management surface in the sidebar.'],
                  ['settings', 'Settings', 'Show or hide the settings entry for non-direct navigation.'],
                ].map(([key, label, description]) => (
                  <Toggle
                    key={key}
                    label={label}
                    description={description}
                    checked={!!uiVisibility.navigation[key]}
                    onChange={(value) => updateUiVisibility('navigation', key, value)}
                    disabled={!settings.developer_mode_enabled}
                  />
                ))}
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader action={<Button variant="secondary" size="sm" icon={RefreshCw} loading={loadingDiagnostics} onClick={refreshDiagnostics}>Refresh</Button>}>
            <div>
              <p className="text-sm font-medium text-white">Operational Snapshot</p>
              <p className="mt-1 text-xs text-gray-500">A compact view of the system-facing controls in this domain.</p>
            </div>
          </CardHeader>
          <div className="space-y-3">
            <Metric icon={Activity} tone="text-cyan-300" label="Live monitoring" value={settings.realtime_enabled ? 'Enabled' : 'Disabled'} />
            <Metric icon={Cpu} tone="text-white" label="Instance name" value={settings.instance_name || 'Unnamed instance'} />
            <Metric icon={Wrench} tone="text-gray-300" label="Timezone" value={settings.timezone || 'UTC'} />
            <Metric icon={Wrench} tone="text-yellow-300" label="Developer mode" value={settings.developer_mode_enabled ? 'Enabled' : 'Disabled'} />
            <Metric icon={Activity} tone={diagnostics?.health?.database === 'ok' ? 'text-green-300' : 'text-red-300'} label="Health" value={diagnostics ? `DB ${diagnostics.health.database} · Redis ${diagnostics.health.redis}` : 'Loading…'} />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(360px,0.55fr)]">
        <Card>
          <CardHeader>
            <div>
              <p className="text-sm font-medium text-white">Diagnostics & Logs</p>
              <p className="mt-1 text-xs text-gray-500">Live health, inventory, and recent operator activity for support sessions.</p>
            </div>
          </CardHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <Metric icon={Activity} tone="text-green-300" label="API" value={diagnostics?.health?.api || '—'} />
              <Metric icon={Cpu} tone={diagnostics?.health?.database === 'ok' ? 'text-green-300' : 'text-red-300'} label="Database" value={diagnostics?.health?.database || '—'} />
              <Metric icon={Wrench} tone={diagnostics?.health?.redis === 'ok' ? 'text-green-300' : 'text-red-300'} label="Redis" value={diagnostics?.health?.redis || '—'} />
              <Metric icon={Cpu} tone="text-cyan-300" label="Backups" value={`${diagnostics?.inventory?.backups ?? 0}`} />
            </div>

            <div className="rounded-xl border border-cyan-500/10 bg-black/25 p-4">
              <p className="text-xs font-mono uppercase tracking-widest text-cyan-400">Recent Audit</p>
              <div className="mt-3 space-y-2">
                {(diagnostics?.recent_audit || []).length === 0 ? (
                  <p className="text-xs text-gray-500">{loadingDiagnostics ? 'Loading audit trail…' : 'No recent audit events.'}</p>
                ) : (
                  diagnostics.recent_audit.map((item) => (
                    <div key={item.id} className="rounded-lg border border-cyan-500/10 bg-black/30 px-3 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-mono text-white">{item.action}</p>
                        <span className="text-[10px] text-gray-500">{new Date(item.created_at).toLocaleString()}</span>
                      </div>
                      <p className="mt-1 text-[11px] text-gray-400">
                        {item.target_type || 'system'} {item.target_id ? `· ${item.target_id}` : ''}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <p className="text-sm font-medium text-white">Maintenance Controls</p>
              <p className="mt-1 text-xs text-gray-500">Safe operator actions for runtime recovery and onboarding lifecycle.</p>
            </div>
          </CardHeader>
          <div className="space-y-3">
            <Button variant="secondary" icon={RefreshCw} loading={busyAction === 'reload'} onClick={() => runMaintenance('reload')}>
              Reload Runtime Cache
            </Button>
            <Button variant="secondary" icon={RotateCcw} loading={busyAction === 'onboarding'} onClick={() => runMaintenance('onboarding')}>
              Reset Onboarding Wizard
            </Button>
            <div className="rounded-xl border border-cyan-500/10 bg-black/25 p-4">
              <p className="text-xs font-mono uppercase tracking-widest text-cyan-400">Inventory</p>
              <p className="mt-2 text-xs text-gray-400">Sites {diagnostics?.inventory?.sites ?? 0} · Themes {diagnostics?.inventory?.themes ?? 0} · Operators {diagnostics?.inventory?.operators ?? 0}</p>
              <p className="mt-1 text-xs text-gray-500">
                Latest backup: {diagnostics?.inventory?.latest_backup?.filename || 'No archives yet'}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {showFeatureStatusDetails ? (
        <SettingsRoadmapCard
          eyebrow="Observability"
          title="System & Debug Organization"
          description="Runtime diagnostics, developer flags, maintenance tooling, and audit visibility now live together in one support-facing operations surface."
          groups={[
            {
              title: 'Diagnostics',
              items: [
                { label: 'Logs', status: 'live', note: 'Recent operator audit activity is now visible directly inside the system settings surface.' },
                { label: 'Debug mode', status: 'live', note: 'Developer mode and advanced diagnostics flags now support deeper support sessions.' },
                { label: 'Live monitoring', status: 'live', note: 'Realtime state, health, and runtime inventory now refresh from live diagnostics.' },
              ],
            },
            {
              title: 'Platform Controls',
              items: [
                { label: 'Health check', status: 'live', note: 'Detailed API, database, and Redis health now surfaces in the System & Debug panel.' },
                { label: 'Feature flags', status: 'live', note: 'Runtime feature flags now persist from settings and support staged rollout of support tooling.' },
                { label: 'Maintenance controls', status: 'live', note: 'Operators can now reload runtime configuration and reset onboarding from a dedicated maintenance card.' },
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
