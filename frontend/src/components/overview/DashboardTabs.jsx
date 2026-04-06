/**
 * DashboardTabs — Top-level navigation between Monitor / Command / Intelligence / Stats.
 * Accepts optional alertCounts for badge indicators on each tab.
 */
import { Activity, Shield, Eye, BarChart2 } from 'lucide-react'

const TABS = [
  { id: 'monitor',      label: 'Monitor',        Icon: Activity,  desc: 'Ops overview'         },
  { id: 'command',      label: 'Command Center',  Icon: Shield,    desc: 'Incidents & actions'  },
  { id: 'intelligence', label: 'Intelligence',    Icon: Eye,       desc: 'Signals & identity'   },
  { id: 'stats',        label: 'Stats',           Icon: BarChart2, desc: 'Analytics & history'  },
]

export default function DashboardTabs({ active, onChange, alertCounts = {} }) {
  return (
    <div className="flex items-stretch gap-1 rounded-xl border border-cyan-500/10 bg-black/30 p-1 backdrop-blur-sm">
      {TABS.map(({ id, label, Icon, desc }) => {
        const isActive = active === id
        const count = alertCounts[id] ?? 0
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            title={desc}
            className={`relative flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-mono font-medium transition ${
              isActive
                ? 'border border-cyan-500/40 bg-cyan-500/15 text-cyan-300'
                : 'border border-transparent text-gray-500 hover:bg-cyan-500/5 hover:text-gray-300'
            }`}
          >
            <Icon size={13} className="shrink-0" />
            <span className="hidden sm:inline">{label}</span>
            {count > 0 && (
              <span className="absolute right-1 top-1 flex h-3.5 min-w-[0.875rem] items-center justify-center rounded-full bg-red-500 px-0.5 text-[8px] font-bold leading-none text-white">
                {count > 99 ? '99+' : count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
