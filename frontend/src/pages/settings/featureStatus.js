export function summarizeFeatureStatus(sections) {
  const counts = { live: 0, partial: 0, planned: 0, total: 0 }

  sections.forEach((section) => {
    section.capabilities.forEach((capability) => {
      counts.total += 1
      counts[capability.status] = (counts[capability.status] || 0) + 1
    })
  })

  const completion = counts.total
    ? Math.round(((counts.live + counts.partial * 0.5) / counts.total) * 100)
    : 0

  return { ...counts, completion }
}
