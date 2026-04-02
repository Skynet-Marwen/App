import { CheckSquare, Download, Search, Square, Ban } from 'lucide-react'
import { Badge, Button, PageToolbar } from '../../components/ui'

export default function VisitorsSelectionToolbar({
  search,
  setSearch,
  setPage,
  visitorsCount,
  selectedCount,
  selectedBlockedCount,
  visibleBlockedCount,
  visibleActiveCount,
  allVisibleSelected,
  hasVisibleVisitors,
  selectedBlockableCount,
  total,
  onToggleVisible,
  onClearSelection,
  onBlockSelected,
  onExportCsv,
  onExportJson,
  currentPresetName = 'Manual view',
  savedPresetCount = 0,
}) {
  return (
    <PageToolbar>
      <div className="space-y-3 w-full">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="relative w-full xl:max-w-[36rem]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              placeholder="Search by IP, country, user agent..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 xl:ml-auto">
            <Button variant="secondary" size="sm" icon={allVisibleSelected ? CheckSquare : Square} onClick={onToggleVisible} disabled={!hasVisibleVisitors}>
              {allVisibleSelected ? 'Clear visible' : 'Select visible'}
            </Button>
            <Button variant="secondary" size="sm" onClick={onClearSelection} disabled={!selectedCount}>
              Clear selection
            </Button>
            <Button variant="danger" size="sm" icon={Ban} disabled={!selectedBlockableCount} onClick={onBlockSelected}>
              Block selected
            </Button>
            <Button variant="secondary" size="sm" icon={Download} disabled={!selectedCount} onClick={onExportCsv}>
              Export CSV
            </Button>
            <Button variant="secondary" size="sm" icon={Download} disabled={!selectedCount} onClick={onExportJson}>
              Export JSON
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <SelectionStat label="Visible" value={visitorsCount} tone="text-cyan-300" />
          <SelectionStat label="Selected" value={selectedCount} tone="text-white" />
          <SelectionStat label="Blocked" value={visibleBlockedCount} tone="text-red-300" />
          <SelectionStat label="Active" value={visibleActiveCount} tone="text-green-300" />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 xl:justify-end">
        <span className="text-sm text-gray-500">{total.toLocaleString()} total visitors</span>
        <Badge variant={currentPresetName === 'Manual view' ? 'default' : 'success'}>
          {currentPresetName}
        </Badge>
        <Badge variant="purple">{savedPresetCount} saved</Badge>
        {selectedCount > 0 && (
          <Badge variant={selectedBlockedCount ? 'warning' : 'info'}>
            {selectedCount} selected
          </Badge>
        )}
      </div>
    </PageToolbar>
  )
}

function SelectionStat({ label, value, tone }) {
  return (
    <div className="rounded-xl border border-cyan-500/10 bg-black/20 px-3 py-2">
      <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-gray-500">{label}</p>
      <p className={`mt-1 text-sm font-semibold font-mono ${tone}`}>{value}</p>
    </div>
  )
}
