import { Upload } from 'lucide-react'

import { Button, Card, CardHeader } from '../../components/ui'

export default function BackupImportCard({
  selectedBackup,
  uploadFile,
  onUploadChange,
  onUploadRestore,
  uploading,
}) {
  return (
    <Card>
      <CardHeader>
        <div>
          <p className="text-sm font-medium text-white">Import External Archive</p>
          <p className="text-xs text-gray-500">Upload a `.skynetbak` file and restore it directly.</p>
        </div>
      </CardHeader>
      <div className="space-y-4">
        {selectedBackup && (
          <div className="rounded-lg border border-cyan-500/10 bg-black/30 p-3">
            <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider font-mono">Selected Local Archive</p>
            <p className="text-sm text-white">{selectedBackup.filename}</p>
            <p className="text-xs text-gray-500 mt-1">
              Contains {selectedBackup.services.join(', ')} and {selectedBackup.encrypted ? 'uses password protection.' : 'is stored without encryption.'}
            </p>
          </div>
        )}
        <div className="space-y-1.5">
          <label className="block text-xs text-gray-500 font-mono uppercase tracking-wider">Archive File</label>
          <input
            type="file"
            accept=".skynetbak,application/octet-stream"
            onChange={onUploadChange}
            className="w-full border border-cyan-500/15 rounded-lg px-3 py-2 text-sm text-gray-300 font-mono bg-black/60"
          />
        </div>
        <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-3 py-3 text-xs text-yellow-200">
          Pro options included here: password-encrypted archives, local integrity hashes, and direct restore from uploaded archives for off-box recovery.
        </div>
        <div className="flex justify-end">
          <Button variant="danger" loading={uploading} onClick={onUploadRestore} icon={Upload} disabled={!uploadFile}>
            Upload And Restore
          </Button>
        </div>
      </div>
    </Card>
  )
}
