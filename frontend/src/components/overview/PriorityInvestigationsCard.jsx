/**
 * PriorityInvestigationsCard — Decision-first incident queue.
 * Each item answers: How severe? Why? What action?
 */
import { AlertCircle, AlertTriangle, ArrowRight, CheckCircle, Siren } from 'lucide-react'
import { Badge, Card, CardHeader } from '../ui/index'

const SEVERITY_MAP = {
  critical: { Icon: Siren,          tone: 'text-red-300',    badge: 'danger',  border: 'border-red-500/25' },
  high:     { Icon: AlertCircle,    tone: 'text-red-400',    badge: 'danger',  border: 'border-red-500/15' },
  medium:   { Icon: AlertTriangle,  tone: 'text-yellow-400', badge: 'warning', border: 'border-yellow-500/15' },
  low:      { Icon: CheckCircle,    tone: 'text-green-400',  badge: 'success', border: 'border-green-500/15' },
}

const TAG_VARIANT = (tag) => tag === 'escalating' ? 'danger' : tag === 'repeated' ? 'warning' : tag === 'linked' ? 'info' : 'default'

const ACTION_CONFIG = {
  block:       { label: 'Block',       color: 'text-red-400',    border: 'border-red-500/30' },
  investigate: { label: 'Investigate', color: 'text-yellow-400', border: 'border-yellow-500/30' },
  monitor:     { label: 'Monitor',     color: 'text-cyan-400',   border: 'border-cyan-500/25' },
  ignore:      { label: 'Ignore',      color: 'text-gray-500',   border: 'border-gray-700/40' },
}

const PRIORITY_DOT = { high: 'bg-red-400', medium: 'bg-yellow-400', low: 'bg-gray-600' }

function getRecommendedAction(item) {
  if (item.severity === 'critical' || item.state_tags?.includes('escalating')) return 'block'
  if (item.severity === 'high' || item.state_tags?.includes('repeated'))       return 'investigate'
  if (item.severity === 'medium')                                               return 'monitor'
  return 'ignore'
}

function getPriority(item) {
  if (item.severity === 'critical' || item.state_tags?.includes('escalating')) return 'high'
  if (item.severity === 'high')                                                return 'high'
  return 'medium'
}

