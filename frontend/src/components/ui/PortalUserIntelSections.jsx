/**
 * PortalUserIntelSections — Overview, Identity, Timeline tabs + Panel primitive.
 * Companion: PortalUserIntelAudit.jsx (Audit, Raw Data tabs)
 */
import { useMemo } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Badge } from './index'

const fmtDT  = (v) => v ? new Date(v).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : '—'
const fmtDTM = (v) => v ? new Date(v).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—'
const pretty = (v) => v ? v.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '—'

const IMPACT_DOT = { high: 'bg-red-400', medium: 'bg-yellow-400', low: 'bg-gray-500' }
const IMPACT_V   = { high: 'danger', medium: 'warning', low: 'default' }
const CAT_COLOR  = { Privacy: 'text-purple-400', Network: 'text-blue-400', Automation: 'text-red-400', Behavior: 'text-orange-400', Anomaly: 'text-rose-400' }
const ROLE_LABEL = { primary: 'Primary', 'highest-risk': 'High Risk', 'most-recent': 'Recent', 'most-active': 'Active' }
const ROLE_COLOR = { primary: 'text-cyan-400', 'highest-risk': 'text-red-400', 'most-recent': 'text-blue-400', 'most-active': 'text-purple-400' }

// ─── Overview Tab ─────────────────────────────────────────────────────────────

