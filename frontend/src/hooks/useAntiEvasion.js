import { useCallback, useEffect, useState } from 'react'
import { antiEvasionApi } from '../services/api'

const DEFAULT_CONFIG = {
  vpn_detection: true,
  tor_detection: true,
  proxy_detection: true,
  datacenter_detection: true,
  headless_browser_detection: true,
  bot_detection: true,
  crawler_signature_detection: true,
  click_farm_detection: true,
  canvas_fingerprint: true,
  webgl_fingerprint: true,
  font_fingerprint: true,
  audio_fingerprint: true,
  timezone_mismatch: true,
  language_mismatch: true,
  cookie_evasion: true,
  ip_rotation_detection: true,
  challenge_enabled: true,
  challenge_type: 'js_pow',
  challenge_redirect_url: '',
  challenge_pow_difficulty: 4,
  challenge_bypass_ttl_sec: 900,
  challenge_honeypot_field: 'website',
  spam_rate_threshold: 10,
  form_honeypot_detection: true,
  form_submission_velocity_threshold: 3,
  form_submission_velocity_window_sec: 300,
  form_content_dedupe_threshold: 3,
  form_content_dedupe_window_sec: 1800,
  dnsbl_enabled: false,
  dnsbl_providers: ['zen.spamhaus.org', 'bl.spamcop.net'],
  dnsbl_action: 'challenge',
  dnsbl_cache_ttl_sec: 900,
  max_accounts_per_device: 3,
  max_accounts_per_ip: 5,
}

export function useAntiEvasion() {
  const [config, setConfig] = useState(DEFAULT_CONFIG)
  const [incidents, setIncidents] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [configRes, incidentsRes] = await Promise.all([
        antiEvasionApi.config(),
        antiEvasionApi.incidents({ page_size: 30 }),
      ])
      setConfig({ ...DEFAULT_CONFIG, ...configRes.data })
      setIncidents(incidentsRes.data.items ?? [])
    } catch (_) {
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const saveConfig = useCallback(async (nextConfig) => {
    setSaving(true)
    try {
      await antiEvasionApi.updateConfig(nextConfig)
      setConfig(nextConfig)
    } finally {
      setSaving(false)
    }
  }, [])

  const resolveIncident = useCallback(async (id) => {
    await antiEvasionApi.resolveIncident(id)
    setIncidents((prev) => prev.map((incident) => (
      incident.id === id ? { ...incident, status: 'resolved' } : incident
    )))
  }, [])

  return { config, setConfig, incidents, loading, saving, refresh, saveConfig, resolveIncident }
}
