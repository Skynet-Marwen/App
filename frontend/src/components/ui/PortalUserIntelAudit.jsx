/**
 * PortalUserIntelAudit — Audit and Raw Data tabs for Portal User Intel modal.
 * Companion: PortalUserIntelSections.jsx (Overview, Identity, Timeline tabs)
 */
import { useState } from 'react'
import { ChevronDown, ChevronRight, Copy } from 'lucide-react'
import { Badge, Button, Pagination, Select } from './index'

const fmtDT  = (v) => v ? new Date(v).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : '—'
const fmtDTM = (v) => v ? new Date(v).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—'
const pretty = (v) => v ? v.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '—'
const mid    = (v, s = 10, e = 6) => !v || v.length <= s + e + 1 ? v || '—' : `${v.slice(0, s)}…${v.slice(-e)}`

const FLAG_SEV = { critical: 'danger', high: 'danger', medium: 'warning', low: 'info' }
const FLAG_ST  = { open: 'danger', acknowledged: 'warning', resolved: 'success', false_positive: 'default' }

// ─── Audit Tab ────────────────────────────────────────────────────────────────

function AuditPanel({ kicker, title, children }) {
  return (
    <section className="rounded-2xl border border-cyan-500/10 bg-black/25 p-4"
      style={{ borderColor: 'var(--theme-panel-border)', background: 'rgba(0,0,0,0.28)' }}>
      {kicker && <p className="text-[9px] font-mono uppercase tracking-[0.18em] text-cyan-400">{kicker}</p>}
      <p className="mt-0.5 mb-3 text-sm font-semibold text-white">{title}</p>
      {children}
    </section>
  )
}

