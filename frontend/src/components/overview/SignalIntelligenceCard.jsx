/**
 * SignalIntelligenceCard — Cross-cutting active threat signals with impact + category.
 * Answers: What threat patterns are currently active and how severe are they?
 */
import { Card, CardHeader } from '../ui/index'

const pretty = (v) => v ? v.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : v

function buildSignals(overview) {
  const signals = []
  const evasion   = Number(overview?.evasion_attempts) || 0
  const spam      = Number(overview?.spam_detected) || 0
  const pressure  = overview?.enforcement_pressure?.totals ?? {}
  const hotspots  = overview?.threat_hotspots ?? []
  const gateway   = overview?.gateway_dashboard
  const leaders   = overview?.risk_leaderboard ?? []

  if (evasion > 0)
    signals.push({ key: 'evasion',     label: 'Evasion Attempts',  count: evasion,            impact: 'high',                              category: 'Automation' })
  if (spam > 0)
    signals.push({ key: 'spam',        label: 'Spam Pattern',      count: spam,               impact: spam > 100 ? 'high' : 'medium',      category: 'Behavior' })
  if ((pressure.blocked || 0) > 0)
    signals.push({ key: 'blocked',     label: 'Active Blocking',   count: pressure.blocked,   impact: 'high',                              category: 'Network' })
  if ((pressure.challenged || 0) > 0)
    signals.push({ key: 'challenged',  label: 'Challenge Active',  count: pressure.challenged, impact: 'medium',                            category: 'Network' })
  if ((pressure.rate_limited || 0) > 0)
    signals.push({ key: 'rate_lim',    label: 'Rate Limited',      count: pressure.rate_limited, impact: 'medium',                          category: 'Network' })

  const reasonCounts = {}
  for (const h of hotspots) {
    if (h.top_reason && h.top_reason !== 'mixed') {
      reasonCounts[h.top_reason] = (reasonCounts[h.top_reason] || 0) + (h.count || 0)
    }
  }
  for (const [reason, count] of Object.entries(reasonCounts).slice(0, 2)) {
    if (!signals.find((s) => s.key === reason)) {
      signals.push({ key: reason, label: pretty(reason), count, impact: 'medium', category: 'Geography' })
    }
  }

  if (gateway?.bot_percent > 5) {
    signals.push({ key: 'bot', label: 'Bot Traffic', count: `${Math.round(gateway.bot_percent)}%`, impact: gateway.bot_percent > 20 ? 'high' : 'medium', category: 'Automation' })
  }

  const flaggedLeaders = leaders.filter((l) => Number(l.open_flags_count) > 0)
  if (flaggedLeaders.length > 0) {
    signals.push({ key: 'flags', label: 'Flagged Identities', count: flaggedLeaders.length, impact: flaggedLeaders.some((l) => Number(l.current_risk_score) >= 0.8) ? 'high' : 'medium', category: 'Identity' })
  }

  const order = { high: 0, medium: 1, low: 2 }
  return signals.sort((a, b) => (order[a.impact] ?? 2) - (order[b.impact] ?? 2)).slice(0, 8)
}

const IMPACT_DOT  = { high: 'bg-red-400',    medium: 'bg-yellow-400', low: 'bg-gray-500' }
const IMPACT_TEXT = { high: 'text-red-400',   medium: 'text-yellow-400', low: 'text-gray-500' }
const CAT_COLOR   = { Network: 'text-blue-400', Automation: 'text-red-400', Behavior: 'text-orange-400', Geography: 'text-purple-400', Identity: 'text-cyan-400' }

export default function SignalIntelligenceCard({ overview, loading, className = '' }) {
  const signals = overview ? buildSignals(overview) : []

  return (
    <Card className={className}>
      <CardHeader>
        <div>
          <p className="text-xs font-mono font-medium text-cyan-400 uppercase tracking-widest">Signal Intelligence</p>
          <p className="text-[10px] font-mono text-gray-600 mt-0.5">Active threat signals across all vectors</p>
        </div>
      </CardHeader>

      {loading || !signals.length ? (
        <p className="text-xs font-mono text-gray-700 text-center py-4">
          {loading ? '// LOADING SIGNALS' : '// NO ACTIVE SIGNALS'}
        </p>
      ) : (
        <div className="space-y-1.5">
          {signals.map((sig) => (
            <div key={sig.key} className="flex items-center justify-between gap-3 rounded-lg border border-cyan-500/10 bg-black/20 px-3 py-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${IMPACT_DOT[sig.impact] || 'bg-gray-500'}`} />
                <span className="text-xs text-gray-300 truncate">{sig.label}</span>
                <span className={`text-[10px] font-mono flex-shrink-0 ${CAT_COLOR[sig.category] || 'text-gray-500'}`}>{sig.category}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`text-[10px] font-mono font-bold ${IMPACT_TEXT[sig.impact]}`}>{sig.impact}</span>
                <span className="text-xs font-mono text-gray-300">{sig.count}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
