import { useEffect, useMemo, useState } from 'react'
import { Download, RefreshCw, RotateCcw, ShieldCheck } from 'lucide-react'

import { Alert, Button, Card, CardHeader, Input, Select } from '../../components/ui'
import { settingsApi } from '../../services/api'
import BackupCatalogCard from './BackupCatalogCard'
import BackupImportCard from './BackupImportCard'

const SERVICE_OPTIONS = [
  { key: 'database', label: 'Database', description: 'Users, sites, visitors, incidents, audit logs, and enforcement records.' },
  { key: 'settings', label: 'Settings', description: 'Runtime settings, SMTP secrets, HTTPS options, and block page config.' },
  { key: 'assets', label: 'Assets', description: 'Persistent backend data such as uploaded certificates and local GeoIP files.' },
]

const DEFAULT_SELECTION = { database: true, settings: true, assets: true }

export default function BackupTab() {
  const [backups, setBackups] = useState([])
  const [loading, setLoading] = useState(true)
  const [createSelection, setCreateSelection] = useState(DEFAULT_SELECTION)
  const [restoreSelection, setRestoreSelection] = useState(DEFAULT_SELECTION)
  const [selectedFilename, setSelectedFilename] = useState('')
  const [createPassword, setCreatePassword] = useState('')
  const [createNote, setCreateNote] = useState('')
  const [restorePassword, setRestorePassword] = useState('')
  const [restoreMode, setRestoreMode] = useState('full')
  const [uploadFile, setUploadFile] = useState(null)
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const selectedBackup = useMemo(() => backups.find((item) => item.filename === selectedFilename) ?? backups[0] ?? null, [backups, selectedFilename])

  useEffect(() => { refreshBackups() }, [])

  useEffect(() => {
    if (!selectedBackup && backups.length > 0) {
      setSelectedFilename(backups[0].filename)
    }
  }, [backups, selectedBackup])

  async function refreshBackups() {
    setLoading(true)
    setError('')
    try {
      const res = await settingsApi.listBackups()
      setBackups(res.data.items ?? [])
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load backups')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate() {
    const services = getSelectedServices(createSelection)
    if (services.length === 0) {
      setError('Select at least one service to back up.')
      return
    }
    setBusy('create')
    setError('')
    setMessage('')
    try {
      const res = await settingsApi.createBackup({
        services,
        password: createPassword || null,
        note: createNote || null,
      })
      await refreshBackups()
      setSelectedFilename(res.data.backup.filename)
      setMessage(`Backup created: ${res.data.backup.filename}`)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create backup')
    } finally {
      setBusy('')
    }
  }

  async function handleDownload() {
    if (!selectedBackup) return
    setBusy('download')
    setError('')
    try {
      const res = await settingsApi.downloadBackup(selectedBackup.filename)
      const url = window.URL.createObjectURL(res.data)
      const link = document.createElement('a')
      link.href = url
      link.download = selectedBackup.filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to download backup')
    } finally {
      setBusy('')
    }
  }

  async function handleRestoreSaved() {
    if (!selectedBackup) {
      setError('Choose a backup archive first.')
      return
    }
    const services = restoreMode === 'full' ? [] : getSelectedServices(restoreSelection)
    if (restoreMode === 'selective' && services.length === 0) {
      setError('Select at least one service to restore.')
      return
    }
    if (!window.confirm(`Restore ${selectedBackup.filename}? This overwrites the selected SkyNet data.`)) {
      return
    }
    setBusy('restore')
    setError('')
    setMessage('')
    try {
      const res = await settingsApi.restoreBackup(selectedBackup.filename, {
        mode: restoreMode,
        services,
        password: restorePassword || null,
      })
      await refreshBackups()
      setMessage(`Restore completed for ${res.data.restored_services.join(', ')}`)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to restore backup')
    } finally {
      setBusy('')
    }
  }

  async function handleUploadRestore() {
    const services = restoreMode === 'full' ? [] : getSelectedServices(restoreSelection)
    if (!uploadFile) {
      setError('Choose a backup archive file to upload.')
      return
    }
    if (restoreMode === 'selective' && services.length === 0) {
      setError('Select at least one service to restore.')
      return
    }
    if (!window.confirm(`Import and restore ${uploadFile.name}? This overwrites the selected SkyNet data.`)) {
      return
    }
    setBusy('upload')
    setError('')
    setMessage('')
    try {
      const res = await settingsApi.restoreUploadedBackup({
        file: uploadFile,
        mode: restoreMode,
        services,
        password: restorePassword,
      })
      await refreshBackups()
      setMessage(`Uploaded archive restored: ${res.data.archive.filename}`)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to restore uploaded backup')
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="space-y-4">
      <Alert type="info">
        <div className="space-y-1">
          <p className="text-sm text-white">Selective backup and restore is now operator-driven.</p>
          <p className="text-xs text-gray-300">
            Password protection encrypts the archive, selective restore applies only the checked sections, and every archive keeps a checksum for integrity review.
          </p>
        </div>
      </Alert>

      {message && <Alert type="success">{message}</Alert>}
      {error && <Alert type="danger">{error}</Alert>}

      <div className="grid grid-cols-1 items-start gap-3 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <p className="text-sm font-medium text-white">Create Backup</p>
              <p className="text-xs text-gray-500">Choose which SkyNet services should be included.</p>
            </div>
          </CardHeader>
          <div className="space-y-3">
            {SERVICE_OPTIONS.map((service) => (
              <label key={service.key} className="flex gap-3 rounded-lg border border-cyan-500/10 bg-black/30 px-3 py-3">
                <input
                  type="checkbox"
                  checked={!!createSelection[service.key]}
                  onChange={() => toggleSelection(setCreateSelection, service.key)}
                  className="mt-1 accent-cyan-500"
                />
                <div>
                  <p className="text-sm text-white font-medium">{service.label}</p>
                  <p className="text-xs text-gray-500">{service.description}</p>
                </div>
              </label>
            ))}
            <Input
              label="Archive Password"
              type="password"
              placeholder="Optional encryption password"
              value={createPassword}
              onChange={(e) => setCreatePassword(e.target.value)}
            />
            <Input
              label="Operator Note"
              placeholder="Optional note for this backup"
              value={createNote}
              onChange={(e) => setCreateNote(e.target.value)}
            />
            <div className="flex justify-end">
              <Button loading={busy === 'create'} onClick={handleCreate} icon={ShieldCheck}>
                Create Backup
              </Button>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader action={<Button variant="secondary" size="sm" icon={RefreshCw} onClick={refreshBackups}>Refresh</Button>}>
            <div>
              <p className="text-sm font-medium text-white">Restore Controls</p>
              <p className="text-xs text-gray-500">Run a full restore or restore only selected services.</p>
            </div>
          </CardHeader>
          <div className="space-y-4">
            <Select
              label="Restore Mode"
              value={restoreMode}
              onChange={(e) => setRestoreMode(e.target.value)}
              options={[
                { value: 'full', label: 'Full Restore' },
                { value: 'selective', label: 'Selective Restore' },
              ]}
            />
            {restoreMode === 'selective' && (
              <div className="space-y-2">
                {SERVICE_OPTIONS.map((service) => (
                  <label key={service.key} className="flex items-center gap-3 text-sm text-gray-300">
                    <input
                      type="checkbox"
                      checked={!!restoreSelection[service.key]}
                      onChange={() => toggleSelection(setRestoreSelection, service.key)}
                      className="accent-cyan-500"
                    />
                    <span>{service.label}</span>
                  </label>
                ))}
              </div>
            )}
            <Input
              label="Restore Password"
              type="password"
              placeholder="Required for encrypted archives"
              value={restorePassword}
              onChange={(e) => setRestorePassword(e.target.value)}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" loading={busy === 'download'} onClick={handleDownload} icon={Download} disabled={!selectedBackup}>
                Download
              </Button>
              <Button variant="danger" loading={busy === 'restore'} onClick={handleRestoreSaved} icon={RotateCcw} disabled={!selectedBackup}>
                Restore Saved Backup
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr,1fr] gap-4">
        <BackupCatalogCard
          backups={backups}
          loading={loading}
          selectedBackup={selectedBackup}
          onSelect={setSelectedFilename}
        />
        <BackupImportCard
          selectedBackup={selectedBackup}
          uploadFile={uploadFile}
          onUploadChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
          onUploadRestore={handleUploadRestore}
          uploading={busy === 'upload'}
        />
      </div>
    </div>
  )
}

function toggleSelection(setter, key) {
  setter((current) => ({ ...current, [key]: !current[key] }))
}

function getSelectedServices(selection) {
  return SERVICE_OPTIONS.filter((service) => selection[service.key]).map((service) => service.key)
}
