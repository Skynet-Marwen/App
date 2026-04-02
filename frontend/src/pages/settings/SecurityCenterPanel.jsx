import { AlertTriangle, RadioTower, RefreshCcw, ShieldCheck, ShieldX, Sparkles } from 'lucide-react'

import { useSecurityCenter } from '../../hooks/useSecurityCenter'
import { Badge, Button, Card, CardHeader, Table } from '../../components/ui'

const findingSeverityVariant = {
  critical: 'danger',
  high: 'danger',
  medium: 'warning',
  low: 'info',
  info: 'default',
}

const recommendationPriorityVariant = {
  critical: 'danger',
  high: 'warning',
  medium: 'info',
  low: 'default',
}

export default function SecurityCenterPanel({ isAdmin }) {
  const {
    status,
    findings,
    recommendations,
    loading,
    scanning,
    actingId,
    error,
    refresh,
    runScan,
    ignoreFinding,
    applyRecommendation,
  } = useSecurityCenter(isAdmin)

  if (!isAdmin) {
    return (
      <Card>
        <CardHeader>
          <div>
            <p className="text-sm font-medium text-white">Security Center</p>
            <p className="mt-1 text-xs text-gray-500">Threat intelligence and scan controls are reserved for administrators.</p>
          </div>
        </CardHeader>
        <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/6 p-4 text-sm text-yellow-100">
          Your account can still view the broader Security & Detection posture, but STIE actions and findings require admin privileges.
        </div>
      </Card>
    )
  }

  const findingColumns = [
    {
      key: 'title',
      label: 'Finding',
      render: (_, row) => (
        <div className="space-y-1">
          <p className="font-medium text-white">{row.title}</p>
          <p className="text-xs text-gray-500">{row.endpoint}</p>
        </div>
      ),
    },
    {
      key: 'severity',
      label: 'Severity',
      render: (value) => <Badge variant={findingSeverityVariant[value] || 'default'}>{value}</Badge>,
    },
    {
      key: 'correlated_risk_score',
      label: 'Risk',
      render: (value, row) => (
        <div className="space-y-1">
          <Badge variant={value >= 0.75 ? 'danger' : value >= 0.5 ? 'warning' : 'info'}>{Math.round(value * 100)} / 100</Badge>
          {row.active_exploitation_suspected ? <p className="text-[11px] font-mono text-red-300">Active exploitation suspected</p> : null}
        </div>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            loading={actingId === `finding:${row.id}`}
            onClick={() => ignoreFinding(row.id)}
          >
            Ignore
          </Button>
        </div>
      ),
    },
  ]

  const recommendationColumns = [
    {
      key: 'recommendation_text',
      label: 'Recommendation',
      render: (_, row) => (
        <div className="space-y-1">
          <p className="font-medium text-white">{row.recommendation_text}</p>
          <p className="text-xs text-gray-500">{row.finding_title || row.finding_endpoint}</p>
        </div>
      ),
    },
    {
      key: 'priority',
      label: 'Priority',
      render: (value, row) => (
        <div className="space-y-1">
          <Badge variant={recommendationPriorityVariant[value] || 'default'}>{value}</Badge>
          {row.auto_applicable ? <p className="text-[11px] font-mono text-cyan-300">Auto-fix ready</p> : null}
        </div>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <div className="flex flex-wrap gap-2">
          <Button
            variant={row.auto_applicable ? 'primary' : 'secondary'}
            size="sm"
            disabled={!row.auto_applicable}
            loading={actingId === `recommendation:${row.id}`}
            onClick={() => applyRecommendation(row.id)}
          >
            Apply Fix
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" size="sm" onClick={refresh} icon={RefreshCcw}>
                Refresh
              </Button>
              <Button size="sm" loading={scanning} onClick={runScan} icon={RadioTower}>
                Rescan Now
              </Button>
            </div>
          }
        >
          <div>
            <p className="text-sm font-medium text-white">Security Center</p>
            <p className="mt-1 text-xs text-gray-500">
              STIE correlates threat intel, safe scanning, and live traffic patterns to surface the most actionable exposure first.
            </p>
          </div>
        </CardHeader>

        {error ? (
          <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>
        ) : null}

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-4">
          <MetricCard icon={Sparkles} label="Threat intel" value={status?.threat_intel_entries ?? 0} accent="text-cyan-300" loading={loading} />
          <MetricCard icon={AlertTriangle} label="Open findings" value={status?.open_findings ?? 0} accent="text-yellow-300" loading={loading} />
          <MetricCard icon={ShieldX} label="Active exploit" value={status?.active_exploitation_findings ?? 0} accent="text-red-300" loading={loading} />
          <MetricCard icon={ShieldCheck} label="Recommendations" value={status?.open_recommendations ?? 0} accent="text-green-300" loading={loading} />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Badge variant="info">Intel every {status?.scheduler?.intel_refresh_interval_hours ?? 24}h</Badge>
          <Badge variant="default">Scan every {status?.scheduler?.scan_interval_hours ?? 12}h</Badge>
          <Badge variant={status?.scheduler?.enable_auto_defense ? 'warning' : 'default'}>
            Auto defense {status?.scheduler?.enable_auto_defense ? 'enabled' : 'disabled'}
          </Badge>
          <Badge variant="purple">Depth {status?.scheduler?.max_scan_depth ?? 8}</Badge>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <p className="text-sm font-medium text-white">Target Profiles</p>
            <p className="mt-1 text-xs text-gray-500">Detected stack hints and scan posture for the protected apps SKYNET has visibility into.</p>
          </div>
        </CardHeader>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {(status?.profiles || []).map((profile) => (
            <div key={profile.id} className="rounded-xl border border-cyan-500/10 bg-black/25 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-white">{profile.base_url}</p>
                  <p className="mt-1 text-xs text-gray-500">{profile.detected_server || 'Server unknown'}</p>
                </div>
                <Badge variant={profile.scan_status === 'ok' ? 'success' : 'warning'}>{profile.scan_status}</Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {[...(profile.frameworks || []), ...(profile.technologies || [])].slice(0, 8).map((item) => (
                  <Badge key={`${profile.id}-${item}`} variant="default">{item}</Badge>
                ))}
              </div>
            </div>
          ))}
          {!loading && !(status?.profiles || []).length ? (
            <div className="rounded-xl border border-cyan-500/10 bg-black/25 p-4 text-sm text-gray-500">
              No target profile has been scanned yet. Run a manual rescan to bootstrap STIE data.
            </div>
          ) : null}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <p className="text-sm font-medium text-white">Security Findings</p>
            <p className="mt-1 text-xs text-gray-500">Live scan issues ordered by active exploitation suspicion and correlated risk.</p>
          </div>
        </CardHeader>
        <Table columns={findingColumns} data={findings} loading={loading} emptyMessage="No active findings yet" />
      </Card>

      <Card>
        <CardHeader>
          <div>
            <p className="text-sm font-medium text-white">Recommendations</p>
            <p className="mt-1 text-xs text-gray-500">Operational guidance generated from the current findings and live traffic correlation.</p>
          </div>
        </CardHeader>
        <Table columns={recommendationColumns} data={recommendations} loading={loading} emptyMessage="No recommendations yet" />
      </Card>
    </div>
  )
}

function MetricCard({ icon: Icon, label, value, accent, loading }) {
  return (
    <div className="rounded-xl border border-cyan-500/10 bg-black/25 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-gray-500">{label}</p>
        <Icon size={16} className={accent} />
      </div>
      {loading ? (
        <div className="mt-3 h-8 w-16 animate-pulse rounded bg-white/5" />
      ) : (
        <p className={`mt-3 text-2xl font-mono font-semibold ${accent}`}>{value}</p>
      )}
    </div>
  )
}
