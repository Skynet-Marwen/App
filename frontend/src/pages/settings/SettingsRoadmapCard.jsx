import { Badge, Card, CardHeader } from '../../components/ui'

const STATUS_VARIANTS = {
  live: 'success',
  partial: 'warning',
  planned: 'default',
}

const STATUS_LABELS = {
  live: 'Live',
  partial: 'Partial',
  planned: 'Planned',
}

export default function SettingsRoadmapCard({ eyebrow = 'Coverage', title, description, groups }) {
  return (
    <Card>
      <CardHeader>
        <div>
          <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-cyan-400">{eyebrow}</p>
          <p className="mt-2 text-sm font-medium text-white">{title}</p>
          {description ? <p className="mt-1 text-xs text-gray-500">{description}</p> : null}
        </div>
      </CardHeader>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {groups.map((group) => (
          <div key={group.title} className="rounded-xl border border-cyan-500/10 bg-black/25 p-4">
            <p className="text-xs font-mono uppercase tracking-[0.18em] text-gray-400">{group.title}</p>
            <div className="mt-3 space-y-2">
              {group.items.map((item) => (
                <div key={item.label} className="flex items-start justify-between gap-3 rounded-lg border border-cyan-500/10 bg-black/20 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm text-white">{item.label}</p>
                    {item.note ? <p className="mt-1 text-xs text-gray-500">{item.note}</p> : null}
                  </div>
                  <Badge variant={STATUS_VARIANTS[item.status] || 'default'}>{STATUS_LABELS[item.status] || 'Planned'}</Badge>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
