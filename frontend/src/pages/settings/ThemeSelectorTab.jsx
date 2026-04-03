import { useEffect, useState } from 'react'
import { Palette, RefreshCw, AlertTriangle, Plus, Trash2 } from 'lucide-react'
import { Card, CardHeader, Button, Select, Badge, Toggle, Input } from '../../components/ui'
import { settingsApi } from '../../services/api'
import { useTheme } from '../../hooks/useTheme'
import { useAuthStore } from '../../store/useAppStore'

export default function ThemeSelectorTab() {
  const isAdmin = useAuthStore((state) => ['admin', 'superadmin'].includes(state.user?.role))
  const {
    availableThemes,
    currentTheme,
    selectedThemeId,
    themeSource,
    defaultThemeId,
    fallbackReason,
    resolvedFromFallback,
    loading,
    error,
    selectTheme,
    resetToDefault,
  } = useTheme()
  const [dynamicSettings, setDynamicSettings] = useState(null)
  const [dynamicSaving, setDynamicSaving] = useState(false)

  const selectedValue = selectedThemeId || '__default__'

  useEffect(() => {
    if (!isAdmin) return
    settingsApi.get().then((res) => {
      setDynamicSettings({
        theme_dynamic_enabled: !!res.data.theme_dynamic_enabled,
        theme_dynamic_strategy: res.data.theme_dynamic_strategy || 'risk',
        theme_dynamic_risk_map: res.data.theme_dynamic_risk_map || {},
        theme_dynamic_tenant_map: res.data.theme_dynamic_tenant_map || {},
      })
    }).catch(() => {})
  }, [isAdmin])

  const handleChange = async (event) => {
    const value = event.target.value
    try {
      await selectTheme(value === '__default__' ? null : value)
    } catch {
      return
    }
  }

  const accent = currentTheme?.colors?.accent || '#22d3ee'
  const surface = currentTheme?.colors?.surface || 'rgba(0,0,0,0.62)'
  const text = currentTheme?.colors?.text || '#f9fafb'
  const muted = currentTheme?.colors?.textMuted || '#9ca3af'
  const sourceLabel = themeSource === 'user' ? 'User Selected' : themeSource === 'dynamic' ? 'Dynamic Override' : 'Default'

  const saveDynamicThemeSettings = async () => {
    if (!dynamicSettings) return
    setDynamicSaving(true)
    try {
      await settingsApi.update(dynamicSettings)
    } finally {
      setDynamicSaving(false)
    }
  }

  const tenantEntries = Object.entries(dynamicSettings?.theme_dynamic_tenant_map || {}).filter(([key]) => key !== 'default')

  const setTenantEntry = (previousKey, nextKey, themeId) => {
    const normalizedKey = nextKey.trim().toLowerCase()
    const nextMap = { ...(dynamicSettings.theme_dynamic_tenant_map || {}) }
    delete nextMap[previousKey]
    if (normalizedKey) nextMap[normalizedKey] = themeId
    setDynamicSettings({ ...dynamicSettings, theme_dynamic_tenant_map: nextMap })
  }

  const removeTenantEntry = (key) => {
    const nextMap = { ...(dynamicSettings.theme_dynamic_tenant_map || {}) }
    delete nextMap[key]
    setDynamicSettings({ ...dynamicSettings, theme_dynamic_tenant_map: nextMap })
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          action={
            <div className="flex items-center gap-2">
              <Badge variant={themeSource === 'user' ? 'info' : 'default'}>
                {sourceLabel}
              </Badge>
              {resolvedFromFallback && <Badge variant="warning">Fallback Active</Badge>}
            </div>
          }
        >
          <div>
            <p className="text-sm font-medium text-white flex items-center gap-2">
              <Palette size={16} className="text-cyan-400" />
              Dashboard Theme
            </p>
            <p className="text-xs text-gray-500 font-mono mt-1">
              Choose your runtime dashboard theme. Changes apply instantly without reloading.
            </p>
          </div>
        </CardHeader>

        <div className="space-y-4">
          <Select
            label="Active Theme"
            value={selectedValue}
            onChange={handleChange}
            options={[
              { value: '__default__', label: 'Use system default theme' },
              ...availableThemes.map((theme) => ({
                value: theme.id,
                label: `${theme.name}${theme.id === defaultThemeId ? ' • default' : ''}`,
              })),
            ]}
          />

          <div className="flex flex-wrap gap-2">
            <Button variant="neon" loading={loading} onClick={() => resetToDefault().catch(() => {})} icon={RefreshCw}>
              Reset to Default
            </Button>
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/8 px-3 py-2 text-xs text-red-300 font-mono">
              {error}
            </div>
          )}

          {fallbackReason && (
            <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/8 px-3 py-2 text-xs text-yellow-200 font-mono flex items-start gap-2">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>Fallback applied: {fallbackReason}</span>
            </div>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <p className="text-sm font-medium text-white">Live Theme Preview</p>
            <p className="text-xs text-gray-500 font-mono mt-1">
              Current resolved theme: {currentTheme?.name || 'System Fallback'}
            </p>
          </div>
        </CardHeader>

        <div className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
          <div
            className="rounded-xl border p-4 space-y-4"
            style={{
              background: surface,
              borderColor: `${accent}33`,
              boxShadow: '0 10px 24px rgba(0, 0, 0, 0.18)',
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-mono uppercase tracking-[0.18em]" style={{ color: accent }}>
                  Preview Panel
                </p>
                <p className="text-lg font-semibold mt-1" style={{ color: text }}>
                  {currentTheme?.branding?.title || currentTheme?.name || 'Theme Preview'}
                </p>
              </div>
              <div
                className="h-10 w-10 rounded-full border flex items-center justify-center"
                style={{ borderColor: accent, color: accent }}
              >
                <Palette size={16} />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {[
                { label: 'Accent', value: currentTheme?.colors?.accent || accent },
                { label: 'Background', value: currentTheme?.colors?.background || '#050505' },
                { label: 'Surface', value: currentTheme?.colors?.surface || surface },
              ].map((item) => (
                <div key={item.label} className="rounded-lg border p-3" style={{ borderColor: `${accent}22`, background: 'rgba(255,255,255,0.02)' }}>
                  <p className="text-[10px] font-mono uppercase tracking-[0.18em]" style={{ color: muted }}>
                    {item.label}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="h-4 w-4 rounded-full border border-white/10" style={{ background: item.value }} />
                    <span className="text-xs font-mono" style={{ color: text }}>{item.value}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-lg border p-3" style={{ borderColor: `${accent}22`, background: 'rgba(255,255,255,0.02)' }}>
              <p className="text-[10px] font-mono uppercase tracking-[0.18em]" style={{ color: muted }}>
                Layout Metadata
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {Object.entries(currentTheme?.layout || {}).map(([key, value]) => (
                  <Badge key={key} variant="default" className="capitalize">
                    {key}: {String(value)}
                  </Badge>
                ))}
                {Object.keys(currentTheme?.layout || {}).length === 0 && (
                  <span className="text-xs font-mono" style={{ color: muted }}>No layout metadata</span>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-xl border border-cyan-500/10 p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
              <p className="text-[10px] text-gray-500 uppercase tracking-[0.18em] font-mono">Resolved Source</p>
              <p className="text-sm text-white font-medium mt-2">
                {themeSource === 'user' ? 'Per-user override' : themeSource === 'dynamic' ? 'Dynamic risk override' : 'Global default'}
              </p>
            </div>
            <div className="rounded-xl border border-cyan-500/10 p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
              <p className="text-[10px] text-gray-500 uppercase tracking-[0.18em] font-mono">Widgets</p>
              <p className="text-sm text-white font-medium mt-2">{Array.isArray(currentTheme?.widgets) ? currentTheme.widgets.length : 0}</p>
            </div>
            <div className="rounded-xl border border-cyan-500/10 p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
              <p className="text-[10px] text-gray-500 uppercase tracking-[0.18em] font-mono">Default Theme ID</p>
              <p className="text-sm text-white font-medium mt-2 break-all">{defaultThemeId || 'Unavailable'}</p>
            </div>
          </div>
        </div>
      </Card>

      {isAdmin && dynamicSettings && (
        <Card>
          <CardHeader
            action={<Button loading={dynamicSaving} onClick={saveDynamicThemeSettings}>Save Dynamic Theme Policy</Button>}
          >
            <div>
              <p className="text-sm font-medium text-white">Dynamic Theme Policy</p>
              <p className="text-xs text-gray-500 font-mono mt-1">Default-theme users can inherit a risk-aware shell automatically.</p>
            </div>
          </CardHeader>
          <div className="space-y-4">
            <Toggle
              label="Enable dynamic themes"
              description="Per-user theme overrides still win; this only affects operators following the system default."
              checked={!!dynamicSettings.theme_dynamic_enabled}
              onChange={(value) => setDynamicSettings({ ...dynamicSettings, theme_dynamic_enabled: value })}
            />
            <Select
              label="Strategy"
              value={dynamicSettings.theme_dynamic_strategy}
              onChange={(event) => setDynamicSettings({ ...dynamicSettings, theme_dynamic_strategy: event.target.value })}
              options={[
                { value: 'risk', label: 'Global risk posture' },
                { value: 'tenant', label: 'Tenant host map' },
              ]}
            />
            {dynamicSettings.theme_dynamic_strategy === 'risk' ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                {['normal', 'elevated', 'high', 'critical'].map((band) => (
                  <Select
                    key={band}
                    label={`${band[0].toUpperCase()}${band.slice(1)} Theme`}
                    value={dynamicSettings.theme_dynamic_risk_map?.[band] || ''}
                    onChange={(event) => setDynamicSettings({
                      ...dynamicSettings,
                      theme_dynamic_risk_map: {
                        ...(dynamicSettings.theme_dynamic_risk_map || {}),
                        [band]: event.target.value,
                      },
                    })}
                    options={[
                      { value: '', label: 'No override' },
                      ...availableThemes.map((theme) => ({ value: theme.id, label: theme.name })),
                    ]}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                <Select
                  label="Default Tenant Theme"
                  value={dynamicSettings.theme_dynamic_tenant_map?.default || ''}
                  onChange={(event) => setDynamicSettings({
                    ...dynamicSettings,
                    theme_dynamic_tenant_map: {
                      ...(dynamicSettings.theme_dynamic_tenant_map || {}),
                      default: event.target.value,
                    },
                  })}
                  options={[
                    { value: '', label: 'No default override' },
                    ...availableThemes.map((theme) => ({ value: theme.id, label: theme.name })),
                  ]}
                />
                <div className="space-y-3">
                  {tenantEntries.map(([tenantKey, themeId]) => (
                    <div key={tenantKey} className="grid grid-cols-1 gap-3 rounded-xl border border-cyan-500/10 bg-black/20 p-3 md:grid-cols-[1.1fr_1fr_auto]">
                      <Input
                        label="Tenant Host"
                        value={tenantKey}
                        onChange={(event) => setTenantEntry(tenantKey, event.target.value, themeId)}
                        placeholder="tenant.example.com"
                      />
                      <Select
                        label="Theme"
                        value={themeId || ''}
                        onChange={(event) => setTenantEntry(tenantKey, tenantKey, event.target.value)}
                        options={[
                          { value: '', label: 'No override' },
                          ...availableThemes.map((theme) => ({ value: theme.id, label: theme.name })),
                        ]}
                      />
                      <div className="flex items-end">
                        <Button variant="ghost" onClick={() => removeTenantEntry(tenantKey)} icon={Trash2}>
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                  <Button
                    variant="secondary"
                    icon={Plus}
                    onClick={() => setDynamicSettings({
                      ...dynamicSettings,
                      theme_dynamic_tenant_map: {
                        ...(dynamicSettings.theme_dynamic_tenant_map || {}),
                        [`tenant-${tenantEntries.length + 1}.local`]: '',
                      },
                    })}
                  >
                    Add Tenant Mapping
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  )
}
