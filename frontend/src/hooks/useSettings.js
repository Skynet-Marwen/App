import { useCallback, useEffect, useState } from 'react'
import { settingsApi } from '../services/api'

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
  const [blockPage, setBlockPage] = useState(DEFAULT_BLOCK)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [settingsRes, blockRes] = await Promise.all([
        settingsApi.get(),
        settingsApi.getBlockPage(),
      ])
      setSettings(settingsRes.data)
      setBlockPage({ ...DEFAULT_BLOCK, ...blockRes.data })
    } catch (_) {
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

  return {
    settings,
    setSettings,
    blockPage,
    setBlockPage,
    loading,
    saving,
    refresh,
    saveSettings,
    saveBlockPage,
  }
}
