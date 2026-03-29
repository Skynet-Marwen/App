import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { authApi } from '../services/api'

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
        try { await authApi.logout() } catch (_) {}
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
