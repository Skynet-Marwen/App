import { Search } from 'lucide-react'
import DashboardLayout from '../components/layout/DashboardLayout'
import { Card, CardHeader, Pagination, Select, Table } from '../components/ui/index'
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
      <Card>
        <CardHeader>
          <p className="text-sm font-medium text-white">Audit Trail</p>
          <p className="text-xs text-gray-500">Write-only operational history across admin actions</p>
        </CardHeader>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              placeholder="Search actor, target, IP..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
            />
          </div>
          <Select value={action} onChange={(e) => { setAction(e.target.value); setPage(1) }} options={ACTION_OPTIONS} />
          <Select value={targetType} onChange={(e) => { setTargetType(e.target.value); setPage(1) }} options={TARGET_OPTIONS} />
        </div>

        <Table columns={columns} data={items} loading={loading} emptyMessage="No audit events found" />
        <Pagination page={page} total={total} pageSize={20} onChange={setPage} />
      </Card>
    </DashboardLayout>
  )
}
