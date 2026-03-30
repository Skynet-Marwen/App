import { useCallback, useEffect, useState } from 'react'
import { antiEvasionApi } from '../services/api'

const DEFAULT_CONFIG = {
  vpn_detection: true,
  tor_detection: true,
  proxy_detection: true,
  datacenter_detection: true,
  headless_browser_detection: true,
  bot_detection: true,
  canvas_fingerprint: true,
  webgl_fingerprint: true,
  font_fingerprint: true,
  audio_fingerprint: true,
  timezone_mismatch: true,
  language_mismatch: true,
  cookie_evasion: true,
  ip_rotation_detection: true,
  spam_rate_threshold: 10,
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
