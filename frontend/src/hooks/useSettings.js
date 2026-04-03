import { useCallback, useEffect, useState } from 'react'
import { antiEvasionApi, settingsApi } from '../services/api'

const DEFAULT_BLOCK = {
  title: 'ACCESS RESTRICTED',
  subtitle: 'Your access to this site has been blocked.',
  message: 'This action was taken automatically for security reasons.',
  bg_color: '#050505',
  accent_color: '#ef4444',
  logo_url: '',
  contact_email: '',
  show_request_id: true,
  show_contact: true,
}

export function useSettings() {
  const [settings, setSettings] = useState({})
  const [securityConfig, setSecurityConfig] = useState({})
  const [blockPage, setBlockPage] = useState(DEFAULT_BLOCK)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [settingsRes, blockRes, securityRes] = await Promise.all([
        settingsApi.get(),
        settingsApi.getBlockPage(),
        antiEvasionApi.config(),
      ])
      setSettings(settingsRes.data)
      setBlockPage({ ...DEFAULT_BLOCK, ...blockRes.data })
      setSecurityConfig(securityRes.data)
    } catch {
      setSettings({})
      setBlockPage(DEFAULT_BLOCK)
      setSecurityConfig({})
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const saveSettings = useCallback(async (nextSettings) => {
    setSaving(true)
    try {
      await settingsApi.update(nextSettings)
      setSettings(nextSettings)
    } finally {
      setSaving(false)
    }
  }, [])

  const saveBlockPage = useCallback(async (nextBlockPage) => {
    setSaving(true)
    try {
      await settingsApi.updateBlockPage(nextBlockPage)
      setBlockPage(nextBlockPage)
    } finally {
      setSaving(false)
    }
  }, [])

  const saveSecuritySettings = useCallback(async (nextSettings, nextSecurityConfig) => {
    setSaving(true)
    try {
      await Promise.all([
        settingsApi.update(nextSettings),
        antiEvasionApi.updateConfig(nextSecurityConfig),
      ])
      setSettings(nextSettings)
      setSecurityConfig(nextSecurityConfig)
    } finally {
      setSaving(false)
    }
  }, [])

  return {
    settings,
    setSettings,
    securityConfig,
    setSecurityConfig,
    blockPage,
    setBlockPage,
    loading,
    saving,
    refresh,
    saveSettings,
    saveSecuritySettings,
    saveBlockPage,
  }
}
