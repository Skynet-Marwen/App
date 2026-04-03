import { AlertTriangle, Shield, TimerReset, Waves } from 'lucide-react'
import { Card, CardHeader } from '../ui/index'

const LANES = [
  { key: 'blocked', label: 'Blocked', color: 'rgba(239,68,68,0.72)', border: 'border-red-500/15', Icon: Shield, text: 'text-red-400' },
  { key: 'challenged', label: 'Challenged', color: 'rgba(245,158,11,0.72)', border: 'border-yellow-500/15', Icon: AlertTriangle, text: 'text-yellow-400' },
  { key: 'rate_limited', label: 'Rate Limited', color: 'rgba(6,182,212,0.72)', border: 'border-cyan-500/15', Icon: TimerReset, text: 'text-cyan-400' },
  { key: 'observed', label: 'Observed', color: 'rgba(34,197,94,0.72)', border: 'border-green-500/15', Icon: Waves, text: 'text-green-400' },
]

export default function EnforcementPressureCard({ pressure, loading }) {
  const totals = pressure?.totals ?? {
    blocked: 0,
    challenged: 0,
    rate_limited: 0,
    observed: 0,
  }
  const summaries = pressure?.summaries ?? []
  const maxValue = Math.max(...LANES.map((lane) => totals[lane.key] ?? 0), 1)

  return (
    <Card>
      <CardHeader>
        <div>
          <p className="text-xs font-mono font-medium text-cyan-400 uppercase tracking-widest">Enforcement Pressure</p>
          <p className="text-[10px] font-mono text-gray-600 mt-0.5">How hard the defense layer is pushing right now</p>
        </div>
      </CardHeader>

      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {summaries.length > 0 ? summaries.map((item) => (
            <div key={item.label} className="rounded-lg border border-cyan-500/10 bg-black/35 px-3 py-2">
              <p className="text-[10px] font-mono uppercase tracking-widest text-gray-600">{item.label}</p>
              <p className="mt-1 text-xs font-mono text-white leading-5">{item.value}</p>
            </div>
          )) : (
            <div className="rounded-lg border border-cyan-500/10 bg-black/35 px-3 py-2 md:col-span-3">
              <p className="text-xs font-mono text-gray-700 text-center py-2">{loading ? '// LOADING SIGNALS' : '// NO ENFORCEMENT DATA'}</p>
            </div>
          )}
        </div>

        <div className="space-y-3">
          {LANES.map((lane) => {
            const LaneIcon = lane.Icon
            return (
            <div key={lane.key} className={`rounded-lg border ${lane.border} bg-black/30 px-3 py-2.5`}>
              <div className="flex items-center justify-between gap-3">
                <span className={`flex items-center gap-2 text-xs font-mono ${lane.text}`}>
                  <LaneIcon size={12} />
                  {lane.label}
                </span>
                <span className="text-xs font-mono text-white">{totals[lane.key] ?? 0}</span>
              </div>
              <div className="mt-2 h-2.5 rounded-full border border-white/5 bg-black/60 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${((totals[lane.key] ?? 0) / maxValue) * 100}%`,
                    background: lane.color,
                  }}
                />
              </div>
            </div>
            )
          })}
        </div>
      </div>
    </Card>
  )
}
