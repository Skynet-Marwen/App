import { Archive } from 'lucide-react'

import { Badge, Card, CardHeader, EmptyState } from '../../components/ui'

export default function BackupCatalogCard({ backups, loading, selectedBackup, onSelect }) {
  return (
    <Card>
      <CardHeader>
        <div>
          <p className="text-sm font-medium text-white">Backup Catalog</p>
          <p className="text-xs text-gray-500">Review local archives before download or restore.</p>
        </div>
      </CardHeader>
      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, index) => (
            <div key={index} className="h-16 rounded-lg border border-cyan-500/10 bg-black/30 animate-pulse" />
          ))}
        </div>
      ) : backups.length === 0 ? (
        <EmptyState
          icon={Archive}
          title="No backups yet"
          description="Create your first archive to enable download and restore operations."
        />
      ) : (
        <div className="space-y-3">
          {backups.map((backup) => {
            const active = selectedBackup?.filename === backup.filename
            return (
              <button
                key={backup.filename}
                onClick={() => onSelect(backup.filename)}
                className={`w-full rounded-lg border p-4 text-left transition ${active ? 'border-cyan-500/40 bg-cyan-500/8' : 'border-cyan-500/10 bg-black/25 hover:bg-cyan-500/5'}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-white">{backup.filename}</p>
                  {backup.encrypted && <Badge variant="success">Encrypted</Badge>}
                  {backup.services.map((service) => <Badge key={service} variant="info">{service}</Badge>)}
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  {new Date(backup.created_at).toLocaleString()} · {formatBytes(backup.size_bytes)}
                </p>
                <p className="mt-1 text-xs text-gray-600 font-mono">SHA256 {backup.sha256.slice(0, 16)}...</p>
                {backup.note && <p className="mt-2 text-xs text-gray-400">{backup.note}</p>}
              </button>
            )
          })}
        </div>
      )}
    </Card>
  )
}

function formatBytes(value) {
  if (!value) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const exponent = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1)
  const size = value / (1024 ** exponent)
  return `${size.toFixed(size >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`
}
