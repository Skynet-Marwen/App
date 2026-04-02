import { CheckCircle, Database, FolderArchive, Save } from 'lucide-react'

import { Badge, Button, Card, CardHeader } from '../../components/ui'
import BackupTab from './BackupTab'
import SettingsRoadmapCard from './SettingsRoadmapCard'

const RETENTION_SLIDERS = [
  { key: 'visitor_retention_days', label: 'Visitor logs retention', unit: 'days' },
  { key: 'event_retention_days', label: 'Event logs retention', unit: 'days' },
  { key: 'incident_retention_days', label: 'Incident logs retention', unit: 'days' },
]

export default function DataStorageTab({ settings, setSettings, saving, savedKey, onSave }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(320px,0.45fr)]">
        <Card>
          <CardHeader
            action={
              <div className="flex items-center gap-2">
                <Badge variant="info">Retention</Badge>
                <Button loading={saving} onClick={onSave} icon={savedKey === 'data' ? CheckCircle : Save}>
                  {savedKey === 'data' ? 'Saved!' : 'Save Retention'}
                </Button>
              </div>
            }
          >
            <div>
              <p className="text-sm font-medium text-white">Retention Policy</p>
              <p className="mt-1 text-xs text-gray-500">Define how long security telemetry stays hot before longer-term archive workflows take over.</p>
            </div>
          </CardHeader>

          <div className="space-y-4">
            {RETENTION_SLIDERS.map(({ key, label, unit }) => (
              <div key={key}>
                <div className="mb-1 flex items-center justify-between gap-3">
                  <label className="text-sm text-gray-300">{label}</label>
                  <span className="text-sm font-medium text-cyan-400">{settings[key] ?? 90} {unit}</span>
                </div>
                <input
                  type="range"
                  min={7}
                  max={365}
                  value={settings[key] ?? 90}
                  onChange={(event) => setSettings({ ...settings, [key]: Number(event.target.value) })}
                  className="w-full accent-cyan-500"
                />
              </div>
            ))}

            <label className="flex items-start gap-3 rounded-xl border border-cyan-500/10 bg-black/20 px-4 py-3">
              <input
                type="checkbox"
                checked={!!settings.anonymize_ips}
                onChange={(event) => setSettings({ ...settings, anonymize_ips: event.target.checked })}
                className="mt-1 accent-cyan-500"
              />
              <div>
                <p className="text-sm text-white">Anonymize IPs after retention</p>
                <p className="mt-1 text-xs text-gray-500">Reduce long-tail personal data exposure while preserving aggregate operational trends.</p>
              </div>
            </label>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <p className="text-sm font-medium text-white">Storage Snapshot</p>
              <p className="mt-1 text-xs text-gray-500">The storage domain now keeps policy, archive, and lifecycle concerns together.</p>
            </div>
          </CardHeader>
          <div className="space-y-3">
            <Metric icon={Database} tone="text-cyan-300" label="Retention model" value="Live" />
            <Metric icon={FolderArchive} tone="text-white" label="Selective backups" value="Live" />
          </div>
        </Card>
      </div>

      <SettingsRoadmapCard
        eyebrow="Storage Map"
        title="Data & Storage Organization"
        description="Retention stays operator-editable today, while performance, indexing, and lifecycle automation can land here cleanly later."
        groups={[
          {
            title: 'Database & Performance',
            items: [
              { label: 'Database performance', status: 'planned', note: 'Vacuum, query health, and tuning views.' },
              { label: 'Cache', status: 'planned', note: 'Retention-aware cache policies and pressure visibility.' },
              { label: 'Indexing', status: 'planned', note: 'Operational indexing controls for large deployments.' },
            ],
          },
          {
            title: 'Lifecycle',
            items: [
              { label: 'Archiving', status: 'planned', note: 'Cold storage or export workflows.' },
              { label: 'Purge rules', status: 'planned', note: 'Automatic lifecycle cleanup by data class.' },
              { label: 'Backups', status: 'live', note: 'Selective backup and restore already ship today.' },
            ],
          },
        ]}
      />

      <BackupTab />
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
