import { Activity, ArrowRight, TrendingUp } from 'lucide-react'
import { Badge, Card, CardHeader } from '../ui/index'
import { WorldGlobe } from '../ui/WorldGlobe'

const deltaTone = (delta) => {
  if (delta > 0) return 'text-red-400'
  if (delta < 0) return 'text-green-400'
  return 'text-gray-500'
}

export default function ThreatHotspotsCard({ hotspots = [], onCountryClick, className = '' }) {
  const items = hotspots

  const topSource = items[0]
  const fastestRising = [...items].sort((left, right) => (right.delta ?? 0) - (left.delta ?? 0))[0]
  const hottestReason = [...items]
    .filter((item) => item.top_reason && item.top_reason !== 'mixed')
    .sort((left, right) => (right.threat_score ?? 0) - (left.threat_score ?? 0))[0]
  const strongestShare = Math.max(...items.map((item) => Number(item.percent) || 0), 1)

  return (
    <Card className={className}>
      <div className="flex h-full min-h-0 flex-col">
        <CardHeader>
          <div>
            <p className="text-xs font-mono font-medium text-cyan-400 uppercase tracking-widest">Threat Hotspots</p>
            <p className="mt-0.5 text-[10px] font-mono text-gray-600">Source regions with the highest current pressure</p>
          </div>
        </CardHeader>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <CompactMetric
            label="Top Source"
            value={topSource ? `${topSource.flag} ${topSource.country}` : 'Awaiting geo data'}
          />
          <CompactMetric
            label="Fastest Rising"
            value={fastestRising ? `${fastestRising.country} ${fastestRising.delta >= 0 ? '+' : ''}${fastestRising.delta}%` : 'Stable'}
          />
          <CompactMetric
            label="Top Trigger"
            value={hottestReason?.top_reason ?? 'Mixed activity'}
          />
        </div>

        <div className="mt-2 grid min-h-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-[9.5rem_minmax(0,1fr)]">
          <div className="flex items-center justify-center">
            <WorldGlobe countries={items} showList={false} />
          </div>

          <div className="min-h-0 space-y-1.5 overflow-y-auto overscroll-contain pr-1">
            {items.length > 0 ? items.slice(0, 4).map((item) => (
              <button
                key={item.country}
                type="button"
                onClick={() => onCountryClick?.(item)}
                className={`w-full rounded-lg border border-cyan-500/10 bg-black/30 px-3 py-2 text-left transition ${
                  onCountryClick ? 'hover:border-cyan-500/30 hover:bg-cyan-500/5' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-mono text-white">{item.flag} {item.country}</p>
                    <p className="mt-0.5 truncate text-[10px] font-mono text-gray-500">{item.top_reason || 'mixed'}</p>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-1.5">
                    <Badge variant="info">{item.threat_score ?? 0}</Badge>
                    {onCountryClick && <ArrowRight size={11} className="text-cyan-400" />}
                  </div>
                </div>

                <div className="mt-1.5 h-1 overflow-hidden rounded-full border border-cyan-500/10 bg-black/60">
                  <div
                    className="h-full rounded-full bg-cyan-400/80"
                    style={{ width: `${Math.max(16, ((Number(item.percent) || 0) / strongestShare) * 100)}%` }}
                  />
                </div>

                <div className="mt-1.5 flex items-center gap-3 text-[10px] font-mono">
                  <span className="flex items-center gap-1 text-cyan-400">
                    <Activity size={10} />
                    {item.count}
                  </span>
                  <span className={`flex items-center gap-1 ${deltaTone(item.delta ?? 0)}`}>
                    <TrendingUp size={10} />
                    {(item.delta ?? 0) >= 0 ? '+' : ''}{item.delta ?? 0}%
                  </span>
                  <span className="text-gray-500">{item.percent ?? 0}% share</span>
                </div>
              </button>
            )) : (
              <p className="py-8 text-center text-xs font-mono text-gray-700">// AWAITING GEO DATA</p>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}

function CompactMetric({ label, value }) {
  return (
    <div className="rounded-lg border border-cyan-500/10 bg-black/35 px-2.5 py-2">
      <p className="text-[9px] font-mono uppercase tracking-[0.16em] text-gray-600">{label}</p>
      <p className="mt-1 truncate text-xs font-mono text-white">{value}</p>
    </div>
  )
}
