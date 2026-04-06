/**
 * MonitorIntelPanel — Merged signal + region intelligence for the Monitor tab.
 * Single compact panel replacing separate Signal and Hotspot cards.
 * Answers: What threats are active? Where? What impact?
 */
import { Card } from '../ui/index'

// ── Signal derivation (inline, no dep on SignalIntelligenceCard) ───────────────
const pretty = (v) => v ? v.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : v

function buildSignals(overview) {
  const out = []
  const evasion  = Number(overview?.evasion_attempts) || 0
  const spam     = Number(overview?.spam_detected) || 0
  const pressure = overview?.enforcement_pressure?.totals ?? {}
  const gateway  = overview?.gateway_dashboard
  const leaders  = overview?.risk_leaderboard ?? []

  if (evasion > 0)                   out.push({ key: 'evasion',    label: 'Evasion',       count: evasion,                  impact: 'high',   cat: 'Automation' })
  if (spam > 0)                      out.push({ key: 'spam',       label: 'Spam',          count: spam,                     impact: spam > 100 ? 'high' : 'medium', cat: 'Behavior' })
  if ((pressure.blocked  || 0) > 0)  out.push({ key: 'blocked',   label: 'Blocked',       count: pressure.blocked,         impact: 'high',   cat: 'Network' })
  if ((pressure.challenged || 0) > 0) out.push({ key: 'challenged',label: 'Challenged',    count: pressure.challenged,      impact: 'medium', cat: 'Network' })
  if ((pressure.rate_limited || 0) > 0) out.push({ key: 'rl',     label: 'Rate Limited',  count: pressure.rate_limited,    impact: 'medium', cat: 'Network' })
  if (gateway?.bot_percent > 5)      out.push({ key: 'bot',        label: 'Bot Traffic',   count: `${Math.round(gateway.bot_percent)}%`, impact: gateway.bot_percent > 20 ? 'high' : 'medium', cat: 'Automation' })

  const flagged = leaders.filter((l) => Number(l.open_flags_count) > 0)
  if (flagged.length > 0)            out.push({ key: 'flags',      label: 'Flagged IDs',   count: flagged.length,           impact: flagged.some((l) => Number(l.current_risk_score) >= 0.8) ? 'high' : 'medium', cat: 'Identity' })

  const reasonCounts = {}
  for (const h of (overview?.threat_hotspots ?? [])) {
    if (h.top_reason && h.top_reason !== 'mixed')
      reasonCounts[h.top_reason] = (reasonCounts[h.top_reason] || 0) + (h.count || 0)
  }
  for (const [reason, count] of Object.entries(reasonCounts).slice(0, 1)) {
    if (!out.find((s) => s.key === reason))
      out.push({ key: reason, label: pretty(reason), count, impact: 'medium', cat: 'Geo' })
  }

  const ord = { high: 0, medium: 1, low: 2 }
  return out.sort((a, b) => (ord[a.impact] ?? 2) - (ord[b.impact] ?? 2)).slice(0, 6)
}

// ── Constants ────────────────────────────────────────────────────────────────
const DOT   = { high: 'bg-red-400',    medium: 'bg-yellow-400', low: 'bg-gray-500' }
const ITXT  = { high: 'text-red-400',  medium: 'text-yellow-400', low: 'text-gray-500' }
const CTXT  = { Network: 'text-blue-400', Automation: 'text-red-400', Behavior: 'text-orange-400', Geo: 'text-purple-400', Identity: 'text-cyan-400' }
const DTONE = (d) => d > 0 ? 'text-red-400' : d < 0 ? 'text-green-400' : 'text-gray-600'
const DSIGN = (d) => d >= 0 ? `+${d}%` : `${d}%`
const TBADGE = (d) => d > 30 ? 'text-red-400' : d > 10 ? 'text-orange-400' : d < -10 ? 'text-green-400' : 'text-gray-600'
const TLABEL = (d) => d > 30 ? '↑ Surge' : d > 10 ? '↑ Rise' : d < -10 ? '↓ Fall' : '→ Stable'

export default function MonitorIntelPanel({ overview, intelligence, loading, onCountryClick, className = '' }) {
  const signals = overview ? buildSignals(overview) : []
  const regions = (overview?.threat_hotspots ?? []).slice(0, 5)
  const actions = intelligence?.priorityActions ?? []

  return (
    <Card className={className}>
      <div className="flex h-full min-h-0 flex-col gap-0">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between py-1.5 px-1 shrink-0 border-b border-cyan-500/10 mb-2">
          <p className="text-[10px] font-mono font-bold text-cyan-400 uppercase tracking-widest">Intelligence</p>
          {actions[0] && (
            <span className="text-[10px] font-mono text-gray-500">→ {actions[0]}</span>
          )}
        </div>

        {/* ── Signals ─────────────────────────────────────────────────────── */}
        <p className="px-1 mb-1 shrink-0 text-[9px] font-mono uppercase tracking-[0.18em] text-gray-700">Active Signals</p>
        <div className="shrink-0 space-y-[3px]">
          {loading ? (
            <div className="h-3 w-32 rounded bg-gray-800/60 animate-pulse" />
          ) : signals.length === 0 ? (
            <p className="text-[10px] font-mono text-gray-700 px-1">// No active signals</p>
          ) : signals.map((sig) => (
            <div key={sig.key} className="flex items-center gap-2 px-2 py-[3px] rounded border border-cyan-500/8 bg-black/20">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${DOT[sig.impact] ?? 'bg-gray-500'}`} />
              <span className="flex-1 min-w-0 truncate text-[11px] font-mono text-gray-300">{sig.label}</span>
              <span className={`shrink-0 text-[9px] font-mono ${CTXT[sig.cat] ?? 'text-gray-500'}`}>{sig.cat}</span>
              <span className={`shrink-0 text-[10px] font-mono font-bold ${ITXT[sig.impact]}`}>{sig.count}</span>
            </div>
          ))}
        </div>

        {/* ── Regions ─────────────────────────────────────────────────────── */}
        <p className="px-1 mt-3 mb-1 shrink-0 text-[9px] font-mono uppercase tracking-[0.18em] text-gray-700">Top Regions</p>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain space-y-[3px] pr-0.5">
          {loading ? (
            <div className="h-3 w-24 rounded bg-gray-800/60 animate-pulse" />
          ) : regions.length === 0 ? (
            <p className="text-[10px] font-mono text-gray-700 px-1">// Awaiting geo data</p>
          ) : regions.map((r) => {
            const d = r.delta ?? 0
            return (
              <button
                key={r.country}
                type="button"
                onClick={() => onCountryClick?.(r)}
                className={`w-full flex items-center gap-2 px-2 py-[3px] rounded border border-cyan-500/8 bg-black/20 text-left ${onCountryClick ? 'hover:border-cyan-500/25 hover:bg-cyan-500/5' : ''} transition`}
              >
                <span className="text-[11px] shrink-0">{r.flag}</span>
                <span className="flex-1 min-w-0 truncate text-[11px] font-mono text-gray-300">{r.country}</span>
                <span className={`shrink-0 text-[9px] font-mono ${TBADGE(d)}`}>{TLABEL(d)}</span>
                <span className="shrink-0 text-[10px] font-mono text-cyan-400">{r.count}</span>
                <span className={`shrink-0 text-[9px] font-mono ${DTONE(d)}`}>{DSIGN(d)}</span>
              </button>
            )
          })}
        </div>
      </div>
    </Card>
  )
}