export function OverviewTab({ narrative }) {
  const { reasons, observations, confidence, recommendedAction: action, signals } = narrative
  return (
    <div className="space-y-4">
      <Panel kicker="Decision" title="Why This Entity Is Flagged">
        {reasons.length === 0 ? (
          <p className="text-xs text-gray-500">No significant risk factors identified.</p>
        ) : (
          <div className="space-y-2">
            {reasons.map((r, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-cyan-500 flex-shrink-0 mt-0.5 text-sm">›</span>
                <p className="text-sm text-gray-300">{r}</p>
              </div>
            ))}
          </div>
        )}
        {observations.length > 0 && (
          <div className="mt-3 pt-3 border-t border-cyan-500/8 space-y-1">
            {observations.map((o, i) => (
              <p key={i} className="text-xs text-gray-500 flex gap-2"><span className="text-gray-600">·</span>{o}</p>
            ))}
          </div>
        )}
        <div className="mt-3 pt-3 border-t border-cyan-500/8 flex items-center justify-between">
          <p className="text-[10px] font-mono text-gray-600">{confidence.label}</p>
          <p className={`text-sm font-bold font-mono ${action.color}`}>{action.label}</p>
        </div>
      </Panel>
      {signals.length > 0 && (
        <Panel kicker="Top Signals" title="Security Signals Detected">
          <div className="space-y-1.5">
            {signals.slice(0, 5).map((sig) => (
              <div key={sig.key} className="flex items-center justify-between gap-3 rounded-lg border border-cyan-500/10 bg-black/20 px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${IMPACT_DOT[sig.impact] || 'bg-gray-500'}`} />
                  <span className="text-xs text-gray-300 truncate">{sig.label}</span>
                  <span className={`text-[10px] font-mono flex-shrink-0 ${CAT_COLOR[sig.category] || 'text-gray-500'}`}>{sig.category}</span>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <Badge variant={IMPACT_V[sig.impact] || 'default'}>{sig.impact}</Badge>
                  <span className="text-[10px] font-mono text-gray-500">{sig.count}×</span>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  )
}

// ─── Identity Tab ─────────────────────────────────────────────────────────────

export function IdentityTab({ profile, devices, visitors }) {
  const visitorsByDevice = useMemo(() => {
    const map = {}
    for (const v of (visitors || [])) { const k = v.device_id || '__none__'; map[k] = (map[k] || 0) + 1 }
    return map
  }, [visitors])

  const multiDevice = (devices || []).length > 2
  const recentDevice = (devices || []).find((d) => {
    const t = d.linked_at || d.first_seen
    return t && (Date.now() - new Date(t).getTime()) < 7 * 24 * 60 * 60 * 1000
  })

  return (
    <div className="space-y-4">
      {(multiDevice || recentDevice) && (
        <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-4 py-2 flex flex-wrap gap-3">
          {multiDevice  && <span className="text-xs text-yellow-400 font-mono">⚠ Multi-device pattern — {devices.length} devices linked</span>}
          {recentDevice && <span className="text-xs text-orange-400 font-mono">⚡ New device added recently</span>}
        </div>
      )}
      <Panel kicker="Entity" title="User Identity">
        <div className="rounded-lg border border-cyan-500/15 bg-black/20 px-4 py-3">
          <p className="text-sm font-semibold text-white">{profile?.display_name || profile?.email || 'Unknown'}</p>
          <p className="text-xs text-gray-400 mt-0.5">{profile?.email}</p>
          <p className="text-[10px] font-mono text-gray-600 mt-1">{profile?.external_user_id || '—'}</p>
        </div>
        <div className="ml-6 mt-1 border-l-2 border-cyan-500/15 pl-4 space-y-2 pt-2">
          <p className="text-[10px] font-mono text-gray-600 uppercase tracking-wider mb-3">Linked Devices</p>
          {!(devices || []).length && <p className="text-xs text-gray-600">No devices linked.</p>}
          {(devices || []).map((d) => {
            const sessions = visitorsByDevice[d.id] || d.visitor_count || 0
            const rs = Number(d.risk_score) || 0
            return (
              <div key={d.id} className="rounded-lg border border-cyan-500/10 bg-black/20 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs text-white">{pretty(d.platform || d.os || 'Unknown')}</p>
                      {(d.roles || []).map((r) => (
                        <span key={r} className={`text-[10px] font-mono font-bold ${ROLE_COLOR[r] || 'text-gray-500'}`}>{ROLE_LABEL[r] || r}</span>
                      ))}
                    </div>
                    <p className="text-[10px] font-mono text-gray-500 mt-0.5">Last seen {fmtDT(d.last_seen_at || d.last_seen)} · {sessions} sessions</p>
                  </div>
                  <Badge variant={rs >= 80 ? 'danger' : rs >= 55 ? 'warning' : rs >= 30 ? 'info' : 'success'}>{rs}</Badge>
                </div>
              </div>
            )
          })}
          {(visitors || []).length > 0 && (
            <p className="text-[10px] font-mono text-gray-600 pt-1">↳ {visitors.length} total visitor sessions across all devices</p>
          )}
        </div>
      </Panel>
    </div>
  )
}

// ─── Timeline Tab ─────────────────────────────────────────────────────────────

const EV_DOT = { login: 'bg-cyan-400', logout: 'bg-gray-400', page_view: 'bg-blue-400', purchase: 'bg-green-400', password_reset: 'bg-yellow-400', flag: 'bg-red-400', risk_change: 'bg-orange-400' }

export function TimelineTab({ riskHistoryData, narrative, activity, flags }) {
  const events = useMemo(() => {
    const flagEvs = (flags || []).map((f) => ({ time: f.detected_at, kind: 'flag', label: pretty(f.flag_type), sub: pretty(f.severity) }))
    const actEvs  = (activity || []).map((ev) => ({ time: ev.created_at, kind: ev.event_type, label: pretty(ev.event_type), sub: `${ev.platform || ''} ${ev.ip ? '· ' + ev.ip : ''}`.trim() }))
    return [...flagEvs, ...actEvs].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 25)
  }, [flags, activity])

  const last = riskHistoryData[riskHistoryData.length - 1]
  const { trend } = narrative

  return (
    <div className="space-y-4">
      <Panel kicker="Risk History" title={`Score Evolution · ${trend.label}`}>
        {trend.eventCount > 1 && (
          <p className="text-[10px] font-mono text-gray-600 mb-3">
            {trend.trend === 'rising'  && 'Risk is increasing — continued monitoring required.'}
            {trend.trend === 'falling' && 'Risk is declining — verify the improvement is sustained.'}
            {trend.trend === 'stable'  && 'Risk has remained stable across recent events.'}
            {trend.trend === 'spike'   && 'Sudden spike detected — investigate cause immediately.'}
          </p>
        )}
        {!riskHistoryData.length ? <p className="text-xs text-gray-600">No risk events recorded.</p> : (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={riskHistoryData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="rg" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 1]} tickFormatter={(v) => `${Math.round(v * 100)}%`} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} width={36} />
                <Tooltip formatter={(v, _n, p) => [`${Math.round(v * 100)}%`, p?.payload?.triggerType]}
                  labelFormatter={(_l, p) => fmtDTM(p?.[0]?.payload?.createdAt)}
                  contentStyle={{ background: 'rgba(3,7,18,0.95)', border: '1px solid rgba(34,211,238,0.18)', borderRadius: '12px', color: '#e2e8f0' }} />
                <Area type="monotone" dataKey="score" stroke="#22d3ee" strokeWidth={2} fill="url(#rg)" activeDot={{ r: 4, stroke: '#67e8f9', strokeWidth: 1 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
        {last && <p className="text-xs font-mono text-gray-500 mt-2">Current: <span className="text-white">{Math.round((last.score || 0) * 100)}%</span> · {riskHistoryData.length} events</p>}
      </Panel>

      <Panel kicker="Events" title="Activity & Anomaly Timeline">
        {!events.length ? <p className="text-xs text-gray-600">No events recorded.</p> : (
          <div className="space-y-0 max-h-80 overflow-y-auto">
            {events.map((ev, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="flex flex-col items-center flex-shrink-0 pt-1.5">
                  <span className={`w-2 h-2 rounded-full ${EV_DOT[ev.kind] || 'bg-gray-400'}`} />
                  {i < events.length - 1 && <span className="w-px flex-1 min-h-[20px] bg-cyan-500/10 mt-1" />}
                </div>
                <div className="pb-3 min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-gray-300 font-medium">{ev.label}</p>
                    <p className="text-[10px] font-mono text-gray-600 flex-shrink-0">{fmtDT(ev.time)}</p>
                  </div>
                  {ev.sub && <p className="text-[10px] text-gray-500 mt-0.5">{ev.sub}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  )
}

// ─── Panel primitive ──────────────────────────────────────────────────────────

export function Panel({ kicker, title, children }) {
  return (
    <section className="rounded-2xl border border-cyan-500/10 bg-black/25 p-4"
      style={{ borderColor: 'var(--theme-panel-border)', background: 'rgba(0,0,0,0.28)' }}>
      {kicker && <p className="text-[9px] font-mono uppercase tracking-[0.18em] text-cyan-400">{kicker}</p>}
      <p className="mt-0.5 mb-3 text-sm font-semibold text-white">{title}</p>
      {children}
    </section>
  )
}

export { Panel as SectionPanel }
