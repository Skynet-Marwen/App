/**
 * Decision Engine — Portal User Intelligence
 * Pure functions — no side effects, no React imports.
 * Input: entity = { profile, devices, visitors, flags, riskHistory }
 */

export const LEVEL_CONFIG = {
  critical: { label: 'Critical', color: 'text-red-400',    border: 'border-red-500/30',    bg: 'bg-red-500/8',    bar: 'bg-red-500' },
  high:     { label: 'High',     color: 'text-orange-400', border: 'border-orange-500/30', bg: 'bg-orange-500/8', bar: 'bg-orange-500' },
  medium:   { label: 'Medium',   color: 'text-yellow-400', border: 'border-yellow-500/30', bg: 'bg-yellow-500/8', bar: 'bg-yellow-500' },
  low:      { label: 'Low',      color: 'text-green-400',  border: 'border-green-500/30',  bg: 'bg-green-500/8',  bar: 'bg-green-500' },
}

export function levelKey(score) {
  if (score >= 80) return 'critical'
  if (score >= 55) return 'high'
  if (score >= 30) return 'medium'
  return 'low'
}

// ─── Trend ───────────────────────────────────────────────────────────────────

export function computeTrendInfo(riskHistory) {
  const events = [...(riskHistory || [])]
  if (events.length < 2) {
    return { trend: 'stable', label: '→ Stable', color: 'text-gray-400', spikeDetected: false, latestSpikeTimestamp: null, volatility: 'low', eventCount: events.length }
  }
  const deltas = events.slice(0, 5).map((e) => Number(e.delta || 0))
  const avg = deltas.reduce((a, b) => a + b, 0) / deltas.length
  const spike = events.find((e) => Number(e.delta || 0) > 0.20)
  const maxAbs = Math.max(...deltas.map(Math.abs))
  const volatility = maxAbs > 0.25 ? 'high' : maxAbs > 0.10 ? 'medium' : 'low'

  let trend, label, color
  if (spike)           { trend = 'spike';   label = '⚡ Spike';   color = 'text-red-400' }
  else if (avg > 0.04) { trend = 'rising';  label = '↑ Rising';  color = 'text-orange-400' }
  else if (avg < -0.04){ trend = 'falling'; label = '↓ Falling'; color = 'text-green-400' }
  else                 { trend = 'stable';  label = '→ Stable';  color = 'text-gray-400' }

  return { trend, label, color, spikeDetected: !!spike, latestSpikeTimestamp: spike?.createdAt ?? null, volatility, eventCount: events.length }
}

// ─── Signals ─────────────────────────────────────────────────────────────────

const SIGNAL_META = {
  adblocker_detected:   { impact: 'medium', category: 'Privacy',    label: 'Adblock / browser blocker' },
  dns_filter_suspected: { impact: 'medium', category: 'Network',    label: 'DNS filtering suspected' },
  isp_unresolved:       { impact: 'low',    category: 'Network',    label: 'ISP resolution failure' },
  vpn_detected:         { impact: 'high',   category: 'Network',    label: 'VPN / anonymization' },
  tor_exit:             { impact: 'high',   category: 'Network',    label: 'Tor exit node' },
  headless_browser:     { impact: 'high',   category: 'Automation', label: 'Headless browser' },
  automation:           { impact: 'high',   category: 'Automation', label: 'Automation tool' },
  behavior_drift:       { impact: 'high',   category: 'Behavior',   label: 'Behavioral inconsistency' },
  risk_spike:           { impact: 'high',   category: 'Anomaly',    label: 'Risk spike event' },
}

