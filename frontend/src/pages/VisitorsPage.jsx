import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Ban, CheckSquare, Clock, Globe, Monitor, Square, Trash2 } from 'lucide-react'
import DashboardLayout from '../components/layout/DashboardLayout'
import { Badge, Button, Card, Pagination, Table } from '../components/ui/index'
import { useVisitors } from '../hooks/useVisitors'
import { useVisitorFilterPresets } from '../hooks/useVisitorFilterPresets'
import { buildVisitorsCsvRows, buildVisitorsSelectionExport, downloadCsvFile, downloadJsonFile } from '../services/visitorsExport'
import VisitorsSelectionToolbar from './visitors/VisitorsSelectionToolbar'
import VisitorFilterPresetsBar from './visitors/VisitorFilterPresetsBar'
import VisitorsActionModals from './visitors/VisitorsActionModals'
import VisitorDetailModal from './visitors/VisitorDetailModal'
const statusBadge = (status) => {
  if (status === 'blocked') return <Badge variant="danger">Blocked</Badge>
  if (status === 'suspicious') return <Badge variant="warning">Suspicious</Badge>
  return <Badge variant="success">Active</Badge>
}
const parsePage = (value) => Math.max(1, Number(value || 1))
export default function VisitorsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const page = parsePage(searchParams.get('page'))
  const search = searchParams.get('search') || ''
  const selectedPresetId = searchParams.get('preset') || '__manual__'
  const [presetName, setPresetName] = useState('')
  const [selected, setSelected] = useState(null)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [blockModal, setBlockModal] = useState(null)
  const [blockReason, setBlockReason] = useState('')
  const [blocking, setBlocking] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const { presets, savePreset, deletePreset } = useVisitorFilterPresets()
  const {
    visitors,
    total,
    loading,
    refresh,
    blockVisitor,
    blockVisitors,
    unblockVisitor,
    deleteVisitor,
    loadVisitor,
    pageSize,
  } = useVisitors({ page, search })
  const selectedPreset = presets.find((preset) => preset.id === selectedPresetId) || null
  const selectedVisitors = useMemo(() => visitors.filter((visitor) => selectedIds.has(visitor.id)), [selectedIds, visitors])
  const selectedBlockableVisitors = useMemo(() => selectedVisitors.filter((visitor) => visitor.status !== 'blocked'), [selectedVisitors])
  const selectedCount = selectedIds.size
  const selectedBlockedCount = selectedVisitors.filter((visitor) => visitor.status === 'blocked').length
  const allVisibleSelected = visitors.length > 0 && visitors.every((visitor) => selectedIds.has(visitor.id))
  const visibleBlockedCount = visitors.filter((visitor) => visitor.status === 'blocked').length
  const visibleActiveCount = visitors.filter((visitor) => visitor.status === 'active').length
  const exportStamp = new Date().toISOString().replace(/[:.]/g, '-')
  useEffect(() => { setSelectedIds(new Set()) }, [page, search])
  const updateQuery = (patch = {}) => {
    const next = new URLSearchParams(searchParams)
    const resetPage = Object.prototype.hasOwnProperty.call(patch, 'search') || Object.prototype.hasOwnProperty.call(patch, 'preset')

    Object.entries(patch).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') next.delete(key)
      else next.set(key, String(value))
    })
    if (resetPage) next.set('page', '1')
    setSearchParams(next, { replace: true })
  }
  const setSearch = (value) => updateQuery({ search: value, preset: '' })
  const setPage = (nextPage) => updateQuery({ page: nextPage })
  const applyPreset = (preset) => updateQuery({ search: preset.filters.search || '', preset: preset.id })
  const clearFilters = () => { setPresetName(''); updateQuery({ search: '', preset: '', page: '1' }) }
  const handleBlock = async () => {
    if (!blockModal) return
    setBlocking(true)
    try {
      if (blockModal.ids.length === 1) {
        await blockVisitor(blockModal.ids[0], blockReason)
      } else {
        await blockVisitors(blockModal.ids, blockReason)
      }
      setBlockModal(null)
      setBlockReason('')
      setSelectedIds(new Set())
    } catch {
      // Keep the modal open state unchanged on failure.
    } finally {
      setBlocking(false)
    }
  }
  const handleUnblock = async (visitor) => { await unblockVisitor(visitor.id) }
  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteVisitor(deleteTarget.id)
      setDeleteTarget(null)
    } catch {
      // Keep the confirmation modal open on failure.
    } finally {
      setDeleting(false)
    }
  }
  const toggleVisitor = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const toggleVisibleVisitors = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allVisibleSelected) {
        visitors.forEach((visitor) => next.delete(visitor.id))
      } else {
        visitors.forEach((visitor) => next.add(visitor.id))
      }
      return next
    })
  }
  const clearSelection = () => setSelectedIds(new Set())
  const handleBulkBlock = () => {
    if (!selectedBlockableVisitors.length) return
    setBlockModal({
      ids: selectedBlockableVisitors.map((visitor) => visitor.id),
      label: `${selectedBlockableVisitors.length} selected visitor${selectedBlockableVisitors.length === 1 ? '' : 's'}`,
      ips: selectedBlockableVisitors.map((visitor) => visitor.ip).filter(Boolean),
    })
    setBlockReason('')
  }
  const handleExportSelection = (format) => {
    if (!selectedVisitors.length) return
    const filename = `visitors-selection-${page}-${exportStamp}.${format === 'json' ? 'json' : 'csv'}`
    const bundle = buildVisitorsSelectionExport(selectedVisitors, { page, search })
    if (format === 'json') {
      downloadJsonFile(filename, bundle)
    } else {
      downloadCsvFile(filename, buildVisitorsCsvRows(selectedVisitors), [
        'id', 'ip', 'country', 'country_flag', 'city', 'isp', 'device_type',
        'browser', 'os', 'page_views', 'status', 'first_seen', 'last_seen', 'user_agent', 'linked_user',
      ])
    }
  }
  const columns = [
    {
      key: 'select',
      label: '',
      width: '56px',
      render: (_, row) => (
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-cyan-500/15 bg-black/30 text-cyan-300 transition hover:border-cyan-500/30 hover:bg-cyan-500/10"
          onClick={(e) => { e.stopPropagation(); toggleVisitor(row.id) }}
          aria-label={selectedIds.has(row.id) ? `Deselect ${row.ip}` : `Select ${row.ip}`}
        >
          {selectedIds.has(row.id) ? <CheckSquare size={16} /> : <Square size={16} />}
        </button>
      ),
    },
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
      key: 'actions',
      label: '',
      width: '140px',
      render: (_, row) => (
        <div className="flex gap-1">
          {row.status !== 'blocked' ? (
            <Button variant="danger" size="sm" icon={Ban} onClick={(e) => { e.stopPropagation(); setBlockModal({ ids: [row.id], label: row.ip, ips: [row.ip] }) }}>
              Block
            </Button>
          ) : (
            <Button variant="secondary" size="sm" onClick={(e) => { e.stopPropagation(); handleUnblock(row) }}>
              Unblock
            </Button>
          )}
          <Button variant="danger" size="sm" icon={Trash2} onClick={(e) => { e.stopPropagation(); setDeleteTarget(row) }} />
        </div>
      ),
    },
  ]

  const openVisitorDetail = async (visitor) => {
    try {
      const exact = await loadVisitor(visitor.id)
      setSelected(exact)
    } catch {
      setSelected(visitor)
    }
  }

  return (
    <DashboardLayout title="Visitors" onRefresh={refresh}>
      <Card>
        <VisitorsSelectionToolbar
          search={search}
          setSearch={setSearch}
          setPage={setPage}
          visitorsCount={visitors.length}
          selectedCount={selectedCount}
          selectedBlockedCount={selectedBlockedCount}
          visibleBlockedCount={visibleBlockedCount}
          visibleActiveCount={visibleActiveCount}
          allVisibleSelected={allVisibleSelected}
          hasVisibleVisitors={visitors.length > 0}
          selectedBlockableCount={selectedBlockableVisitors.length}
          total={total}
          onToggleVisible={toggleVisibleVisitors}
          onClearSelection={clearSelection}
          onBlockSelected={handleBulkBlock}
          onExportCsv={() => handleExportSelection('csv')}
          onExportJson={() => handleExportSelection('json')}
          currentPresetName={selectedPreset ? selectedPreset.name : 'Manual view'}
          savedPresetCount={presets.length}
        />

        <div className="mb-4">
          <VisitorFilterPresetsBar
            search={search}
            presetName={presetName}
            setPresetName={setPresetName}
            presets={presets}
            selectedPresetId={selectedPresetId}
            setSelectedPresetId={(value) => {
              if (value === '__manual__') {
                clearFilters()
                return
              }
              const preset = presets.find((item) => item.id === value)
              if (preset) applyPreset(preset)
            }}
            onSavePreset={(name, filters) => {
              const created = savePreset(name, filters)
              if (created) {
                setPresetName('')
                updateQuery({ preset: created.id, search: created.filters.search || '' })
              }
            }}
            onApplyPreset={applyPreset}
            onDeletePreset={(presetId) => {
              deletePreset(presetId)
              if (selectedPresetId === presetId) clearFilters()
            }}
            onClear={clearFilters}
          />
        </div>

        <Table
          columns={columns}
          data={visitors}
          loading={loading}
          emptyMessage="No visitors found"
          onRowClick={openVisitorDetail}
        />
        <Pagination page={page} total={total} pageSize={pageSize} onChange={setPage} />
      </Card>

      <VisitorsActionModals
        blockModal={blockModal}
        blockReason={blockReason}
        setBlockReason={setBlockReason}
        onCloseBlock={() => setBlockModal(null)}
        onConfirmBlock={handleBlock}
        blocking={blocking}
        deleteTarget={deleteTarget}
        onCloseDelete={() => setDeleteTarget(null)}
        onConfirmDelete={handleDelete}
        deleting={deleting}
      />

      <VisitorDetailModal visitor={selected} onClose={() => setSelected(null)} />
    </DashboardLayout>
  )
}
