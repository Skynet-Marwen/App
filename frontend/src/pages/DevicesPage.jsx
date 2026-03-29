import { useState, useEffect, useCallback } from 'react'
import { Search, Monitor, Link2, Unlink, Ban, Fingerprint } from 'lucide-react'
import DashboardLayout from '../components/layout/DashboardLayout'
import { Card, Table, Badge, Button, Input, Pagination, Modal, Select } from '../components/ui/index'
import { devicesApi, usersApi } from '../services/api'

export default function DevicesPage() {
  const [devices, setDevices] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [linkModal, setLinkModal] = useState(null)
  const [usersList, setUsersList] = useState([])
  const [linkUserId, setLinkUserId] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchDevices = useCallback(async () => {
    setLoading(true)
    try {
      const res = await devicesApi.list({ page, search, page_size: 20 })
      setDevices(res.data.items)
      setTotal(res.data.total)
    } catch (_) {}
    finally { setLoading(false) }
  }, [page, search])

  useEffect(() => { fetchDevices() }, [fetchDevices])

  const openLinkModal = async (device) => {
    setLinkModal(device)
    try {
      const res = await usersApi.list({ page_size: 100 })
      setUsersList(res.data.items.map((u) => ({ value: u.id, label: `${u.username} (${u.email})` })))
    } catch (_) {}
  }

  const handleLink = async () => {
    setSubmitting(true)
    try {
      await devicesApi.link(linkModal.id, linkUserId)
      setLinkModal(null)
      setLinkUserId('')
      fetchDevices()
    } catch (_) {}
    finally { setSubmitting(false) }
  }

  const handleUnlink = async (device) => {
    await devicesApi.unlink(device.id)
    fetchDevices()
  }

  const handleBlock = async (device) => {
    await devicesApi.block(device.id, 'Manual block')
    fetchDevices()
  }

  const riskBadge = (score) => {
    if (score >= 80) return <Badge variant="danger">{score} High</Badge>
    if (score >= 50) return <Badge variant="warning">{score} Medium</Badge>
    return <Badge variant="success">{score} Low</Badge>
  }

  const columns = [
    { key: 'fingerprint', label: 'Fingerprint', render: (v) => (
      <div className="flex items-center gap-2">
        <Fingerprint size={14} className="text-cyan-400 flex-shrink-0" />
        <code className="text-xs text-cyan-400 truncate max-w-[120px]">{v}</code>
      </div>
    )},
    { key: 'type', label: 'Type', render: (v) => (
      <span className="flex items-center gap-1.5 text-xs text-gray-300">
        <Monitor size={13} className="text-gray-500" /> {v}
      </span>
    )},
    { key: 'browser', label: 'Browser', render: (v, r) => <span className="text-xs text-gray-300">{v} / {r.os}</span> },
    { key: 'linked_user', label: 'Linked User', render: (v) => v ? (
      <span className="flex items-center gap-1.5 text-xs">
        <Link2 size={12} className="text-cyan-400" />
        <span className="text-cyan-400">{v}</span>
      </span>
    ) : <span className="text-xs text-gray-500">—</span>},
    { key: 'risk_score', label: 'Risk Score', render: (v) => riskBadge(v ?? 0) },
    { key: 'last_seen', label: 'Last Seen', render: (v) => <span className="text-xs text-gray-400">{v}</span> },
    { key: 'status', label: 'Status', render: (v) => (
      v === 'blocked' ? <Badge variant="danger">Blocked</Badge> : <Badge variant="success">Active</Badge>
    )},
    {
      key: 'actions', label: '', width: '140px',
      render: (_, row) => (
        <div className="flex gap-1">
          {row.linked_user ? (
            <Button variant="secondary" size="sm" icon={Unlink} onClick={(e) => { e.stopPropagation(); handleUnlink(row) }}>
              Unlink
            </Button>
          ) : (
            <Button variant="secondary" size="sm" icon={Link2} onClick={(e) => { e.stopPropagation(); openLinkModal(row) }}>
              Link
            </Button>
          )}
          {row.status !== 'blocked' && (
            <Button variant="danger" size="sm" icon={Ban} onClick={(e) => { e.stopPropagation(); handleBlock(row) }} />
          )}
        </div>
      )
    },
  ]

  return (
    <DashboardLayout title="Devices" onRefresh={fetchDevices}>
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              placeholder="Search by fingerprint, browser, OS..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
            />
          </div>
          <span className="text-sm text-gray-500">{total.toLocaleString()} devices</span>
        </div>

        <Table columns={columns} data={devices} loading={loading} emptyMessage="No devices found" onRowClick={setSelected} />
        <Pagination page={page} total={total} pageSize={20} onChange={setPage} />
      </Card>

      {/* Device Detail Modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title="Device Details" width="max-w-2xl">
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {[
                ['Fingerprint', selected.fingerprint],
                ['Type', selected.type],
                ['Browser', selected.browser],
                ['OS', selected.os],
                ['Screen', selected.screen_resolution],
                ['Language', selected.language],
                ['Timezone', selected.timezone],
                ['Risk Score', selected.risk_score],
                ['First Seen', selected.first_seen],
                ['Last Seen', selected.last_seen],
              ].map(([label, value]) => (
                <div key={label} className="bg-gray-800 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-0.5">{label}</p>
                  <p className="text-sm text-white font-mono">{value ?? '—'}</p>
                </div>
              ))}
            </div>
            {selected.canvas_hash && (
              <div className="bg-gray-800 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-0.5">Canvas Hash</p>
                <p className="text-xs text-gray-300 font-mono break-all">{selected.canvas_hash}</p>
              </div>
            )}
            {selected.webgl_hash && (
              <div className="bg-gray-800 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-0.5">WebGL Hash</p>
                <p className="text-xs text-gray-300 font-mono break-all">{selected.webgl_hash}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Link to User Modal */}
      <Modal open={!!linkModal} onClose={() => { setLinkModal(null); setLinkUserId('') }} title="Link Device to User">
        <div className="space-y-4">
          <p className="text-sm text-gray-400">
            Link fingerprint <code className="text-cyan-400 text-xs">{linkModal?.fingerprint?.slice(0, 16)}…</code> to a user account.
          </p>
          <Select
            label="Select User"
            value={linkUserId}
            onChange={(e) => setLinkUserId(e.target.value)}
            options={[{ value: '', label: '— Select user —' }, ...usersList]}
          />
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setLinkModal(null)}>Cancel</Button>
            <Button loading={submitting} disabled={!linkUserId} onClick={handleLink} icon={Link2}>
              Link Device
            </Button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  )
}
