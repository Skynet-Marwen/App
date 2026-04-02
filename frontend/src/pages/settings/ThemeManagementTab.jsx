import { useEffect, useState } from 'react'
import { AlertTriangle, Palette, Pencil, Plus, RefreshCw, ShieldCheck, Sparkles, Trash2 } from 'lucide-react'
import { Badge, Button, Card, CardHeader } from '../../components/ui'
import { themesApi } from '../../services/api'
import { useThemesAdmin } from '../../hooks/useThemesAdmin'
import { useThemePackages } from '../../hooks/useThemePackages'
import ThemeEditorModal from './theme/ThemeEditorModal'
import ThemePackagePanel from './theme/ThemePackagePanel'
import ThemePreviewCard from './theme/ThemePreviewCard'

export default function ThemeManagementTab() {
  const {
    themes,
    loading,
    saving,
    uploadingLogo,
    actionLoading,
    error,
    success,
    refreshThemes,
    buildFormState,
    saveTheme,
    deleteTheme,
    setDefaultTheme,
    uploadLogo,
    removeLogo,
  } = useThemesAdmin()
  const defaultTheme = themes.find((theme) => theme.is_default)
  const {
    loading: packageLoading,
    error: packageError,
    success: packageSuccess,
    exportRegistry,
    importRegistry,
  } = useThemePackages({ themes, defaultThemeId: defaultTheme?.id, refreshThemes })
  const [editorState, setEditorState] = useState({ open: false, mode: 'create', originalId: null, form: buildFormState() })
  const [starterPacks, setStarterPacks] = useState([])
  const [starterBusy, setStarterBusy] = useState('')
  const activeThemes = themes.filter((theme) => theme.is_active).length

  const openCreateModal = () => setEditorState({ open: true, mode: 'create', originalId: null, form: buildFormState() })
  const openEditModal = (theme) => setEditorState({ open: true, mode: 'edit', originalId: theme.id, form: buildFormState(theme) })
  const closeEditor = () => setEditorState((prev) => ({ ...prev, open: false }))

  const handleDelete = async (theme) => {
    if (theme.is_default) return
    const confirmed = window.confirm(`Delete theme "${theme.name}"? Users using it will fall back to the current default theme.`)
    if (!confirmed) return
    await deleteTheme(theme)
  }

  const handleSetDefault = async (theme) => {
    if (theme.is_default) return
    await setDefaultTheme(theme)
  }

  useEffect(() => {
    themesApi.starterPacks().then((res) => setStarterPacks(Array.isArray(res.data) ? res.data : [])).catch(() => setStarterPacks([]))
  }, [])

  const handleInstallStarterPack = async (packId) => {
    setStarterBusy(packId)
    try {
      await themesApi.installStarterPack(packId, { set_default: themes.length === 0 })
      await refreshThemes()
    } finally {
      setStarterBusy('')
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div>
            <p className="text-sm font-medium text-white">Curated Starter Packs</p>
            <p className="text-xs text-gray-500 font-mono mt-1">Marketplace-style installs for opinionated theme bundles you can customize afterward.</p>
          </div>
        </CardHeader>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {starterPacks.map((pack) => (
            <div key={pack.id} className="rounded-xl border border-cyan-500/10 bg-black/20 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">{pack.name}</p>
                  <p className="mt-1 text-xs text-gray-500 font-mono">{pack.theme_count} theme{pack.theme_count === 1 ? '' : 's'}</p>
                </div>
                <Badge variant="info">{pack.id}</Badge>
              </div>
              <p className="mt-3 text-sm text-gray-300">{pack.description}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {pack.themes?.map((theme) => (
                  <Badge key={theme.id} variant="default">{theme.name}</Badge>
                ))}
              </div>
              <div className="mt-4 flex justify-end">
                <Button variant="secondary" loading={starterBusy === pack.id} onClick={() => handleInstallStarterPack(pack.id)}>
                  Install Pack
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader
          action={(
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" icon={RefreshCw} onClick={refreshThemes} loading={loading}>Refresh</Button>
              <Button size="sm" icon={Plus} onClick={openCreateModal}>New Theme</Button>
            </div>
          )}
        >
          <div>
            <p className="text-sm font-medium text-white">Theme Registry</p>
            <p className="text-xs text-gray-500 font-mono mt-1">Manage dashboard theme definitions and choose the global default.</p>
          </div>
        </CardHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
          <MetricCard label="Total Themes" value={themes.length} icon={Palette} tone="text-cyan-400" />
          <MetricCard label="Active Themes" value={activeThemes} icon={Sparkles} tone="text-green-400" />
          <div className="rounded-xl border border-cyan-500/10 bg-black/30 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] text-gray-500 uppercase tracking-[0.18em] font-mono">Default Theme</p>
              <ShieldCheck size={14} className="text-yellow-400" />
            </div>
            <p className="text-sm font-semibold font-mono text-yellow-300 mt-2">{defaultTheme?.name || 'No default configured'}</p>
            <p className="text-[11px] text-gray-500 font-mono mt-1">{defaultTheme?.id || '—'}</p>
          </div>
        </div>

        <div className="mb-5">
          <ThemePackagePanel
            themeCount={themes.length}
            defaultThemeName={defaultTheme?.name}
            exporting={packageLoading}
            importing={packageLoading}
            error={packageError}
            success={packageSuccess}
            onExport={exportRegistry}
            onImport={importRegistry}
          />
        </div>

        {error && <Notice tone="red">{error}</Notice>}
        {success && <Notice tone="green">{success}</Notice>}

        <div className="space-y-4">
          {loading ? (
            [...Array(3)].map((_, index) => <div key={index} className="h-48 rounded-xl border border-cyan-500/10 bg-black/20 animate-pulse" />)
          ) : themes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-cyan-500/15 bg-black/20 px-6 py-10 text-center">
              <p className="text-sm font-mono text-gray-300">No themes found.</p>
              <p className="text-xs font-mono text-gray-500 mt-2">Create the first theme to initialize the registry.</p>
            </div>
          ) : (
            themes.map((theme) => (
              <div key={theme.id} className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-4 rounded-xl border border-cyan-500/10 bg-black/20 p-4">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-white font-mono">{theme.name}</p>
                        <Badge variant="info">{theme.id}</Badge>
                        {theme.is_default && <Badge variant="warning">Default</Badge>}
                        {theme.is_active ? <Badge variant="success">Active</Badge> : <Badge variant="danger">Inactive</Badge>}
                      </div>
                      <p className="text-xs text-gray-500 font-mono mt-2">
                        Widgets: {Array.isArray(theme.widgets) ? theme.widgets.length : 0} · Layout keys: {Object.keys(theme.layout || {}).length} · Color keys: {Object.keys(theme.colors || {}).length}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button variant="secondary" size="sm" icon={Pencil} onClick={() => openEditModal(theme)}>Edit</Button>
                      <Button variant="neon" size="sm" icon={ShieldCheck} disabled={theme.is_default} loading={!!actionLoading[`default:${theme.id}`]} onClick={() => handleSetDefault(theme)}>
                        {theme.is_default ? 'Default Theme' : 'Set Default'}
                      </Button>
                      <Button variant="danger" size="sm" icon={Trash2} disabled={theme.is_default} loading={!!actionLoading[`delete:${theme.id}`]} onClick={() => handleDelete(theme)}>
                        Delete
                      </Button>
                    </div>
                  </div>

                  {theme.is_default && <Notice tone="yellow">Default themes cannot be deleted. Promote another theme first if you need to retire this one.</Notice>}
                  {!theme.is_active && <Notice tone="red">Inactive themes stay available in the registry but clients now resolve to a safe default when needed.</Notice>}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <KeyValueCard title="Colors" entries={Object.entries(theme.colors || {}).slice(0, 5)} colorSwatches />
                    <KeyValueCard title="Layout" entries={Object.entries(theme.layout || {}).slice(0, 5)} />
                    <KeyValueCard
                      title="Branding"
                      entries={[
                        ['Company', theme.branding?.company_name || '—'],
                        ['Title', theme.branding?.title || '—'],
                        ['Tagline', theme.branding?.tagline || '—'],
                        ['Logo URL', theme.branding?.logo_url || '—'],
                      ]}
                    />
                  </div>
                </div>

                <ThemePreviewCard theme={theme} />
              </div>
            ))
          )}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <p className="text-sm font-medium text-white">Safety Notes</p>
            <p className="text-xs text-gray-500 font-mono mt-1">Theme actions affect the global registry used for user resolution and fallback.</p>
          </div>
        </CardHeader>
        <div className="space-y-3 text-xs font-mono text-gray-400">
          <SafetyNote text="Deleting the current default theme is blocked in the UI. Promote another theme before removing legacy variants." />
          <SafetyNote text="Inactive themes remain editable for recovery, but the runtime now falls users back to the current default automatically." />
        </div>
      </Card>

      <ThemeEditorModal
        key={`${editorState.open ? 'open' : 'closed'}:${editorState.mode}:${editorState.originalId || 'new'}`}
        open={editorState.open}
        mode={editorState.mode}
        initialForm={editorState.form}
        saving={saving}
        uploadingLogo={uploadingLogo}
        onClose={closeEditor}
        onSubmit={(form) => saveTheme({ form, originalId: editorState.originalId, isEdit: editorState.mode === 'edit' })}
        onUploadLogo={(themeId, file) => uploadLogo(themeId, file)}
        onRemoveLogo={(themeId) => removeLogo(themeId)}
      />
    </div>
  )
}

function MetricCard({ label, value, icon, tone }) {
  const MetricIcon = icon
  return (
    <div className="rounded-xl border border-cyan-500/10 bg-black/30 p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] text-gray-500 uppercase tracking-[0.18em] font-mono">{label}</p>
        <MetricIcon size={14} className={tone} />
      </div>
      <p className={`text-2xl font-bold font-mono ${tone}`}>{value}</p>
    </div>
  )
}

function Notice({ children, tone }) {
  const styles = {
    green: 'border-green-500/25 bg-green-500/10 text-green-300',
    red: 'border-red-500/25 bg-red-500/10 text-red-300',
    yellow: 'border-yellow-500/20 bg-yellow-500/10 text-yellow-200',
  }
  return <div className={`rounded-lg px-3 py-2 text-xs font-mono ${styles[tone]}`}>{children}</div>
}

function KeyValueCard({ title, entries, colorSwatches = false }) {
  return (
    <div className="rounded-lg border border-cyan-500/10 bg-black/30 p-3">
      <p className="text-[10px] text-gray-500 uppercase tracking-widest font-mono mb-2">{title}</p>
      <div className="space-y-2">
        {entries.map(([key, value]) => (
          <div key={key} className="flex items-center justify-between gap-2 text-xs font-mono">
            <span className="text-gray-400">{key}</span>
            <div className="flex items-center gap-2 min-w-0">
              {colorSwatches && <span className="h-3 w-3 rounded-full border border-white/10" style={{ background: String(value) }} />}
              <span className="text-gray-300 truncate">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SafetyNote({ text }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-cyan-500/10 bg-black/20 p-3">
      <AlertTriangle size={14} className="mt-0.5 text-yellow-400 flex-shrink-0" />
      <p>{text}</p>
    </div>
  )
}
