import { useCallback, useEffect, useState } from 'react'

import { securityApi } from '../services/api'

export function useSecurityCenter(enabled) {
  const [status, setStatus] = useState(null)
  const [findings, setFindings] = useState([])
  const [recommendations, setRecommendations] = useState([])
  const [loading, setLoading] = useState(Boolean(enabled))
  const [scanning, setScanning] = useState(false)
  const [actingId, setActingId] = useState('')
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    if (!enabled) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const [statusRes, findingsRes, recommendationsRes] = await Promise.all([
        securityApi.status(),
        securityApi.findings(),
        securityApi.recommendations(),
      ])
      setStatus(statusRes.data)
      setFindings(findingsRes.data)
      setRecommendations(recommendationsRes.data)
    } catch (error_) {
      setError(error_.response?.data?.detail || 'Failed to load Security Center')
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    refresh()
  }, [refresh])

  const runScan = useCallback(async () => {
    if (!enabled) return
    setScanning(true)
    setError('')
    try {
      await securityApi.scan({ refresh_intel: true })
      await refresh()
    } catch (error_) {
      setError(error_.response?.data?.detail || 'Failed to run security scan')
    } finally {
      setScanning(false)
    }
  }, [enabled, refresh])

  const ignoreFinding = useCallback(async (findingId) => {
    if (!enabled) return
    setActingId(`finding:${findingId}`)
    setError('')
    try {
      await securityApi.ignoreFinding(findingId)
      await refresh()
    } catch (error_) {
      setError(error_.response?.data?.detail || 'Failed to ignore finding')
    } finally {
      setActingId('')
    }
  }, [enabled, refresh])

  const applyRecommendation = useCallback(async (recommendationId) => {
    if (!enabled) return
    setActingId(`recommendation:${recommendationId}`)
    setError('')
    try {
      await securityApi.applyRecommendation(recommendationId)
      await refresh()
    } catch (error_) {
      setError(error_.response?.data?.detail || 'Failed to apply recommendation')
    } finally {
      setActingId('')
    }
  }, [enabled, refresh])

  return {
    status,
    findings,
    recommendations,
    loading,
    scanning,
    actingId,
    error,
    refresh,
    runScan,
    ignoreFinding,
    applyRecommendation,
  }
}
