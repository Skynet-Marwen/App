import { Badge, Card } from '../../components/ui'


export default function SettingsFeatureStatusSummary({ summary }) {
  return (
    <Card>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.1fr)_repeat(4,minmax(0,0.42fr))]">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-cyan-400">Feature Status</p>
          <h2 className="mt-2 text-xl font-semibold text-white">Coordinated product state for the current settings surface</h2>
          <p className="mt-2 text-sm text-gray-400">
            These stats are derived from the same domain capability map used across Settings, so the page summary stays aligned with what is actually live, partial, or still planned.
          </p>
        </div>
        <Metric label="Completion" value={`${summary.completion}%`} badge="Weighted" tone="text-cyan-300" />
        <Metric label="Live" value={summary.live} badge="Shipping" tone="text-green-300" />
        <Metric label="Partial" value={summary.partial} badge="In progress" tone="text-yellow-200" />
        <Metric label="Planned" value={summary.planned} badge="Future" tone="text-gray-300" />
        <Metric label="Total" value={summary.total} badge="Capabilities" tone="text-white" />
      </div>
    </Card>
  )
}


function Metric({ label, value, badge, tone }) {
  return (
    <div className="rounded-xl border border-cyan-500/10 bg-black/20 px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-gray-500">{label}</p>
        <Badge variant="default" className="text-[10px]">{badge}</Badge>
      </div>
      <p className={`mt-3 text-2xl font-semibold font-mono ${tone}`}>{value}</p>
    </div>
  )
}
