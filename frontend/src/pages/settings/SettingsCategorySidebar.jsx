import { BellRing, Database, LockKeyhole, Network, Palette, Plug, Shield, ShieldBan, Wrench } from 'lucide-react'

const ICONS = {
  shield: Shield,
  network: Network,
  lock: LockKeyhole,
  palette: Palette,
  database: Database,
  plug: Plug,
  bell: BellRing,
  ban: ShieldBan,
  wrench: Wrench,
}

export default function SettingsCategorySidebar({ sections, activeKey, onSelect }) {
  return (
    <div className="sticky top-0 z-20">
      <nav
        aria-label="Settings section navigation"
        className="flex flex-nowrap items-center gap-5 overflow-x-auto overscroll-x-contain pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {sections.map((section) => {
          const Icon = ICONS[section.icon] || Wrench
          const isActive = section.key === activeKey

          return (
            <button
              key={section.key}
              type="button"
              onClick={() => onSelect(section.key)}
              aria-current={isActive ? 'page' : undefined}
              className={`group inline-flex min-w-fit items-center gap-2 whitespace-nowrap border-b-2 pb-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'border-cyan-400 text-white'
                  : 'border-transparent text-gray-500 hover:text-gray-200'
              }`}
            >
              <span className={isActive ? 'text-cyan-300' : 'text-gray-600 group-hover:text-gray-300'}>
                <Icon size={14} />
              </span>
              <span>{section.title}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}
