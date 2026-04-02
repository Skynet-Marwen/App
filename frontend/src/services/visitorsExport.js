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

export function buildVisitorsSelectionExport(visitors, { page, search }) {
  return {
    exported_at: new Date().toISOString(),
    page,
    search,
    total: visitors.length,
    visitors,
  }
}

export function buildVisitorsCsvRows(visitors) {
  return visitors.map((visitor) => ({
    id: visitor.id,
    ip: visitor.ip || '',
    country: visitor.country || '',
    country_flag: visitor.country_flag || '',
    city: visitor.city || '',
    isp: visitor.isp || '',
    device_type: visitor.device_type || '',
    browser: visitor.browser || '',
    os: visitor.os || '',
    page_views: visitor.page_views ?? 0,
    status: visitor.status || '',
    first_seen: visitor.first_seen || '',
    last_seen: visitor.last_seen || '',
    user_agent: visitor.user_agent || '',
    linked_user: visitor.linked_user || '',
  }))
}
