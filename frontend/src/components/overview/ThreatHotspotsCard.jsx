import { Activity, ArrowRight, TrendingUp } from 'lucide-react'
import { Badge, Card, CardHeader } from '../ui/index'
import { WorldGlobe } from '../ui/WorldGlobe'

const deltaTone = (delta) => {
  if (delta > 0) return 'text-red-400'
  if (delta < 0) return 'text-green-400'
  return 'text-gray-500'
}

export default function ThreatHotspotsCard({ hotspots = [], fallbackCountries = [], onCountryClick }) {
  const items = hotspots.length > 0
    ? hotspots
    : fallbackCountries.map((country) => ({
        ...country,
        delta: 0,
        top_reason: 'mixed',
        threat_score: Math.min(99, Math.round((country.percent ?? 0) * 1.2)),
      }))

  const topSource = items[0]
  const fastestRising = [...items].sort((left, right) => (right.delta ?? 0) - (left.delta ?? 0))[0]
  const hottestReason = [...items]
    .filter((item) => item.top_reason && item.top_reason !== 'mixed')
    .sort((left, right) => (right.threat_score ?? 0) - (left.threat_score ?? 0))[0]

  return (
    <Card>
      <CardHeader>
        <div>
          <p className="text-xs font-mono font-medium text-cyan-400 uppercase tracking-widest">Threat Hotspots</p>
          <p className="text-[10px] font-mono text-gray-600 mt-0.5">Source regions with the highest current pressure</p>
        </div>
      </CardHeader>

      <div className="grid grid-cols-1 gap-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div className="rounded-lg border border-cyan-500/10 bg-black/35 px-3 py-2">
            <p className="text-[10px] font-mono uppercase tracking-widest text-gray-600">Top Source</p>
            <p className="mt-1 text-sm font-mono text-white truncate">
              {topSource ? `${topSource.flag} ${topSource.country}` : 'Awaiting geo data'}
            </p>
          </div>
          <div className="rounded-lg border border-red-500/10 bg-black/35 px-3 py-2">
            <p className="text-[10px] font-mono uppercase tracking-widest text-gray-600">Fastest Rising</p>
            <p className="mt-1 text-sm font-mono text-white truncate">
              {fastestRising ? `${fastestRising.country} ${fastestRising.delta >= 0 ? '+' : ''}${fastestRising.delta}%` : 'Stable'}
            </p>
          </div>
          <div className="rounded-lg border border-yellow-500/10 bg-black/35 px-3 py-2">
            <p className="text-[10px] font-mono uppercase tracking-widest text-gray-600">Top Trigger</p>
            <p className="mt-1 text-sm font-mono text-white truncate">
              {hottestReason?.top_reason ?? 'Mixed activity'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] gap-4 items-start">
          <WorldGlobe countries={items} showList={false} />

          <div className="space-y-2">
            {items.length > 0 ? items.slice(0, 5).map((item) => (
              <button
                key={item.country}
                type="button"
                onClick={() => onCountryClick?.(item)}
                className={`w-full rounded-lg border border-cyan-500/10 bg-black/30 px-3 py-2.5 text-left transition ${
                  onCountryClick ? 'hover:border-cyan-500/30 hover:bg-cyan-500/5' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-mono text-white truncate">{item.flag} {item.country}</p>
                    <p className="mt-1 text-[10px] font-mono text-gray-500 truncate">{item.top_reason || 'mixed'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="info">{item.threat_score ?? 0} score</Badge>
                    {onCountryClick && <ArrowRight size={12} className="text-cyan-400" />}
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-3 text-[10px] font-mono">
                  <span className="flex items-center gap-1 text-cyan-400">
                    <Activity size={11} />
                    {item.count} hits
                  </span>
                  <span className={`flex items-center gap-1 ${deltaTone(item.delta ?? 0)}`}>
                    <TrendingUp size={11} />
                    {(item.delta ?? 0) >= 0 ? '+' : ''}{item.delta ?? 0}%
                  </span>
                  <span className="text-gray-500">{item.percent ?? 0}% share</span>
                </div>
              </button>
            )) : (
              <p className="text-xs font-mono text-gray-700 text-center py-8">// AWAITING GEO DATA</p>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}
