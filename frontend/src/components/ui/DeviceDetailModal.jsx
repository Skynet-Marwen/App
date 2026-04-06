import { Link2, Shield, Trash2 } from 'lucide-react'
import { Badge, Button } from './index'
import {
  ActivityContext, IdentityBlock, RiskExplanation,
  SecuritySignals, TechnicalDetails, VisitorRelation, ScoreBar,
} from './DeviceDetailSections'

const RISK = {
  critical: { label: 'Critical', c: 'text-red-400',    b: 'border-red-500/30',    bg: 'bg-red-500/8',    bar: 'bg-red-500'    },
  high:     { label: 'High',     c: 'text-orange-400', b: 'border-orange-500/30', bg: 'bg-orange-500/8', bar: 'bg-orange-500' },
  medium:   { label: 'Medium',   c: 'text-yellow-400', b: 'border-yellow-500/30', bg: 'bg-yellow-500/8', bar: 'bg-yellow-500' },
  low:      { label: 'Low',      c: 'text-green-400',  b: 'border-green-500/30',  bg: 'bg-green-500/8',  bar: 'bg-green-500'  },
}
const STATUS = {
  blocked: { label: 'Blocked', v: 'danger' },  trusted: { label: 'Trusted', v: 'success' },
  flagged: { label: 'Flagged', v: 'warning' }, active:  { label: 'Active',  v: 'info'    },
}
const riskKey = (s) => s >= 80 ? 'critical' : s >= 60 ? 'high' : s >= 30 ? 'medium' : 'low'

export default function DeviceDetailModal({ selected, deviceVisitors, onOpenShield, onOpenDelete, onOpenLink, onDeleteVisitor }) {
  if (!selected) return null
  const R = RISK[riskKey(selected.risk_score ?? 0)]
  const statusCfg = STATUS[selected.status] ?? { label: selected.status, v: 'default' }
  const hasLinked = !!(selected.linked_user || selected.linked_external_users?.length)
  const hasFp = (selected.fingerprint_confidence ?? 0) > 0

  return (
    <div className="space-y-4">

      {/* 1 — Verdict */}
      <div className={`rounded-xl border ${R.b} ${R.bg} p-4`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4 min-w-0 flex-1">
            <div className="text-center flex-shrink-0">
              <p className={`text-4xl font-mono font-black leading-none ${R.c}`}>{selected.risk_score ?? 0}</p>
              <p className={`text-[10px] font-mono font-bold mt-0.5 uppercase tracking-wider ${R.c}`}>{R.label}</p>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white truncate">
                {selected.display_name || selected.probable_model || selected.probable_vendor || selected.os || 'Unknown Device'}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <Badge variant={statusCfg.v}>{statusCfg.label}</Badge>
                {selected.type && <Badge variant="default">{selected.type}</Badge>}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 max-w-xs">
                {[['FP Confidence', selected.fingerprint_confidence, 'bg-cyan-500'],
                  ['Stability',     selected.stability_score,        'bg-green-500']].map(([lbl, val, cls]) => (
                  <div key={lbl}>
                    <p className="text-[9px] font-mono text-gray-500 uppercase tracking-wider mb-1">{lbl}</p>
                    {hasFp ? <ScoreBar value={val} colorClass={cls} />
                           : <p className="text-xs font-mono text-gray-600">No signals</p>}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-row flex-wrap gap-2 sm:flex-col sm:items-end sm:flex-nowrap">
            <Button variant={selected.status === 'blocked' ? 'secondary' : 'danger'} size="sm" icon={Shield} onClick={() => onOpenShield(selected)}>
              {selected.status === 'blocked' ? 'Unblock' : 'Block'}
            </Button>
            <Button variant="secondary" size="sm" icon={Link2} onClick={() => onOpenLink(selected)}>
              {hasLinked ? 'Unlink' : 'Link'}
            </Button>
            <Button variant="danger" size="sm" icon={Trash2} onClick={() => onOpenDelete(selected)}>Delete</Button>
          </div>
        </div>
      </div>

      {/* 2 — Why flagged */}
      <RiskExplanation d={selected} R={R} />

      {/* 3 — Activity */}
      <ActivityContext d={selected} />

      {/* 4 — Identity */}
      <IdentityBlock d={selected} />

      {/* 5 — Signals */}
      <SecuritySignals s={selected.tracking_signals} />

      {/* 6 — Visitors */}
      <VisitorRelation visitors={deviceVisitors} onDeleteVisitor={onDeleteVisitor} />

      {/* 7 — Technical (collapsible) */}
      <TechnicalDetails d={selected} />

    </div>
  )
}
