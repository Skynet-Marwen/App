import { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, Monitor, Shield, AlertTriangle,
  Plug, Settings, LogOut, ChevronLeft, ChevronRight,
  Eye, Activity, Info, Cpu
} from 'lucide-react'
import { ScrollText } from 'lucide-react'
import { useUIStore, useAuthStore } from '../../store/useAppStore'
import { systemApi } from '../../services/api'

const navItems = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, exact: true },
  { to: '/visitors', label: 'Visitors', icon: Eye },
  { to: '/users', label: 'Users', icon: Users },
  { to: '/devices', label: 'Devices', icon: Monitor },
  { to: '/blocking', label: 'Blocking', icon: Shield },
  { to: '/anti-evasion', label: 'Anti-Evasion', icon: AlertTriangle },
  { to: '/audit', label: 'Audit', icon: ScrollText },
  { to: '/integration', label: 'Integration', icon: Plug },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export default function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useUIStore()
  const { logout, user } = useAuthStore()
  const navigate = useNavigate()
  const [versionInfo, setVersionInfo] = useState(null)
  const [showVersions, setShowVersions] = useState(false)

  useEffect(() => {
    systemApi.info().then(r => setVersionInfo(r.data)).catch(() => {})
  }, [])

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <aside
      className={`flex flex-col border-r border-cyan-500/10 transition-all duration-300 ${
        sidebarCollapsed ? 'w-16' : 'w-60'
      } min-h-screen`}
      style={{ background: 'rgba(3,3,3,0.95)', backdropFilter: 'blur(8px)' }}
    >
      {/* Logo */}
      <div className="flex items-center justify-between px-4 py-5 border-b border-cyan-500/10">
        {!sidebarCollapsed && (
          <div className="flex items-center gap-2">
            <Activity className="text-cyan-400" size={22} />
            <span className="text-white font-bold text-lg tracking-wide">SkyNet</span>
          </div>
        )}
        {sidebarCollapsed && <Activity className="text-cyan-400 mx-auto" size={22} />}
        <button
          onClick={toggleSidebar}
          className="p-1 rounded hover:bg-gray-800 text-gray-400 hover:text-white transition ml-auto"
        >
          {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 space-y-1 px-2">
        {navItems.map(({ to, label, icon: Icon, exact }) => (
          <NavLink
            key={to}
            to={to}
            end={exact}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-mono font-medium tracking-wide transition-all ${
                isActive
                  ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/25 neon-text-cyan'
                  : 'text-gray-500 hover:bg-cyan-500/5 hover:text-gray-200 border border-transparent'
              }`
            }
          >
            <Icon size={18} className="flex-shrink-0" />
            {!sidebarCollapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Version info + User / Logout */}
      <div className="p-3 border-t border-cyan-500/10 space-y-1">

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
