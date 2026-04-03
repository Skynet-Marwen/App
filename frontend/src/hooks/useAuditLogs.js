import { useCallback, useEffect, useState } from 'react'
import { auditApi } from '../services/api'

export function useAuditLogs() {
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [action, setAction] = useState('')
  const [targetType, setTargetType] = useState('')
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await auditApi.logs({
        page,
        search,
        action,
        target_type: targetType,
        page_size: 20,
      })
      setItems(res.data.items)
      setTotal(res.data.total)
    } catch {
      setItems([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [action, page, search, targetType])

  useEffect(() => { refresh() }, [refresh])

  return {
    items,
    total,
    page,
    search,
    action,
    targetType,
    loading,
    setPage,
    setSearch,
    setAction,
    setTargetType,
    refresh,
  }
}
