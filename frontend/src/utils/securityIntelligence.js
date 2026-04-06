/**
 * Security Intelligence Engine — Overview dashboard
 * Pure functions. Input: overview object from statsApi.overview()
 */

// ─── Trend ────────────────────────────────────────────────────────────────────

export function computeGlobalTrend(data) {
  const blockedChange = Number(data?.blocked_change) || 0
  const hotspots = data?.threat_hotspots ?? []
  const maxDelta = Math.max(...hotspots.map((h) => Number(h.delta) || 0), 0)
  const spikeDetected = blockedChange > 50 || maxDelta > 50

  if (spikeDetected)           return { trend: 'spike',   label: '⚡ Spike',   color: 'text-red-400',    spikeDetected: true }
  if (blockedChange > 10 || maxDelta > 25) return { trend: 'rising',  label: '↑ Rising',  color: 'text-orange-400', spikeDetected: false }
  if (blockedChange < -10)     return { trend: 'falling', label: '↓ Falling', color: 'text-green-400',  spikeDetected: false }
  return                              { trend: 'stable',  label: '→ Stable',  color: 'text-gray-400',   spikeDetected: false }
}

// ─── AI Insights ──────────────────────────────────────────────────────────────

export function generateAIInsights(data) {
  const leaders       = data?.risk_leaderboard ?? []
  const investigations = data?.priority_investigations ?? []
  const hotspots      = data?.threat_hotspots ?? []
  const blockedChange = Number(data?.blocked_change) || 0
  const evasion       = Number(data?.evasion_attempts) || 0
  const spam          = Number(data?.spam_detected) || 0

  const criticalLeaders = leaders.filter((l) => Number(l.current_risk_score) >= 0.8)
  const openInv = investigations.filter((i) => i.status !== 'resolved')
  const insights = []

  if (Math.abs(blockedChange) > 20) {
    insights.push(blockedChange > 0
      ? `Blocking rate surged ${blockedChange}% — enforcement pressure is unusually high this period.`
      : `Blocking rate dropped ${Math.abs(blockedChange)}% — threat pressure may be easing.`,
    )
  }

  if (criticalLeaders.length > 0) {
    const names = criticalLeaders.slice(0, 2).map((l) => l.display_name || l.email || 'unknown').join(', ')
    insights.push(`${criticalLeaders.length} ${criticalLeaders.length === 1 ? 'identity' : 'identities'} at critical risk (${names}) — immediate review required.`)
  }

  if (evasion > 0) {
    insights.push(`${evasion} evasion attempt${evasion > 1 ? 's' : ''} detected — possible bypass technique active.`)
  }

  const topHot = hotspots[0]
  if (topHot && Number(topHot.percent) > 50) {
    insights.push(`Over ${topHot.percent}% of threat traffic originates from ${topHot.country} — geographic concentration risk.`)
  }

  const risingHot = [...hotspots].sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0))[0]
  if (risingHot && Number(risingHot.delta) > 30 && risingHot !== topHot) {
    insights.push(`Threat activity from ${risingHot.country} rising ${risingHot.delta}% — emerging source, monitor closely.`)
  }

  if (openInv.length >= 3) {
    const escalating = openInv.filter((i) => i.state_tags?.includes('escalating')).length
    insights.push(`${openInv.length} open incidents in queue${escalating > 0 ? ` — ${escalating} escalating` : ''}.`)
  }

  if (spam > 100 && insights.length < 5) {
    insights.push(`${spam} spam detections recorded — possible automated form abuse or credential stuffing.`)
  }

  const multiDev = leaders.find((l) => Number(l.total_devices) > 3)
  if (multiDev && insights.length < 5) {
    const name = multiDev.display_name || multiDev.email || 'an identity'
    insights.push(`"${name}" linked to ${multiDev.total_devices} devices — potential multi-account pattern detected.`)
  }

  return insights.slice(0, 5)
}

// ─── Entity Ranking ───────────────────────────────────────────────────────────

