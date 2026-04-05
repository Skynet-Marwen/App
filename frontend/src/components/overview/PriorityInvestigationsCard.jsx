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

export default function PriorityInvestigationsCard({ investigations = [], onInspect, className = '' }) {
  const items = investigations

  return (
    <Card className={className}>
      <div className="flex h-full min-h-0 flex-col">
        <CardHeader
          action={(
            <span className="rounded border border-cyan-500/15 px-2 py-0.5 text-[10px] font-mono text-gray-700">
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
          <div className="flex flex-1 items-center justify-center py-8 text-center text-xs font-mono text-gray-700">
            // NO INCIDENTS DETECTED
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
            <div className="space-y-2">
              {items.map((item) => {
                const cfg = SEVERITY_MAP[item.severity] ?? SEVERITY_MAP.low
                const { Icon } = cfg
                return (
                  <div
                    key={item.id}
                    role={onInspect ? 'button' : undefined}
                    tabIndex={onInspect ? 0 : undefined}
                    onClick={onInspect ? () => onInspect(item) : undefined}
                    onKeyDown={onInspect ? (event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        onInspect(item)
                      }
                    } : undefined}
                    className={`rounded-lg border ${cfg.border} bg-black/30 px-3 py-2.5 ${onInspect ? 'cursor-pointer transition hover:bg-cyan-500/5' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex items-start gap-2">
                        <Icon size={14} className={`mt-0.5 flex-shrink-0 ${cfg.tone}`} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className={`break-words text-xs font-mono ${cfg.tone}`}>{item.title}</p>
                            <Badge variant={cfg.badge}>{item.severity}</Badge>
                            {item.status === 'resolved' && <Badge variant="default">resolved</Badge>}
                          </div>
                          <p className="mt-1 break-all text-[10px] font-mono text-gray-500">
                            {item.target_type}: {item.target_label}
                          </p>
                        </div>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <p className="text-[10px] font-mono text-gray-500">{item.time}</p>
                        <p className="mt-1 text-[10px] font-mono text-cyan-400">{item.repeat_count}x seen</p>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex min-w-0 flex-wrap items-center gap-1">
                        {(item.state_tags ?? []).map((tag) => (
                          <Badge key={`${item.id}-${tag}`} variant={tagVariant(tag)}>{tag}</Badge>
                        ))}
                      </div>
                      {onInspect && (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            onInspect(item)
                          }}
                          className="inline-flex flex-shrink-0 items-center gap-1 rounded-md border border-cyan-500/15 px-1.5 py-0.5 text-[10px] font-mono text-cyan-400 transition hover:bg-cyan-500/10"
                        >
                          Inspect
                          <ArrowRight size={11} />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
