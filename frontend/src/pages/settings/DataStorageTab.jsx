import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle, Database, FolderArchive, HardDriveDownload, RefreshCw, Save, Trash2 } from 'lucide-react'

import { Alert, Badge, Button, Card, CardHeader } from '../../components/ui'
import { settingsApi } from '../../services/api'
import BackupTab from './BackupTab'
import SettingsRoadmapCard from './SettingsRoadmapCard'

const RETENTION_SLIDERS = [
  { key: 'visitor_retention_days', label: 'Visitor logs retention', unit: 'days' },
  { key: 'event_retention_days', label: 'Event logs retention', unit: 'days' },
  { key: 'incident_retention_days', label: 'Incident logs retention', unit: 'days' },
]

export default function DataStorageTab({ settings, setSettings, saving, savedKey, showFeatureStatusDetails, onSave }) {
  const [status, setStatus] = useState(null)
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => { refreshStatus() }, [])

  async function refreshStatus() {
    setLoadingStatus(true)
    try {
      const res = await settingsApi.storageStatus()
      setStatus(res.data)
      setError('')
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load storage status')
    } finally {
      setLoadingStatus(false)
    }
  }

  async function handleArchive() {
    setBusy('archive')
    setMessage('')
    setError('')
    try {
      const res = await settingsApi.archiveStorage()
      const filename = extractFilename(res.headers['content-disposition']) || 'retention-archive.json'
      downloadBlob(res.data, filename)
      setMessage('Retention archive exported.')
      await refreshStatus()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to export retention archive')
    } finally {
      setBusy('')
    }
  }

  async function handlePurge() {
    if (!window.confirm('Run retention cleanup now? This deletes expired telemetry and either anonymizes or deletes old visitors.')) {
      return
    }
    setBusy('purge')
    setMessage('')
    setError('')
    try {
      const res = await settingsApi.purgeStorage()
      const summary = res.data.summary || {}
      setMessage(`Retention cleanup finished: ${Object.entries(summary).map(([key, value]) => `${key} ${value}`).join(' · ')}`)
      await refreshStatus()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to run retention cleanup')
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="space-y-4">
      {message && <Alert type="success">{message}</Alert>}
      {error && <Alert type="danger">{error}</Alert>}

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
          <CardHeader
            action={<Button variant="secondary" size="sm" icon={RefreshCw} loading={loadingStatus} onClick={refreshStatus}>Refresh</Button>}
          >
            <div>
              <p className="text-sm font-medium text-white">Storage Snapshot</p>
              <p className="mt-1 text-xs text-gray-500">The storage domain now keeps policy, archive, and lifecycle concerns together.</p>
            </div>
          </CardHeader>
          <div className="space-y-3">
            <Metric icon={Database} tone="text-cyan-300" label="Database size" value={formatBytes(status?.database?.size_bytes)} />
            <Metric icon={FolderArchive} tone="text-white" label="Backup catalog" value={`${status?.backups?.count ?? 0} archives`} />
            <Metric icon={AlertTriangle} tone="text-yellow-300" label="Expired rows" value={formatPending(status?.preview)} />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,0.75fr)_minmax(320px,0.55fr)]">
        <Card>
          <CardHeader>
            <div>
              <p className="text-sm font-medium text-white">Performance & Cache</p>
              <p className="mt-1 text-xs text-gray-500">Database footprint, index coverage, and Redis pressure are now visible directly from settings.</p>
            </div>
          </CardHeader>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Metric icon={Database} tone="text-cyan-300" label="Indexes" value={`${status?.database?.index_count ?? 0}`} />
            <Metric icon={Database} tone="text-white" label="Redis memory" value={status?.cache?.used_memory_human || (status?.cache?.ok ? '0 B' : 'Unavailable')} />
            <Metric icon={FolderArchive} tone="text-green-300" label="Retention archives" value={`${status?.archives?.count ?? 0}`} />
          </div>
          <div className="mt-4 space-y-2">
            {(status?.database?.tables ?? []).map((table) => (
              <div key={table.table} className="flex items-center justify-between rounded-lg border border-cyan-500/10 bg-black/25 px-3 py-2">
                <span className="text-sm text-gray-300">{table.table}</span>
                <span className="text-xs font-mono text-cyan-300">{formatBytes(table.bytes)}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <p className="text-sm font-medium text-white">Lifecycle Actions</p>
              <p className="mt-1 text-xs text-gray-500">Export soon-to-be-purged records, then run retention cleanup on demand in addition to the background maintenance loop.</p>
            </div>
          </CardHeader>
          <div className="space-y-3">
            <div className="rounded-xl border border-cyan-500/10 bg-black/20 px-4 py-3">
              <p className="text-xs font-mono uppercase tracking-[0.18em] text-gray-500">Current Preview</p>
              <p className="mt-2 text-sm text-white">{formatPending(status?.preview)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" icon={HardDriveDownload} loading={busy === 'archive'} onClick={handleArchive}>
                Export Archive
              </Button>
              <Button variant="danger" icon={Trash2} loading={busy === 'purge'} onClick={handlePurge}>
                Run Purge Now
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {showFeatureStatusDetails ? (
        <SettingsRoadmapCard
          eyebrow="Storage Map"
          title="Data & Storage Organization"
          description="Retention, lifecycle cleanup, archive export, performance visibility, and backup workflows now live together in one operator surface."
          groups={[
            {
              title: 'Database & Performance',
              items: [
                { label: 'Database performance', status: 'live', note: 'Settings now surface database size and the heaviest user tables.' },
                { label: 'Cache', status: 'live', note: 'Redis memory health is now visible alongside storage controls.' },
                { label: 'Indexing', status: 'live', note: 'Index coverage is now reported from the live schema footprint.' },
              ],
            },
            {
              title: 'Lifecycle',
              items: [
                { label: 'Archiving', status: 'live', note: 'Operators can export retention archives for expiring visitors, events, activity, and incidents.' },
                { label: 'Purge rules', status: 'live', note: 'Background maintenance and manual cleanup now apply retention by data class.' },
                { label: 'Backups', status: 'live', note: 'Selective backup and restore already ship today.' },
              ],
            },
          ]}
        />
      ) : null}

      <BackupTab />
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

function formatBytes(value) {
  const bytes = Number(value || 0)
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = bytes
  let unitIndex = 0
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }
  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

function formatPending(preview) {
  if (!preview) return 'Loading…'
  return [
    `${preview.visitors ?? 0} visitors`,
    `${preview.events ?? 0} events`,
    `${preview.activity_events ?? 0} activity`,
    `${preview.incidents ?? 0} incidents`,
  ].join(' · ')
}

function extractFilename(contentDisposition) {
  const match = /filename="?([^"]+)"?/.exec(contentDisposition || '')
  return match?.[1] || ''
}

function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}
