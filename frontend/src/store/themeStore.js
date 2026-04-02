import { create } from 'zustand'
import { themesApi, userThemeApi } from '../services/api'
import {
  applyTheme,
  extractResolvedTheme,
  getFallbackTheme,
  normalizeTheme,
} from '../services/themeEngine'

const fallbackTheme = getFallbackTheme()

export const useThemeStore = create((set, get) => ({
  availableThemes: [fallbackTheme],
  currentTheme: fallbackTheme,
  selectedThemeId: null,
  themeSource: 'default',
  defaultThemeId: fallbackTheme.id,
  fallbackReason: null,
  resolvedFromFallback: false,
  isBootstrapped: false,
  loading: false,
  error: null,

  applyResolvedTheme: (themePayload) => {
    const resolved = extractResolvedTheme(themePayload)

    applyTheme(resolved.resolvedTheme)

    set({
      availableThemes: resolved.availableThemes.length ? resolved.availableThemes : [fallbackTheme],
      currentTheme: resolved.resolvedTheme,
      selectedThemeId: resolved.selectedThemeId,
      themeSource: resolved.themeSource,
      defaultThemeId: resolved.defaultThemeId,
      fallbackReason: resolved.fallbackReason,
      resolvedFromFallback: resolved.resolvedFromFallback,
      isBootstrapped: true,
      error: null,
    })

    return resolved
  },

  loadThemeContext: async () => {
    set({ loading: true, error: null })

    try {
      const res = await userThemeApi.get()
      get().applyResolvedTheme(res.data)
      set({ loading: false })
      return res.data
    } catch (error) {
      try {
        const res = await themesApi.list()
        const themes = Array.isArray(res.data) ? res.data.map(normalizeTheme) : []
        const activeThemes = themes.filter((theme) => theme.is_active !== false)
        const defaultTheme = activeThemes.find((theme) => theme.is_default) || activeThemes[0] || fallbackTheme

        applyTheme(defaultTheme)

        set({
          availableThemes: activeThemes.length ? activeThemes : [fallbackTheme],
          currentTheme: defaultTheme,
          selectedThemeId: defaultTheme.id,
          themeSource: 'default',
          defaultThemeId: defaultTheme.id,
          fallbackReason: 'theme_context_unavailable',
          resolvedFromFallback: true,
          isBootstrapped: true,
          loading: false,
          error: error?.response?.data?.detail || error.message || 'Failed to load theme context',
        })
      } catch (listError) {
        applyTheme(fallbackTheme)

        set({
          availableThemes: [fallbackTheme],
          currentTheme: fallbackTheme,
          selectedThemeId: null,
          themeSource: 'default',
          defaultThemeId: fallbackTheme.id,
          fallbackReason: 'theme_registry_unavailable',
          resolvedFromFallback: true,
          isBootstrapped: true,
          loading: false,
          error: listError?.response?.data?.detail || listError.message || 'Failed to load themes',
        })
      }
    }
  },

  selectTheme: async (themeId, themeSource = null) => {
    set({ loading: true, error: null })

    try {
      const payload = themeId
        ? { theme_id: themeId, theme_source: themeSource || 'user' }
        : { theme_source: themeSource || 'default' }
      const res = await userThemeApi.set(payload)
      get().applyResolvedTheme(res.data)
      set({ loading: false })
      return res.data
    } catch (error) {
      set({
        loading: false,
        error: error?.response?.data?.detail || error.message || 'Failed to update theme',
      })
      throw error
    }
  },

  resetToDefault: async () => {
    return get().selectTheme(null, 'default')
  },

  clearThemeState: () => {
    applyTheme(fallbackTheme)
    set({
      availableThemes: [fallbackTheme],
      currentTheme: fallbackTheme,
      selectedThemeId: null,
      themeSource: 'default',
      defaultThemeId: fallbackTheme.id,
      fallbackReason: null,
      resolvedFromFallback: false,
      isBootstrapped: false,
      loading: false,
      error: null,
    })
  },
}))
