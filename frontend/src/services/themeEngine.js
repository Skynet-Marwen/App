const DEFAULT_THEME = {
  id: 'system-fallback',
  name: 'System Fallback',
  colors: {
    background: '#050505',
    backgroundGradient: 'radial-gradient(circle at top, rgba(34,211,238,0.08), transparent 40%), linear-gradient(180deg, #050505 0%, #020617 100%)',
    surface: 'rgba(0,0,0,0.62)',
    surfaceAlt: 'rgba(0,0,0,0.55)',
    panel: 'rgba(4,4,4,0.96)',
    panelSoft: 'rgba(2,2,2,0.85)',
    headerBackground: 'rgba(2, 6, 23, 0.86)',
    headerBorder: 'rgba(6,182,212,0.10)',
    headerText: '#f9fafb',
    navBackground: 'rgba(3,3,3,0.95)',
    navBorder: 'rgba(6,182,212,0.10)',
    navText: '#9ca3af',
    navTextActive: '#22d3ee',
    footerBackground: 'rgba(2, 6, 23, 0.82)',
    footerBorder: 'rgba(6,182,212,0.10)',
    footerText: '#9ca3af',
    panelBackground: 'rgba(0,0,0,0.55)',
    panelBorder: 'rgba(6,182,212,0.10)',
    panelGlow: 'rgba(6,182,212,0.18)',
    text: '#f9fafb',
    textMuted: '#9ca3af',
    textSoft: '#6b7280',
    border: 'rgba(6,182,212,0.10)',
    borderStrong: 'rgba(6,182,212,0.25)',
    accent: '#22d3ee',
    accentSoft: 'rgba(34,211,238,0.15)',
    accentGlow: 'rgba(6,182,212,0.45)',
    success: '#4ade80',
    warning: '#facc15',
    danger: '#f87171',
  },
  layout: {
    density: 'comfortable',
    radius: 'xl',
    sidebar: 'expanded',
    sidebar_width: 'standard',
    topbar: 'default',
    shell_mode: 'fixed',
    content_width: 'regular',
    header_sticky: true,
    font_family: "'Segoe UI', system-ui, sans-serif",
    nav_style: 'stacked',
    header_alignment: 'left',
    footer_enabled: true,
    logo_size: 'md',
  },
  widgets: [],
  branding: null,
  is_default: true,
  is_active: true,
}

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
}

function normalizeHexOrRaw(value, fallback) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function toKebabCase(value) {
  return String(value)
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
}

function normalizeWidgetId(widget) {
  if (typeof widget === 'string') return widget.trim().toLowerCase()
  if (widget && typeof widget === 'object') {
    return String(widget.id || widget.key || widget.name || '').trim().toLowerCase()
  }
  return ''
}

function normalizeSurfaceGroup(group) {
  if (!isPlainObject(group)) {
    return { hidden: [], labels: {} }
  }

  const hidden = Array.isArray(group.hidden) ? group.hidden : Array.isArray(group.hide) ? group.hide : []
  const labels = isPlainObject(group.labels) ? group.labels : isPlainObject(group.rename) ? group.rename : {}

  return {
    hidden: hidden.map((value) => String(value).trim().toLowerCase()).filter(Boolean),
    labels: Object.fromEntries(Object.entries(labels).map(([key, value]) => [String(key).trim().toLowerCase(), String(value).trim()])),
  }
}

function roleSurfaceAliases(role) {
  const normalizedRole = String(role || 'user').trim().toLowerCase()
  const aliasMap = {
    user: ['user', 'viewer'],
    viewer: ['viewer', 'user'],
    moderator: ['moderator', 'operator'],
    operator: ['operator', 'moderator'],
    admin: ['admin'],
    superadmin: ['superadmin', 'admin'],
  }
  return aliasMap[normalizedRole] || [normalizedRole]
}

export function getFallbackTheme() {
  return DEFAULT_THEME
}

export function normalizeTheme(theme) {
  if (!theme || typeof theme !== 'object') return DEFAULT_THEME

  const colors = isPlainObject(theme.colors) ? theme.colors : {}
  const layout = isPlainObject(theme.layout) ? theme.layout : {}
  const branding = theme.branding === null || isPlainObject(theme.branding) ? theme.branding : null

  return {
    id: theme.id || DEFAULT_THEME.id,
    name: theme.name || DEFAULT_THEME.name,
    colors: {
      ...DEFAULT_THEME.colors,
      ...colors,
    },
    layout: {
      ...DEFAULT_THEME.layout,
      ...layout,
    },
    widgets: Array.isArray(theme.widgets) ? theme.widgets : [],
    branding,
    is_default: Boolean(theme.is_default),
    is_active: theme.is_active ?? true,
  }
}

