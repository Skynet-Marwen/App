import { Activity, FilterX, Search } from 'lucide-react'
import DashboardLayout from '../components/layout/DashboardLayout'
import { Badge, Button, Card, CardHeader, Pagination, Select, StatCard, Table } from '../components/ui/index'
import { useAuditLogs } from '../hooks/useAuditLogs'

const ACTION_OPTIONS = [
  { value: '', label: 'All actions' },
  { value: 'LOGIN', label: 'LOGIN' },
  { value: 'LOGIN_FAILED', label: 'LOGIN_FAILED' },
  { value: 'LOGOUT', label: 'LOGOUT' },
  { value: 'CONFIG_CHANGE', label: 'CONFIG_CHANGE' },
  { value: 'CREATE_USER', label: 'CREATE_USER' },
  { value: 'BLOCK_USER', label: 'BLOCK_USER' },
  { value: 'BLOCK_IP', label: 'BLOCK_IP' },
  { value: 'RESOLVE_INCIDENT', label: 'RESOLVE_INCIDENT' },
]

const TARGET_OPTIONS = [
  { value: '', label: 'All targets' },
  { value: 'user', label: 'User' },
  { value: 'visitor', label: 'Visitor' },
  { value: 'device', label: 'Device' },
  { value: 'ip', label: 'IP' },
  { value: 'site', label: 'Site' },
  { value: 'settings', label: 'Settings' },
  { value: 'incident', label: 'Incident' },
  { value: 'session', label: 'Session' },
]

function summarizeExtra(extra) {
  if (!extra) return '—'
  const entries = Object.entries(extra).slice(0, 3)
  return entries.map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`).join(' · ')
}

export default function AuditPage() {
  const {
    items,
    total,
    page,
    search,
    action,
    targetType,
    loading,
    setPage,
    setSearch,
    setAction,
    setTargetType,
    refresh,
  } = useAuditLogs()

  const hasFilters = Boolean(search || action || targetType)
  const uniqueActions = new Set(items.map((item) => item.action).filter(Boolean)).size
  const uniqueTargets = new Set(items.map((item) => item.target_type).filter(Boolean)).size
  const configChanges = items.filter((item) => item.action === 'CONFIG_CHANGE').length

  const clearFilters = () => {
    setSearch('')
    setAction('')
    setTargetType('')
    setPage(1)
  }

  const columns = [
    { key: 'actor_label', label: 'Actor', render: (value, row) => <span className="text-xs text-white">{value || row.actor_id || 'System'}</span> },
    { key: 'action', label: 'Action', render: (value) => <span className="text-xs text-cyan-400 font-mono">{value}</span> },
    { key: 'target_type', label: 'Target', render: (value, row) => <span className="text-xs text-gray-300">{value ? `${value}:${row.target_id || '—'}` : row.target_id || '—'}</span> },
    { key: 'ip', label: 'IP', render: (value) => <code className="text-xs text-gray-400">{value || '—'}</code> },
    { key: 'extra', label: 'Details', render: (value) => <span className="text-xs text-gray-500">{summarizeExtra(value)}</span> },
    { key: 'created_at', label: 'Timestamp', render: (value) => <span className="text-xs text-gray-400">{new Date(value).toLocaleString()}</span> },
  ]

  return (
    <DashboardLayout title="Audit Log" onRefresh={refresh}>
      {/* Stat strip */}
      <div className="grid grid-cols-2 gap-1 xl:grid-cols-4">
        <StatCard label="Matching records" rawValue={total} value={total.toLocaleString()} icon={Activity} color="cyan" loading={loading} nano />
        <StatCard label="Loaded rows" rawValue={items.length} value={items.length.toLocaleString()} icon={Activity} color="blue" loading={loading} nano />
        <StatCard label="Unique actions" rawValue={uniqueActions} value={uniqueActions.toLocaleString()} icon={Activity} color="green" loading={loading} nano />
        <StatCard label="Config changes" rawValue={configChanges} value={configChanges.toLocaleString()} icon={Activity} color="yellow" loading={loading} nano />
      </div>

      <Card>
        <CardHeader
          action={
            <div className="flex items-center gap-2">
              <Badge variant={hasFilters ? 'warning' : 'default'}>{hasFilters ? 'Filtered' : 'Live'}</Badge>
              {hasFilters && <Button variant="secondary" size="sm" icon={FilterX} onClick={clearFilters}>Clear</Button>}
            </div>
          }
        >
          <p className="text-xs font-mono font-medium text-cyan-400 uppercase tracking-widest">Filter Events</p>
        </CardHeader>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.2fr_0.9fr_0.9fr_auto]">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              placeholder="Search actor, target, IP..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="w-full rounded-lg border border-cyan-500/15 bg-black/60 py-2 pl-9 pr-3 text-sm text-white placeholder-gray-500 focus:border-cyan-500/60 focus:outline-none"
            />
          </div>
          <Select value={action} onChange={(e) => { setAction(e.target.value); setPage(1) }} options={ACTION_OPTIONS} />
          <Select value={targetType} onChange={(e) => { setTargetType(e.target.value); setPage(1) }} options={TARGET_OPTIONS} />
          <div className="flex items-end">
            <Button variant="secondary" className="w-full xl:w-auto" onClick={refresh}>Refresh</Button>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-cyan-500/10">
          <Table columns={columns} data={items} loading={loading} emptyMessage="No audit events found" />
        </div>
        <Pagination page={page} total={total} pageSize={20} onChange={setPage} />
      </Card>
    </DashboardLayout>
  )
}
