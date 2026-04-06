import { useState } from 'react'
import {
  AlertTriangle, ChevronDown, ChevronRight, Clock,
  Copy, Eye, Link2, Monitor, Trash2, TrendingUp, Users,
} from 'lucide-react'
import { Badge, Button } from './index'

export const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : '—'
const fmtPct = (v) => v != null ? `${Math.round(v * 100)}%` : '—'
const prettify = (s) => String(s || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
const sevRank = { critical: 4, high: 3, medium: 2, low: 1 }

export function generateRiskExplanation(d) {
  const s = d.tracking_signals || {}
  const reasons = []
  if (s.adblocker_detected)   reasons.push('Tracking interference detected (Adblock)')
  if (s.dns_filter_suspected) reasons.push('Network-level DNS filtering behavior')
  if (s.isp_unresolved)       reasons.push('ISP resolution anomaly — possibly VPN or proxy')
  if ((s.open_incident_count ?? 0) > 0)
    reasons.push(`${s.open_incident_count} open security incident${s.open_incident_count > 1 ? 's' : ''} on record`)
  const topSigs = [...(s.signals || [])]
    .filter((sg) => sg.status === 'open')
    .sort((a, b) => (sevRank[b.severity] ?? 0) - (sevRank[a.severity] ?? 0))
  for (const sg of topSigs.slice(0, 2)) {
    const lbl = prettify(sg.label || sg.type)
    if (!reasons.some((r) => r.toLowerCase().includes(lbl.toLowerCase()))) reasons.push(lbl)
  }
  if ((d.stability_score ?? 1) < 0.5 && (d.fingerprint_confidence ?? 0) > 0)
    reasons.push('Unstable fingerprint — device identity may shift')
  if (reasons.length === 0 && (d.risk_score ?? 0) >= 50)
    reasons.push('Elevated risk score — no specific signals identified (possible evasion)')
  const fp = d.fingerprint_confidence ?? 0
  const st = d.stability_score ?? 1
  const confidence = fp >= 0.7 && st >= 0.7 ? 'high' : fp >= 0.4 || st >= 0.5 ? 'medium' : fp > 0 ? 'low' : null
  return { reasons: reasons.slice(0, 5), confidence }
}

export function ScoreBar({ value, colorClass }) {
  const pct = Math.round((value ?? 0) * 100)
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-gray-800">
        <div className={`h-1.5 rounded-full ${colorClass}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono text-gray-300 w-8 text-right">{pct}%</span>
    </div>
  )
}

function CopyBtn({ value }) {
  const [copied, setCopied] = useState(false)
  if (!value) return null
  return (
    <button type="button" title={copied ? 'Copied!' : 'Copy'}
      onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
      className="ml-1 p-0.5 rounded hover:bg-cyan-500/10 text-gray-600 hover:text-cyan-400 transition">
      <Copy size={11} className={copied ? 'text-cyan-400' : ''} />
    </button>
  )
}

export function RiskExplanation({ d, R }) {
  const { reasons, confidence } = generateRiskExplanation(d)
  if (!reasons.length) return null
  const confNote = { high: 'Reliable fingerprint, consistent signals', medium: 'Moderate fingerprint stability', low: 'Low confidence — consider manual review' }
  const confColor = { high: 'text-green-400', medium: 'text-yellow-400', low: 'text-red-400' }
  return (
    <div className={`rounded-lg border ${R.b} ${R.bg} p-3`}>
      <div className="flex items-center gap-2 mb-2.5">
        <AlertTriangle size={13} className={R.c} />
        <span className={`text-xs font-mono font-bold uppercase tracking-wider ${R.c}`}>Why this device is flagged</span>
      </div>
      <ul className="space-y-1.5">
        {reasons.map((r) => (
          <li key={r} className="flex items-start gap-2 text-xs text-gray-300">
            <span className={`mt-1.5 flex-shrink-0 w-1.5 h-1.5 rounded-full ${R.bar}`} />
            {r}
          </li>
        ))}
      </ul>
      {confidence && (
        <p className="mt-2.5 text-[10px] font-mono text-gray-500 border-t border-cyan-500/10 pt-2">
          Signal confidence: <span className={confColor[confidence]}>{confidence.toUpperCase()}</span> — {confNote[confidence]}
        </p>
      )}
    </div>
  )
}

export function ActivityContext({ d }) {
  const hoursAgo = d.last_seen ? (Date.now() - new Date(d.last_seen)) / 3_600_000 : null
  const activity = hoursAgo == null ? null
    : hoursAgo < 24  ? { l: 'Active now',      c: 'text-green-400'  }
    : hoursAgo < 168 ? { l: 'Recent activity', c: 'text-yellow-400' }
    :                  { l: 'Dormant',          c: 'text-gray-500'   }
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        {[{ label: 'First Seen', value: fmtDate(d.first_seen), Icon: Clock },
          { label: 'Last Seen',  value: fmtDate(d.last_seen),  Icon: Eye   },
          { label: 'Visitors',   value: d.visitor_count ?? 0,  Icon: Users },
        ].map(({ label, value, Icon }) => (
          <div key={label} className="rounded-lg border border-cyan-500/10 bg-black/30 p-2.5 flex items-center gap-2">
            <Icon size={13} className="text-cyan-400 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">{label}</p>
              <p className="text-xs text-white font-mono truncate">{value}</p>
            </div>
          </div>
        ))}
      </div>
      {activity && (
        <div className="flex items-center gap-2 px-1">
          <TrendingUp size={11} className={activity.c} />
          <span className={`text-[10px] font-mono ${activity.c}`}>{activity.l}</span>
          {hoursAgo < 24 && d.visitor_count > 1 &&
            <span className="text-[10px] font-mono text-gray-600">· {d.visitor_count} sessions</span>}
        </div>
      )}
    </div>
  )
}

export function IdentityBlock({ d }) {
  const fields = [
    ['Name', d.display_name], ['Model', d.probable_model], ['Vendor', d.probable_vendor],
    ['Browser', d.browser], ['OS', d.os], ['Screen', d.screen_resolution],
    ['Language', d.language], ['Timezone', d.timezone],
  ].filter(([, v]) => v)
  return (
    <div className="rounded-lg border border-cyan-500/10 bg-black/20 p-3">
      <p className="text-[10px] font-mono text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
        <Monitor size={11} /> Device Identity
      </p>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-3">
        {fields.map(([label, value]) => (
          <div key={label} className="flex flex-col min-w-0">
            <span className="text-[10px] text-gray-600">{label}</span>
            <span className="text-xs text-gray-200 truncate" title={value}>{value}</span>
          </div>
        ))}
      </div>
      {d.linked_external_users?.length > 0 && (
        <div className="mt-3 pt-3 border-t border-cyan-500/10">
          <p className="text-[10px] font-mono text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <Link2 size={11} /> Linked Identity
          </p>
          {d.linked_external_users.map((u) => (
            <div key={u.external_user_id} className="flex items-center gap-2 min-w-0">
              <span className="text-xs text-cyan-400 font-mono truncate">{u.display_name || u.email || u.external_user_id}</span>
              {u.email && u.display_name && <span className="text-xs text-gray-600 truncate">{u.email}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function SecuritySignals({ s }) {
  const hasBadges = s?.adblocker_detected || s?.dns_filter_suspected || s?.isp_unresolved
  const topSigs = [...(s?.signals || [])]
    .filter((sg) => sg.status === 'open')
    .sort((a, b) => (sevRank[b.severity] ?? 0) - (sevRank[a.severity] ?? 0))
    .slice(0, 3)
  if (!hasBadges && !topSigs.length && !(s?.open_incident_count)) return null
  const sevVariant = (sv) => sv === 'critical' ? 'danger' : sv === 'high' ? 'warning' : 'info'
  return (
    <div className="rounded-lg border border-cyan-500/10 bg-black/20 p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">Security Signals</p>
        <div className="flex gap-1.5 flex-wrap">
          {s?.adblocker_detected   && <Badge variant="warning">Adblock</Badge>}
          {s?.dns_filter_suspected && <Badge variant="warning">DNS Filter</Badge>}
          {s?.isp_unresolved       && <Badge variant="info">ISP Anomaly</Badge>}
        </div>
      </div>
      {topSigs.map((sg) => (
        <div key={sg.id} className="flex items-center justify-between gap-2 text-xs py-1 border-t border-cyan-500/5">
          <span className="text-gray-300 truncate">{prettify(sg.label || sg.type)}</span>
          <Badge variant={sevVariant(sg.severity)}>{prettify(sg.severity)}</Badge>
        </div>
      ))}
      {(s?.open_incident_count ?? 0) > 0 && (
        <p className="mt-1.5 text-[10px] font-mono text-gray-500">
          {s.open_incident_count} open · {s.incident_count ?? 0} total
          {s.last_detected_at && ` · last ${new Date(s.last_detected_at).toLocaleDateString()}`}
        </p>
      )}
    </div>
  )
}

export function VisitorRelation({ visitors, onDeleteVisitor }) {
  return (
    <div>
      <p className="text-[10px] font-mono text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
        <Users size={11} /> Visitors ({visitors.length})
      </p>
      {visitors.length === 0
        ? <p className="text-xs text-gray-600 italic border border-cyan-500/5 rounded-lg p-3">No visitor records yet.</p>
        : (
          <div className="space-y-1.5 max-h-52 overflow-y-auto pr-0.5">
            {visitors.map((v) => (
              <div key={v.id} className="rounded-lg border border-cyan-500/10 bg-black/30 px-3 py-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 text-xs">
                  <code className="text-cyan-400 flex-shrink-0">{v.ip}</code>
                  {v.country_flag && <span>{v.country_flag}</span>}
                  <span className="text-gray-500 truncate">{v.browser ?? '?'} / {v.os ?? '?'}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs text-gray-500">{v.page_views ?? 0} pvs</span>
                  {v.status === 'blocked' ? <Badge variant="danger">Blocked</Badge> : <Badge variant="success">Active</Badge>}
                  <Button variant="danger" size="sm" icon={Trash2} onClick={() => onDeleteVisitor(v)} />
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  )
}

export function TechnicalDetails({ d }) {
  const [open, setOpen] = useState(false)
  const hashes = [
    ['Fingerprint', d.fingerprint], ['Match Key', d.match_key],
    ['Canvas Hash', d.canvas_hash], ['WebGL Hash', d.webgl_hash],
    ['Composite FP', d.composite_fingerprint],
  ].filter(([, v]) => v)
  const scalars = [
    ['Composite Score', fmtPct(d.composite_score)],
    ['Clock Skew',  d.clock_skew_minutes != null  ? `${d.clock_skew_minutes} min`  : null],
    ['TZ Offset',   d.timezone_offset_minutes != null ? `${d.timezone_offset_minutes} min` : null],
    ['Match Version', d.match_version?.toString()],
  ].filter(([, v]) => v)
  return (
    <div className="rounded-lg border border-cyan-500/10 bg-black/10 overflow-hidden">
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-cyan-500/5 transition">
        <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">Technical Details</span>
        {open ? <ChevronDown size={13} className="text-gray-500" /> : <ChevronRight size={13} className="text-gray-500" />}
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2 border-t border-cyan-500/10">
          {hashes.map(([label, value]) => (
            <div key={label} className="pt-2">
              <div className="flex items-center gap-0.5">
                <p className="text-[10px] text-gray-600 font-mono uppercase">{label}</p>
                <CopyBtn value={value} />
              </div>
              <p className="text-xs text-gray-400 font-mono break-all">{value}</p>
            </div>
          ))}
          {scalars.length > 0 && (
            <div className="pt-2 grid grid-cols-2 gap-x-4 gap-y-1">
              {scalars.map(([label, value]) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-600 font-mono uppercase">{label}</span>
                  <span className="text-xs text-gray-400 font-mono">{value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
