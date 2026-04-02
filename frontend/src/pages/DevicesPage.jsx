import { useState } from 'react'
import { Link2, Search, Shield, Trash2, Users } from 'lucide-react'
import DashboardLayout from '../components/layout/DashboardLayout'
import { Card, Badge, Button, Pagination, Modal, Select, PageToolbar } from '../components/ui/index'
import DeviceGroupsTable from '../components/ui/DeviceGroupsTable'
import { useDevices } from '../hooks/useDevices'

const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : '—'

export default function DevicesPage() {
  const {
    deviceGroups,
    total,
    page,
    search,
    loading,
    usersList,
    setPage,
    setSearch,
    refresh,
    loadDevice,
    loadDeviceVisitors,
    loadUsersList,
    linkDevice,
    unlinkDevice,
    blockDevice,
    unblockDevice,
    deleteDevice,
  } = useDevices()
  const [selected, setSelected] = useState(null)
  const [deviceVisitors, setDeviceVisitors] = useState([])
  const [linkModal, setLinkModal] = useState(null)
  const [linkUserId, setLinkUserId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [shieldTarget, setShieldTarget] = useState(null)
  const [shielding, setShielding] = useState(false)

  const openDetailModal = async (device) => {
    try {
      const exact = await loadDevice(device.id)
      setSelected(exact)
      setDeviceVisitors(await loadDeviceVisitors(device.id))
    } catch {
      // Keep the table interactive even if the exact fetch fails.
      setSelected(null)
      setDeviceVisitors([])
    }
  }

  const openLinkModal = async (device) => {
    setLinkModal(device)
    try {
      await loadUsersList()
    } catch {
      // User list failure leaves the modal open without options.
    }
  }

  const handleLinkAction = async (device) => {
    if (device.linked_user) {
      await unlinkDevice(device.id)
      if (selected?.id === device.id) {
        setSelected({ ...selected, linked_user: null })
      }
      return
    }
    await openLinkModal(device)
  }

  const handleLink = async () => {
    if (!linkModal || !linkUserId) return
    setSubmitting(true)
    try {
      await linkDevice(linkModal.id, linkUserId)
      if (selected?.id === linkModal.id) {
        setSelected({ ...selected, linked_user: linkUserId })
      }
      setLinkModal(null)
      setLinkUserId('')
    } catch {
      // Keep the modal open so the operator can retry.
    } finally {
      setSubmitting(false)
    }
  }

  const handleShield = async () => {
    if (!shieldTarget) return
    setShielding(true)
    try {
      if (shieldTarget.status === 'blocked') {
        await unblockDevice(shieldTarget.id)
      } else {
        await blockDevice(shieldTarget.id)
      }
      if (selected?.id === shieldTarget.id) {
        setSelected({
          ...selected,
          status: shieldTarget.status === 'blocked' ? 'active' : 'blocked',
        })
      }
      setShieldTarget(null)
    } catch {
      // Preserve the current UI state on request failure.
    } finally {
      setShielding(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteDevice(deleteTarget.id)
      if (selected?.id === deleteTarget.id) {
        setSelected(null)
        setDeviceVisitors([])
      }
      setDeleteTarget(null)
    } catch {
      // Preserve the current UI state on request failure.
    } finally {
      setDeleting(false)
    }
  }

  return (
    <DashboardLayout title="Devices" onRefresh={refresh}>
      <Card>
        <PageToolbar>
          <div className="relative w-full xl:max-w-[40rem]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              placeholder="Search by fingerprint, browser, OS, or match key..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3 xl:justify-end">
            <span className="text-sm text-gray-500">{total.toLocaleString()} device groups</span>
          </div>
        </PageToolbar>

        <DeviceGroupsTable
          groups={deviceGroups}
          loading={loading}
          onViewDevice={openDetailModal}
          onOpenLink={handleLinkAction}
          onOpenDelete={setDeleteTarget}
          onOpenShield={setShieldTarget}
        />

        <Pagination page={page} total={total} pageSize={20} onChange={setPage} />
      </Card>

      <Modal open={!!selected} onClose={() => { setSelected(null); setDeviceVisitors([]) }} title="Device Details" width="max-w-2xl">
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {[
                ['Fingerprint', selected.fingerprint],
                ['Match Key', selected.match_key ?? '—'],
                ['Type', selected.type],
                ['Browser', selected.browser],
                ['OS', selected.os],
                ['Screen', selected.screen_resolution],
                ['Language', selected.language],
                ['Timezone', selected.timezone],
                ['Timezone Offset', selected.timezone_offset_minutes != null ? `${selected.timezone_offset_minutes} min` : '—'],
                ['Visitors', selected.visitor_count],
                ['Fingerprint Confidence', selected.fingerprint_confidence != null ? `${Math.round(selected.fingerprint_confidence * 100)}%` : '—'],
                ['Stability Score', selected.stability_score != null ? `${Math.round(selected.stability_score * 100)}%` : '—'],
                ['Composite Score', selected.composite_score != null ? `${Math.round(selected.composite_score * 100)}%` : '—'],
                ['Clock Skew', selected.clock_skew_minutes != null ? `${selected.clock_skew_minutes} min` : '—'],
                ['Status', selected.status],
                ['First Seen', fmtDate(selected.first_seen)],
                ['Last Seen', fmtDate(selected.last_seen)],
              ].map(([label, value]) => (
                <div key={label} className="bg-gray-800 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-0.5">{label}</p>
                  <p className="text-sm text-white font-mono break-all">{value ?? '—'}</p>
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

            {selected.composite_fingerprint && (
              <div className="bg-gray-800 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-0.5">Composite Fingerprint</p>
                <p className="text-xs text-gray-300 font-mono break-all">{selected.composite_fingerprint}</p>
              </div>
            )}

            <div>
              <p className="text-xs text-gray-500 mb-2 flex items-center gap-1.5">
                <Users size={12} /> Visitors on this fingerprint ({deviceVisitors.length})
              </p>
              {deviceVisitors.length === 0 ? (
                <p className="text-xs text-gray-600 italic">No visitor records yet.</p>
              ) : (
                <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                  {deviceVisitors.map((visitor) => (
                    <div key={visitor.id} className="flex flex-col gap-3 rounded-lg bg-gray-800 px-3 py-2 xl:flex-row xl:items-center xl:justify-between">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-300">
                        <code className="text-cyan-400">{visitor.ip}</code>
                        {visitor.country_flag && <span>{visitor.country_flag}</span>}
                        <span className="text-gray-500">{visitor.browser ?? '?'} / {visitor.os ?? '?'}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                        <span>{visitor.page_views ?? 0} pvs</span>
                        <span>{fmtDate(visitor.last_seen)}</span>
                        {visitor.status === 'blocked' ? (
                          <Badge variant="danger">Blocked</Badge>
                        ) : (
                          <Badge variant="success">Active</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!shieldTarget} onClose={() => setShieldTarget(null)} title={shieldTarget?.status === 'blocked' ? 'Unblock Fingerprint' : 'Block Fingerprint'}>
        <div className="space-y-4">
          <p className="text-sm text-gray-400">
            {shieldTarget?.status === 'blocked' ? 'Remove the block from exact fingerprint ' : 'Block exact fingerprint '}
            <code className="text-cyan-400 text-xs">{shieldTarget?.fingerprint?.slice(0, 20)}…</code>?
            <br />
            <span className="text-gray-500">This action affects only this fingerprint, not the whole grouped device.</span>
          </p>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setShieldTarget(null)}>Cancel</Button>
            <Button
              variant={shieldTarget?.status === 'blocked' ? 'secondary' : 'danger'}
              loading={shielding}
              onClick={handleShield}
              icon={Shield}
            >
              {shieldTarget?.status === 'blocked' ? 'Unblock' : 'Block'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Device">
        <div className="space-y-4">
          <p className="text-sm text-gray-400">
            Permanently delete exact fingerprint <code className="text-cyan-400 text-xs">{deleteTarget?.fingerprint?.slice(0, 20)}…</code>?
            <br />
            <span className="text-red-400">Visitors will be unlinked and events will lose device context.</span>
          </p>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" loading={deleting} onClick={handleDelete} icon={Trash2}>Delete</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!linkModal} onClose={() => { setLinkModal(null); setLinkUserId('') }} title="Link Device to User">
        <div className="space-y-4">
          <p className="text-sm text-gray-400">
            Link exact fingerprint <code className="text-cyan-400 text-xs">{linkModal?.fingerprint?.slice(0, 20)}…</code> to a user account.
          </p>
          <Select
            label="Select User"
            value={linkUserId}
            onChange={(e) => setLinkUserId(e.target.value)}
            options={[{ value: '', label: '— Select user —' }, ...usersList]}
          />
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setLinkModal(null)}>Cancel</Button>
            <Button loading={submitting} disabled={!linkUserId} onClick={handleLink} icon={Link2}>Link Device</Button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  )
}
