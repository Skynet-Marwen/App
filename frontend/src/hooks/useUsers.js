import { useCallback, useEffect, useState } from 'react'
import { usersApi } from '../services/api'

export function useUsers() {
  const [users, setUsers] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await usersApi.list({ page, search, page_size: 20 })
      setUsers(res.data.items)
      setTotal(res.data.total)
    } catch {
      setUsers([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => { refresh() }, [refresh])

  const createUser = useCallback(async (data) => {
    const res = await usersApi.create(data)
    await refresh()
    return res
  }, [refresh])

  const blockUser = useCallback(async (id) => {
    await usersApi.block(id)
    await refresh()
  }, [refresh])

  const unblockUser = useCallback(async (id) => {
    await usersApi.unblock(id)
    await refresh()
  }, [refresh])

  const updateUser = useCallback(async (id, data) => {
    const res = await usersApi.update(id, data)
    await refresh()
    return res
  }, [refresh])

  const deleteUser = useCallback(async (id) => {
    await usersApi.delete(id)
    await refresh()
  }, [refresh])

  const resetPassword = useCallback(async (id) => {
    const res = await usersApi.resetPassword(id)
    return res.data
  }, [])

  return {
    users,
    total,
    page,
    search,
    loading,
    setPage,
    setSearch,
    refresh,
    createUser,
    updateUser,
    deleteUser,
    blockUser,
    unblockUser,
    resetPassword,
  }
}
