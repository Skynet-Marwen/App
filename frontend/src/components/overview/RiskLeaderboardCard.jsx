/**
 * RiskLeaderboardCard — Decision-oriented identity risk ranking.
 * Answers: Who is most dangerous? Why? What should be done?
 */
import { Link } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { Badge, Card, CardHeader } from '../ui/index'

const riskVariant  = (s) => s >= 0.8 ? 'danger' : s >= 0.55 ? 'warning' : s >= 0.3 ? 'info' : 'success'
const trustVariant = (t) => t === 'blocked' ? 'danger' : t === 'suspicious' ? 'warning' : t === 'trusted' ? 'info' : 'success'
const prettify     = (v) => v ? v.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'Mixed'
const formatRisk   = (v) => `${Math.round((Number(v) || 0) * 100)}%`
const mid          = (v, s = 10, e = 6) => !v || v.length <= s + e + 1 ? v || '—' : `${v.slice(0, s)}...${v.slice(-e)}`

function getAction(leader) {
  const risk  = Number(leader.current_risk_score) || 0
  const flags = Number(leader.open_flags_count) || 0
  if (risk >= 0.8 && flags > 0) return { label: 'Investigate', color: 'text-orange-400', border: 'border-orange-500/30' }
  if (risk >= 0.8)               return { label: 'Monitor',     color: 'text-yellow-400', border: 'border-yellow-500/25' }
  if (risk >= 0.55)              return { label: 'Review',      color: 'text-cyan-400',   border: 'border-cyan-500/25' }
  return                                { label: 'Watch',       color: 'text-gray-500',   border: 'border-gray-700/40' }
}

const RANK_COLOR = ['text-red-400', 'text-orange-400', 'text-yellow-400']

export default function RiskLeaderboardCard({ leaders = [], className = '' }) {
  const criticalCount = leaders.filter((l) => Number(l.current_risk_score) >= 0.8).length
  const flaggedCount  = leaders.filter((l) => Number(l.open_flags_count) > 0).length
  const topUser       = leaders[0]

  return (
    <Card className={className}>
      <div className="flex h-full min-h-0 flex-col">
        <CardHeader
          action={(
            <Link to="/users"
              className="inline-flex items-center justify-center rounded-lg border border-gray-700/60 bg-black/60 px-3 py-1.5 text-xs font-mono font-medium text-gray-300 transition hover:bg-black/80">
              Open Portal Users
            </Link>
          )}
        >
          <div>
            <p className="text-xs font-mono font-medium text-cyan-400 uppercase tracking-widest">Risk Leaderboard</p>
            <p className="text-[10px] font-mono text-gray-600 mt-0.5">Highest-risk identities — ranked for investigation</p>
          </div>
        </CardHeader>

        {/* Summary strip */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="rounded-lg border border-red-500/10 bg-black/35 px-3 py-2">
            <p className="text-[10px] font-mono uppercase tracking-widest text-gray-600">Critical</p>
            <p className={`mt-1 text-sm font-mono font-bold ${criticalCount > 0 ? 'text-red-400' : 'text-gray-500'}`}>{criticalCount}</p>
          </div>
          <div className="rounded-lg border border-yellow-500/10 bg-black/35 px-3 py-2">
            <p className="text-[10px] font-mono uppercase tracking-widest text-gray-600">Flagged</p>
            <p className={`mt-1 text-sm font-mono font-bold ${flaggedCount > 0 ? 'text-yellow-400' : 'text-gray-500'}`}>{flaggedCount}</p>
          </div>
          <div className="rounded-lg border border-cyan-500/10 bg-black/35 px-3 py-2">
            <p className="text-[10px] font-mono uppercase tracking-widest text-gray-600">Top Focus</p>
            <p className="mt-1 text-xs font-mono text-white truncate">
              {topUser ? (topUser.display_name || topUser.email || mid(topUser.external_user_id, 8, 6)) : '—'}
            </p>
          </div>
        </div>

        {leaders.length === 0 ? (
          <div className="flex flex-1 items-center justify-center py-8 text-center text-xs font-mono text-gray-700">
            // NO RISKY IDENTITIES IN RANGE
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
            <div className="space-y-2">
              {leaders.map((leader, index) => {
                const risk   = Number(leader.current_risk_score) || 0
                const action = getAction(leader)
                const nextRisk = leaders[index + 1] ? Number(leaders[index + 1].current_risk_score) || 0 : null
                const delta  = nextRisk !== null ? Math.round((risk - nextRisk) * 100) : null
                return (
                  <div key={leader.external_user_id} className="rounded-lg border border-cyan-500/10 bg-black/30 px-3 py-2.5">
                    {/* Row 1: rank + name + risk + trust + action */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className={`text-[10px] font-mono font-black flex-shrink-0 ${RANK_COLOR[index] || 'text-gray-600'}`}>#{index + 1}</span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="text-xs font-mono text-white break-words">
                              {leader.display_name || leader.email || mid(leader.external_user_id, 12, 8)}
                            </p>
                            <Badge variant={riskVariant(risk)}>{formatRisk(risk)}</Badge>
                            <Badge variant={trustVariant(leader.trust_level)}>{prettify(leader.trust_level)}</Badge>
                          </div>
                          {delta !== null && delta > 0 && (
                            <p className="text-[9px] font-mono text-gray-600 mt-0.5">+{delta}pts above next</p>
                          )}
                        </div>
                      </div>
                      <span className={`rounded border ${action.border} ${action.color} px-1.5 py-0.5 text-[10px] font-mono font-bold flex-shrink-0`}>
                        {action.label}
                      </span>
                    </div>

                    {/* Row 2: top trigger */}
                    {leader.top_flag && (
                      <div className="mt-2 flex items-center gap-2 text-[10px] font-mono">
                        <ShieldAlert size={10} className="text-cyan-400 flex-shrink-0" />
                        <span className="text-gray-500">Top trigger:</span>
                        <span className="text-cyan-300 break-words">{prettify(leader.top_flag)}</span>
                        {leader.open_flags_count > 0 && (
                          <span className="ml-auto text-yellow-400 flex-shrink-0">{leader.open_flags_count} flags</span>
                        )}
                      </div>
                    )}

                    {/* Row 3: meta */}
                    <div className="mt-1.5 grid grid-cols-4 gap-1 text-[10px] font-mono text-gray-600">
                      <span>{leader.total_devices}d</span>
                      <span>{leader.total_sessions}s</span>
                      <span>{leader.last_country || '?'}</span>
                      <span className="truncate">{leader.last_seen ? new Date(leader.last_seen).toLocaleDateString() : '—'}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
