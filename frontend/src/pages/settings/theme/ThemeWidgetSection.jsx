import { Toggle } from '../../../components/ui'

import { THEME_WIDGET_OPTIONS, normalizeWidgetArray } from './themeCatalog'


export default function ThemeWidgetSection({ widgets, onWidgetsChange }) {
  const selected = normalizeWidgetArray(widgets)
  const usePlatformDefaults = selected.length === 0

  const handleToggle = (widgetId, enabled) => {
    const next = new Set(usePlatformDefaults ? THEME_WIDGET_OPTIONS.map((widget) => widget.id) : selected)
    if (enabled) next.add(widgetId)
    else next.delete(widgetId)
    onWidgetsChange([...next])
  }

  return (
    <div className="space-y-4 rounded-xl border border-cyan-500/10 p-4">
      <div>
        <p className="text-sm font-medium text-white">Dashboard Widgets</p>
        <p className="text-xs text-gray-500 font-mono mt-1">Leave the list empty to inherit the platform default dashboard. Turn defaults off to curate a specific widget stack.</p>
      </div>

      <div className="divide-y divide-cyan-500/10 rounded-xl border border-cyan-500/10 px-4 py-1">
        <Toggle
          label="Use platform default widget set"
          description="When enabled, the theme does not hide any overview widgets and inherits new defaults as the product grows."
          checked={usePlatformDefaults}
          onChange={(value) => onWidgetsChange(value ? [] : THEME_WIDGET_OPTIONS.map((widget) => widget.id))}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {THEME_WIDGET_OPTIONS.map((widget) => (
          <div key={widget.id} className="rounded-xl border border-cyan-500/10 bg-black/20 p-3">
            <Toggle
              label={widget.label}
              description={widget.description}
              checked={usePlatformDefaults ? true : selected.includes(widget.id)}
              onChange={(value) => handleToggle(widget.id, value)}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