export function getEnabledWidgets(theme) {
  const normalized = normalizeTheme(theme)
  return new Set(normalized.widgets.map(normalizeWidgetId).filter(Boolean))
}

export function themeHasWidget(theme, widgetId) {
  const enabled = getEnabledWidgets(theme)
  if (enabled.size === 0) return true
  return enabled.has(String(widgetId).trim().toLowerCase())
}

export function getThemeNavigationSurface(theme, role = 'viewer') {
  const normalized = normalizeTheme(theme)
  const roleSurfaces = isPlainObject(normalized.layout?.role_surfaces) ? normalized.layout.role_surfaces : {}
  const defaultSurface = normalizeSurfaceGroup(roleSurfaces.default || roleSurfaces.all)
  const resolvedSurfaces = roleSurfaceAliases(role).map((alias) => normalizeSurfaceGroup(roleSurfaces[alias]))
  const hidden = new Set(defaultSurface.hidden)
  const labels = { ...defaultSurface.labels }

  resolvedSurfaces.forEach((surface) => {
    surface.hidden.forEach((key) => hidden.add(key))
    Object.assign(labels, surface.labels)
  })

  return { hidden, labels }
}

export function applyTheme(theme) {
  if (typeof document === 'undefined') return

  const normalized = normalizeTheme(theme)
  const root = document.documentElement
  const { colors, layout, branding, widgets } = normalized
  const widgetIds = [...getEnabledWidgets(normalized)]

  Object.entries(colors).forEach(([key, value]) => {
    root.style.setProperty(`--theme-${toKebabCase(key)}`, normalizeHexOrRaw(value, ''))
  })

  root.style.setProperty('--theme-bg', normalizeHexOrRaw(colors.background, DEFAULT_THEME.colors.background))
  root.style.setProperty('--theme-body-bg', normalizeHexOrRaw(colors.background, DEFAULT_THEME.colors.background))
  root.style.setProperty('--theme-body-gradient', normalizeHexOrRaw(colors.backgroundGradient, DEFAULT_THEME.colors.backgroundGradient))
  root.style.setProperty('--theme-surface', normalizeHexOrRaw(colors.surface, DEFAULT_THEME.colors.surface))
  root.style.setProperty('--theme-surface-alt', normalizeHexOrRaw(colors.surfaceAlt, DEFAULT_THEME.colors.surfaceAlt))
  root.style.setProperty('--theme-panel', normalizeHexOrRaw(colors.panel, DEFAULT_THEME.colors.panel))
  root.style.setProperty('--theme-panel-soft', normalizeHexOrRaw(colors.panelSoft, DEFAULT_THEME.colors.panelSoft))
  root.style.setProperty('--theme-header-bg', normalizeHexOrRaw(colors.headerBackground, DEFAULT_THEME.colors.headerBackground))
  root.style.setProperty('--theme-header-border', normalizeHexOrRaw(colors.headerBorder, DEFAULT_THEME.colors.headerBorder))
  root.style.setProperty('--theme-header-text', normalizeHexOrRaw(colors.headerText, DEFAULT_THEME.colors.headerText))
  root.style.setProperty('--theme-nav-bg', normalizeHexOrRaw(colors.navBackground, DEFAULT_THEME.colors.navBackground))
  root.style.setProperty('--theme-nav-border', normalizeHexOrRaw(colors.navBorder, DEFAULT_THEME.colors.navBorder))
  root.style.setProperty('--theme-nav-text', normalizeHexOrRaw(colors.navText, DEFAULT_THEME.colors.navText))
  root.style.setProperty('--theme-nav-text-active', normalizeHexOrRaw(colors.navTextActive, DEFAULT_THEME.colors.navTextActive))
  root.style.setProperty('--theme-footer-bg', normalizeHexOrRaw(colors.footerBackground, DEFAULT_THEME.colors.footerBackground))
  root.style.setProperty('--theme-footer-border', normalizeHexOrRaw(colors.footerBorder, DEFAULT_THEME.colors.footerBorder))
  root.style.setProperty('--theme-footer-text', normalizeHexOrRaw(colors.footerText, DEFAULT_THEME.colors.footerText))
  root.style.setProperty('--theme-panel-bg', normalizeHexOrRaw(colors.panelBackground, DEFAULT_THEME.colors.panelBackground))
  root.style.setProperty('--theme-panel-border', normalizeHexOrRaw(colors.panelBorder, DEFAULT_THEME.colors.panelBorder))
  root.style.setProperty('--theme-panel-glow', normalizeHexOrRaw(colors.panelGlow, DEFAULT_THEME.colors.panelGlow))
  root.style.setProperty('--theme-text', normalizeHexOrRaw(colors.text, DEFAULT_THEME.colors.text))
  root.style.setProperty('--theme-text-muted', normalizeHexOrRaw(colors.textMuted, DEFAULT_THEME.colors.textMuted))
  root.style.setProperty('--theme-text-soft', normalizeHexOrRaw(colors.textSoft, DEFAULT_THEME.colors.textSoft))
  root.style.setProperty('--theme-border', normalizeHexOrRaw(colors.border, DEFAULT_THEME.colors.border))
  root.style.setProperty('--theme-border-strong', normalizeHexOrRaw(colors.borderStrong, DEFAULT_THEME.colors.borderStrong))
  root.style.setProperty('--theme-accent', normalizeHexOrRaw(colors.accent, DEFAULT_THEME.colors.accent))
  root.style.setProperty('--theme-accent-soft', normalizeHexOrRaw(colors.accentSoft, DEFAULT_THEME.colors.accentSoft))
  root.style.setProperty('--theme-accent-glow', normalizeHexOrRaw(colors.accentGlow, DEFAULT_THEME.colors.accentGlow))
  root.style.setProperty('--theme-success', normalizeHexOrRaw(colors.success, DEFAULT_THEME.colors.success))
  root.style.setProperty('--theme-warning', normalizeHexOrRaw(colors.warning, DEFAULT_THEME.colors.warning))
  root.style.setProperty('--theme-danger', normalizeHexOrRaw(colors.danger, DEFAULT_THEME.colors.danger))
  root.style.setProperty('--theme-font-sans', layout.font_family || DEFAULT_THEME.layout.font_family)

  root.dataset.themeId = normalized.id
  root.dataset.themeDensity = layout.density || DEFAULT_THEME.layout.density
  root.dataset.themeRadius = layout.radius || DEFAULT_THEME.layout.radius
  root.dataset.themeSidebar = layout.sidebar || DEFAULT_THEME.layout.sidebar
  root.dataset.themeSidebarWidth = layout.sidebar_width || DEFAULT_THEME.layout.sidebar_width
  root.dataset.themeTopbar = layout.topbar || DEFAULT_THEME.layout.topbar
  root.dataset.themeShellMode = layout.shell_mode || DEFAULT_THEME.layout.shell_mode
  root.dataset.themeContentWidth = layout.content_width || DEFAULT_THEME.layout.content_width
  root.dataset.themeHeaderSticky = layout.header_sticky === false ? 'false' : 'true'
  root.dataset.themeNavStyle = layout.nav_style || DEFAULT_THEME.layout.nav_style
  root.dataset.themeHeaderAlignment = layout.header_alignment || DEFAULT_THEME.layout.header_alignment
  root.dataset.themeFooterEnabled = layout.footer_enabled === false ? 'false' : 'true'
  root.dataset.themeLogoSize = layout.logo_size || DEFAULT_THEME.layout.logo_size
  root.dataset.themeWidgets = String(widgets.length)
  root.dataset.themeWidgetSet = widgetIds.join(',')
  root.dataset.themeRoleSurfaces = String(Object.keys(layout.role_surfaces || {}).length)

  if (branding?.title) {
    document.title = branding.title
  } else if (branding?.company_name) {
    document.title = branding.company_name
  }
}