export function aggregateSignalsForDecision(profile, devices, visitors) {
  const sources = [
    profile?.tracking_signals,
    ...(devices || []).map((d) => d.tracking_signals),
    ...(visitors || []).map((v) => v.tracking_signals),
  ].filter(Boolean)

  const result = []
  for (const field of ['adblocker_detected', 'dns_filter_suspected', 'isp_unresolved']) {
    const count = sources.filter((s) => s[field]).length
    if (count > 0) {
      const m = SIGNAL_META[field]
      result.push({ key: field, label: m.label, count, impact: m.impact, category: m.category })
    }
  }
  const byType = new Map()
  for (const sig of sources.flatMap((s) => s.signals || [])) {
    const key = sig.type || sig.label
    if (!byType.has(key)) byType.set(key, { ...sig, count: 1 })
    else byType.get(key).count += 1
  }
  for (const [key, sig] of byType) {
    const m = SIGNAL_META[key] || { impact: 'low', category: 'Behavior', label: sig.label || sig.type }
    result.push({ key, label: m.label, count: sig.count, impact: m.impact, category: m.category })
  }
  const order = { high: 0, medium: 1, low: 2 }
  return result.sort((a, b) => (order[a.impact] ?? 2) - (order[b.impact] ?? 2))
}

// ─── Devices ─────────────────────────────────────────────────────────────────

export function rankLinkedDevices(devices) {
  if (!devices?.length) return []
  const highestRiskId = [...devices].sort((a, b) => (Number(b.risk_score) || 0) - (Number(a.risk_score) || 0))[0]?.id
  const mostRecentId  = [...devices].sort((a, b) => new Date(b.last_seen_at || b.last_seen || 0) - new Date(a.last_seen_at || a.last_seen || 0))[0]?.id
  const mostActiveId  = [...devices].sort((a, b) => (b.visitor_count || 0) - (a.visitor_count || 0))[0]?.id

  return devices.map((d, i) => {
    const roles = []
    if (i === 0)                              roles.push('primary')
    if (d.id === highestRiskId && devices.length > 1) roles.push('highest-risk')
    if (d.id === mostRecentId)                roles.push('most-recent')
    if (d.id === mostActiveId && devices.length > 1)  roles.push('most-active')
    return { ...d, roles }
  })
}

// ─── Confidence ──────────────────────────────────────────────────────────────

export function computeConfidenceLevel({ profile, devices, visitors, flags, riskHistory }) {
  let s = 0
  const dc = (devices || []).length
  if (dc >= 2) s += 2; else if (dc === 1) s += 1
  const hc = (riskHistory || []).length
  if (hc >= 5) s += 2; else if (hc >= 2) s += 1
  const openF = (flags || []).filter((f) => f.status === 'open').length
  if (openF >= 2) s += 2; else if (openF === 1) s += 1
  if ((visitors || []).length >= 5) s += 1
  const sigs = aggregateSignalsForDecision(profile, devices, visitors)
  if (sigs.some((x) => x.impact === 'high')) s += 2; else if (sigs.length > 0) s += 1
  if ((Number(profile?.fingerprint_confidence) || 0) > 0.7) s += 1
  if ((Number(profile?.stability_score) || 0) > 0.7) s += 1

  if (s >= 8) return { key: 'high',   label: 'High — multiple corroborating signals' }
  if (s >= 4) return { key: 'medium', label: 'Medium — partial signal coverage' }
  return { key: 'low', label: 'Low — insufficient data for reliable assessment' }
}

// ─── Recommended Action ──────────────────────────────────────────────────────

export function generateRecommendedAction(score, confidence, trend, openFlagCount, signals) {
  const highSigs = signals.filter((s) => s.impact === 'high').length
  if (score >= 80 && confidence.key !== 'low')
    return { action: 'block',       label: 'Block Recommended',  color: 'text-red-400',    bg: 'bg-red-500/12 border-red-500/30' }
  if (score >= 65 && openFlagCount >= 2)
    return { action: 'flag',        label: 'Flag for Review',    color: 'text-orange-400', bg: 'bg-orange-500/12 border-orange-500/30' }
  if (score >= 55 || (trend.trend === 'rising' && score >= 40) || (highSigs >= 2 && confidence.key === 'high'))
    return { action: 'investigate', label: 'Investigate Further',color: 'text-yellow-400', bg: 'bg-yellow-500/12 border-yellow-500/30' }
  if (score >= 30 || confidence.key === 'low')
    return { action: 'monitor',     label: 'Monitor Only',       color: 'text-cyan-400',   bg: 'bg-cyan-500/12 border-cyan-500/30' }
  return   { action: 'allow',       label: 'No Action Needed',   color: 'text-green-400',  bg: 'bg-green-500/12 border-green-500/30' }
}

