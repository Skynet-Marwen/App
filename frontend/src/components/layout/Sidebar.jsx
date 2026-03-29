import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, Monitor, Shield, AlertTriangle,
  Plug, Settings, LogOut, ChevronLeft, ChevronRight,
  Eye, Activity
} from 'lucide-react'
import { useUIStore, useAuthStore } from '../../store/useAppStore'

const navItems = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, exact: true },
  { to: '/visitors', label: 'Visitors', icon: Eye },
  { to: '/users', label: 'Users', icon: Users },
  { to: '/devices', label: 'Devices', icon: Monitor },
  { to: '/blocking', label: 'Blocking', icon: Shield },
  { to: '/anti-evasion', label: 'Anti-Evasion', icon: AlertTriangle },
  { to: '/integration', label: 'Integration', icon: Plug },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export default function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useUIStore()
  const { logout, user } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <aside
      className={`flex flex-col bg-gray-900 border-r border-gray-800 transition-all duration-300 ${
        sidebarCollapsed ? 'w-16' : 'w-60'
      } min-h-screen`}
    >
      {/* Logo */}
      <div className="flex items-center justify-between px-4 py-5 border-b border-gray-800">
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
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`
            }
          >
            <Icon size={18} className="flex-shrink-0" />
            {!sidebarCollapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* User / Logout */}
      <div className="p-3 border-t border-gray-800">
        {!sidebarCollapsed && user && (
          <div className="mb-2 px-3 py-2">
            <p className="text-xs text-gray-400 truncate">{user.email}</p>
            <p className="text-xs text-gray-600 capitalize">{user.role}</p>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:bg-red-500/10 hover:text-red-400 transition"
        >
          <LogOut size={18} className="flex-shrink-0" />
          {!sidebarCollapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  )
}