export function rankEntitiesForInvestigation(data) {
  const leaders       = data?.risk_leaderboard ?? []
  const investigations = data?.priority_investigations ?? []
  const result = []

  for (const inv of investigations.filter((i) => i.status !== 'resolved')) {
    const isCrit     = inv.severity === 'critical'
    const isEscalate = inv.state_tags?.includes('escalating')
    const priority   = isCrit || isEscalate ? 'high' : inv.severity === 'high' ? 'high' : 'medium'
    const action     = isCrit || isEscalate ? 'block' : 'investigate'
    result.push({
      id: inv.id, type: 'incident', name: inv.title, subtype: inv.target_type,
      severity: inv.severity, priority, action,
      reason: `${inv.repeat_count > 1 ? `Seen ${inv.repeat_count}× — ` : ''}${inv.target_type}: ${inv.target_label}`,
      score: isCrit ? 100 : inv.severity === 'high' ? 80 : 50,
    })
  }

  for (const l of leaders) {
    const risk  = Number(l.current_risk_score) || 0
    const flags = Number(l.open_flags_count) || 0
    const priority = risk >= 0.8 ? 'high' : risk >= 0.55 ? 'medium' : 'low'
    const action   = risk >= 0.8 && flags > 0 ? 'investigate' : risk >= 0.55 ? 'investigate' : 'monitor'
    const name = l.display_name || l.email || l.external_user_id?.slice(0, 12) + '…'
    result.push({
      id: l.external_user_id, type: 'user', name,
      severity: risk >= 0.8 ? 'critical' : risk >= 0.55 ? 'high' : 'medium',
      priority, action,
      reason: [risk >= 0.8 ? `${Math.round(risk * 100)}% risk` : null, flags > 0 ? `${flags} flags` : null, l.top_flag ? l.top_flag.replace(/_/g, ' ') : null].filter(Boolean).join(' · '),
      score: Math.round(risk * 100),
    })
  }

  const ord = { high: 0, medium: 1, low: 2 }
  return result.sort((a, b) => (ord[a.priority] ?? 2) - (ord[b.priority] ?? 2) || b.score - a.score).slice(0, 10)
}

// ─── Recommended Actions ──────────────────────────────────────────────────────

export function generateRecommendedActions(level, data) {
  const leaders     = data?.risk_leaderboard ?? []
  const investigations = data?.priority_investigations ?? []
  const hotspots    = data?.threat_hotspots ?? []
  const openInv     = investigations.filter((i) => i.status !== 'resolved')
  const criticals   = leaders.filter((l) => Number(l.current_risk_score) >= 0.8)
  const risingHot   = [...hotspots].sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0))[0]
  const topLeader   = criticals[0]
  const topInv      = openInv[0]
  const actions     = []

  if (level === 'critical' || level === 'high') {
    if (topLeader) actions.push(`Review: ${topLeader.display_name || topLeader.email || 'top critical identity'}`)
    if (topInv)    actions.push(`Escalate: ${topInv.title}`)
    if (risingHot?.delta > 20) actions.push(`Monitor source: ${risingHot.country} (${risingHot.delta > 0 ? '+' : ''}${risingHot.delta}%)`)
  } else if (level === 'medium') {
    if (openInv.length) actions.push(`Review ${openInv.length} open incident${openInv.length > 1 ? 's' : ''}`)
    if (risingHot)      actions.push(`Watch ${risingHot.country} (${risingHot.delta > 0 ? '+' : ''}${risingHot.delta ?? 0}% change)`)
    actions.push('Check enforcement pressure metrics')
  } else {
    actions.push('System stable — maintain current posture')
    actions.push('Review period metrics for baseline drift')
  }

  return actions.slice(0, 3)
}

// ─── Global State ─────────────────────────────────────────────────────────────

export function generateGlobalSecurityState(data) {
  if (!data) return null
  const leaders    = data.risk_leaderboard ?? []
  const invs       = data.priority_investigations ?? []
  const blockedCh  = Number(data.blocked_change) || 0
  const evasion    = Number(data.evasion_attempts) || 0
  const criticals  = leaders.filter((l) => Number(l.current_risk_score) >= 0.8)
  const openInv    = invs.filter((i) => i.status !== 'resolved')
  const critInv    = openInv.filter((i) => i.severity === 'critical')

  let globalRiskLevel
  if (criticals.length >= 3 || critInv.length >= 2 || (blockedCh > 50 && evasion > 20)) globalRiskLevel = 'critical'
  else if (criticals.length >= 1 || critInv.length >= 1 || openInv.length >= 3 || blockedCh > 25) globalRiskLevel = 'high'
  else if (leaders.some((l) => Number(l.current_risk_score) >= 0.55) || openInv.length >= 1 || blockedCh > 10) globalRiskLevel = 'medium'
  else globalRiskLevel = 'low'

  const visitors = Number(data.total_visitors) || 0
  const confidence = visitors > 100 && leaders.length > 0 ? 'high' : visitors > 10 || leaders.length > 0 ? 'medium' : 'low'

  return {
    globalRiskLevel,
    activeThreats: openInv.length,
    criticalEntities: criticals.length,
    trend: computeGlobalTrend(data),
    keyInsights: generateAIInsights(data),
    priorityActions: generateRecommendedActions(globalRiskLevel, data),
    confidence,
    rankedEntities: rankEntitiesForInvestigation(data),
  }
}
