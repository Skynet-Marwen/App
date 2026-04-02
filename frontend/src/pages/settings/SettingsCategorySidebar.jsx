import { Badge, Card } from '../../components/ui'
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

const STATUS_VARIANTS = {
  live: 'success',
  partial: 'warning',
  planned: 'default',
}

export default function SettingsCategorySidebar({ sections, activeKey, onSelect }) {
  return (
    <aside className="space-y-4 xl:sticky xl:top-0 xl:flex xl:max-h-[calc(100dvh-2rem)] xl:flex-col xl:overflow-hidden">
      <Card className="xl:flex-shrink-0">
        <div className="space-y-2">
          <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-cyan-400">Settings Domains</p>
          <p className="text-sm text-white font-medium">Clean, grouped settings with room for the next SaaS layers.</p>
          <p className="text-xs text-gray-500">
            Each domain keeps today&apos;s working controls visible while reserving clear space for upcoming controls.
          </p>
        </div>
      </Card>

      <nav aria-label="Settings section navigation" className="space-y-3 xl:flex-1 xl:overflow-y-auto xl:pr-1">
        {sections.map((section) => {
          const Icon = ICONS[section.icon] || Wrench
          const isActive = section.key === activeKey
          return (
            <button
              key={section.key}
              type="button"
              onClick={() => onSelect(section.key)}
              aria-current={isActive ? 'page' : undefined}
              className={`w-full rounded-2xl border p-4 text-left transition ${
                isActive
                  ? 'border-cyan-500/40 bg-cyan-500/10 shadow-[0_0_22px_rgba(6,182,212,0.12)]'
                  : 'border-cyan-500/10 bg-black/25 hover:border-cyan-500/20 hover:bg-cyan-500/5'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 rounded-xl border p-2 ${isActive ? 'border-cyan-400/40 text-cyan-300' : 'border-cyan-500/15 text-gray-500'}`}>
                  <Icon size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={`text-sm font-medium ${isActive ? 'text-white' : 'text-gray-200'}`}>{section.title}</p>
                    <Badge variant="info" className="text-[10px]">
                      {section.capabilities.filter((item) => item.status === 'live').length} live
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">{section.description}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {section.capabilities.slice(0, 3).map((capability) => (
                      <Badge key={capability.label} variant={STATUS_VARIANTS[capability.status]} className="text-[10px]">
                        {capability.label}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </button>
          )
        })}
      </nav>
    </aside>
  )
}
