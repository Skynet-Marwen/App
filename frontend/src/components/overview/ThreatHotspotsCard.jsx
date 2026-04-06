/**
 * ThreatHotspotsCard — Geographic threat analysis with trend interpretation.
 * Answers: Where is the threat? Is it rising? What is the pattern?
 */
import { Activity, ArrowRight } from 'lucide-react'
import { Badge, Card, CardHeader } from '../ui/index'
import { WorldGlobe } from '../ui/WorldGlobe'

const deltaTone     = (d) => d > 0 ? 'text-red-400' : d < 0 ? 'text-green-400' : 'text-gray-500'
const deltaSign     = (d) => d >= 0 ? `+${d}%` : `${d}%`
const trendBadge    = (d) => d > 30 ? 'danger' : d > 10 ? 'warning' : d < -10 ? 'success' : 'default'
const trendLabel    = (d) => d > 30 ? '↑ Surge' : d > 10 ? '↑ Rising' : d < -10 ? '↓ Falling' : '→ Stable'

function CompactMetric({ label, value }) {
  return (
    <div className="rounded-lg border border-cyan-500/10 bg-black/35 px-2.5 py-2">
      <p className="text-[9px] font-mono uppercase tracking-[0.16em] text-gray-600">{label}</p>
      <p className="mt-1 truncate text-xs font-mono text-white">{value}</p>
    </div>
  )
}

export default function ThreatHotspotsCard({ hotspots = [], trend, onCountryClick, className = '' }) {
  const topSource     = hotspots[0]
  const fastestRising = [...hotspots].sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0))[0]
  const hottestReason = [...hotspots].filter((h) => h.top_reason && h.top_reason !== 'mixed').sort((a, b) => (b.threat_score ?? 0) - (a.threat_score ?? 0))[0]
  const strongestShare = Math.max(...hotspots.map((h) => Number(h.percent) || 0), 1)

  return (
    <Card className={className}>
      <div className="flex h-full min-h-0 flex-col">
        <CardHeader
          action={trend && (
            <span className={`text-xs font-mono font-bold ${trend.color}`}>{trend.label}</span>
          )}
        >
          <div>
            <p className="text-xs font-mono font-medium text-cyan-400 uppercase tracking-widest">Threat Hotspots</p>
            <p className="mt-0.5 text-[10px] font-mono text-gray-600">Source regions with highest current pressure</p>
          </div>
        </CardHeader>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <CompactMetric label="Top Source"     value={topSource ? `${topSource.flag} ${topSource.country}` : 'Awaiting geo data'} />
          <CompactMetric label="Fastest Rising" value={fastestRising ? `${fastestRising.country} ${deltaSign(fastestRising.delta ?? 0)}` : 'Stable'} />
          <CompactMetric label="Top Trigger"    value={hottestReason?.top_reason ?? 'Mixed activity'} />
        </div>

        {/* Global trend interpretation */}
        {trend && trend.trend !== 'stable' && (
          <div className={`mt-2 rounded-lg border px-3 py-1.5 text-[10px] font-mono ${
            trend.trend === 'rising' || trend.trend === 'spike'
              ? 'border-orange-500/20 bg-orange-500/5 text-orange-400'
              : 'border-green-500/20 bg-green-500/5 text-green-400'
          }`}>
            {trend.trend === 'spike'   && '⚡ Threat spike detected — investigate origin immediately.'}
            {trend.trend === 'rising'  && '↑ Overall threat pressure is rising this period.'}
            {trend.trend === 'falling' && '↓ Threat pressure is easing — monitor for reversal.'}
          </div>
        )}

        <div className="mt-2 grid min-h-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-[9.5rem_minmax(0,1fr)]">
          <div className="flex items-center justify-center">
            <WorldGlobe countries={hotspots} showList={false} />
          </div>

          <div className="min-h-0 space-y-1.5 overflow-y-auto overscroll-contain pr-1">
            {hotspots.length > 0 ? hotspots.slice(0, 4).map((item) => {
              const d = item.delta ?? 0
              return (
                <button
                  key={item.country}
                  type="button"
                  onClick={() => onCountryClick?.(item)}
                  className={`w-full rounded-lg border border-cyan-500/10 bg-black/30 px-3 py-2 text-left transition ${onCountryClick ? 'hover:border-cyan-500/30 hover:bg-cyan-500/5' : ''}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-xs font-mono text-white">{item.flag} {item.country}</p>
                        <Badge variant={trendBadge(d)}>{trendLabel(d)}</Badge>
                      </div>
                      <p className="mt-0.5 truncate text-[10px] font-mono text-gray-500">{item.top_reason || 'mixed'}</p>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-1.5">
                      <Badge variant="info">{item.threat_score ?? 0}</Badge>
                      {onCountryClick && <ArrowRight size={11} className="text-cyan-400" />}
                    </div>
                  </div>

                  <div className="mt-1.5 h-1 overflow-hidden rounded-full border border-cyan-500/10 bg-black/60">
                    <div className="h-full rounded-full bg-cyan-400/80"
                      style={{ width: `${Math.max(16, ((Number(item.percent) || 0) / strongestShare) * 100)}%` }} />
                  </div>

                  <div className="mt-1 flex items-center gap-3 text-[10px] font-mono">
                    <span className="flex items-center gap-1 text-cyan-400"><Activity size={10} />{item.count}</span>
                    <span className={`${deltaTone(d)}`}>{deltaSign(d)}</span>
                    <span className="text-gray-500">{item.percent ?? 0}% share</span>
                  </div>
                </button>
              )
            }) : (
              <p className="py-8 text-center text-xs font-mono text-gray-700">// AWAITING GEO DATA</p>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}