export function AuditTab({ flags, activity, activityLoading, activityFilters, activityTotal, busyAction, onFlagAction, onEventType, onPlatform, onPage }) {
  return (
    <div className="space-y-4">
      <AuditPanel kicker="Anomaly Flags" title={`System Decisions (${(flags || []).length} flags)`}>
        {!(flags || []).length ? <p className="text-xs text-gray-600">No anomaly flags recorded.</p> : (
          <div className="space-y-3">
            {flags.map((f) => (
              <div key={f.id} className="rounded-xl border border-cyan-500/10 bg-black/20 p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-white">{pretty(f.flag_type)}</span>
                      <Badge variant={FLAG_SEV[f.severity] || 'info'}>{pretty(f.severity)}</Badge>
                      <Badge variant={FLAG_ST[f.status] || 'default'}>{pretty(f.status)}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">Detected {fmtDTM(f.detected_at)}</p>
                  </div>
                  {(f.status === 'open' || f.status === 'acknowledged') && (
                    <div className="flex flex-wrap gap-1.5 flex-shrink-0">
                      {f.status === 'open' && (
                        <Button variant="secondary" size="sm" loading={busyAction === `flag:${f.id}:acknowledged`} onClick={() => onFlagAction(f.id, 'acknowledged')}>Ack</Button>
                      )}
                      <Button variant="primary" size="sm" loading={busyAction === `flag:${f.id}:resolved`} onClick={() => onFlagAction(f.id, 'resolved')}>Resolve</Button>
                      <Button variant="ghost" size="sm" loading={busyAction === `flag:${f.id}:false_positive`} onClick={() => onFlagAction(f.id, 'false_positive')}>FP</Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </AuditPanel>

      <AuditPanel kicker="Activity" title="Authenticated Events">
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <Select value={activityFilters.eventType} onChange={(e) => onEventType(e.target.value)} options={[
              { value: '', label: 'All event types' }, { value: 'login', label: 'Login' },
              { value: 'logout', label: 'Logout' }, { value: 'page_view', label: 'Page View' },
              { value: 'purchase', label: 'Purchase' }, { value: 'password_reset', label: 'Password Reset' },
            ]} />
            <Select value={activityFilters.platform} onChange={(e) => onPlatform(e.target.value)} options={[
              { value: '', label: 'All platforms' }, { value: 'web', label: 'Web' },
              { value: 'ios', label: 'iOS' }, { value: 'android', label: 'Android' }, { value: 'api', label: 'API' },
            ]} />
          </div>
          {activityLoading ? (
            <p className="text-xs text-gray-500">Loading activity…</p>
          ) : !(activity || []).length ? (
            <p className="text-xs text-gray-600">No events match the current filters.</p>
          ) : (
            <>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {activity.map((ev) => (
                  <div key={ev.id} className="rounded-lg border border-cyan-500/10 bg-black/20 px-3 py-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="info">{pretty(ev.event_type)}</Badge>
                        <Badge variant="default">{pretty(ev.platform)}</Badge>
                        {ev.country && <Badge variant="default">{ev.country}</Badge>}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs text-gray-300">{fmtDTM(ev.created_at)}</p>
                        <p className="text-[10px] font-mono text-gray-500">{ev.ip || '—'}</p>
                      </div>
                    </div>
                    {ev.page_url && <p className="mt-1 text-xs text-gray-400 truncate">{ev.page_url}</p>}
                  </div>
                ))}
              </div>
              <Pagination page={activityFilters.page} total={activityTotal} pageSize={12} onChange={onPage} />
            </>
          )}
        </div>
      </AuditPanel>
    </div>
  )
}

// ─── Raw Data Tab ─────────────────────────────────────────────────────────────

function CollapsibleRaw({ title, children }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-lg border border-cyan-500/10 bg-black/10 overflow-hidden">
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-cyan-500/5 transition">
        <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">{title}</span>
        {open ? <ChevronDown size={13} className="text-gray-500" /> : <ChevronRight size={13} className="text-gray-500" />}
      </button>
      {open && <div className="px-3 pb-3 border-t border-cyan-500/10 pt-3 space-y-2">{children}</div>}
    </div>
  )
}

function CopyField({ label, value }) {
  const [done, setDone] = useState(false)
  return (
    <div>
      <div className="flex items-center gap-1">
        <p className="text-[9px] font-mono uppercase text-gray-600">{label}</p>
        {value && (
          <button type="button" onClick={() => { navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1400) }}
            className="p-0.5 rounded text-gray-600 hover:text-cyan-400 transition">
            <Copy size={10} className={done ? 'text-cyan-400' : ''} />
          </button>
        )}
      </div>
      <p className="text-xs text-gray-400 font-mono break-all">{value || '—'}</p>
    </div>
  )
}

export function RawDataTab({ profile, devices, visitors, signals, flags }) {
  return (
    <div className="space-y-2">
      <CollapsibleRaw title="Profile Fields">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <CopyField label="External User ID" value={profile?.external_user_id} />
          <CopyField label="Email" value={profile?.email} />
          <CopyField label="Display Name" value={profile?.display_name} />
          <CopyField label="Trust Level" value={profile?.trust_level} />
          <CopyField label="Risk Score" value={profile?.current_risk_score != null ? `${Math.round(profile.current_risk_score * 100)}%` : null} />
          <CopyField label="Last Known IP" value={profile?.last_ip} />
          <CopyField label="First Seen" value={profile?.first_seen} />
          <CopyField label="Last Seen" value={profile?.last_seen} />
          <CopyField label="Total Sessions" value={profile?.total_sessions != null ? String(profile.total_sessions) : null} />
        </div>
      </CollapsibleRaw>

      <CollapsibleRaw title={`Device Fingerprints (${(devices || []).length})`}>
        {!(devices || []).length ? <p className="text-xs text-gray-600">No devices.</p> : (devices || []).map((d) => (
          <div key={d.id} className="rounded-lg border border-cyan-500/8 bg-black/20 p-2">
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              <CopyField label="Fingerprint ID" value={mid(d.fingerprint_id || d.id, 16, 8)} />
              <CopyField label="Platform / Browser" value={[d.platform, d.browser].filter(Boolean).join(' · ')} />
              <CopyField label="Canvas Hash" value={mid(d.canvas_hash, 12, 8)} />
              <CopyField label="WebGL Hash" value={mid(d.webgl_hash, 12, 8)} />
              <CopyField label="Match Key" value={d.match_key} />
              <CopyField label="Composite Score" value={d.composite_score != null ? String(d.composite_score) : null} />
            </div>
          </div>
        ))}
      </CollapsibleRaw>

      <CollapsibleRaw title={`Security Signals (${(signals || []).length} types)`}>
        {!(signals || []).length ? <p className="text-xs text-gray-600">No signals detected.</p> : (
          <div className="space-y-1">
            {signals.map((s) => (
              <div key={s.key} className="flex items-center justify-between text-xs">
                <span className="font-mono text-gray-400">{s.key}</span>
                <div className="flex items-center gap-3">
                  <span className="text-gray-500">{s.category} · {s.impact}</span>
                  <span className="text-gray-300 font-mono">{s.count}×</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CollapsibleRaw>

      <CollapsibleRaw title={`Flags Raw (${(flags || []).length})`}>
        {!(flags || []).length ? <p className="text-xs text-gray-600">No flags.</p> : (
          <div className="space-y-1">
            {flags.map((f) => (
              <div key={f.id} className="text-[10px] font-mono text-gray-500 flex flex-wrap gap-x-3 gap-y-0.5">
                <span className="text-gray-300">{pretty(f.flag_type)}</span>
                <span>{f.severity}</span><span>{f.status}</span>
                <span className="text-gray-600">{fmtDT(f.detected_at)}</span>
              </div>
            ))}
          </div>
        )}
      </CollapsibleRaw>
    </div>
  )
}