export default function PriorityInvestigationsCard({ investigations = [], onInspect, limit, dense = false, className = '' }) {
  const open = investigations.filter((i) => i.status !== 'resolved')
  const critical = open.filter((i) => i.severity === 'critical').length
  const visible = typeof limit === 'number' ? investigations.slice(0, limit) : investigations

  return (
    <Card className={className}>
      <div className="flex h-full min-h-0 flex-col">

        {/* ── Header ── */}
        {dense ? (
          <div className="flex items-center justify-between shrink-0 border-b border-cyan-500/10 pb-1.5 mb-2">
            <p className="text-[10px] font-mono font-bold text-cyan-400 uppercase tracking-widest">Investigations</p>
            <div className="flex items-center gap-2">
              {critical > 0 && (
                <span className="rounded border border-red-500/30 px-1.5 py-0.5 text-[9px] font-mono text-red-400 font-bold animate-pulse">{critical} CRIT</span>
              )}
              <span className="text-[9px] font-mono text-gray-700">{investigations.length} total</span>
            </div>
          </div>
        ) : (
          <CardHeader
            action={(
              <div className="flex items-center gap-2">
                {critical > 0 && (
                  <span className="rounded border border-red-500/30 px-2 py-0.5 text-[10px] font-mono text-red-400 font-bold animate-pulse">
                    {critical} CRITICAL
                  </span>
                )}
                <span className="rounded border border-cyan-500/15 px-2 py-0.5 text-[10px] font-mono text-gray-700">
                  {investigations.length} total
                </span>
              </div>
            )}
          >
            <div>
              <p className="text-xs font-mono font-medium text-cyan-400 uppercase tracking-widest">Priority Investigations</p>
              <p className="text-[10px] font-mono text-gray-600 mt-0.5">What an analyst should act on next</p>
            </div>
          </CardHeader>
        )}

        {visible.length === 0 ? (
          <div className="flex flex-1 items-center justify-center py-8 text-center text-xs font-mono text-gray-700">
            // NO INCIDENTS DETECTED
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-0.5">
            <div className={dense ? 'space-y-[3px]' : 'space-y-2'}>
              {visible.map((item) => {
                const cfg      = SEVERITY_MAP[item.severity] ?? SEVERITY_MAP.low
                const { Icon } = cfg
                const action   = ACTION_CONFIG[getRecommendedAction(item)] ?? ACTION_CONFIG.monitor
                const priority = getPriority(item)

                // ── Dense: single-line row ──────────────────────────────────
                if (dense) {
                  return (
                    <div
                      key={item.id}
                      role={onInspect ? 'button' : undefined}
                      tabIndex={onInspect ? 0 : undefined}
                      onClick={onInspect ? () => onInspect(item) : undefined}
                      onKeyDown={onInspect ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onInspect(item) } } : undefined}
                      className={`flex items-center gap-2 rounded border ${cfg.border} bg-black/20 px-2 py-[4px] ${onInspect ? 'cursor-pointer hover:bg-cyan-500/5' : ''} transition`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${PRIORITY_DOT[priority] ?? 'bg-gray-600'}`} />
                      <Icon size={11} className={`shrink-0 ${cfg.tone}`} />
                      <p className={`flex-1 min-w-0 truncate text-[11px] font-mono ${cfg.tone}`}>{item.title}</p>
                      <Badge variant={cfg.badge} className="shrink-0 text-[9px] px-1 py-0">{item.severity}</Badge>
                      <span className="shrink-0 truncate max-w-[6rem] text-[10px] font-mono text-gray-600 hidden sm:block">{item.target_label}</span>
                      {item.repeat_count > 1 && (
                        <span className="shrink-0 text-[9px] font-mono text-orange-400">{item.repeat_count}×</span>
                      )}
                      <span className="shrink-0 text-[9px] font-mono text-gray-600">{item.time}</span>
                      <span className={`shrink-0 rounded border ${action.border} ${action.color} px-1.5 py-0 text-[9px] font-mono font-bold`}>
                        {action.label}
                      </span>
                      {onInspect && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onInspect(item) }}
                          className="shrink-0 rounded border border-cyan-500/15 p-0.5 text-cyan-400 hover:bg-cyan-500/10 transition"
                          aria-label="Inspect"
                        >
                          <ArrowRight size={10} />
                        </button>
                      )}
                    </div>
                  )
                }

                // ── Normal: multi-row card ──────────────────────────────────
                return (
                  <div
                    key={item.id}
                    role={onInspect ? 'button' : undefined}
                    tabIndex={onInspect ? 0 : undefined}
                    onClick={onInspect ? () => onInspect(item) : undefined}
                    onKeyDown={onInspect ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onInspect(item) } } : undefined}
                    className={`rounded-lg border ${cfg.border} bg-black/30 px-3 py-2.5 ${onInspect ? 'cursor-pointer transition hover:bg-cyan-500/5' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2 min-w-0">
                        <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                          <Icon size={14} className={`mt-0.5 ${cfg.tone}`} />
                          <span className={`w-1.5 h-1.5 rounded-full ${PRIORITY_DOT[priority]}`} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className={`text-xs font-mono break-words ${cfg.tone}`}>{item.title}</p>
                            <Badge variant={cfg.badge}>{item.severity}</Badge>
                            {item.status === 'resolved' && <Badge variant="default">resolved</Badge>}
                          </div>
                          <p className="mt-1 text-[10px] font-mono text-gray-500 break-all">
                            {item.target_type}: {item.target_label}
                          </p>
                        </div>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <p className="text-[10px] font-mono text-gray-500">{item.time}</p>
                        {item.repeat_count > 1 && (
                          <p className="mt-0.5 text-[10px] font-mono text-orange-400">{item.repeat_count}× seen</p>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1">
                        {(item.state_tags ?? []).map((tag) => (
                          <Badge key={`${item.id}-${tag}`} variant={TAG_VARIANT(tag)}>{tag}</Badge>
                        ))}
                        <span className={`rounded border ${action.border} ${action.color} px-1.5 py-0.5 text-[10px] font-mono font-bold`}>
                          → {action.label}
                        </span>
                      </div>
                      {onInspect && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onInspect(item) }}
                          className="inline-flex flex-shrink-0 items-center gap-1 rounded-md border border-cyan-500/15 px-1.5 py-0.5 text-[10px] font-mono text-cyan-400 transition hover:bg-cyan-500/10"
                        >
                          Inspect <ArrowRight size={11} />
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
