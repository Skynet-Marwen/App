import { useCallback, useEffect, useMemo, useState } from 'react'
import { themesApi } from '../services/api'

const DEFAULT_THEME_FORM = {
  id: '',
  name: '',
  colors: {
    primary: '#06b6d4',
    secondary: '#8b5cf6',
    accent: '#22c55e',
    background: '#0b1120',
    backgroundGradient: 'radial-gradient(circle at top, rgba(34,211,238,0.10), transparent 42%), linear-gradient(180deg, #0b1120 0%, #050814 100%)',
    surface: '#111827',
    surfaceAlt: 'rgba(17,24,39,0.85)',
    headerBackground: '#020617',
    headerBorder: '#164e63',
    navBackground: '#030712',
    navBorder: '#164e63',
    navText: '#94a3b8',
    navTextActive: '#67e8f9',
    footerBackground: '#020617',
    footerBorder: '#164e63',
    footerText: '#94a3b8',
    panelBackground: '#111827',
    panelBorder: '#164e63',
    panelGlow: '#0891b2',
    text: '#e5e7eb',
    muted: '#6b7280',
  },
  layout: {
    density: 'comfortable',
    radius: 'xl',
    mode: 'dark',
    sidebar: 'expanded',
    sidebar_width: 'standard',
    shell_mode: 'fixed',
    content_width: 'regular',
    header_sticky: true,
    nav_style: 'stacked',
    topbar: 'default',
    header_alignment: 'left',
    footer_enabled: true,
    logo_size: 'md',
    font_family: "'Segoe UI', system-ui, sans-serif",
  },
  widgets: [],
  branding: {
    logo_url: '',
    logo_text: 'SkyNet',
    company_name: '',
    title: '',
    tagline: '',
  },
  is_active: true,
}

function normalizeTheme(theme) {
  return {
    id: theme?.id ?? '',
    name: theme?.name ?? '',
    colors: typeof theme?.colors === 'object' && theme?.colors !== null ? theme.colors : {},
    layout: typeof theme?.layout === 'object' && theme?.layout !== null ? theme.layout : {},
    widgets: Array.isArray(theme?.widgets) ? theme.widgets : [],
    branding: typeof theme?.branding === 'object' && theme?.branding !== null ? theme.branding : null,
    is_default: !!theme?.is_default,
    is_active: theme?.is_active ?? true,
  }
}

function parseJsonField(value, fieldName) {
  if (!value.trim()) {
    if (fieldName === 'widgets') return []
    if (fieldName === 'branding') return null
    return {}
  }

  try {
    const parsed = JSON.parse(value)

    if (fieldName === 'widgets' && !Array.isArray(parsed)) {
      return { error: 'Widgets must be a JSON array.' }
    }

    if (fieldName !== 'widgets' && fieldName !== 'branding' && (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))) {
      return { error: `${fieldName} must be a JSON object.` }
    }

    if (fieldName === 'branding' && parsed !== null && (typeof parsed !== 'object' || Array.isArray(parsed))) {
      return { error: 'Branding must be a JSON object or null.' }
    }

    return { value: parsed }
  } catch {
    return { error: `Invalid JSON in ${fieldName}.` }
  }
}

function stringifyJson(value, fallback) {
  return JSON.stringify(value ?? fallback, null, 2)
}

function extractApiError(error, fallback) {
  return error?.response?.data?.detail || error?.message || fallback
}

