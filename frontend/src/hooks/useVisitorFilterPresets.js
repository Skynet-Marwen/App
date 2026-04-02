import { useEffect, useState } from 'react'

const STORAGE_KEY = 'skynet.visitor-filter-presets.v1'

function readStorage() {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((item) => item && item.id && item.name) : []
  } catch {
    return []
  }
}

function writeStorage(presets) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(presets))
}

function createPresetId(name) {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 8)}-${String(name).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
}

export function useVisitorFilterPresets() {
  const [presets, setPresets] = useState(() => readStorage())

  useEffect(() => {
    writeStorage(presets)
  }, [presets])

  const savePreset = (name, filters) => {
    const trimmed = String(name || '').trim()
    if (!trimmed) return null
    const nextPreset = {
      id: createPresetId(trimmed),
      name: trimmed,
      filters: {
        search: String(filters?.search || '').trim(),
      },
      created_at: new Date().toISOString(),
    }
    setPresets((current) => [nextPreset, ...current.filter((preset) => preset.name.toLowerCase() !== trimmed.toLowerCase())].slice(0, 12))
    return nextPreset
  }

  const deletePreset = (presetId) => {
    setPresets((current) => current.filter((preset) => preset.id !== presetId))
  }

  return {
    presets,
    savePreset,
    deletePreset,
  }
}
