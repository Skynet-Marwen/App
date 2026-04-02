import { CheckCircle, Save, Activity, Cpu, Wrench } from 'lucide-react'

import { Badge, Button, Card, CardHeader, Input, Select, Toggle } from '../../components/ui'
import SettingsRoadmapCard from './SettingsRoadmapCard'

const TIMEZONE_OPTIONS = ['UTC', 'Europe/Paris', 'Europe/London', 'America/New_York', 'Asia/Tokyo']

export default function SystemDebugTab({ settings, setSettings, saving, savedKey, onSave }) {
  return (
    <div className="space-y-4">
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
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <p className="text-sm font-medium text-white">Operational Snapshot</p>
              <p className="mt-1 text-xs text-gray-500">A compact view of the system-facing controls in this domain.</p>
            </div>
          </CardHeader>
          <div className="space-y-3">
            <Metric icon={Activity} tone="text-cyan-300" label="Live monitoring" value={settings.realtime_enabled ? 'Enabled' : 'Disabled'} />
            <Metric icon={Cpu} tone="text-white" label="Instance name" value={settings.instance_name || 'Unnamed instance'} />
            <Metric icon={Wrench} tone="text-gray-300" label="Timezone" value={settings.timezone || 'UTC'} />
          </div>
        </Card>
      </div>

      <SettingsRoadmapCard
        eyebrow="Observability"
        title="System & Debug Organization"
        description="This area is reserved for runtime operations and diagnostics so future debug features stay separated from policy settings."
        groups={[
          {
            title: 'Diagnostics',
            items: [
              { label: 'Logs', status: 'planned', note: 'Central runtime and operator logs.' },
              { label: 'Debug mode', status: 'planned', note: 'Targeted deep diagnostics for support sessions.' },
              { label: 'Live monitoring', status: 'partial', note: 'Realtime runtime stream is already available.' },
            ],
          },
          {
            title: 'Platform Controls',
            items: [
              { label: 'Health check', status: 'partial', note: 'Platform health endpoint already exists.' },
              { label: 'Feature flags', status: 'planned', note: 'Controlled rollout of experimental capabilities.' },
              { label: 'Maintenance controls', status: 'planned', note: 'Safe operator tooling for lifecycle events.' },
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
