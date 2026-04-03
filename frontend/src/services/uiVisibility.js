export const DEFAULT_UI_VISIBILITY = {
  settings: {
    feature_status_summary: true,
    feature_status_details: true,
  },
  overview: {
    realtime_banner: true,
    stat_cards: true,
    traffic_heatmap: true,
    threat_hotspots: true,
    enforcement_pressure: true,
    gateway_operations: true,
    risk_leaderboard: true,
    priority_investigations: true,
  },
  navigation: {
    overview: true,
    visitors: true,
    users: true,
    devices: true,
    blocking: true,
    'anti-evasion': true,
    audit: true,
    integration: true,
    settings: true,
  },
}

export function mergeUiVisibility(rawVisibility = {}) {
  return {
    settings: {
      ...DEFAULT_UI_VISIBILITY.settings,
      ...(rawVisibility?.settings || {}),
    },
    overview: {
      ...DEFAULT_UI_VISIBILITY.overview,
      ...(rawVisibility?.overview || {}),
    },
    navigation: {
      ...DEFAULT_UI_VISIBILITY.navigation,
      ...(rawVisibility?.navigation || {}),
    },
  }
}

export function isUiVisible(uiVisibility, path, fallback = true) {
  if (!path) return fallback
  const resolved = path.split('.').reduce((value, segment) => {
    if (value && typeof value === 'object') return value[segment]
    return undefined
  }, uiVisibility)
  return typeof resolved === 'boolean' ? resolved : fallback
}
