import { Gauge, ShieldAlert, TimerReset, Waypoints } from 'lucide-react'
import { Badge, Card, CardHeader } from '../ui'

const METRICS = [
  { key: 'total_requests', label: 'Gateway Requests', Icon: Waypoints, tone: 'text-cyan-300' },
  { key: 'bot_percent', label: 'Bot Pressure', suffix: '%', Icon: ShieldAlert, tone: 'text-red-300' },
  { key: 'challenge_rate', label: 'Challenge Rate', suffix: '%', Icon: Gauge, tone: 'text-yellow-300' },
  { key: 'avg_latency_ms', label: 'Avg Latency', suffix: ' ms', Icon: TimerReset, tone: 'text-green-300' },
]

export default function GatewayOperationsCard({ gateway, loading }) {
  const data = gateway || {
    enabled: false,
    configured: false,
    target_origin: '',
    total_requests: 0,
    request_change_pct: 0,
    bot_percent: 0,
    challenge_rate: 0,
    avg_latency_ms: null,
    p95_latency_ms: null,
    upstream_error_rate: 0,
    decision_totals: { allow: 0, challenge: 0, block: 0 },
    challenge_outcomes: [],
    challenge_breakdown: [],
    top_reasons: [],
  }

  const challengePassed = data.challenge_outcomes.find((item) => item.label === 'passed')?.count || 0
  const challengeFailed = data.challenge_outcomes.filter((item) => item.label !== 'passed').reduce((sum, item) => sum + item.count, 0)

  const formatMetric = (item) => {
    const value = data[item.key]
    if (value === null || value === undefined) return '—'
    if (typeof value === 'number' && item.suffix === '%') return `${value.toFixed(1)}${item.suffix}`
    if (typeof value === 'number' && item.suffix) return `${value.toFixed(1)}${item.suffix}`
    return String(value)
  }

  return (
    <Card>
      <CardHeader
        action={
          <div className="flex items-center gap-2">
            <Badge variant={data.enabled && data.configured ? 'success' : 'warning'}>
              {data.enabled && data.configured ? 'Gateway live' : 'Gateway optional'}
            </Badge>
            {typeof data.request_change_pct === 'number' ? (
              <Badge variant={data.request_change_pct >= 0 ? 'info' : 'warning'}>
                {data.request_change_pct >= 0 ? '+' : ''}{data.request_change_pct}% traffic
              </Badge>
            ) : null}
          </div>
        }
      >
        <div>
          <p className="text-xs font-mono font-medium text-cyan-400 uppercase tracking-widest">Gateway Dashboard</p>
          <p className="text-[10px] font-mono text-gray-600 mt-0.5">
            Live proxy pressure, challenge outcomes, and upstream health from routed requests
          </p>
        </div>
      </CardHeader>

      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {METRICS.map(({ key, label, suffix, Icon, tone }) => (
            <div key={key} className="rounded-xl border border-cyan-500/10 bg-black/25 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-gray-500">{label}</p>
                <Icon size={14} className={tone} />
              </div>
              <p className={`mt-2 text-lg font-semibold ${tone}`}>
                {loading ? '…' : formatMetric({ key, suffix })}
              </p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.1fr_0.9fr_0.9fr]">
          <DecisionPanel title="Decision Mix" totals={data.decision_totals} />
          <ListPanel
            title="Challenge Analytics"
            subtitle={`Passed ${challengePassed} · Other outcomes ${challengeFailed} · P95 ${data.p95_latency_ms ?? '—'} ms`}
            items={data.challenge_breakdown}
            emptyLabel="No challenge traffic yet"
          />
          <ListPanel
            title="Top Reasons"
            subtitle={`Upstream error rate ${data.upstream_error_rate}%`}
            items={data.top_reasons}
            emptyLabel="No gateway reasons recorded"
          />
        </div>

        <div className="rounded-xl border border-cyan-500/10 bg-black/25 p-4">
          <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-gray-500">Upstream</p>
          <p className="mt-2 break-all text-sm text-white">{data.target_origin || 'Not configured'}</p>
        </div>
      </div>
    </Card>
  )
}

function DecisionPanel({ title, totals }) {
  const lanes = [
    { key: 'allow', label: 'Allow', tone: 'text-green-300', color: 'rgba(34,197,94,0.6)' },
    { key: 'challenge', label: 'Challenge', tone: 'text-yellow-300', color: 'rgba(245,158,11,0.6)' },
    { key: 'block', label: 'Block', tone: 'text-red-300', color: 'rgba(239,68,68,0.6)' },
  ]
  const max = Math.max(...lanes.map((lane) => totals?.[lane.key] || 0), 1)

  return (
    <div className="rounded-xl border border-cyan-500/10 bg-black/25 p-4">
      <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-gray-500">{title}</p>
      <div className="mt-4 space-y-3">
        {lanes.map((lane) => (
          <div key={lane.key}>
            <div className="flex items-center justify-between gap-3">
              <span className={`text-xs font-mono ${lane.tone}`}>{lane.label}</span>
              <span className="text-xs font-mono text-white">{totals?.[lane.key] || 0}</span>
            </div>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full border border-white/5 bg-black/60">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${(((totals?.[lane.key] || 0) / max) * 100)}%`, background: lane.color }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ListPanel({ title, subtitle, items, emptyLabel }) {
  return (
    <div className="rounded-xl border border-cyan-500/10 bg-black/25 p-4">
      <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-gray-500">{title}</p>
      <p className="mt-2 text-xs text-gray-400">{subtitle}</p>
      <div className="mt-4 space-y-2">
        {items?.length ? items.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-3 rounded-lg border border-cyan-500/10 bg-black/30 px-3 py-2">
            <span className="truncate text-xs font-mono text-gray-200">{item.label}</span>
            <Badge variant="info">{item.count}</Badge>
          </div>
        )) : (
          <div className="rounded-lg border border-cyan-500/10 bg-black/30 px-3 py-4 text-center text-xs font-mono text-gray-500">
            {emptyLabel}
          </div>
        )}
      </div>
    </div>
  )
}
