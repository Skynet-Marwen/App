export const THEME_WIDGET_OPTIONS = [
  { id: 'realtime-banner', label: 'Realtime Banner', description: 'Live active-now strip with socket status.' },
  { id: 'stat-cards', label: 'Stat Cards', description: 'Top-line traffic, users, devices, and enforcement counters.' },
  { id: 'traffic-heatmap', label: 'Traffic Heatmap', description: 'Traffic intensity panel for the selected range.' },
  { id: 'threat-hotspots', label: 'Threat Hotspots', description: 'Country and reason pressure overview.' },
  { id: 'enforcement-pressure', label: 'Enforcement Pressure', description: 'Allow, challenge, block, and rate-limit mix.' },
  { id: 'gateway-operations', label: 'Gateway Operations', description: 'Proxy decision rates and latency summary.' },
  { id: 'risk-leaderboard', label: 'Risk Leaderboard', description: 'Highest-risk identities and trust posture.' },
  { id: 'priority-investigations', label: 'Priority Investigations', description: 'Open incidents that need operator follow-up.' },
]

export function normalizeWidgetArray(widgets) {
  return Array.isArray(widgets)
    ? widgets.map((widget) => String(widget).trim()).filter(Boolean)
    : []
}