// ─── Decision Summary ────────────────────────────────────────────────────────

function buildReasons(flagTypes, deviceCount, openFlagCount, signals) {
  const reasons = []
  if (flagTypes.has('automation') || flagTypes.has('headless_browser'))
    reasons.push('Automated or headless browser behavior detected')
  if (flagTypes.has('impossible_travel') || flagTypes.has('geo_jump'))
    reasons.push('Impossible geographic travel detected between sessions')
  if (flagTypes.has('tor_vpn') || flagTypes.has('vpn_detected') || flagTypes.has('vpn'))
    reasons.push('VPN, proxy, or anonymization network in use')
  if (flagTypes.has('multi_account'))    reasons.push('Activity consistent with multiple account usage')
  if (flagTypes.has('behavior_drift'))   reasons.push('Behavioral inconsistency detected across sessions')
  if (deviceCount > 2)                   reasons.push(`${deviceCount} distinct devices linked to this identity`)
  if (openFlagCount > 2)                 reasons.push(`${openFlagCount} unresolved anomaly flags pending review`)
  if (signals.some((s) => ['adblocker_detected', 'dns_filter_suspected'].includes(s.key)) && reasons.length < 5)
    reasons.push('Privacy tools active across multiple sessions')
  return reasons.slice(0, 5)
}

function buildObservations(profile, flagTypes, visitors, trend) {
  const obs = []
  if (profile?.enhanced_audit)       obs.push('Profile is under enhanced monitoring')
  if (flagTypes.has('risk_spike'))   obs.push('Recent rapid risk score increase detected')
  if (trend.trend === 'falling')     obs.push('Risk trend is currently declining — monitor for reversal')
  if (trend.spikeDetected)           obs.push(`Risk spike detected${trend.latestSpikeTimestamp ? ` on ${new Date(trend.latestSpikeTimestamp).toLocaleDateString()}` : ''}`)
  if ((visitors || []).length > 10)  obs.push(`${visitors.length} visitor sessions correlated to this identity`)
  return obs
}

export function generateDecisionSummary(entity) {
  const { profile, devices, visitors, flags, riskHistory } = entity
  const score = Math.round((Number(profile?.current_risk_score) || 0) * 100)
  const lk = levelKey(score)
  const openFlags = (flags || []).filter((f) => f.status === 'open')
  const flagTypes = new Set(openFlags.map((f) => f.flag_type))
  const signals = aggregateSignalsForDecision(profile, devices, visitors)
  const trend = computeTrendInfo(riskHistory)
  const confidence = computeConfidenceLevel({ profile, devices, visitors, flags, riskHistory })
  const recommendedAction = generateRecommendedAction(score, confidence, trend, openFlags.length, signals)
  return {
    level: lk, status: profile?.trust_level || 'unknown', confidence, trend, recommendedAction,
    primaryReasons: buildReasons(flagTypes, (devices || []).length, openFlags.length, signals),
    supportingObservations: buildObservations(profile, flagTypes, visitors, trend),
    openFlagCount: openFlags.length, hasActionableFlags: openFlags.length > 0, signals,
  }
}

// ─── Risk Narrative (public API — backward compat) ───────────────────────────

export function generateRiskNarrative(entity) {
  const dec = generateDecisionSummary(entity)
  const score = Math.round((Number(entity.profile?.current_risk_score) || 0) * 100)
  return {
    ...LEVEL_CONFIG[dec.level],
    score, levelKey: dec.level,
    reasons: dec.primaryReasons,
    observations: dec.supportingObservations,
    confidence: dec.confidence,
    trend: dec.trend,
    recommendedAction: dec.recommendedAction,
    openFlagCount: dec.openFlagCount,
    hasActionableFlags: dec.hasActionableFlags,
    signals: dec.signals,
    rankedDevices: rankLinkedDevices(entity.devices),
  }
}
