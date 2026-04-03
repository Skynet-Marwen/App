/* global __APP_VERSION__ */

import { useState, useEffect } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, UserCog, Monitor, Shield, AlertTriangle,
  Plug, Settings, LogOut, ChevronLeft, ChevronRight,
  Eye, Activity, Info, Cpu
} from 'lucide-react'
import { ScrollText } from 'lucide-react'
import { useUIStore, useAuthStore, useRuntimeSettingsStore } from '../../store/useAppStore'
import { systemApi } from '../../services/api'
import { useThemeStore } from '../../store/themeStore'
import { getThemeNavigationSurface } from '../../services/themeEngine'
import { isUiVisible } from '../../services/uiVisibility'

const navItems = [
  { key: 'overview', to: '/', label: 'Overview', icon: LayoutDashboard, exact: true },
  { key: 'visitors', to: '/visitors', label: 'Visitors', icon: Eye },
  { key: 'users', to: '/users', label: 'Portal Users', icon: UserCog },
  { key: 'devices', to: '/devices', label: 'Devices', icon: Monitor },
  { key: 'blocking', to: '/blocking', label: 'Blocking', icon: Shield },
  { key: 'anti-evasion', to: '/anti-evasion', label: 'Anti-Evasion', icon: AlertTriangle },
  { key: 'audit', to: '/audit', label: 'Audit', icon: ScrollText },
  { key: 'integration', to: '/integration', label: 'Integration', icon: Plug },
  { key: 'settings', to: '/settings', label: 'Settings', icon: Settings },
]

