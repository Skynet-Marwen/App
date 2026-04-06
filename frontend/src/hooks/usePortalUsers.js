import { useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { identityApi, riskApi } from '../services/api'

const DEFAULT_ACTIVITY_FILTERS = {
  eventType: '',
  platform: '',
  page: 1,
}

const EMPTY_DETAIL = {
  profile: null,
  devices: [],
  visitors: [],
  riskHistory: [],
  flags: [],
  activity: [],
  activityTotal: 0,
}

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.detail?.message ||
  error?.response?.data?.detail ||
  fallback

export function usePortalUsers() {
  const location = useLocation()
  const [users, setUsers] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearchState] = useState(() => new URLSearchParams(window.location.search).get('search') || '')
  const [minScore, setMinScoreState] = useState('0')
  const [trustLevel, setTrustLevelState] = useState('')
  const [hasFlags, setHasFlagsState] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [selectedUser, setSelectedUser] = useState(null)
  const [detail, setDetail] = useState(EMPTY_DETAIL)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [activityLoading, setActivityLoading] = useState(false)
  const [activityError, setActivityError] = useState('')
  const [activityFilters, setActivityFilters] = useState(DEFAULT_ACTIVITY_FILTERS)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await riskApi.listUsers({
        page,
        page_size: 20,
        search: search.trim(),
        min_score: Number(minScore) || 0,
        trust_level: trustLevel,
        has_flags: hasFlags,
      })
      setUsers((res.data.items ?? []).map((item) => ({ ...item, id: item.external_user_id })))
      setTotal(res.data.total ?? 0)
    } catch (err) {
      setUsers([])
      setTotal(0)
      setError(getErrorMessage(err, 'Failed to load portal users'))
    } finally {
      setLoading(false)
    }
  }, [hasFlags, minScore, page, search, trustLevel])

  useEffect(() => {
    const timerId = window.setTimeout(refresh, search ? 220 : 0)
    return () => window.clearTimeout(timerId)
  }, [refresh, search])

  useEffect(() => {
    const nextSearch = new URLSearchParams(location.search).get('search') || ''
    setSearchState(nextSearch)
    setPage(1)
  }, [location.search])

  useEffect(() => {
    if (!selectedUser?.external_user_id) return
    const updated = users.find((item) => item.external_user_id === selectedUser.external_user_id)
    if (updated) {
      setSelectedUser(updated)
    }
  }, [selectedUser, users])

  const refreshDetail = useCallback(async (externalUserId = selectedUser?.external_user_id) => {
    if (!externalUserId) return
    setDetailLoading(true)
    setDetailError('')
    try {
      const [profileRes, devicesRes, visitorsRes, riskHistoryRes, flagsRes] = await Promise.all([
        identityApi.profile(externalUserId),
        identityApi.devices(externalUserId),
        identityApi.visitors(externalUserId, { limit: 24 }),
        identityApi.riskHistory(externalUserId, { limit: 24 }),
        identityApi.flags(externalUserId),
      ])

      setDetail((current) => ({
        ...current,
        profile: profileRes.data,
        devices: devicesRes.data ?? [],
        visitors: visitorsRes.data ?? [],
        riskHistory: riskHistoryRes.data?.items ?? [],
        flags: flagsRes.data ?? [],
      }))
    } catch (err) {
      setDetailError(getErrorMessage(err, 'Failed to load user intelligence details'))
    } finally {
      setDetailLoading(false)
    }
  }, [selectedUser])

  const refreshActivity = useCallback(async (
    externalUserId = selectedUser?.external_user_id,
    filters = activityFilters,
  ) => {
    if (!externalUserId) return
    setActivityLoading(true)
    setActivityError('')
    try {
      const res = await identityApi.activity(externalUserId, {
        page: filters.page,
        page_size: 12,
        event_type: filters.eventType,
        platform: filters.platform,
      })
      setDetail((current) => ({
        ...current,
        activity: res.data?.items ?? [],
        activityTotal: res.data?.total ?? 0,
      }))
    } catch (err) {
      setActivityError(getErrorMessage(err, 'Failed to load activity timeline'))
    } finally {
      setActivityLoading(false)
    }
  }, [activityFilters, selectedUser])

  useEffect(() => {
    if (!selectedUser?.external_user_id) return
    refreshDetail(selectedUser.external_user_id)
  }, [refreshDetail, selectedUser])

  useEffect(() => {
    if (!selectedUser?.external_user_id) return
    refreshActivity(selectedUser.external_user_id, activityFilters)
  }, [activityFilters, refreshActivity, selectedUser])

  const selectUser = useCallback((user) => {
    setSelectedUser(user)
    setDetail(EMPTY_DETAIL)
    setDetailError('')
    setActivityError('')
    setActivityFilters(DEFAULT_ACTIVITY_FILTERS)
  }, [])

  const closeUser = useCallback(() => {
    setSelectedUser(null)
    setDetail(EMPTY_DETAIL)
    setDetailError('')
    setActivityError('')
    setActivityFilters(DEFAULT_ACTIVITY_FILTERS)
  }, [])

  const setSearch = useCallback((value) => {
    setSearchState(value)
    setPage(1)
  }, [])

  const setMinScore = useCallback((value) => {
    setMinScoreState(value)
    setPage(1)
  }, [])

  const setTrustLevel = useCallback((value) => {
    setTrustLevelState(value)
    setPage(1)
  }, [])

  const setHasFlags = useCallback((value) => {
    setHasFlagsState(value)
    setPage(1)
  }, [])

  const setActivityEventType = useCallback((value) => {
    setActivityFilters((current) => ({ ...current, eventType: value, page: 1 }))
  }, [])

  const setActivityPlatform = useCallback((value) => {
    setActivityFilters((current) => ({ ...current, platform: value, page: 1 }))
  }, [])

  const setActivityPage = useCallback((value) => {
    setActivityFilters((current) => ({ ...current, page: value }))
  }, [])

  const recomputeRisk = useCallback(async (externalUserId = selectedUser?.external_user_id) => {
    if (!externalUserId) return null
    const res = await riskApi.recompute(externalUserId)
    await Promise.all([refresh(), refreshDetail(externalUserId)])
    return res.data
  }, [refresh, refreshDetail, selectedUser])

  const setEnhancedAudit = useCallback(async (
    enabled,
    reason,
    externalUserId = selectedUser?.external_user_id,
  ) => {
    if (!externalUserId) return null
    const res = await identityApi.setEnhancedAudit(externalUserId, { enabled, reason })
    await Promise.all([refresh(), refreshDetail(externalUserId)])
    return res.data
  }, [refresh, refreshDetail, selectedUser])

  const updateFlagStatus = useCallback(async (
    flagId,
    status,
    externalUserId = selectedUser?.external_user_id,
  ) => {
    if (!externalUserId || !flagId) return null
    const res = await identityApi.updateFlag(externalUserId, flagId, { status })
    await Promise.all([refresh(), refreshDetail(externalUserId)])
    return res.data
  }, [refresh, refreshDetail, selectedUser])

  const updateTrustLevel = useCallback(async (
    trustLevel,
    reason = 'Updated from Portal Users intelligence view',
    externalUserId = selectedUser?.external_user_id,
  ) => {
    if (!externalUserId) return null
    const res = await identityApi.setTrustLevel(externalUserId, { trust_level: trustLevel, reason })
    await Promise.all([refresh(), refreshDetail(externalUserId)])
    return res.data
  }, [refresh, refreshDetail, selectedUser])

  const deleteExternalUser = useCallback(async (
    externalUserId = selectedUser?.external_user_id,
  ) => {
    if (!externalUserId) return null
    const res = await identityApi.delete(externalUserId)
    await refresh()
    if (selectedUser?.external_user_id === externalUserId) {
      setSelectedUser(null)
      setDetail(EMPTY_DETAIL)
      setDetailError('')
      setActivityError('')
      setActivityFilters(DEFAULT_ACTIVITY_FILTERS)
    }
    return res.data
  }, [refresh, selectedUser])

  return {
    users,
    total,
    page,
    search,
    minScore,
    trustLevel,
    hasFlags,
    loading,
    error,
    detail,
    detailLoading,
    detailError,
    activityLoading,
    activityError,
    activityFilters,
    selectedUser,
    setPage,
    setSearch,
    setMinScore,
    setTrustLevel,
    setHasFlags,
    setActivityEventType,
    setActivityPlatform,
    setActivityPage,
    refresh,
    refreshDetail,
    refreshActivity,
    selectUser,
    closeUser,
    recomputeRisk,
    setEnhancedAudit,
    updateFlagStatus,
    updateTrustLevel,
    deleteExternalUser,
  }
}
