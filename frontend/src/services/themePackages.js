const PACKAGE_SCHEMA = 'skynet.theme-registry.v1'

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
}

function normalizeThemeRecord(theme) {
  const colors = isPlainObject(theme?.colors) ? theme.colors : {}
  const layout = isPlainObject(theme?.layout) ? theme.layout : {}
  const branding = theme?.branding === null || isPlainObject(theme?.branding) ? theme.branding : null

  return {
    id: theme?.id || '',
    name: theme?.name || '',
    colors,
    layout,
    widgets: Array.isArray(theme?.widgets) ? theme.widgets : [],
    branding,
    is_active: theme?.is_active ?? true,
  }
}

export function buildThemeRegistryPackage(themes, defaultThemeId) {
  return {
    schema_version: PACKAGE_SCHEMA,
    exported_at: new Date().toISOString(),
    default_theme_id: defaultThemeId || null,
    themes: Array.isArray(themes) ? themes.map(normalizeThemeRecord) : [],
  }
}

export function parseThemeRegistryPackage(packageData) {
  if (!isPlainObject(packageData)) return null
  const themes = Array.isArray(packageData.themes)
    ? packageData.themes
    : packageData.theme && isPlainObject(packageData.theme)
      ? [packageData.theme]
      : []

  return {
    schema_version: packageData.schema_version || PACKAGE_SCHEMA,
    exported_at: packageData.exported_at || null,
    default_theme_id: packageData.default_theme_id || null,
    themes: themes.map(normalizeThemeRecord).filter((theme) => theme.id && theme.name),
  }
}

export async function readThemeRegistryPackage(file) {
  const raw = await file.text()
  const parsed = JSON.parse(raw)
  const packageData = parseThemeRegistryPackage(parsed)
  if (!packageData) {
    throw new Error('Theme package must be a JSON object.')
  }
  return packageData
}

export function downloadThemeRegistryPackage(packageData, filename = 'skynet-theme-registry.json') {
  const blob = new Blob([JSON.stringify(packageData, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function prepareThemePayload(theme) {
  const normalized = normalizeThemeRecord(theme)
  return {
    id: normalized.id,
    name: normalized.name,
    colors: normalized.colors,
    layout: normalized.layout,
    widgets: normalized.widgets,
    branding: normalized.branding,
    is_active: normalized.is_active,
  }
}