export default function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useUIStore()
  const { logout, user } = useAuthStore()
  const location = useLocation()
  const currentTheme = useThemeStore((state) => state.currentTheme)
  const uiVisibility = useRuntimeSettingsStore((state) => state.uiVisibility)
  const fetchRuntimeSettings = useRuntimeSettingsStore((state) => state.fetchRuntimeSettings)
  const navigate = useNavigate()
  const [versionInfo, setVersionInfo] = useState(null)
  const [showVersions, setShowVersions] = useState(false)
  const roleSurface = getThemeNavigationSurface(currentTheme, user?.role)
  const brandLabel = currentTheme?.branding?.logo_text || currentTheme?.branding?.company_name || 'SkyNet'
  const logoUrl = currentTheme?.branding?.logo_url || ''
  const logoSize = currentTheme?.layout?.logo_size || 'md'
  const sidebarWidth = currentTheme?.layout?.sidebar_width || 'standard'
  const logoClassName = logoSize === 'lg' ? 'h-10 w-10' : logoSize === 'sm' ? 'h-6 w-6' : 'h-8 w-8'
  const expandedWidthClass = sidebarWidth === 'wide' ? 'w-72' : sidebarWidth === 'narrow' ? 'w-56' : 'w-60'
  const tenantLabel = user?.tenant_name || user?.tenant_slug || ''

  useEffect(() => {
    systemApi.info().then(r => setVersionInfo(r.data)).catch(() => {})
    fetchRuntimeSettings().catch(() => {})
  }, [fetchRuntimeSettings])

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <aside
      className={`flex flex-col border-r border-cyan-500/10 transition-all duration-300 ${
        sidebarCollapsed ? 'w-16' : expandedWidthClass
      } h-screen flex-shrink-0 sticky top-0 overflow-hidden`}
      style={{ background: 'var(--theme-nav-bg)', borderColor: 'var(--theme-nav-border)', backdropFilter: 'blur(8px)' }}
    >
      {/* Logo */}
      <div className="flex items-center justify-between px-4 py-5 border-b border-cyan-500/10">
        {!sidebarCollapsed && (
          <div className="flex items-center gap-2">
            {logoUrl ? (
              <img src={logoUrl} alt="" className={`${logoClassName} rounded-xl object-cover border border-white/10`} />
            ) : (
              <Activity className="text-cyan-400" size={22} />
            )}
            <span className="text-white font-bold text-lg tracking-wide">{brandLabel}</span>
          </div>
        )}
        {sidebarCollapsed && (logoUrl ? <img src={logoUrl} alt="" className="h-8 w-8 rounded-xl object-cover border border-white/10 mx-auto" /> : <Activity className="text-cyan-400 mx-auto" size={22} />)}
        <button
          onClick={toggleSidebar}
          className="p-1 rounded hover:bg-gray-800 text-gray-400 hover:text-white transition ml-auto"
        >
          {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 min-h-0 overflow-y-auto py-4 space-y-1 px-2">
        {navItems
          .filter(({ key, to, exact }) => {
            const isCurrentEntry = exact ? location.pathname === to : location.pathname.startsWith(to)
            return !roleSurface.hidden.has(key) && (isUiVisible(uiVisibility, `navigation.${key}`) || isCurrentEntry)
          })
          .map(({ key, to, label, icon, exact }) => {
            const NavIcon = icon
            return (
          <NavLink
            key={key}
            to={to}
            end={exact}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-mono font-medium tracking-wide transition-all ${
                isActive
                  ? 'border neon-text-cyan'
                  : 'border border-transparent'
              }`
            }
            style={({ isActive }) => ({
              color: isActive ? 'var(--theme-nav-text-active)' : 'var(--theme-nav-text)',
              background: isActive ? 'rgba(34,211,238,0.10)' : 'transparent',
              borderColor: isActive ? 'var(--theme-nav-border)' : 'transparent',
            })}
          >
            <NavIcon size={18} className="flex-shrink-0" />
            {!sidebarCollapsed && <span>{roleSurface.labels[key] || label}</span>}
          </NavLink>
            )
          })}
      </nav>

      {/* Version info + User / Logout */}
      <div className="p-3 border-t border-cyan-500/10 space-y-1 flex-shrink-0">

        {/* Version panel — expanded sidebar only */}
        {!sidebarCollapsed && versionInfo && (
          <div className="mb-1">
            <button
              onClick={() => setShowVersions(v => !v)}
              className="flex items-center gap-2 w-full px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition"
            >
              <Info size={13} className="flex-shrink-0" />
              <span className="flex-1 text-left">
                SkyNet <span className="text-cyan-500">v{__APP_VERSION__}</span>
              </span>
              <span className="text-gray-600">{showVersions ? '▲' : '▼'}</span>
            </button>

            {showVersions && (
              <div className="mx-2 mt-1 mb-1 rounded-lg bg-gray-800/60 border border-gray-700/50 px-3 py-2 space-y-1">
                {[
                  ['Frontend',    `v${__APP_VERSION__}`],
                  ['Backend',     `v${versionInfo.app}`],
                  ['API',         versionInfo.api],
                  ['FastAPI',     versionInfo.fastapi],
                  ['Python',      versionInfo.python],
                  ['SQLAlchemy',  versionInfo.sqlalchemy],
                  ['Alembic',     versionInfo.alembic],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between items-center">
                    <span className="text-gray-500 text-xs">{label}</span>
                    <span className="text-gray-300 text-xs font-mono">{value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Collapsed: version dot tooltip */}
        {sidebarCollapsed && versionInfo && (
          <div className="flex justify-center mb-1" title={`SkyNet v${versionInfo.app}`}>
            <span className="w-2 h-2 rounded-full bg-cyan-500/50" />
          </div>
        )}

        {/* User info */}
        {!sidebarCollapsed && user && (
          <div className="px-3 py-1.5">
            <p className="text-xs text-gray-400 truncate">{user.email}</p>
            <p className="text-xs text-gray-600 capitalize">{user.role}</p>
            {tenantLabel ? <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">{tenantLabel}</p> : null}
          </div>
        )}

        {/* CPU secure access indicator */}
        <div className={`flex items-center gap-2 px-3 py-1.5 ${sidebarCollapsed ? 'justify-center' : ''}`}>
          <Cpu size={13} className="text-cyan-500/50 flex-shrink-0 animate-pulse" />
          {!sidebarCollapsed && (
            <span className="text-xs font-mono text-cyan-500/40 tracking-widest">SECURE ACCESS</span>
          )}
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-xs font-mono text-gray-500 hover:bg-red-500/10 hover:text-red-400 border border-transparent hover:border-red-500/20 transition"
        >
          <LogOut size={15} className="flex-shrink-0" />
          {!sidebarCollapsed && <span>LOGOUT</span>}
        </button>
      </div>
    </aside>
  )
}
