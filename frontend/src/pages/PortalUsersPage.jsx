import { createElement, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  Crosshair,
  Download,
  Fingerprint,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Users,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import DashboardLayout from '../components/layout/DashboardLayout'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  Modal,
  Pagination,
  PageToolbar,
  Select,
  Table,
} from '../components/ui/index'
import TrackingSignalsSummary from '../components/ui/TrackingSignalsSummary'
import { usePortalUsers } from '../hooks/usePortalUsers'
import {
  buildPortalUserDetailBundle,
  buildPortalUserDetailCsvRows,
  buildPortalUsersCsvRows,
  buildPortalUsersJsonExport,
  downloadCsvFile,
  downloadJsonFile,
  fetchAllPortalUsers,
} from '../services/portalUsersExport'

const fmtDateTime = (value) => (
  value
    ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : '—'
)

const fmtShortDateTime = (value) => (
  value
    ? new Date(value).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
    : '—'
)

const fmtRisk = (value) => `${Math.round((Number(value) || 0) * 100)}%`

const prettify = (value) => (
  value
    ? value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
    : '—'
)

const truncateMiddle = (value, start = 10, end = 6) => {
  if (!value || value.length <= start + end + 1) return value || '—'
  return `${value.slice(0, start)}...${value.slice(-end)}`
}

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

const severityVariant = (severity) => {
  if (severity === 'critical' || severity === 'high') return 'danger'
  if (severity === 'medium') return 'warning'
  return 'info'
}

const flagStatusVariant = (status) => {
  if (status === 'open') return 'danger'
  if (status === 'acknowledged') return 'warning'
  if (status === 'resolved') return 'success'
  return 'default'
}

const parseEvidence = (value) => {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return [['details', JSON.stringify(parsed)]]
    }
    return Object.entries(parsed).map(([key, entry]) => [key, typeof entry === 'string' ? entry : JSON.stringify(entry)])
  } catch {
    return [['details', value]]
  }
}

function SummaryCard({ icon, label, value, detail, tone = 'cyan' }) {
  const toneClass = {
    cyan: 'text-cyan-300 border-cyan-500/20 bg-cyan-500/8',
    amber: 'text-amber-300 border-amber-500/20 bg-amber-500/8',
    red: 'text-red-300 border-red-500/20 bg-red-500/8',
    green: 'text-green-300 border-green-500/20 bg-green-500/8',
  }[tone]

  return (
    <Card className="h-full">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-gray-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
          <p className="mt-1 text-xs font-mono text-gray-500">{detail}</p>
        </div>
        <div className={`rounded-xl border px-3 py-2 ${toneClass}`}>
          {createElement(icon, { size: 16 })}
        </div>
      </div>
    </Card>
  )
}