export function getThemeContentWidthClass(layout = {}, fullWidth = false) {
  if (fullWidth) return 'max-w-none'
  const width = layout?.content_width || DEFAULT_THEME.layout.content_width
  if (width === 'narrow') return 'max-w-5xl'
  if (width === 'wide') return 'max-w-[1900px]'
  if (width === 'full') return 'max-w-none'
  return 'max-w-[1720px]'
}

export function extractResolvedTheme(payload) {
  if (!payload || typeof payload !== 'object') {
    return {
      selectedThemeId: null,
      themeSource: 'default',
      resolvedTheme: DEFAULT_THEME,
      defaultThemeId: DEFAULT_THEME.id,
      availableThemes: [DEFAULT_THEME],
      fallbackReason: 'missing_payload',
      resolvedFromFallback: true,
    }
  }

  const availableThemes = Array.isArray(payload.available_themes)
    ? payload.available_themes.map(normalizeTheme)
    : [DEFAULT_THEME]

  const resolvedTheme = normalizeTheme(payload.resolved_theme)
  const fallbackReason = payload.fallback_reason || payload.fallback?.reason || null
  const resolvedFromFallback = Boolean(payload.fallback_applied || payload.fallback?.applied || fallbackReason)

  return {
    selectedThemeId: payload.selected_theme_id ?? null,
    themeSource: payload.theme_source || 'default',
    resolvedTheme,
    defaultThemeId: payload.default_theme_id || resolvedTheme.id || DEFAULT_THEME.id,
    availableThemes,
    fallbackReason,
    resolvedFromFallback,
  }
}

export function bootstrapFallbackTheme() {
  applyTheme(DEFAULT_THEME)
}
