import { riskApi } from './api'

const DEFAULT_PAGE_SIZE = 100

const csvEscape = (value) => {
  const text = value === null || value === undefined ? '' : String(value)
  return `"${text.replaceAll('"', '""').replaceAll(/\r?\n/g, ' ')}"`
}

export function rowsToCsv(rows, columns) {
  const headers = columns?.length ? columns : Object.keys(rows[0] ?? {})
  const lines = [headers.map(csvEscape).join(',')]
  rows.forEach((row) => {
    lines.push(headers.map((header) => csvEscape(row?.[header])).join(','))
  })
  return lines.join('\n')
}

export function downloadTextFile(filename, content, mimeType = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function downloadJsonFile(filename, data) {
  downloadTextFile(filename, JSON.stringify(data, null, 2), 'application/json;charset=utf-8')
}

export function downloadCsvFile(filename, rows, columns) {
  downloadTextFile(filename, rowsToCsv(rows, columns), 'text/csv;charset=utf-8')
}

export async function fetchAllPortalUsers(filters) {
  const users = []
  let page = 1
  let total = 0

  while (true) {
    const res = await riskApi.listUsers({
      page,
      page_size: DEFAULT_PAGE_SIZE,
      search: filters.search || '',
      min_score: Number(filters.minScore) || 0,
      trust_level: filters.trustLevel || '',
      has_flags: !!filters.hasFlags,
    })
    const items = res.data?.items ?? []
    users.push(...items)
    total = res.data?.total ?? users.length
    if (users.length >= total || items.length === 0) break
    page += 1
  }

  return users.map((user) => ({ ...user, id: user.external_user_id }))
}

export function buildPortalUsersJsonExport(users, filters) {
  return {
    exported_at: new Date().toISOString(),
    filters,
    total: users.length,
    users,
  }
}

export function buildPortalUsersCsvRows(users) {
  return users.map((user) => ({
    external_user_id: user.external_user_id,
    display_name: user.display_name || '',
    email: user.email || '',
    current_risk_score: user.current_risk_score,
    trust_level: user.trust_level,
    total_devices: user.total_devices ?? 0,
    total_sessions: user.total_sessions ?? 0,
    open_flags_count: user.open_flags_count ?? 0,
    last_seen: user.last_seen || '',
    last_country: user.last_country || '',
    enhanced_audit: !!user.enhanced_audit,
  }))
}

export function buildPortalUserDetailBundle({ profile, devices, riskHistory, activity, flags, activityFilters }) {
  return {
    exported_at: new Date().toISOString(),
    profile,
    devices,
    risk_history: riskHistory,
    activity,
    flags,
    activity_filters: activityFilters,
  }
}

export function buildPortalUserDetailCsvRows(bundle) {
  const rows = []
  const profile = bundle.profile || {}
  const pushRow = (section, field, value, notes = '') => {
    rows.push({
      section,
      field,
      value: value === null || value === undefined ? '' : value,
      notes,
    })
  }

  pushRow('profile', 'external_user_id', profile.external_user_id)
  pushRow('profile', 'display_name', profile.display_name)
  pushRow('profile', 'email', profile.email)
  pushRow('profile', 'current_risk_score', profile.current_risk_score)
  pushRow('profile', 'trust_level', profile.trust_level)
  pushRow('profile', 'total_devices', profile.total_devices)
  pushRow('profile', 'total_sessions', profile.total_sessions)
  pushRow('profile', 'first_seen', profile.first_seen)
  pushRow('profile', 'last_seen', profile.last_seen)
  pushRow('profile', 'last_ip', profile.last_ip)
  pushRow('profile', 'last_country', profile.last_country)
  pushRow('profile', 'enhanced_audit', profile.enhanced_audit)

  ;(bundle.devices || []).forEach((device) => {
    pushRow('device', device.id || device.fingerprint_id, device.platform, `IP: ${device.ip || '—'} | Linked: ${device.linked_at || '—'} | Last seen: ${device.last_seen_at || '—'}`)
  })

  ;(bundle.risk_history || []).forEach((entry) => {
    pushRow('risk_history', entry.id, entry.score, `Delta: ${entry.delta ?? 0} | Trigger: ${entry.trigger_type || '—'} | At: ${entry.created_at || '—'}`)
  })

  ;(bundle.activity || []).forEach((event) => {
    pushRow('activity', event.id, event.event_type, `Platform: ${event.platform || '—'} | IP: ${event.ip || '—'} | Country: ${event.country || '—'} | At: ${event.created_at || '—'}`)
  })

  ;(bundle.flags || []).forEach((flag) => {
    pushRow('flag', flag.id, flag.flag_type, `Severity: ${flag.severity || '—'} | Status: ${flag.status || '—'} | Detected: ${flag.detected_at || '—'}`)
  })

  return rows
}
