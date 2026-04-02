import { BookmarkPlus, Trash2, RotateCcw } from 'lucide-react'
import { Badge, Button, Input, Select } from '../../components/ui'

export default function VisitorFilterPresetsBar({
  search,
  presetName,
  setPresetName,
  presets,
  selectedPresetId,
  setSelectedPresetId,
  onSavePreset,
  onApplyPreset,
  onDeletePreset,
  onClear,
}) {
  const selectedPreset = presets.find((preset) => preset.id === selectedPresetId) || null

  return (
    <div className="space-y-3 rounded-xl border border-cyan-500/10 bg-black/25 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-mono uppercase tracking-[0.18em] text-cyan-400">Saved Views</p>
          <p className="mt-1 text-xs text-gray-500">
            Store the current Visitors search as a quick operator view. Search presets also power Overview drill-downs.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="info">{presets.length} presets</Badge>
          <Badge variant={selectedPreset ? 'success' : 'default'}>
            {selectedPreset ? selectedPreset.name : 'Manual view'}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(220px,0.55fr)]">
        <Input
          label="Preset name"
          value={presetName}
          onChange={(event) => setPresetName(event.target.value)}
          placeholder="Blocked countries"
        />

        <Select
          label="Apply preset"
          value={selectedPresetId}
          onChange={(event) => {
            const value = event.target.value
            setSelectedPresetId(value)
            if (value === '__manual__') {
              onClear()
              return
            }
            const preset = presets.find((item) => item.id === value)
            if (preset) onApplyPreset(preset)
          }}
          options={[
            { value: '__manual__', label: 'Manual search' },
            ...presets.map((preset) => ({ value: preset.id, label: preset.name })),
          ]}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="neon"
          size="sm"
          icon={BookmarkPlus}
          onClick={() => onSavePreset(presetName, { search })}
          disabled={!String(presetName || '').trim()}
        >
          Save Current Search
        </Button>
        <Button variant="secondary" size="sm" icon={RotateCcw} onClick={onClear}>
          Clear Search
        </Button>
        {selectedPreset && (
          <Button variant="danger" size="sm" icon={Trash2} onClick={() => onDeletePreset(selectedPreset.id)}>
            Delete Preset
          </Button>
        )}
      </div>
    </div>
  )
}
