import { useRef } from 'react'
import { Download, Package, Upload } from 'lucide-react'
import { Button, Card, CardHeader } from '../../../components/ui'

export default function ThemePackagePanel({
  exporting,
  importing,
  error,
  success,
  themeCount,
  defaultThemeName,
  onExport,
  onImport,
}) {
  const inputRef = useRef(null)

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    await onImport(file)
  }

  return (
    <Card>
      <CardHeader
        action={(
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" icon={Upload} loading={importing} onClick={() => inputRef.current?.click()}>
              Import Package
            </Button>
            <Button size="sm" icon={Download} loading={exporting} onClick={onExport}>
              Export Package
            </Button>
          </div>
        )}
      >
        <div>
          <p className="text-sm font-medium text-white flex items-center gap-2">
            <Package size={16} className="text-cyan-400" />
            Theme Registry Package
          </p>
          <p className="text-xs text-gray-500 font-mono mt-1">
            Export the full registry to a JSON package or import a previous package to restore themes, layout rules, and role-based surfaces.
          </p>
        </div>
      </CardHeader>

      <input ref={inputRef} type="file" accept="application/json,.json" className="hidden" onChange={handleFileChange} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <InfoTile label="Themes in Registry" value={themeCount} />
        <InfoTile label="Default Theme" value={defaultThemeName || 'Not configured'} />
        <InfoTile label="Package Schema" value="skynet.theme-registry.v1" />
      </div>

      {success && <Notice tone="green">{success}</Notice>}
      {error && <Notice tone="red">{error}</Notice>}
    </Card>
  )
}

function InfoTile({ label, value }) {
  return (
    <div className="rounded-xl border border-cyan-500/10 bg-black/20 p-3">
      <p className="text-[10px] text-gray-500 uppercase tracking-[0.18em] font-mono">{label}</p>
      <p className="text-sm text-white font-mono mt-2 break-words">{value}</p>
    </div>
  )
}

function Notice({ children, tone }) {
  const styles = {
    green: 'border-green-500/25 bg-green-500/10 text-green-300',
    red: 'border-red-500/25 bg-red-500/10 text-red-300',
  }
  return <div className={`mt-3 rounded-lg border px-3 py-2 text-xs font-mono ${styles[tone]}`}>{children}</div>
}

