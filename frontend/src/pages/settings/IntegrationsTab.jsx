import { useRef, useState } from 'react'
import { Upload, CheckCircle, XCircle, Wifi } from 'lucide-react'
import { Card, CardHeader, Button, Select } from '../../components/ui/index'
import { settingsApi } from '../../services/api'

export default function IntegrationsTab({ settings, setSettings, saving, onSave }) {
  const fileRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState(null) // 'ok' | 'error' | null
  const [probing, setProbing] = useState(false)
  const [probeResult, setProbeResult] = useState(null)

  const provider = settings.geoip_provider ?? 'ip-api'

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadResult(null)
    try {
      await settingsApi.uploadMmdb(file)
      setUploadResult('ok')
    } catch {
      setUploadResult('error')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const probe = async () => {
    setProbing(true)
    setProbeResult(null)
    try {
      const r = await settingsApi.geoipStatus()
      setProbeResult(r.data)
    } catch {
      setProbeResult({ ok: false, error: 'Request failed' })
    } finally {
      setProbing(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <p className="text-sm font-medium text-white">GeoIP Provider</p>
        <p className="text-xs text-gray-500">Resolve visitor country &amp; city from IP address</p>
      </CardHeader>

      <div className="space-y-4">
        <Select
          label="Provider"
          value={provider}
          onChange={(e) => setSettings({ ...settings, geoip_provider: e.target.value })}
          options={[
            { value: 'ip-api', label: 'ip-api.com — free, no token (default)' },
            { value: 'local', label: 'Local .mmdb file — offline, no rate limit' },
            { value: 'none', label: 'Disabled' },
          ]}
        />

        {provider === 'ip-api' && (
          <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-3 py-2.5">
            <p className="text-xs text-yellow-400">
              Rate limit: 45 req/min · Results cached 24 h per IP in Redis.
              Sufficient for most deployments. No account or token required.
            </p>
          </div>
        )}

        {provider === 'local' && (
          <div className="space-y-2.5">
            <p className="text-xs text-gray-500">
              Upload any <span className="text-gray-300">.mmdb</span> file —
              MaxMind GeoLite2-City, DB-IP Community, or ip2location LITE.
              All are free downloads (no account required for DB-IP &amp; ip2location).
            </p>
            <div className="flex items-center gap-3">
              <input
                ref={fileRef}
                type="file"
                accept=".mmdb"
                className="hidden"
                onChange={handleUpload}
              />
              <Button
                icon={Upload}
                loading={uploading}
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? 'Uploading…' : 'Upload .mmdb'}
              </Button>
              {uploadResult === 'ok' && (
                <span className="flex items-center gap-1 text-xs text-green-400">
                  <CheckCircle size={12} /> Uploaded — reader reset
                </span>
              )}
              {uploadResult === 'error' && (
                <span className="flex items-center gap-1 text-xs text-red-400">
                  <XCircle size={12} /> Upload failed
                </span>
              )}
            </div>
          </div>
        )}

        {provider === 'none' && (
          <div className="rounded-lg border border-gray-700 bg-gray-800/30 px-3 py-2.5">
            <p className="text-xs text-gray-500">
              GeoIP is disabled. Country, city and flag fields will be empty on new visitors.
            </p>
          </div>
        )}

        {provider !== 'none' && (
          <div className="flex items-center gap-3 pt-1 border-t border-gray-800">
            <Button variant="ghost" icon={Wifi} loading={probing} onClick={probe}>
              Test Provider
            </Button>
            {probeResult && (
              probeResult.ok
                ? <span className="text-xs text-green-400">
                    ✓ {probeResult.sample?.country_flag} {probeResult.sample?.country} ({probeResult.sample?.city})
                  </span>
                : <span className="text-xs text-red-400">✗ {probeResult.error}</span>
            )}
          </div>
        )}
      </div>

      <div className="mt-5 flex justify-end">
        <Button loading={saving} onClick={onSave}>Save</Button>
      </div>
    </Card>
  )
}
