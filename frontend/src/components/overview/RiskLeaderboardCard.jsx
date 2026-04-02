import { AlertTriangle, RadioTower, ShieldAlert } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge, Card, CardHeader } from '../ui/index'

const riskVariant = (score) => {
  if (score >= 0.8) return 'danger'
  if (score >= 0.55) return 'warning'
  if (score >= 0.3) return 'info'
  return 'success'
}

const trustVariant = (trustLevel) => {
  if (trustLevel === 'blocked') return 'danger'
  if (trustLevel === 'suspicious') return 'warning'
  if (trustLevel === 'trusted') return 'info'
  return 'success'
}

const prettify = (value) => (
  value
    ? value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
    : 'Mixed'
)

const formatRisk = (value) => `${Math.round((Number(value) || 0) * 100)}%`

const formatLastSeen = (value) => (
  value
    ? new Date(value).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
    : 'No recent activity'
)

const truncateMiddle = (value, start = 10, end = 6) => {
  if (!value || value.length <= start + end + 1) return value || '—'
  return `${value.slice(0, start)}...${value.slice(-end)}`
}

export default function RiskLeaderboardCard({ leaders = [] }) {
  const criticalCount = leaders.filter((item) => Number(item.current_risk_score) >= 0.8).length
  const flaggedCount = leaders.filter((item) => Number(item.open_flags_count) > 0).length
  const topUser = leaders[0]

  return (
    <Card>
      <CardHeader
        action={(
          <Link
            to="/users"
            className="inline-flex items-center justify-center rounded-lg border border-gray-700/60 bg-black/60 px-3 py-1.5 text-xs font-mono font-medium text-gray-300 transition hover:bg-black/80"
          >
            Open Portal Users
          </Link>
        )}
      >
        <div>
          <p className="text-xs font-mono font-medium text-cyan-400 uppercase tracking-widest">Risk Leaderboard</p>
          <p className="text-[10px] font-mono text-gray-600 mt-0.5">Highest-risk external identities active in the selected window</p>
        </div>
      </CardHeader>

      <div className="grid grid-cols-1 gap-4">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <div className="rounded-lg border border-red-500/10 bg-black/35 px-3 py-2">
            <p className="text-[10px] font-mono uppercase tracking-widest text-gray-600">Critical Profiles</p>
            <p className="mt-1 text-sm font-mono text-white">{criticalCount}</p>
          </div>
          <div className="rounded-lg border border-yellow-500/10 bg-black/35 px-3 py-2">
            <p className="text-[10px] font-mono uppercase tracking-widest text-gray-600">Open Flags</p>
            <p className="mt-1 text-sm font-mono text-white">{flaggedCount}</p>
          </div>
          <div className="rounded-lg border border-cyan-500/10 bg-black/35 px-3 py-2">
            <p className="text-[10px] font-mono uppercase tracking-widest text-gray-600">Top Focus</p>
            <p className="mt-1 text-sm font-mono text-white truncate">
              {topUser ? (topUser.display_name || topUser.email || truncateMiddle(topUser.external_user_id, 8, 6)) : 'Awaiting identity activity'}
            </p>
          </div>
        </div>

        {leaders.length === 0 ? (
          <p className="py-8 text-center text-xs font-mono text-gray-700">// NO RISKY IDENTITIES IN RANGE</p>
        ) : (
          <div className="space-y-2">
            {leaders.map((leader, index) => (
              <div key={leader.external_user_id} className="rounded-lg border border-cyan-500/10 bg-black/30 px-3 py-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="default">#{index + 1}</Badge>
                      <p className="text-sm font-mono text-white truncate">
                        {leader.display_name || leader.email || truncateMiddle(leader.external_user_id, 12, 8)}
                      </p>
                      <Badge variant={riskVariant(Number(leader.current_risk_score))}>{formatRisk(leader.current_risk_score)}</Badge>
                      <Badge variant={trustVariant(leader.trust_level)}>{prettify(leader.trust_level)}</Badge>
                    </div>
                    <p className="mt-1 text-[10px] font-mono text-gray-500">
                      {leader.email || truncateMiddle(leader.external_user_id, 14, 10)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {leader.open_flags_count > 0 && (
                      <Badge variant="warning">
                        <AlertTriangle size={11} className="mr-1" />
                        {leader.open_flags_count} flags
                      </Badge>
                    )}
                    {leader.enhanced_audit && (
                      <Badge variant="info">
                        <RadioTower size={11} className="mr-1" />
                        Audit
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] font-mono text-gray-500 xl:grid-cols-4">
                  <span>{leader.total_devices} devices</span>
                  <span>{leader.total_sessions} sessions</span>
                  <span>{leader.last_country || 'Country ?'}</span>
                  <span>{formatLastSeen(leader.last_seen)}</span>
                </div>

                <div className="mt-2 flex items-center gap-2 text-[10px] font-mono">
                  <ShieldAlert size={11} className="text-cyan-400" />
                  <span className="text-gray-400">Top trigger</span>
                  <span className="text-cyan-300">{prettify(leader.top_flag)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  )
}
