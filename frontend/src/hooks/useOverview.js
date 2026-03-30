import { useCallback, useEffect, useState } from 'react'
import { statsApi } from '../services/api'

export function useOverview(range) {
  const [overview, setOverview] = useState(null)
  const [realtime, setRealtime] = useState(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const [overviewRes, realtimeRes] = await Promise.all([
        statsApi.overview(range),
        statsApi.realtime(),
      ])
      setOverview(overviewRes.data)
      setRealtime(realtimeRes.data)
    } catch (_) {
    } finally {
      setLoading(false)
    }
  }, [range])

  useEffect(() => { refresh() }, [refresh])

  useEffect(() => {
    const id = setInterval(() => {
      statsApi.realtime().then((res) => setRealtime(res.data)).catch(() => {})
      refresh()
    }, 10000)
    return () => clearInterval(id)
  }, [refresh])

  return { overview, realtime, loading, refresh }
}
