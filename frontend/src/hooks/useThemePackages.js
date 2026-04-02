import { useCallback, useState } from 'react'
import { themesApi } from '../services/api'
import {
  buildThemeRegistryPackage,
  downloadThemeRegistryPackage,
  prepareThemePayload,
  readThemeRegistryPackage,
} from '../services/themePackages'

function extractApiError(error, fallback) {
  return error?.response?.data?.detail || error?.message || fallback
}

export function useThemePackages({ themes, defaultThemeId, refreshThemes }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const clearMessages = useCallback(() => {
    setError('')
    setSuccess('')
  }, [])

  const exportRegistry = useCallback(async () => {
    clearMessages()
    setLoading(true)
    try {
      const packageData = buildThemeRegistryPackage(themes, defaultThemeId)
      downloadThemeRegistryPackage(packageData)
      setSuccess(`Exported ${packageData.themes.length} theme${packageData.themes.length === 1 ? '' : 's'} as a JSON package.`)
      return { ok: true, packageData }
    } catch (err) {
      const message = extractApiError(err, 'Failed to export the theme package.')
      setError(message)
      return { ok: false, error: message }
    } finally {
      setLoading(false)
    }
  }, [clearMessages, defaultThemeId, themes])

  const importRegistry = useCallback(async (file) => {
    if (!file) return { ok: false, error: 'No theme package selected.' }

    clearMessages()
    setLoading(true)
    try {
      const packageData = await readThemeRegistryPackage(file)
      if (!packageData.themes.length) {
        throw new Error('Theme package did not contain any themes.')
      }

      const existingIds = new Set((themes || []).map((theme) => theme.id))
      const importedIds = new Set()

      for (const theme of packageData.themes) {
        const payload = prepareThemePayload(theme)
        if (!payload.id || !payload.name) {
          continue
        }

        if (existingIds.has(payload.id)) {
          await themesApi.update(payload.id, payload)
        } else {
          await themesApi.create(payload)
        }

        importedIds.add(payload.id)
      }

      if (packageData.default_theme_id && importedIds.has(packageData.default_theme_id)) {
        await themesApi.setDefault({ theme_id: packageData.default_theme_id })
      }

      await refreshThemes()
      setSuccess(`Imported ${importedIds.size} theme${importedIds.size === 1 ? '' : 's'} from the JSON package.`)
      return { ok: true, count: importedIds.size, defaultThemeId: packageData.default_theme_id }
    } catch (err) {
      const message = extractApiError(err, 'Failed to import the theme package.')
      setError(message)
      return { ok: false, error: message }
    } finally {
      setLoading(false)
    }
  }, [clearMessages, refreshThemes, themes])

  return {
    loading,
    error,
    success,
    clearMessages,
    exportRegistry,
    importRegistry,
  }
}

