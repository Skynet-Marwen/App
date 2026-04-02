import { useEffect, useState } from 'react'
import { searchApi } from '../services/api'

const SEARCH_DELAY_MS = 180

export function useDashboardSearch(query) {
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const normalized = query.trim()
    if (normalized.length < 2) {
      setResults(null)
      setLoading(false)
      return undefined
    }

    const timerId = window.setTimeout(async () => {
      setLoading(true)
      try {
        const res = await searchApi.query({ q: normalized, limit: 4 })
        setResults(res.data)
      } catch {
        setResults({
          query: normalized,
          totals: { visitors: 0, devices: 0, portal_users: 0, overall: 0 },
          sections: [],
        })
      } finally {
        setLoading(false)
      }
    }, SEARCH_DELAY_MS)

    return () => window.clearTimeout(timerId)
  }, [query])

  return { results, loading }
}
