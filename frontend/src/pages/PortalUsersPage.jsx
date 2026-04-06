import { createElement, useState } from 'react'
import {
  AlertTriangle,
  Crosshair,
  Download,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Users,
} from 'lucide-react'
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
import PortalUserIntelModal from '../components/ui/PortalUserIntelModal'
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
    updateTrustLevel,
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

  const handleTrustLevel = async (level) => {
    if (!selectedUser?.external_user_id) return
    setActionError('')
    setBusyAction(`trust:${selectedUser.external_user_id}:${level}`)
    try {
      await updateTrustLevel(level)
    } catch (err) {
      setActionError(err?.response?.data?.detail?.message || err?.response?.data?.detail || 'Failed to update trust level')
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
        <div className="space-y-2">
          {actionError && <Alert type="danger">{actionError}</Alert>}
          {detailError && <Alert type="warning">{detailError}</Alert>}
          {activityError && <Alert type="warning">{activityError}</Alert>}
          <PortalUserIntelModal
            profile={selectedProfile}
            detail={detail}
            riskHistoryData={riskHistoryData}
            detailLoading={detailLoading}
            activityLoading={activityLoading}
            activityFilters={activityFilters}
            busyAction={busyAction}
            onRecompute={() => handleRecomputeRisk()}
            onAuditToggle={handleAuditToggle}
            onDelete={() => setConfirmDelete(true)}
            onExportDetail={handleExportDetail}
            onFlagAction={handleFlagAction}
            onTrustLevel={handleTrustLevel}
            onEventType={setActivityEventType}
            onPlatform={setActivityPlatform}
            onActivityPage={setActivityPage}
          />
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