export function useThemesAdmin() {
  const [themes, setThemes] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [actionLoading, setActionLoading] = useState({})
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const refreshThemes = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await themesApi.list()
      const nextThemes = Array.isArray(res.data) ? res.data.map(normalizeTheme) : []
      setThemes(nextThemes)
    } catch (err) {
      setError(extractApiError(err, 'Failed to load themes.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshThemes()
  }, [refreshThemes])

  const themeMap = useMemo(
    () => Object.fromEntries(themes.map((theme) => [theme.id, theme])),
    [themes]
  )

  const buildFormState = useCallback((theme = null) => {
    const current = theme ? normalizeTheme(theme) : { ...DEFAULT_THEME_FORM, is_default: false }
    return {
      id: current.id,
      name: current.name,
      colorsText: stringifyJson(current.colors, {}),
      layoutText: stringifyJson(current.layout, {}),
      widgetsText: stringifyJson(current.widgets, []),
      brandingText: stringifyJson(current.branding, null),
      is_active: current.is_active ?? true,
      is_default: current.is_default ?? false,
    }
  }, [])

  const validateAndBuildPayload = useCallback((form) => {
    const trimmedId = form.id.trim()
    const trimmedName = form.name.trim()
    const fieldErrors = {}

    if (!trimmedId) fieldErrors.id = 'Theme id is required.'
    if (!trimmedName) fieldErrors.name = 'Theme name is required.'

    const colorsResult = parseJsonField(form.colorsText, 'colors')
    const layoutResult = parseJsonField(form.layoutText, 'layout')
    const widgetsResult = parseJsonField(form.widgetsText, 'widgets')
    const brandingResult = parseJsonField(form.brandingText, 'branding')

    if (colorsResult.error) fieldErrors.colorsText = colorsResult.error
    if (layoutResult.error) fieldErrors.layoutText = layoutResult.error
    if (widgetsResult.error) fieldErrors.widgetsText = widgetsResult.error
    if (brandingResult.error) fieldErrors.brandingText = brandingResult.error

    if (Object.keys(fieldErrors).length > 0) {
      return { fieldErrors }
    }

    const payload = {
      id: trimmedId,
      name: trimmedName,
      colors: colorsResult.value,
      layout: layoutResult.value,
      widgets: widgetsResult.value,
      branding: brandingResult.value,
      is_active: !!form.is_active,
    }

    return { payload }
  }, [])

  const saveTheme = useCallback(async ({ form, originalId = null, isEdit = false }) => {
    setSaving(true)
    setError('')
    setSuccess('')

    const validation = validateAndBuildPayload(form)
    if (validation.fieldErrors) {
      setSaving(false)
      return { ok: false, fieldErrors: validation.fieldErrors }
    }

    try {
      if (isEdit && originalId) {
        await themesApi.update(originalId, validation.payload)
        setSuccess(`Theme "${validation.payload.name}" updated.`)
      } else {
        await themesApi.create(validation.payload)
        setSuccess(`Theme "${validation.payload.name}" created.`)
      }

      await refreshThemes()
      return { ok: true }
    } catch (err) {
      const message = extractApiError(err, isEdit ? 'Failed to update theme.' : 'Failed to create theme.')
      setError(message)
      return { ok: false, formError: message }
    } finally {
      setSaving(false)
    }
  }, [refreshThemes, validateAndBuildPayload])

  const runRowAction = useCallback(async (key, action) => {
    setActionLoading((prev) => ({ ...prev, [key]: true }))
    setError('')
    setSuccess('')
    try {
      await action()
      await refreshThemes()
      return true
    } catch (err) {
      setError(extractApiError(err, 'Theme action failed.'))
      return false
    } finally {
      setActionLoading((prev) => ({ ...prev, [key]: false }))
    }
  }, [refreshThemes])

  const deleteTheme = useCallback(async (theme) => {
    return runRowAction(`delete:${theme.id}`, async () => {
      await themesApi.delete(theme.id)
      setSuccess(`Theme "${theme.name}" deleted.`)
    })
  }, [runRowAction])

  const setDefaultTheme = useCallback(async (theme) => {
    return runRowAction(`default:${theme.id}`, async () => {
      await themesApi.setDefault({ theme_id: theme.id })
      setSuccess(`Theme "${theme.name}" is now the default.`)
    })
  }, [runRowAction])

  const uploadLogo = useCallback(async (themeId, file) => {
    setUploadingLogo(true)
    setError('')
    setSuccess('')
    try {
      const res = await themesApi.uploadLogo(themeId, file)
      await refreshThemes()
      setSuccess('Theme logo uploaded.')
      return normalizeTheme(res.data)
    } catch (err) {
      setError(extractApiError(err, 'Failed to upload theme logo.'))
      throw err
    } finally {
      setUploadingLogo(false)
    }
  }, [refreshThemes])

  const removeLogo = useCallback(async (themeId) => {
    setUploadingLogo(true)
    setError('')
    setSuccess('')
    try {
      const res = await themesApi.removeLogo(themeId)
      await refreshThemes()
      setSuccess('Theme logo removed.')
      return normalizeTheme(res.data)
    } catch (err) {
      setError(extractApiError(err, 'Failed to remove theme logo.'))
      throw err
    } finally {
      setUploadingLogo(false)
    }
  }, [refreshThemes])

  return {
    themes,
    themeMap,
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
  }
}
