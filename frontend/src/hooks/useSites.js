import { useCallback, useEffect, useState } from 'react'
import { integrationApi } from '../services/api'

export function useSites() {
  const [sites, setSites] = useState([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await integrationApi.sites()
      setSites(res.data)
    } catch (_) {
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const createSite = useCallback(async (data) => {
    const res = await integrationApi.createSite(data)
    await refresh()
    return res
  }, [refresh])

  const deleteSite = useCallback(async (id) => {
    await integrationApi.deleteSite(id)
    await refresh()
  }, [refresh])

  const regenerateKey = useCallback(async (id) => {
    await integrationApi.regenerateKey(id)
    await refresh()
  }, [refresh])

  return { sites, loading, refresh, createSite, deleteSite, regenerateKey }
}
