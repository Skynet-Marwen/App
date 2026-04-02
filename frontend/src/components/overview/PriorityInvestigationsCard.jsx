import { AlertCircle, AlertTriangle, ArrowRight, CheckCircle, Siren } from 'lucide-react'
import { Badge, Card, CardHeader } from '../ui/index'

const SEVERITY_MAP = {
  critical: { Icon: Siren, tone: 'text-red-300', badge: 'danger', border: 'border-red-500/20' },
  high: { Icon: AlertCircle, tone: 'text-red-400', badge: 'danger', border: 'border-red-500/15' },
  medium: { Icon: AlertTriangle, tone: 'text-yellow-400', badge: 'warning', border: 'border-yellow-500/15' },
  low: { Icon: CheckCircle, tone: 'text-green-400', badge: 'success', border: 'border-green-500/15' },
}

const tagVariant = (tag) => {
  if (tag === 'escalating') return 'danger'
  if (tag === 'repeated') return 'warning'
  if (tag === 'linked') return 'info'
  return 'default'
}

export default function PriorityInvestigationsCard({ investigations = [], fallbackIncidents = [], onInspect }) {
  const items = investigations.length > 0
    ? investigations
    : fallbackIncidents.map((incident) => ({
        ...incident,
        status: 'open',
        target_type: 'system',
        target_label: incident.title,
        repeat_count: 1,
        state_tags: ['observed'],
      }))

  return (
    <Card>
      <CardHeader
        action={(
          <span className="text-[10px] font-mono text-gray-700 border border-cyan-500/15 px-2 py-0.5 rounded">
            {items.length} queued
          </span>
        )}
      >
        <div>
          <p className="text-xs font-mono font-medium text-cyan-400 uppercase tracking-widest">Priority Investigations</p>
          <p className="text-[10px] font-mono text-gray-600 mt-0.5">What an analyst should inspect next</p>
        </div>
      </CardHeader>

      {items.length === 0 ? (
        <p className="text-xs font-mono text-gray-700 text-center py-8">// NO INCIDENTS DETECTED</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const cfg = SEVERITY_MAP[item.severity] ?? SEVERITY_MAP.low
            const { Icon } = cfg
            return (
              <div key={item.id} className={`rounded-lg border ${cfg.border} bg-black/30 px-3 py-3`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex items-start gap-2">
                    <Icon size={14} className={`mt-0.5 flex-shrink-0 ${cfg.tone}`} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={`text-xs font-mono truncate ${cfg.tone}`}>{item.title}</p>
                        <Badge variant={cfg.badge}>{item.severity}</Badge>
                        {item.status === 'resolved' && <Badge variant="default">resolved</Badge>}
                      </div>
                      <p className="mt-1 text-[10px] font-mono text-gray-500 truncate">
                        {item.target_type}: {item.target_label}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[10px] font-mono text-gray-500">{item.time}</p>
                    <p className="mt-1 text-[10px] font-mono text-cyan-400">{item.repeat_count}x seen</p>
                    {onInspect && (
                      <button
                        type="button"
                        onClick={() => onInspect(item)}
                        className="mt-2 inline-flex items-center gap-1 rounded-md border border-cyan-500/15 px-2 py-1 text-[10px] font-mono text-cyan-400 transition hover:bg-cyan-500/10"
                      >
                        Inspect
                        <ArrowRight size={11} />
                      </button>
                    )}
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                  {(item.state_tags ?? []).map((tag) => (
                    <Badge key={`${item.id}-${tag}`} variant={tagVariant(tag)}>{tag}</Badge>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
