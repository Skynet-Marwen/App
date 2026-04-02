import { useEffect } from 'react'
import { useThemeStore } from '../store/themeStore'
import { applyTheme } from '../services/themeEngine'

export function useTheme() {
  const store = useThemeStore()

  useEffect(() => {
    if (store.currentTheme) {
      applyTheme(store.currentTheme)
    }
  }, [store.currentTheme])

  return store
}