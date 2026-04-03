import { useCallback, useEffect, useState } from 'react'

import { tenantsApi } from '../services/api'


export function useTenants() {
  const [tenants, setTenants] = useState([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await tenantsApi.list()
      setTenants(Array.isArray(res.data) ? res.data : [])
    } catch {
      setTenants([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const createTenant = useCallback(async (payload) => {
    const res = await tenantsApi.create(payload)
    await refresh()
    return res
  }, [refresh])

  const updateTenant = useCallback(async (tenantId, payload) => {
    const res = await tenantsApi.update(tenantId, payload)
    await refresh()
    return res
  }, [refresh])

  const deleteTenant = useCallback(async (tenantId) => {
    const res = await tenantsApi.delete(tenantId)
    await refresh()
    return res
  }, [refresh])

  return {
    tenants,
    loading,
    refresh,
    createTenant,
    updateTenant,
    deleteTenant,
  }
}
