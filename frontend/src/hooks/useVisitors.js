import { useCallback, useEffect, useState } from 'react'
import { visitorsApi } from '../services/api'

const DEFAULT_PAGE_SIZE = 20

export function useVisitors({ page = 1, search = '' } = {}) {
  const [visitors, setVisitors] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await visitorsApi.list({ page, search, page_size: DEFAULT_PAGE_SIZE })
      setVisitors(Array.isArray(res.data.items) ? res.data.items : [])
      setTotal(Number(res.data.total) || 0)
    } catch {
      // Visitors list failures are handled by leaving the current table empty.
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => { refresh() }, [refresh])

  const blockVisitor = useCallback(async (id, reason) => {
    await visitorsApi.block(id, reason)
    await refresh()
  }, [refresh])

  const blockVisitors = useCallback(async (ids, reason) => {
    const uniqueIds = [...new Set((ids || []).filter(Boolean))]
    for (const id of uniqueIds) {
      await visitorsApi.block(id, reason)
    }
    await refresh()
  }, [refresh])

  const unblockVisitor = useCallback(async (id) => {
    await visitorsApi.unblock(id)
    await refresh()
  }, [refresh])

  const deleteVisitor = useCallback(async (id) => {
    await visitorsApi.delete(id)
    await refresh()
  }, [refresh])

  const loadVisitor = useCallback(async (id) => {
    const res = await visitorsApi.get(id)
    return res.data
  }, [])

  return {
    visitors,
    total,
    loading,
    refresh,
    blockVisitor,
    blockVisitors,
    unblockVisitor,
    deleteVisitor,
    loadVisitor,
    pageSize: DEFAULT_PAGE_SIZE,
  }
}
