import { useState } from 'react'
import { AlertCircle, AlertTriangle, CheckCircle } from 'lucide-react'

const SEV = {
  high:   { Icon: AlertCircle,   color: 'text-red-400',    dot: 'bg-red-400',    ring: 'border-red-500/25',    tag: '[IP-Red]',     bg: 'bg-red-500/5' },
  medium: { Icon: AlertTriangle, color: 'text-yellow-400', dot: 'bg-yellow-400', ring: 'border-yellow-500/25', tag: '[A-Gold]',     bg: 'bg-yellow-500/5' },
  low:    { Icon: CheckCircle,   color: 'text-green-400',  dot: 'bg-green-400',  ring: 'border-green-500/25',  tag: '[Green]',      bg: 'bg-green-500/5' },
}

export function CombatLog({ incidents = [] }) {
  const [states, setStates] = useState({})
  const act = (id, action) => setStates(s => ({ ...s, [id]: action }))

  if (!incidents.length) return (
    <p className="text-xs font-mono text-gray-700 text-center py-6">// NO INCIDENTS DETECTED</p>
  )

  return (
    <div className="space-y-2">
      {incidents.map((inc) => {
        const cfg = SEV[inc.severity] ?? SEV.low
        const { Icon } = cfg
        const state = states[inc.id]

        return (
          <div key={inc.id}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all ${
              state === 'quarantined' ? `${cfg.ring} bg-red-500/8`  :
              state === 'analysed'   ? 'border-cyan-500/20 bg-cyan-500/5' :
                                       `border-gray-800/60 ${cfg.bg}`
            }`}>
            <Icon size={13} className={`flex-shrink-0 ${cfg.color}`} />
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-mono ${cfg.color} truncate`}>
                {inc.time} UTC — {inc.title}{' '}
                <span className="opacity-50">{cfg.tag}</span>
              </p>
            </div>
            {!state ? (
              <div className="flex gap-1.5 flex-shrink-0">
                <button onClick={() => act(inc.id, 'analysed')}
                  className="px-2 py-0.5 text-[10px] font-mono rounded border border-cyan-500/35 text-cyan-400 hover:bg-cyan-500/10 transition">
                  Analyse
                </button>
                <button onClick={() => act(inc.id, 'quarantined')}
                  className="px-2 py-0.5 text-[10px] font-mono rounded border border-red-500/35 text-red-400 hover:bg-red-500/10 transition">
                  Quarantine
                </button>
              </div>
            ) : (
              <span className={`text-[10px] font-mono flex-shrink-0 ${state === 'quarantined' ? 'text-red-400' : 'text-cyan-400'}`}>
                [{state.toUpperCase()}]
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
