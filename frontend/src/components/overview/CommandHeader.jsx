/**
 * CommandHeader — Global security state. Always visible above all content.
 * Answers: What is the risk? How many threats? What trend? What to do next?
 */
const LEVEL_CONFIG = {
  critical: { label: 'Critical Risk', color: 'text-red-400',    border: 'border-red-500/30',    bg: 'bg-red-500/8',    dot: 'bg-red-400',    pulse: 'bg-red-400' },
  high:     { label: 'High Risk',     color: 'text-orange-400', border: 'border-orange-500/25', bg: 'bg-orange-500/6', dot: 'bg-orange-400', pulse: 'bg-orange-400' },
  medium:   { label: 'Medium Risk',   color: 'text-yellow-400', border: 'border-yellow-500/25', bg: 'bg-yellow-500/6', dot: 'bg-yellow-400', pulse: 'bg-yellow-400' },
  low:      { label: 'Low Risk',      color: 'text-green-400',  border: 'border-green-500/25',  bg: 'bg-green-500/6',  dot: 'bg-green-400',  pulse: 'bg-green-400' },
}
const CONF_COLOR = { high: 'text-green-400', medium: 'text-yellow-400', low: 'text-gray-500' }

function Metric({ label, value, alert, large }) {
  return (
    <div className="text-center">
      <p className={`font-black font-mono ${large ? 'text-2xl' : 'text-xl'} ${alert && value > 0 ? 'text-white' : 'text-gray-500'}`}>{value}</p>
      <p className="text-[9px] font-mono uppercase tracking-wider text-gray-600 mt-0.5">{label}</p>
    </div>
  )
}

export default function CommandHeader({ state, loading, compact = false }) {
  if (loading) {
    return <div className={`rounded-xl border border-cyan-500/10 bg-black/20 animate-pulse ${compact ? 'h-11' : 'h-24'}`} />
  }
  if (!state) return null

  const cfg = LEVEL_CONFIG[state.globalRiskLevel] || LEVEL_CONFIG.low
  const isElevated = state.globalRiskLevel === 'critical' || state.globalRiskLevel === 'high'

  // ── Compact mode: single row, no actions strip ──────────────────────────────
  if (compact) {
    return (
      <div className={`flex items-center justify-between gap-4 rounded-lg border ${cfg.border} ${cfg.bg} px-4 py-2.5`}>
        <div className="flex items-center gap-3 min-w-0">
          <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
            {isElevated && <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-60 ${cfg.pulse}`} />}
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${cfg.dot}`} />
          </span>
          <p className={`text-sm font-black font-mono uppercase tracking-wider ${cfg.color}`}>{cfg.label}</p>
          <span className={`text-xs font-mono font-semibold ${state.trend.color}`}>{state.trend.label}</span>
          {state.trend.spikeDetected && (
            <span className="rounded border border-red-500/40 px-1.5 py-0.5 text-[9px] font-mono text-red-400 font-bold animate-pulse">SPIKE</span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-5">
          <div className="text-right">
            <p className={`text-sm font-black font-mono ${state.activeThreats > 0 ? 'text-white' : 'text-gray-500'}`}>{state.activeThreats}</p>
            <p className="text-[9px] font-mono uppercase tracking-wider text-gray-600">Threats</p>
          </div>
          <div className="text-right">
            <p className={`text-sm font-black font-mono ${state.criticalEntities > 0 ? 'text-white' : 'text-gray-500'}`}>{state.criticalEntities}</p>
            <p className="text-[9px] font-mono uppercase tracking-wider text-gray-600">Critical</p>
          </div>
          <span className={`text-xs font-mono font-bold ${CONF_COLOR[state.confidence]}`}>{state.confidence} conf.</span>
          {state.priorityActions[0] && (
            <span className={`rounded-lg px-2.5 py-1 text-xs font-mono border font-bold ${cfg.border} ${cfg.color}`}>
              {state.priorityActions[0]}
            </span>
          )}
        </div>
      </div>
    )
  }

  // ── Full mode ────────────────────────────────────────────────────────────────
  return (
    <div className={`rounded-xl border ${cfg.border} ${cfg.bg} p-4 space-y-3`}>
      {/* Row 1: Status indicators */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Left: risk level + trend */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <span className={`relative flex h-3 w-3 flex-shrink-0`}>
              {isElevated && <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-60 ${cfg.pulse}`} />}
              <span className={`relative inline-flex rounded-full h-3 w-3 ${cfg.dot}`} />
            </span>
            <p className={`text-lg font-black font-mono uppercase tracking-wider ${cfg.color}`}>{cfg.label}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-mono font-bold ${state.trend.color}`}>{state.trend.label}</span>
            {state.trend.spikeDetected && (
              <span className="rounded border border-red-500/40 px-1.5 py-0.5 text-[10px] font-mono text-red-400 font-bold">SPIKE</span>
            )}
          </div>
        </div>

        {/* Right: metric counters */}
        <div className="flex items-center gap-6">
          <Metric label="Active Threats"   value={state.activeThreats}   alert />
          <Metric label="Critical Entities" value={state.criticalEntities} alert />
          <div className="text-center">
            <p className={`text-[11px] font-mono font-bold ${CONF_COLOR[state.confidence]}`}>{state.confidence}</p>
            <p className="text-[9px] font-mono uppercase tracking-wider text-gray-600">confidence</p>
          </div>
        </div>
      </div>

      {/* Row 2: Priority actions */}
      {state.priorityActions.length > 0 && (
        <div className="flex flex-wrap items-start gap-2 pt-2 border-t border-white/5">
          <p className="text-[10px] font-mono text-gray-600 uppercase tracking-wider pt-1 flex-shrink-0">Recommended:</p>
          <div className="flex flex-wrap gap-1.5">
            {state.priorityActions.map((action, i) => (
              <span key={i} className={`rounded-lg px-2.5 py-1 text-xs font-mono border ${
                i === 0
                  ? `${cfg.border} ${cfg.color} font-bold`
                  : 'border-gray-700/50 text-gray-400'
              }`}>
                {action}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
