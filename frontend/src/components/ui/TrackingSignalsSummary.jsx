import { Badge } from './index'

const severityVariant = (value) => {
  if (value === 'critical') return 'danger'
  if (value === 'high') return 'warning'
  if (value === 'medium') return 'info'
  return 'default'
}

const prettify = (value) =>
  String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())

export default function TrackingSignalsSummary({
  summary,
  title = 'Tracking Signals',
  emptyMessage = 'No adblock, DNS-filter, or ISP-resolution anomalies have been recorded.',
  compact = false,
}) {
  const hasSignals = Boolean(
    summary?.adblocker_detected ||
    summary?.dns_filter_suspected ||
    summary?.isp_unresolved ||
    (summary?.signals || []).length
  )

  if (!hasSignals) {
    return (
      <div className="rounded-lg bg-gray-800 p-3">
        <p className="text-xs text-gray-500 mb-0.5">{title}</p>
        <p className="text-sm text-gray-300">{emptyMessage}</p>
      </div>
    )
  }

  const visibleSignals = compact ? (summary?.signals || []).slice(0, 2) : (summary?.signals || []).slice(0, 4)

  return (
    <div className="rounded-lg bg-gray-800 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-gray-500">{title}</p>
        <div className="flex flex-wrap gap-2">
          {summary?.adblocker_detected && <Badge variant="warning">Adblocker</Badge>}
          {summary?.dns_filter_suspected && <Badge variant="warning">DNS Filter</Badge>}
          {summary?.isp_unresolved && <Badge variant="info">ISP Unresolved</Badge>}
        </div>
      </div>

      <div className="mt-2 grid grid-cols-1 gap-2 text-xs text-gray-400 sm:grid-cols-3">
        <p>Open incidents: <span className="text-gray-200">{summary?.open_incident_count ?? 0}</span></p>
        <p>Total incidents: <span className="text-gray-200">{summary?.incident_count ?? 0}</span></p>
        <p>Last detected: <span className="text-gray-200">{summary?.last_detected_at ? new Date(summary.last_detected_at).toLocaleString() : '—'}</span></p>
      </div>

      {summary?.blocker_family && (
        <p className="mt-2 text-xs text-gray-400">
          Family: <span className="text-gray-200">{prettify(summary.blocker_family)}</span>
        </p>
      )}

      {visibleSignals.length > 0 && (
        <div className="mt-3 space-y-2">
          {visibleSignals.map((signal) => (
            <div key={signal.id} className="rounded-lg border border-cyan-500/10 bg-black/20 p-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-medium text-white">{signal.label || prettify(signal.type)}</p>
                <Badge variant={severityVariant(signal.severity)}>{prettify(signal.severity)}</Badge>
                <Badge variant={signal.status === 'open' ? 'danger' : 'success'}>{prettify(signal.status)}</Badge>
              </div>
              {signal.description && <p className="mt-1 text-xs text-gray-400">{signal.description}</p>}
              <p className="mt-1 text-[11px] text-gray-500">{signal.detected_at ? new Date(signal.detected_at).toLocaleString() : '—'}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
