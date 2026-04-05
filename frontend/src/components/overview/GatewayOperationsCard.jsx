import { Gauge, ShieldAlert, TimerReset, Waypoints, Link2 } from 'lucide-react'
import { Badge, Card, CardHeader } from '../ui'

const METRICS = [
  { key: 'total_requests',  label: 'Requests',   Icon: Waypoints,  tone: 'text-cyan-300' },
  { key: 'bot_percent',     label: 'Bot %',      suffix: '%', Icon: ShieldAlert, tone: 'text-red-300' },
  { key: 'challenge_rate',  label: 'Challenge %', suffix: '%', Icon: Gauge,       tone: 'text-yellow-300' },
  { key: 'avg_latency_ms',  label: 'Avg Latency', suffix: ' ms', Icon: TimerReset, tone: 'text-green-300' },
]

const DECISION_LANES = [
  { key: 'allow',     label: 'Allow',     tone: 'text-green-400',  color: 'rgba(34,197,94,0.6)' },
  { key: 'challenge', label: 'Challenge', tone: 'text-yellow-400', color: 'rgba(245,158,11,0.6)' },
  { key: 'block',     label: 'Block',     tone: 'text-red-400',    color: 'rgba(239,68,68,0.6)' },
]

function fmt(data, key, suffix) {
  const v = data[key]
  if (v === null || v === undefined) return '—'
  if (typeof v === 'number' && suffix) return `${v.toFixed(1)}${suffix}`
  return String(v)
}

export default function GatewayOperationsCard({ gateway, loading, className = '' }) {
  const data = gateway || {
    enabled: false, configured: false, target_origin: '',
    total_requests: 0, request_change_pct: 0,
    bot_percent: 0, challenge_rate: 0, avg_latency_ms: null, p95_latency_ms: null,
    upstream_error_rate: 0,
    decision_totals: { allow: 0, challenge: 0, block: 0 },
    challenge_outcomes: [], challenge_breakdown: [], top_reasons: [],
  }

  const challengePassed = data.challenge_outcomes.find((i) => i.label === 'passed')?.count || 0
  const challengeFailed = data.challenge_outcomes
    .filter((i) => i.label !== 'passed')
    .reduce((s, i) => s + i.count, 0)
  const decisionMax = Math.max(...DECISION_LANES.map((l) => data.decision_totals?.[l.key] || 0), 1)

  return (
    <Card className={className}>
      {/* Header */}
      <CardHeader
        action={
          <div className="flex items-center gap-1.5">
            <Badge variant={data.enabled && data.configured ? 'success' : 'warning'}>
              {data.enabled && data.configured ? 'Live' : 'Optional'}
            </Badge>
            {typeof data.request_change_pct === 'number' && (
              <Badge variant={data.request_change_pct >= 0 ? 'info' : 'warning'}>
                {data.request_change_pct >= 0 ? '+' : ''}{data.request_change_pct}% traffic
              </Badge>
            )}
          </div>
        }
      >
        <p className="text-xs font-mono font-medium text-cyan-400 uppercase tracking-widest">Gateway Dashboard</p>
      </CardHeader>

      {/* Row 1 — metric strip + upstream */}
      <div className="mb-2 grid grid-cols-2 gap-1 sm:grid-cols-3 xl:grid-cols-5">
        {METRICS.map(({ key, label, suffix, Icon, tone }) => (
          <div key={key} className="flex items-center gap-2 rounded-lg border border-cyan-500/10 bg-black/25 px-2.5 py-2">
            <Icon size={12} className={`shrink-0 ${tone}`} />
            <div className="min-w-0">
              <p className="text-[8px] font-mono uppercase tracking-widest text-gray-600">{label}</p>
              <p className={`text-sm font-semibold leading-none mt-0.5 ${tone}`}>
                {loading ? '…' : fmt(data, key, suffix)}
              </p>
            </div>
          </div>
        ))}
        {/* Upstream — 5th chip */}
        <div className="flex items-center gap-2 rounded-lg border border-cyan-500/10 bg-black/25 px-2.5 py-2 sm:col-span-1 col-span-2">
          <Link2 size={12} className="shrink-0 text-gray-500" />
          <div className="min-w-0">
            <p className="text-[8px] font-mono uppercase tracking-widest text-gray-600">Upstream</p>
            <p className="truncate text-xs font-mono text-gray-300 leading-none mt-0.5">
              {data.target_origin || 'Not configured'}
            </p>
          </div>
        </div>
      </div>

      {/* Row 2 — decision bars | challenge list | top reasons */}
      <div className="grid grid-cols-1 gap-1.5 xl:grid-cols-3">
        {/* Decision mix — horizontal bars */}
        <div className="rounded-lg border border-cyan-500/10 bg-black/25 px-3 py-2.5">
          <p className="mb-2 text-[9px] font-mono uppercase tracking-widest text-gray-600">Decision Mix</p>
          <div className="space-y-1.5">
            {DECISION_LANES.map((lane) => {
              const count = data.decision_totals?.[lane.key] || 0
              return (
                <div key={lane.key}>
                  <div className="mb-0.5 flex items-center justify-between">
                    <span className={`text-[9px] font-mono ${lane.tone}`}>{lane.label}</span>
                    <span className="text-[9px] font-mono text-gray-400">{count}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full border border-white/5 bg-black/60">
                    <div className="h-full rounded-full" style={{ width: `${(count / decisionMax) * 100}%`, background: lane.color }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Challenge analytics */}
        <CompactList
          title="Challenge Analytics"
          subtitle={`Passed ${challengePassed} · Other ${challengeFailed} · P95 ${data.p95_latency_ms ?? '—'} ms`}
          items={data.challenge_breakdown}
          empty="No challenge traffic"
        />

        {/* Top reasons */}
        <CompactList
          title="Top Reasons"
          subtitle={`Upstream error rate ${data.upstream_error_rate}%`}
          items={data.top_reasons}
          empty="No gateway reasons"
        />
      </div>
    </Card>
  )
}

function CompactList({ title, subtitle, items, empty }) {
  return (
    <div className="rounded-lg border border-cyan-500/10 bg-black/25 px-3 py-2.5">
      <p className="mb-0.5 text-[9px] font-mono uppercase tracking-widest text-gray-600">{title}</p>
      <p className="mb-2 text-[9px] font-mono text-gray-500">{subtitle}</p>
      <div className="space-y-1">
        {items?.length ? items.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-2 rounded border border-cyan-500/8 bg-black/30 px-2 py-1">
            <span className="truncate text-[10px] font-mono text-gray-300">{item.label}</span>
            <span className="shrink-0 text-[9px] font-mono text-cyan-400">{item.count}</span>
          </div>
        )) : (
          <p className="py-2 text-center text-[9px] font-mono text-gray-600">{empty}</p>
        )}
      </div>
    </div>
  )
}
