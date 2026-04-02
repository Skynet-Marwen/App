import { useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { devicesApi, usersApi } from '../services/api'

export function useDevices() {
  const location = useLocation()
  const [deviceGroups, setDeviceGroups] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState(() => new URLSearchParams(window.location.search).get('search') || '')
  const [loading, setLoading] = useState(true)
  const [usersList, setUsersList] = useState([])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await devicesApi.groups({ page, search, page_size: 20 })
      setDeviceGroups(res.data.items)
      setTotal(res.data.total)
    } catch {
      setDeviceGroups([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => { refresh() }, [refresh])

  useEffect(() => {
    const nextSearch = new URLSearchParams(location.search).get('search') || ''
    setSearch(nextSearch)
    setPage(1)
  }, [location.search])

  const loadDeviceVisitors = useCallback(async (deviceId) => {
    const res = await devicesApi.visitors(deviceId)
    return res.data.items
  }, [])

  const loadDevice = useCallback(async (deviceId) => {
    const res = await devicesApi.get(deviceId)
    return res.data
  }, [])

  const loadUsersList = useCallback(async () => {
    const res = await usersApi.list({ page_size: 100 })
    const options = res.data.items.map((user) => ({
      value: user.id,
      label: `${user.username} (${user.email})`,
    }))
    setUsersList(options)
    return options
  }, [])

  const linkDevice = useCallback(async (deviceId, userId) => {
    await devicesApi.link(deviceId, userId)
    await refresh()
  }, [refresh])

  const unlinkDevice = useCallback(async (deviceId) => {
    await devicesApi.unlink(deviceId)
    await refresh()
  }, [refresh])

  const blockDevice = useCallback(async (deviceId) => {
    await devicesApi.block(deviceId, 'Manual block')
    await refresh()
  }, [refresh])

  const unblockDevice = useCallback(async (deviceId) => {
    await devicesApi.unblock(deviceId)
    await refresh()
  }, [refresh])

  const deleteDevice = useCallback(async (deviceId) => {
    await devicesApi.delete(deviceId)
    await refresh()
  }, [refresh])

  return {
    deviceGroups,
    total,
    page,
    search,
    loading,
    usersList,
    setPage,
    setSearch,
    refresh,
    loadDevice,
    loadDeviceVisitors,
    loadUsersList,
    linkDevice,
    unlinkDevice,
    blockDevice,
    unblockDevice,
    deleteDevice,
  }
}
