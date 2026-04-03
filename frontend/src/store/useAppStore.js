import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { authApi, settingsApi } from '../services/api'
import { DEFAULT_UI_VISIBILITY, mergeUiVisibility } from '../services/uiVisibility'

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      login: async (credentials) => {
        const res = await authApi.login(credentials)
        const { access_token, user } = res.data
        localStorage.setItem('skynet_token', access_token)
        set({ user, token: access_token, isAuthenticated: true })
        return res.data
      },

      logout: async () => {
        try {
          await authApi.logout()
        } catch {
          return null
        }
        localStorage.removeItem('skynet_token')
        set({ user: null, token: null, isAuthenticated: false })
      },

      fetchMe: async () => {
        const res = await authApi.me()
        set({ user: res.data, isAuthenticated: true })
      },
    }),
    { name: 'skynet-auth', partialize: (s) => ({ token: s.token, user: s.user, isAuthenticated: s.isAuthenticated }) }
  )
)

export const useUIStore = create((set) => ({
  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  notifications: [],
  addNotification: (notif) =>
    set((s) => ({
      notifications: [{ id: Date.now(), ...notif }, ...s.notifications].slice(0, 50),
    })),
  clearNotification: (id) =>
    set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) })),

  statsRange: '24h',
  setStatsRange: (range) => set({ statsRange: range }),
}))

export const useRuntimeSettingsStore = create((set, get) => ({
  developerModeEnabled: false,
  featureFlags: {},
  uiVisibility: DEFAULT_UI_VISIBILITY,
  runtimeLoaded: false,
  runtimeLoading: false,

  applyRuntimeSettings: (settings = {}) =>
    set({
      developerModeEnabled: !!settings.developer_mode_enabled,
      featureFlags: settings.feature_flags || {},
      uiVisibility: mergeUiVisibility(settings.ui_visibility),
      runtimeLoaded: true,
    }),

  fetchRuntimeSettings: async (force = false) => {
    if (get().runtimeLoading) return
    if (!force && get().runtimeLoaded) return

    set({ runtimeLoading: true })
    try {
      const response = await settingsApi.get()
      get().applyRuntimeSettings(response.data)
    } catch {
      set({ runtimeLoaded: true })
    } finally {
      set({ runtimeLoading: false })
    }
  },
}))
