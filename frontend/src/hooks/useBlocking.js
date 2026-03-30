import { useCallback, useEffect, useState } from 'react'
import { blockingApi } from '../services/api'

export function useBlocking() {
  const [rules, setRules] = useState([])
  const [ips, setIps] = useState([])
  const [ipTotal, setIpTotal] = useState(0)
  const [ipPage, setIpPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [rulesRes, ipsRes] = await Promise.all([
        blockingApi.rules(),
        blockingApi.ipList({ page: ipPage, search, page_size: 20 }),
      ])
      setRules(rulesRes.data)
      setIps(ipsRes.data.items)
      setIpTotal(ipsRes.data.total)
    } catch (_) {
    } finally {
      setLoading(false)
    }
  }, [ipPage, search])

  useEffect(() => { refresh() }, [refresh])

  const createRule = useCallback(async (data) => {
    const res = await blockingApi.createRule(data)
    await refresh()
    return res
  }, [refresh])

  const deleteRule = useCallback(async (id) => {
    await blockingApi.deleteRule(id)
    await refresh()
  }, [refresh])

  const blockIp = useCallback(async (ip, reason) => {
    const res = await blockingApi.blockIp(ip, reason)
    await refresh()
    return res
  }, [refresh])

  const unblockIp = useCallback(async (ip) => {
    await blockingApi.unblockIp(ip)
    await refresh()
  }, [refresh])

  return {
    rules,
    ips,
    ipTotal,
    ipPage,
    search,
    loading,
    setIpPage,
    setSearch,
    refresh,
    createRule,
    deleteRule,
    blockIp,
    unblockIp,
  }
}
