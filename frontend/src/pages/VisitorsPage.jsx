import { useState } from 'react'
import { Eye, Search, Ban, Globe, Monitor, Clock, Trash2 } from 'lucide-react'
import DashboardLayout from '../components/layout/DashboardLayout'
import { Card, Table, Badge, Button, Input, Pagination, Modal } from '../components/ui/index'
import { useVisitors } from '../hooks/useVisitors'

const statusBadge = (status) => {
  if (status === 'blocked') return <Badge variant="danger">Blocked</Badge>
  if (status === 'suspicious') return <Badge variant="warning">Suspicious</Badge>
  return <Badge variant="success">Active</Badge>
}

export default function VisitorsPage() {
  const {
    visitors,
    total,
    page,
    search,
    loading,
    setPage,
    setSearch,
    refresh,
    blockVisitor,
    unblockVisitor,
    deleteVisitor,
  } = useVisitors()
  const [selected, setSelected] = useState(null)
  const [blockModal, setBlockModal] = useState(null)
  const [blockReason, setBlockReason] = useState('')
  const [blocking, setBlocking] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const handleBlock = async () => {
    if (!blockModal) return
    setBlocking(true)
    try {
      await blockVisitor(blockModal.id, blockReason)
      setBlockModal(null)
      setBlockReason('')
    } catch (_) {}
    finally { setBlocking(false) }
  }

  const handleUnblock = async (visitor) => {
    await unblockVisitor(visitor.id)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteVisitor(deleteTarget.id)
      setDeleteTarget(null)
    } catch (_) {}
    finally { setDeleting(false) }
  }

  const columns = [
    { key: 'ip', label: 'IP Address', render: (v) => <code className="text-cyan-400 text-xs">{v}</code> },
    { key: 'country', label: 'Country', render: (_, r) => (
      <span className="flex items-center gap-2 text-xs text-gray-300">
        <Globe size={13} className="text-gray-500" /> {r.country_flag} {r.country}
      </span>
    )},
    { key: 'device_type', label: 'Device', render: (v) => (
      <span className="flex items-center gap-1.5 text-xs text-gray-300">
        <Monitor size={13} className="text-gray-500" /> {v}
      </span>
    )},
    { key: 'first_seen', label: 'First Seen', render: (v) => (
      <span className="flex items-center gap-1.5 text-xs text-gray-400">
        <Clock size={12} /> {v}
      </span>
    )},
    { key: 'last_seen', label: 'Last Seen', render: (v) => <span className="text-xs text-gray-400">{v}</span> },
    { key: 'page_views', label: 'Page Views', render: (v) => <span className="text-xs text-white font-medium">{v}</span> },
    { key: 'status', label: 'Status', render: (v) => statusBadge(v) },
    {
      key: 'actions', label: '', width: '140px',
      render: (_, row) => (
        <div className="flex gap-1">
          {row.status !== 'blocked' ? (
            <Button variant="danger" size="sm" icon={Ban} onClick={(e) => { e.stopPropagation(); setBlockModal(row) }}>
              Block
            </Button>
          ) : (
            <Button variant="secondary" size="sm" onClick={(e) => { e.stopPropagation(); handleUnblock(row) }}>
              Unblock
            </Button>
          )}
          <Button variant="danger" size="sm" icon={Trash2} onClick={(e) => { e.stopPropagation(); setDeleteTarget(row) }} />
        </div>
      )
    },
  ]

  return (
    <DashboardLayout title="Visitors" onRefresh={refresh}>
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              placeholder="Search by IP, country, user agent..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
            />
          </div>
          <span className="text-sm text-gray-500">{total.toLocaleString()} total</span>
        </div>

        <Table
          columns={columns}
          data={visitors}
          loading={loading}
          emptyMessage="No visitors found"
          onRowClick={setSelected}
        />
        <Pagination page={page} total={total} pageSize={20} onChange={setPage} />
      </Card>

      {/* Visitor Detail Modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title="Visitor Details" width="max-w-2xl">
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {[
                ['IP Address', selected.ip],
                ['Country', `${selected.country_flag} ${selected.country}`],
                ['City', selected.city],
                ['ISP', selected.isp],
                ['Device', selected.device_type],
                ['Browser', selected.browser],
                ['OS', selected.os],
                ['Page Views', selected.page_views],
                ['First Seen', selected.first_seen],
                ['Last Seen', selected.last_seen],
              ].map(([label, value]) => (
                <div key={label} className="bg-gray-800 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-0.5">{label}</p>
                  <p className="text-sm text-white">{value || '—'}</p>
                </div>
              ))}
            </div>
            {selected.user_agent && (
              <div className="bg-gray-800 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-0.5">User Agent</p>
                <p className="text-xs text-gray-300 font-mono break-all">{selected.user_agent}</p>
              </div>
            )}
            {selected.linked_user && (
              <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-3">
                <p className="text-xs text-cyan-400 mb-0.5">Linked User</p>
                <p className="text-sm text-white">{selected.linked_user}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Visitor">
        <div className="space-y-4">
          <p className="text-sm text-gray-400">
            Permanently delete visitor <code className="text-cyan-400">{deleteTarget?.ip}</code>?
            <br />
            <span className="text-red-400">All events for this visitor will be deleted. Linked device will be unlinked.</span>
          </p>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" loading={deleting} onClick={handleDelete} icon={Trash2}>Delete</Button>
          </div>
        </div>
      </Modal>

      {/* Block Modal */}
      <Modal open={!!blockModal} onClose={() => setBlockModal(null)} title="Block Visitor">
        <div className="space-y-4">
          <p className="text-sm text-gray-400">
            Block IP <code className="text-cyan-400">{blockModal?.ip}</code> from all tracked sites?
          </p>
          <Input
            label="Reason (optional)"
            placeholder="Spam, abuse, etc."
            value={blockReason}
            onChange={(e) => setBlockReason(e.target.value)}
          />
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setBlockModal(null)}>Cancel</Button>
            <Button variant="danger" loading={blocking} onClick={handleBlock} icon={Ban}>
              Block
            </Button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  )
}
