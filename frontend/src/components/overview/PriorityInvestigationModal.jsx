import { createElement } from 'react'
import { ExternalLink, Monitor, User, Users } from 'lucide-react'
import { Badge, Button, Card, Modal } from '../ui/index'

const severityVariant = (severity) => {
  if (severity === 'critical' || severity === 'high') return 'danger'
  if (severity === 'medium') return 'warning'
  return 'success'
}

const trustVariant = (trustLevel) => {
  if (trustLevel === 'blocked') return 'danger'
  if (trustLevel === 'suspicious') return 'warning'
  if (trustLevel === 'trusted') return 'info'
  return 'success'
}

export default function PriorityInvestigationModal({
  open,
  loading,
  error,
  investigation,
  onClose,
  onOpenVisitors,
  onOpenUsers,
  onOpenDevices,
}) {
  return (
    <Modal open={open} onClose={onClose} title="Priority Investigation" width="max-w-4xl">
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, index) => (
            <div key={index} className="h-20 animate-pulse rounded-xl border border-cyan-500/10 bg-black/25" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>
      ) : investigation ? (
        <div className="space-y-4">
          <Card>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={severityVariant(investigation.severity)}>{investigation.severity}</Badge>
                <Badge variant={investigation.status === 'resolved' ? 'success' : 'warning'}>{investigation.status}</Badge>
                <Badge variant="info">{investigation.target?.type || investigation.target_type || 'system'}</Badge>
              </div>
              <div>
                <p className="text-lg font-medium text-white">{investigation.type || investigation.title}</p>
                <p className="mt-1 text-sm text-gray-400">{investigation.description || 'No description recorded for this incident.'}</p>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <DetailStat label="Detected" value={formatDateTime(investigation.detected_at) || investigation.time} />
                <DetailStat label="Target" value={investigation.target?.label || investigation.target_label || '—'} />
                <DetailStat label="IP" value={investigation.ip || '—'} />
              </div>
              {investigation.extra_data ? (
                <div className="rounded-xl border border-cyan-500/10 bg-black/20 px-4 py-3">
                  <p className="text-xs font-mono uppercase tracking-[0.18em] text-gray-500">Evidence</p>
                  <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                    {Object.entries(normalizeExtra(investigation.extra_data)).map(([key, value]) => (
                      <div key={key} className="rounded-lg bg-black/25 px-3 py-2">
                        <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-gray-500">{key}</p>
                        <p className="mt-1 break-words text-sm text-gray-200">{String(value)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <EntityCard
              icon={User}
              title="Concerned Portal User"
              empty="No linked external user could be resolved from this incident."
              action={investigation.related_user ? (
                <Button variant="secondary" size="sm" icon={ExternalLink} onClick={() => onOpenUsers?.(investigation.related_user)}>
                  Open Users Page
                </Button>
              ) : null}
            >
              {investigation.related_user ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-white">{investigation.related_user.display_name || investigation.related_user.email || investigation.related_user.external_user_id}</p>
                    <Badge variant={trustVariant(investigation.related_user.trust_level)}>{investigation.related_user.trust_level}</Badge>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <DetailStat label="External User ID" value={investigation.related_user.external_user_id} mono />
                    <DetailStat label="Risk Score" value={`${Math.round((Number(investigation.related_user.current_risk_score) || 0) * 100)}%`} />
                    <DetailStat label="Devices" value={investigation.related_user.total_devices} />
                    <DetailStat label="Sessions" value={investigation.related_user.total_sessions} />
                    <DetailStat label="Last Seen" value={formatDateTime(investigation.related_user.last_seen)} />
                    <DetailStat label="Country" value={investigation.related_user.last_country || '—'} />
                  </div>
                </div>
              ) : null}
            </EntityCard>

            <EntityCard
              icon={Monitor}
              title="Concerned Device"
              empty="No exact device was attached to this incident."
              action={investigation.related_device ? (
                <Button variant="secondary" size="sm" icon={ExternalLink} onClick={() => onOpenDevices?.(investigation.related_device)}>
                  Open Devices Page
                </Button>
              ) : null}
            >
              {investigation.related_device ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={investigation.related_device.status === 'blocked' ? 'danger' : 'success'}>{investigation.related_device.status}</Badge>
                    {investigation.related_device.match_key ? <Badge variant="info">{investigation.related_device.match_key}</Badge> : null}
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <DetailStat label="Fingerprint" value={investigation.related_device.fingerprint} mono />
                    <DetailStat label="Browser / OS" value={[investigation.related_device.browser, investigation.related_device.os].filter(Boolean).join(' / ') || '—'} />
                    <DetailStat label="Risk Score" value={investigation.related_device.risk_score} />
                    <DetailStat label="Owner User ID" value={investigation.related_device.owner_user_id || '—'} mono />
                    <DetailStat label="Shared Users" value={investigation.related_device.shared_user_count} />
                    <DetailStat label="Last Seen" value={formatDateTime(investigation.related_device.last_seen)} />
                  </div>
                </div>
              ) : null}
            </EntityCard>
          </div>

          <EntityCard
            icon={Users}
            title={`Concerned Visitors (${investigation.related_visitors?.length || 0})`}
            empty="No visitors were resolved for this incident."
            action={investigation.related_visitors?.length ? (
              <Button variant="secondary" size="sm" icon={ExternalLink} onClick={() => onOpenVisitors?.(investigation.related_visitors[0])}>
                Open Visitors
              </Button>
            ) : null}
          >
            {investigation.related_visitors?.length ? (
              <div className="space-y-2">
                {investigation.related_visitors.map((visitor) => (
                  <div key={visitor.id} className="rounded-xl border border-cyan-500/10 bg-black/20 px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={visitor.status === 'blocked' ? 'danger' : visitor.status === 'suspicious' ? 'warning' : 'success'}>{visitor.status}</Badge>
                      {visitor.country ? <Badge variant="default">{`${visitor.country_flag || ''} ${visitor.country}`.trim()}</Badge> : null}
                      {visitor.external_user_id ? <Badge variant="info">{visitor.external_user_id}</Badge> : null}
                    </div>
                    <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <DetailStat label="IP" value={visitor.ip || '—'} mono />
                      <DetailStat label="Browser / OS" value={[visitor.browser, visitor.os].filter(Boolean).join(' / ') || '—'} />
                      <DetailStat label="Device Type" value={visitor.device_type || '—'} />
                      <DetailStat label="Page Views" value={visitor.page_views} />
                      <DetailStat label="Last Seen" value={formatDateTime(visitor.last_seen)} />
                      <DetailStat label="Device ID" value={visitor.device_id || '—'} mono />
                      <DetailStat label="Site ID" value={visitor.site_id || '—'} mono />
                      <DetailStat label="Visitor ID" value={visitor.id} mono />
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </EntityCard>
        </div>
      ) : (
        <div className="rounded-xl border border-cyan-500/10 bg-black/20 px-4 py-6 text-sm text-gray-400">Choose an investigation to inspect.</div>
      )}
    </Modal>
  )
}

function EntityCard({ icon: Icon, title, children, empty, action }) {
  return (
    <Card>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {createElement(Icon, { size: 15, className: 'text-cyan-300' })}
            <p className="text-sm font-medium text-white">{title}</p>
          </div>
          {action}
        </div>
        {children || (
          <div className="rounded-xl border border-cyan-500/10 bg-black/20 px-4 py-4 text-sm text-gray-400">{empty}</div>
        )}
      </div>
    </Card>
  )
}

function DetailStat({ label, value, mono = false }) {
  return (
    <div className="rounded-xl border border-cyan-500/10 bg-black/20 px-3 py-3">
      <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-gray-500">{label}</p>
      <p className={`mt-1 break-words text-sm text-gray-100 ${mono ? 'font-mono text-xs' : ''}`}>{value || '—'}</p>
    </div>
  )
}

function formatDateTime(value) {
  return value ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—'
}

function normalizeExtra(extra) {
  if (!extra || typeof extra !== 'object' || Array.isArray(extra)) {
    return { details: extra }
  }
  return extra
}
