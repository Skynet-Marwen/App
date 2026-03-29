import { Bell, Search, RefreshCw } from 'lucide-react'
import { useUIStore, useAuthStore } from '../../store/useAppStore'
import { useState } from 'react'

const RANGES = ['1h', '24h', '7d', '30d']

export default function Topbar({ title, showRange = false, onRefresh }) {
  const { notifications, clearNotification, statsRange, setStatsRange } = useUIStore()
  const [showNotifs, setShowNotifs] = useState(false)
  const unread = notifications.filter((n) => !n.read).length

  return (
    <header className="h-16 bg-gray-900/80 backdrop-blur border-b border-gray-800 flex items-center justify-between px-6 sticky top-0 z-20">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold text-white">{title}</h1>
        {showRange && (
          <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
            {RANGES.map((r) => (
              <button
                key={r}
                onClick={() => setStatsRange(r)}
                className={`px-3 py-1 text-xs rounded-md font-medium transition ${
                  statsRange === r
                    ? 'bg-cyan-500 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="p-2 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition"
          >
            <RefreshCw size={16} />
          </button>
        )}

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotifs(!showNotifs)}
            className="p-2 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition relative"
          >
            <Bell size={16} />
            {unread > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            )}
          </button>
          {showNotifs && (
            <div className="absolute right-0 mt-2 w-80 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50">
              <div className="p-3 border-b border-gray-800 flex items-center justify-between">
                <span className="text-sm font-medium text-white">Notifications</span>
                <span className="text-xs text-gray-500">{unread} unread</span>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-6">No notifications</p>
                ) : (
                  notifications.slice(0, 10).map((n) => (
                    <div
                      key={n.id}
                      className="flex items-start gap-3 p-3 hover:bg-gray-800 transition border-b border-gray-800/50"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-white truncate">{n.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{n.message}</p>
                      </div>
                      <button
                        onClick={() => clearNotification(n.id)}
                        className="text-gray-600 hover:text-white text-xs"
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
    </header>
  )
}
