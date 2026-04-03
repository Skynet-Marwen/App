import { Bell, RefreshCw } from 'lucide-react'
import { useUIStore } from '../../store/useAppStore'
import { useState } from 'react'
import GlobalSearchCommand from './GlobalSearchCommand'
import { useThemeStore } from '../../store/themeStore'
import { getThemeContentWidthClass } from '../../services/themeEngine'

const RANGES = ['1h', '24h', '7d', '30d']

export default function Topbar({ title, showRange = false, onRefresh }) {
  const { notifications, clearNotification, statsRange, setStatsRange } = useUIStore()
  const currentTheme = useThemeStore((state) => state.currentTheme)
  const [showNotifs, setShowNotifs] = useState(false)
  const unread = notifications.filter((n) => !n.read).length
  const layout = currentTheme?.layout || {}
  const isCentered = layout.header_alignment === 'center'
  const contentWidthClass = getThemeContentWidthClass(layout)
  const topbarClass = layout.topbar === 'prominent' ? 'min-h-20' : layout.topbar === 'compact' ? 'min-h-14' : 'min-h-16'
  const stickyClass = layout.header_sticky === false ? 'relative' : 'sticky top-0'

  return (
    <header className={`flex-shrink-0 border-b backdrop-blur-md z-20 ${stickyClass}`}
      style={{ background: 'var(--theme-header-bg)', borderColor: 'var(--theme-header-border)' }}>
      <div className={`mx-auto flex w-full items-center px-4 py-3 sm:px-5 lg:px-6 xl:px-8 ${contentWidthClass} ${topbarClass}`}>
        <div className="flex w-full flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className={`flex min-w-0 flex-1 flex-col gap-3 xl:flex-row xl:items-center ${isCentered ? 'xl:justify-center' : ''}`}>
            <h1 className="truncate text-sm font-bold font-mono tracking-widest uppercase" style={{ color: 'var(--theme-header-text)' }}>{title}</h1>
            {showRange && (
              <div className="flex flex-wrap gap-1 rounded-lg border p-1" style={{ background: 'rgba(0,0,0,0.28)', borderColor: 'var(--theme-header-border)' }}>
                {RANGES.map((r) => (
                  <button
                    key={r}
                    onClick={() => setStatsRange(r)}
                    className={`px-3 py-1 text-xs rounded-md font-mono font-medium transition ${
                      statsRange === r
                        ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                        : 'text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3">
            <div className="hidden min-w-0 flex-1 xl:flex xl:justify-center">
              <GlobalSearchCommand />
            </div>
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="rounded-lg border border-transparent p-2 transition"
                style={{ color: 'var(--theme-nav-text-active)' }}
              >
                <RefreshCw size={16} />
              </button>
            )}

            <div className="relative">
              <button
                onClick={() => setShowNotifs(!showNotifs)}
                className="relative rounded-lg p-2 text-gray-400 transition hover:bg-gray-800 hover:text-white"
              >
                <Bell size={16} />
                {unread > 0 && (
                  <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500" />
                )}
              </button>
              {showNotifs && (
                <div className="absolute right-0 mt-2 w-[min(26rem,calc(100vw-2rem))] rounded-xl border border-cyan-500/15 shadow-2xl z-50"
                  style={{ background: 'rgba(4,4,4,0.95)', backdropFilter: 'blur(12px)' }}>
                  <div className="flex items-center justify-between border-b border-cyan-500/10 p-3">
                    <span className="text-sm font-medium text-white">Notifications</span>
                    <span className="text-xs text-gray-500">{unread} unread</span>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="py-6 text-center text-sm text-gray-500">No notifications</p>
                    ) : (
                      notifications.slice(0, 10).map((n) => (
                        <div
                          key={n.id}
                          className="flex items-start gap-3 border-b border-gray-800/50 p-3 transition hover:bg-gray-800"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium text-white">{n.title}</p>
                            <p className="mt-0.5 text-xs text-gray-400">{n.message}</p>
                          </div>
                          <button
                            onClick={() => clearNotification(n.id)}
                            className="text-xs text-gray-600 hover:text-white"
                          >
                            ✕
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="xl:hidden">
          <GlobalSearchCommand />
        </div>
      </div>
    </header>
  )
}