function SectionPanel({ kicker, title, action, children }) {
  return (
    <section
      className="rounded-2xl border border-cyan-500/10 bg-black/25 p-4 sm:p-5"
      style={{ borderColor: 'var(--theme-panel-border)', background: 'rgba(0,0,0,0.28)' }}
    >
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          {kicker && <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-cyan-400">{kicker}</p>}
          <p className="mt-1 text-sm font-semibold text-white">{title}</p>
        </div>
        {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
      </div>
      {children}
    </section>
  )
}

export default function PortalUsersPage() {
  const {
    users,
    total,
    page,
    search,
    minScore,
    trustLevel,
    hasFlags,
    loading,
    error,
    detail,
    detailLoading,
    detailError,
    activityLoading,
    activityError,
    activityFilters,
    selectedUser,
    setPage,
    setSearch,
    setMinScore,
    setTrustLevel,
    setHasFlags,
    setActivityEventType,
    setActivityPlatform,
    setActivityPage,
    refresh,
    selectUser,
    closeUser,
    recomputeRisk,
    setEnhancedAudit,
    updateFlagStatus,
    deleteExternalUser,
  } = usePortalUsers()

  const [actionError, setActionError] = useState('')
  const [busyAction, setBusyAction] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const selectedProfile = detail.profile || selectedUser
  const riskHistoryData = [...detail.riskHistory]
    .reverse()
    .map((entry, index) => ({
      id: entry.id,
      sequence: index + 1,
      score: Number(entry.score || 0),
      delta: Number(entry.delta || 0),
      triggerType: prettify(entry.trigger_type),
      createdAt: entry.created_at,
      label: new Date(entry.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
    }))
  const visibleHighRisk = users.filter((user) => Number(user.current_risk_score) >= 0.7).length
  const visibleFlagged = users.filter((user) => Number(user.open_flags_count) > 0).length
  const visibleAudited = users.filter((user) => user.enhanced_audit).length
  const averageRisk = users.length
    ? `${Math.round((users.reduce((sum, user) => sum + Number(user.current_risk_score || 0), 0) / users.length) * 100)}%`
    : '0%'

  const exportStamp = new Date().toISOString().replace(/[:.]/g, '-')
  const tableExportFilters = {
    search: search.trim(),
    minScore,
    trustLevel,
    hasFlags,
  }

  const handleRecomputeRisk = async (externalUserId = selectedUser?.external_user_id) => {
    if (!externalUserId) return
    setActionError('')
    setBusyAction(`recompute:${externalUserId}`)
    try {
      await recomputeRisk(externalUserId)
    } catch (err) {
      setActionError(err?.response?.data?.detail?.message || err?.response?.data?.detail || 'Failed to recompute risk')
    } finally {
      setBusyAction('')
    }
  }

  const handleAuditToggle = async (enabled) => {
    if (!selectedUser?.external_user_id) return
    setActionError('')
    setBusyAction(`audit:${selectedUser.external_user_id}`)
    try {
      await setEnhancedAudit(
        enabled,
        enabled
          ? 'Enabled from Portal Users intelligence view'
          : 'Disabled from Portal Users intelligence view',
      )
    } catch (err) {
      setActionError(err?.response?.data?.detail?.message || err?.response?.data?.detail || 'Failed to update enhanced audit')
    } finally {
      setBusyAction('')
    }
  }

  const handleFlagAction = async (flagId, status) => {
    if (!selectedUser?.external_user_id) return
    setActionError('')
    setBusyAction(`flag:${flagId}:${status}`)
    try {
      await updateFlagStatus(flagId, status)
    } catch (err) {
      setActionError(err?.response?.data?.detail?.message || err?.response?.data?.detail || 'Failed to update anomaly flag')
    } finally {
      setBusyAction('')
    }
  }

  const handleDeleteExternalUser = async () => {
    if (!selectedUser?.external_user_id) return
    setActionError('')
    setBusyAction(`delete:${selectedUser.external_user_id}`)
    try {
      await deleteExternalUser(selectedUser.external_user_id)
      setConfirmDelete(false)
    } catch (err) {
      setActionError(err?.response?.data?.detail?.message || err?.response?.data?.detail || 'Failed to delete portal user intelligence profile')
    } finally {
      setBusyAction('')
    }
  }

  const resetFilters = () => {
    setSearch('')
    setMinScore('0')
    setTrustLevel('')
    setHasFlags(false)
  }

  const handleExportUsers = async (format) => {
    setActionError('')
    setBusyAction(`export-users:${format}`)
    try {
      const exportedUsers = await fetchAllPortalUsers(tableExportFilters)
      const filename = `portal-users-${exportStamp}.${format === 'json' ? 'json' : 'csv'}`
      if (format === 'json') {
        downloadJsonFile(filename, buildPortalUsersJsonExport(exportedUsers, tableExportFilters))
      } else {
        downloadCsvFile(filename, buildPortalUsersCsvRows(exportedUsers), [
          'external_user_id',
          'display_name',
          'email',
          'current_risk_score',
          'trust_level',
          'total_devices',
          'total_sessions',
          'open_flags_count',
          'last_seen',
          'last_country',
          'enhanced_audit',
        ])
      }
    } catch (err) {
      setActionError(err?.response?.data?.detail?.message || err?.response?.data?.detail || 'Failed to export portal users')
    } finally {
      setBusyAction('')
    }
  }

  const handleExportDetail = (format) => {
    if (!selectedProfile) return
    setActionError('')
    setBusyAction(`export-detail:${format}`)
    try {
      const bundle = buildPortalUserDetailBundle({
        profile: selectedProfile,
        devices: detail.devices,
        visitors: detail.visitors,
        riskHistory: detail.riskHistory,
        activity: detail.activity,
        flags: detail.flags,
        activityFilters,
      })
      const baseName = `portal-user-${selectedProfile.external_user_id}-${exportStamp}`
      if (format === 'json') {
        downloadJsonFile(`${baseName}.json`, bundle)
      } else {
        downloadCsvFile(`${baseName}.csv`, buildPortalUserDetailCsvRows(bundle), ['section', 'field', 'value', 'notes'])
      }
    } catch (err) {
      setActionError(err?.response?.data?.detail?.message || err?.response?.data?.detail || 'Failed to export portal user detail')
    } finally {
      setBusyAction('')
    }
  }

  const columns = [
    {
      key: 'identity',
      label: 'External User',
      render: (_, row) => (
        <div className="min-w-[15rem]">
          <p className="text-sm font-medium text-white">{row.display_name || row.email || 'Unnamed user'}</p>
          <p className="mt-1 text-xs text-gray-400">{row.email || 'No email claim'}</p>
          <p className="mt-1 font-mono text-[10px] text-gray-600">{truncateMiddle(row.external_user_id, 12, 8)}</p>
        </div>
      ),
    },
    {
      key: 'risk',
      label: 'Risk',
      render: (_, row) => (
        <div className="space-y-1">
          <Badge variant={riskVariant(Number(row.current_risk_score))}>{fmtRisk(row.current_risk_score)}</Badge>
          <p className="text-[10px] font-mono text-gray-500">{row.total_sessions ?? 0} sessions observed</p>
        </div>
      ),
    },
    {
      key: 'trust_level',
      label: 'Trust',
      render: (value) => <Badge variant={trustVariant(value)}>{prettify(value)}</Badge>,
    },
    {
      key: 'exposure',
      label: 'Exposure',
      render: (_, row) => (
        <div className="space-y-1 text-xs text-gray-300">
          <p>{row.total_devices ?? 0} devices</p>
          <p className="font-mono text-[10px] text-gray-500">{row.open_flags_count ?? 0} open flags</p>
        </div>
      ),
    },
    {
      key: 'last_seen',
      label: 'Last Seen',
      render: (value, row) => (
        <div className="space-y-1 text-xs text-gray-300">
          <p>{fmtShortDateTime(value)}</p>
          <p className="font-mono text-[10px] text-gray-500">{row.last_country || 'Country unknown'}</p>
        </div>
      ),
    },
    {
      key: 'audit',
      label: 'Audit',
      render: (_, row) => row.enhanced_audit ? <Badge variant="info">Enhanced</Badge> : <Badge variant="default">Normal</Badge>,
    },
    {
      key: 'actions',
      label: '',
      width: '168px',
      render: (_, row) => (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            loading={busyAction === `recompute:${row.external_user_id}`}
            onClick={(event) => {
              event.stopPropagation()
              handleRecomputeRisk(row.external_user_id)
            }}
          >
            Recompute
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={Crosshair}
            onClick={(event) => {
              event.stopPropagation()
              selectUser(row)
            }}
          >
            Inspect
          </Button>
        </div>
      ),
    },
  ]

  return (
    <DashboardLayout title="Portal Users" onRefresh={refresh} fullWidth>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={Users}
          label="Visible Profiles"
          value={total.toLocaleString()}
          detail="Profiles matching the current filters"
          tone="cyan"
        />
        <SummaryCard
          icon={ShieldAlert}
          label="High Risk"
          value={visibleHighRisk.toLocaleString()}
          detail="Risk score at or above 70%"
          tone="red"
        />
        <SummaryCard
          icon={AlertTriangle}
          label="Flagged"
          value={visibleFlagged.toLocaleString()}
          detail="Profiles with at least one open anomaly"
          tone="amber"
        />
        <SummaryCard
          icon={ShieldCheck}
          label="Enhanced Audit"
          value={visibleAudited.toLocaleString()}
          detail={`Average visible risk ${averageRisk}`}
          tone="green"
        />
      </div>

      <Card>
        <CardHeader
          action={(
            <div className="flex flex-wrap items-center gap-2">
              <Button variant={hasFlags ? 'primary' : 'secondary'} size="sm" onClick={() => setHasFlags(!hasFlags)}>
                {hasFlags ? 'Open Flags Only' : 'All Profiles'}
              </Button>
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                Reset Filters
              </Button>
              <Button variant="secondary" size="sm" icon={Download} loading={busyAction === 'export-users:csv'} onClick={() => handleExportUsers('csv')}>
                Export CSV
              </Button>
              <Button variant="secondary" size="sm" icon={Download} loading={busyAction === 'export-users:json'} onClick={() => handleExportUsers('json')}>
                Export JSON
              </Button>
            </div>
          )}
        >
          <div>
            <p className="text-xs font-mono uppercase tracking-[0.18em] text-cyan-400">Identity Intelligence</p>
            <p className="mt-1 text-sm text-gray-400">
              External user risk, device exposure, and anomaly response on top of the new `/identity/*` and `/risk/*` APIs.
            </p>
          </div>
        </CardHeader>

        <PageToolbar>
          <div className="grid w-full gap-3 xl:grid-cols-[minmax(0,1.5fr),220px,220px]">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                placeholder="Search by display name, email, or external user id..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-900/70 py-2 pl-9 pr-3 text-sm text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <Select
              value={minScore}
              onChange={(event) => setMinScore(event.target.value)}
              options={[
                { value: '0', label: 'All risk scores' },
                { value: '0.3', label: '30% and above' },
                { value: '0.55', label: '55% and above' },
                { value: '0.8', label: '80% and above' },
              ]}
            />
            <Select
              value={trustLevel}
              onChange={(event) => setTrustLevel(event.target.value)}
              options={[
                { value: '', label: 'All trust levels' },
                { value: 'normal', label: 'Normal' },
                { value: 'trusted', label: 'Trusted' },
                { value: 'suspicious', label: 'Suspicious' },
                { value: 'blocked', label: 'Blocked' },
              ]}
            />
          </div>
        </PageToolbar>

        {error && (
          <div className="mb-4">
            <Alert type="danger">{error}</Alert>
          </div>
        )}

        <Table
          columns={columns}
          data={users}
          loading={loading}
          emptyMessage="No external users match the current filters."
          onRowClick={selectUser}
        />
        <Pagination page={page} total={total} pageSize={20} onChange={setPage} />
      </Card>

      <Modal
        open={!!selectedUser}
        onClose={closeUser}
        title="Portal User Intelligence"
        width="max-w-7xl"
        fullHeight
        bodyClassName="!px-4 sm:!px-6"
      >
        <div className="space-y-4">
          {actionError && <Alert type="danger">{actionError}</Alert>}
          {detailError && <Alert type="warning">{detailError}</Alert>}
          {activityError && <Alert type="warning">{activityError}</Alert>}

          {selectedProfile && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cyan-500/10 bg-black/25 px-4 py-3">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-cyan-400">Export bundle</p>
                <p className="mt-1 text-sm text-gray-300">Download the selected profile with devices, risk history, activity, and anomaly flags.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="secondary" size="sm" icon={Download} loading={busyAction === 'export-detail:csv'} onClick={() => handleExportDetail('csv')}>
                  Export CSV
                </Button>
                <Button variant="secondary" size="sm" icon={Download} loading={busyAction === 'export-detail:json'} onClick={() => handleExportDetail('json')}>
                  Export JSON
                </Button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(22rem,0.95fr)_minmax(22rem,0.95fr)_minmax(34rem,1.3fr)]">
            <div className="space-y-4">
              <SectionPanel
                kicker="Profile"
                title={selectedProfile?.display_name || selectedProfile?.email || 'Portal user'}
                action={(
                  <Badge variant={riskVariant(Number(selectedProfile?.current_risk_score || 0))}>
                    {fmtRisk(selectedProfile?.current_risk_score)}
                  </Badge>
                )}
              >
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-300">{selectedProfile?.email || 'No email claim available'}</p>
                    <p className="mt-1 font-mono text-[11px] text-gray-500 break-all">{selectedProfile?.external_user_id || '—'}</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Badge variant={trustVariant(selectedProfile?.trust_level)}>{prettify(selectedProfile?.trust_level)}</Badge>
                    <Badge variant={selectedProfile?.enhanced_audit ? 'info' : 'default'}>
                      {selectedProfile?.enhanced_audit ? 'Enhanced Audit' : 'Normal Audit'}
                    </Badge>
                    <Badge variant={(detail.flags || []).some((flag) => flag.status === 'open') ? 'danger' : 'success'}>
                      {(detail.flags || []).filter((flag) => flag.status === 'open').length} open flags
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {[
                      ['Devices', selectedProfile?.total_devices ?? 0],
                      ['Sessions', selectedProfile?.total_sessions ?? 0],
                      ['First Seen', fmtShortDateTime(selectedProfile?.first_seen)],
                      ['Last Seen', fmtShortDateTime(selectedProfile?.last_seen)],
                      ['Last IP', selectedProfile?.last_ip || '—'],
                      ['Country', selectedProfile?.last_country || '—'],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-xl border border-cyan-500/10 bg-black/20 p-3">
                        <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-gray-500">{label}</p>
                        <p className="mt-1 text-sm text-white break-all">{value}</p>
                      </div>
                    ))}
                  </div>

                  <TrackingSignalsSummary
                    summary={selectedProfile?.tracking_signals}
                    title="Tracking & Blocker Signals"
                    emptyMessage="No adblock, DNS-filter, or ISP-resolution incidents are attached to this portal user yet."
                  />

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      className="flex-1"
                      icon={RefreshCw}
                      loading={busyAction === `recompute:${selectedUser?.external_user_id}`}
                      onClick={() => handleRecomputeRisk()}
                    >
                      Recompute Risk
                    </Button>
                    <Button
                      className="flex-1"
                      variant={selectedProfile?.enhanced_audit ? 'secondary' : 'neon'}
                      loading={busyAction === `audit:${selectedUser?.external_user_id}`}
                      onClick={() => handleAuditToggle(!selectedProfile?.enhanced_audit)}
                    >
                      {selectedProfile?.enhanced_audit ? 'Disable Audit' : 'Enable Audit'}
                    </Button>
                  </div>

                  <Button
                    variant="danger"
                    icon={Trash2}
                    loading={busyAction === `delete:${selectedUser?.external_user_id}`}
                    onClick={() => setConfirmDelete(true)}
                  >
                    Delete External User
                  </Button>

                  {detailLoading && (
                    <p className="text-xs font-mono text-gray-500">Refreshing profile intelligence...</p>
                  )}
                </div>
              </SectionPanel>
            </div>

            <div className="space-y-4">
              <SectionPanel
                kicker="Devices"
                title={`Linked Devices (${detail.devices.length})`}
                action={<Fingerprint size={15} className="text-cyan-400" />}
              >
                {detail.devices.length === 0 ? (
                  <p className="text-sm text-gray-500">No linked devices have been recorded yet.</p>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {detail.devices.map((device) => (
                      <div key={device.id} className="rounded-xl border border-cyan-500/10 bg-black/20 p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="info">{prettify(device.platform)}</Badge>
                          <p className="font-mono text-xs text-cyan-300">{truncateMiddle(device.fingerprint_id || device.id, 12, 8)}</p>
                        </div>
                        <div className="mt-2 grid grid-cols-1 gap-2 text-xs text-gray-400 sm:grid-cols-2">
                          <p>IP: <span className="text-gray-200">{device.ip || '—'}</span></p>
                          <p>Linked: <span className="text-gray-200">{fmtShortDateTime(device.linked_at)}</span></p>
                          <p className="sm:col-span-2">Last seen: <span className="text-gray-200">{fmtShortDateTime(device.last_seen_at)}</span></p>
                        </div>
                        <div className="mt-3">
                          <TrackingSignalsSummary
                            summary={device.tracking_signals}
                            title="Device Signals"
                            compact
                            emptyMessage="No blocker-related incidents on this linked device."
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </SectionPanel>

              <SectionPanel
                kicker="Visitors"
                title={`Tracked Visitors (${detail.visitors?.length || 0})`}
                action={<Users size={15} className="text-cyan-400" />}
              >
                {!detail.visitors || detail.visitors.length === 0 ? (
                  <p className="text-sm text-gray-500">No tracked visitor records have been linked to this portal user yet.</p>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {detail.visitors.map((visitor) => (
                      <div key={visitor.id} className="rounded-xl border border-cyan-500/10 bg-black/20 p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="info">{visitor.status || 'active'}</Badge>
                          <p className="font-mono text-xs text-cyan-300">{truncateMiddle(visitor.id, 12, 8)}</p>
                        </div>
                        <div className="mt-2 grid grid-cols-1 gap-2 text-xs text-gray-400 sm:grid-cols-2">
                          <p>IP: <span className="text-gray-200">{visitor.ip || '—'}</span></p>
                          <p>Country: <span className="text-gray-200">{visitor.country_flag ? `${visitor.country_flag} ${visitor.country || '—'}` : visitor.country || '—'}</span></p>
                          <p>Browser: <span className="text-gray-200">{visitor.browser || '—'}</span></p>
                          <p>OS: <span className="text-gray-200">{visitor.os || '—'}</span></p>
                          <p>Page views: <span className="text-gray-200">{visitor.page_views ?? 0}</span></p>
                          <p>Last seen: <span className="text-gray-200">{fmtShortDateTime(visitor.last_seen)}</span></p>
                        </div>
                        <div className="mt-3">
                          <TrackingSignalsSummary
                            summary={visitor.tracking_signals}
                            title="Visitor Signals"
                            compact
                            emptyMessage="No blocker-related incidents on this visitor."
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </SectionPanel>
            </div>

            <div className="space-y-4">
              <SectionPanel
                kicker="Risk History"
                title="Composite Risk Timeline"
                action={(
                  <div className="flex items-center gap-2">
                    <Badge variant={riskVariant(Number(selectedProfile?.current_risk_score || 0))}>
                      Current {fmtRisk(selectedProfile?.current_risk_score)}
                    </Badge>
                  </div>
                )}
              >
                {riskHistoryData.length === 0 ? (
                  <p className="text-sm text-gray-500">No risk events have been recorded for this profile yet.</p>
                ) : (
                  <div className="space-y-4">
                    <div className="h-72 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={riskHistoryData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id="riskFill" x1="0" x2="0" y1="0" y2="1">
                              <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.45} />
                              <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.04} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                          <XAxis
                            dataKey="label"
                            tick={{ fill: '#94a3b8', fontSize: 11 }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            domain={[0, 1]}
                            tickFormatter={(value) => `${Math.round(value * 100)}%`}
                            tick={{ fill: '#94a3b8', fontSize: 11 }}
                            axisLine={false}
                            tickLine={false}
                            width={42}
                          />
                          <Tooltip
                            formatter={(value, _name, item) => [fmtRisk(value), item?.payload?.triggerType]}
                            labelFormatter={(_label, payload) => fmtDateTime(payload?.[0]?.payload?.createdAt)}
                            contentStyle={{
                              background: 'rgba(3, 7, 18, 0.94)',
                              border: '1px solid rgba(34, 211, 238, 0.2)',
                              borderRadius: '12px',
                              color: '#e2e8f0',
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="score"
                            stroke="#22d3ee"
                            strokeWidth={2}
                            fill="url(#riskFill)"
                            activeDot={{ r: 4, stroke: '#67e8f9', strokeWidth: 1 }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      {riskHistoryData.slice(-3).reverse().map((entry) => (
                        <div key={entry.id} className="rounded-xl border border-cyan-500/10 bg-black/20 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <Badge variant={riskVariant(entry.score)}>{fmtRisk(entry.score)}</Badge>
                            <p className="text-[10px] font-mono text-gray-500">{fmtShortDateTime(entry.createdAt)}</p>
                          </div>
                          <p className="mt-2 text-sm text-white">{entry.triggerType}</p>
                          <p className={`mt-1 text-xs font-mono ${entry.delta >= 0 ? 'text-red-300' : 'text-green-300'}`}>
                            Delta {entry.delta >= 0 ? '+' : ''}{Math.round(entry.delta * 100)}%
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </SectionPanel>

              <SectionPanel
                kicker="Activity"
                title="Authenticated Activity Timeline"
                action={(
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Select
                      value={activityFilters.eventType}
                      onChange={(event) => setActivityEventType(event.target.value)}
                      options={[
                        { value: '', label: 'All event types' },
                        { value: 'login', label: 'Login' },
                        { value: 'logout', label: 'Logout' },
                        { value: 'page_view', label: 'Page View' },
                        { value: 'purchase', label: 'Purchase' },
                        { value: 'password_reset', label: 'Password Reset' },
                      ]}
                    />
                    <Select
                      value={activityFilters.platform}
                      onChange={(event) => setActivityPlatform(event.target.value)}
                      options={[
                        { value: '', label: 'All platforms' },
                        { value: 'web', label: 'Web' },
                        { value: 'ios', label: 'iOS' },
                        { value: 'android', label: 'Android' },
                        { value: 'api', label: 'API' },
                      ]}
                    />
                  </div>
                )}
              >
                {activityLoading ? (
                  <p className="text-sm text-gray-500">Loading activity timeline...</p>
                ) : detail.activity.length === 0 ? (
                  <p className="text-sm text-gray-500">No authenticated activity matches the current filters.</p>
                ) : (
                  <div className="space-y-3">
                    {detail.activity.map((event) => (
                      <div key={event.id} className="rounded-xl border border-cyan-500/10 bg-black/20 p-3">
                        <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="info">{prettify(event.event_type)}</Badge>
                              <Badge variant="default">{prettify(event.platform)}</Badge>
                              {event.country && <Badge variant="default">{event.country}</Badge>}
                            </div>
                            <p className="mt-2 text-xs text-gray-300">
                              {event.page_url || 'No page URL captured'}
                            </p>
                          </div>
                          <div className="text-left lg:text-right">
                            <p className="text-xs text-gray-300">{fmtDateTime(event.created_at)}</p>
                            <p className="mt-1 font-mono text-[10px] text-gray-500">{event.ip || 'IP unavailable'}</p>
                          </div>
                        </div>
                        <div className="mt-3 grid grid-cols-1 gap-2 text-[11px] text-gray-500 sm:grid-cols-2">
                          <p>Session: <span className="text-gray-300">{event.session_id || '—'}</span></p>
                          <p>Fingerprint: <span className="text-gray-300">{truncateMiddle(event.fingerprint_id || '—', 12, 8)}</span></p>
                          <p className="sm:col-span-2">Site: <span className="text-gray-300">{event.site_id || '—'}</span></p>
                        </div>
                      </div>
                    ))}
                    <Pagination
                      page={activityFilters.page}
                      total={detail.activityTotal}
                      pageSize={12}
                      onChange={setActivityPage}
                    />
                  </div>
                )}
              </SectionPanel>

              <SectionPanel
                kicker="Anomalies"
                title={`Anomaly Flags (${detail.flags.length})`}
                action={<Activity size={15} className="text-cyan-400" />}
              >
                {detail.flags.length === 0 ? (
                  <p className="text-sm text-gray-500">No anomaly flags have been recorded for this user.</p>
                ) : (
                  <div className="space-y-3">
                    {detail.flags.map((flag) => (
                      <div key={flag.id} className="rounded-xl border border-cyan-500/10 bg-black/20 p-4">
                        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-medium text-white">{prettify(flag.flag_type)}</p>
                              <Badge variant={severityVariant(flag.severity)}>{prettify(flag.severity)}</Badge>
                              <Badge variant={flagStatusVariant(flag.status)}>{prettify(flag.status)}</Badge>
                            </div>
                            <p className="mt-2 text-xs text-gray-400">Detected {fmtDateTime(flag.detected_at)}</p>
                            {flag.related_device_id && (
                              <p className="mt-1 font-mono text-[10px] text-gray-500">
                                Related device {truncateMiddle(flag.related_device_id, 12, 8)}
                              </p>
                            )}
                          </div>

                          {(flag.status === 'open' || flag.status === 'acknowledged') && (
                            <div className="flex flex-wrap gap-2">
                              {flag.status === 'open' && (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  loading={busyAction === `flag:${flag.id}:acknowledged`}
                                  onClick={() => handleFlagAction(flag.id, 'acknowledged')}
                                >
                                  Acknowledge
                                </Button>
                              )}
                              <Button
                                variant="primary"
                                size="sm"
                                loading={busyAction === `flag:${flag.id}:resolved`}
                                onClick={() => handleFlagAction(flag.id, 'resolved')}
                              >
                                Resolve
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                loading={busyAction === `flag:${flag.id}:false_positive`}
                                onClick={() => handleFlagAction(flag.id, 'false_positive')}
                              >
                                False Positive
                              </Button>
                            </div>
                          )}
                        </div>

                        {parseEvidence(flag.evidence).length > 0 && (
                          <div className="mt-3 grid grid-cols-1 gap-2 rounded-xl border border-cyan-500/10 bg-black/20 p-3 md:grid-cols-2">
                            {parseEvidence(flag.evidence).map(([key, value]) => (
                              <div key={`${flag.id}-${key}`}>
                                <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-gray-500">{prettify(key)}</p>
                                <p className="mt-1 text-xs text-gray-300 break-all">{value}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </SectionPanel>
            </div>
          </div>
        </div>
      </Modal>

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete External User">
        <div className="space-y-4">
          <p className="text-sm text-gray-400">
            Permanently delete portal user intelligence for <code className="text-cyan-400">{selectedProfile?.email || selectedProfile?.external_user_id}</code>?
            <br />
            <span className="text-red-400">This removes the external user profile, linked intelligence records, flags, risk history, activity timeline, and stored user-to-device links.</span>
          </p>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button variant="danger" icon={Trash2} loading={busyAction === `delete:${selectedUser?.external_user_id}`} onClick={handleDeleteExternalUser}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  )
}
