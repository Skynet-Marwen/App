import { useCallback, useEffect, useState } from 'react'
import { visitorsApi } from '../services/api'

export function useVisitors() {
  const [visitors, setVisitors] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await visitorsApi.list({ page, search, page_size: 20 })
      setVisitors(res.data.items)
      setTotal(res.data.total)
    } catch (_) {
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => { refresh() }, [refresh])

  const blockVisitor = useCallback(async (id, reason) => {
    await visitorsApi.block(id, reason)
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

  return {
    visitors,
    total,
    page,
    search,
    loading,
    setPage,
    setSearch,
    refresh,
    blockVisitor,
    unblockVisitor,
    deleteVisitor,
  }
}
