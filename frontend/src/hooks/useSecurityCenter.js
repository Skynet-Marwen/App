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
  const [scanSummary, setScanSummary] = useState('')
  const [scanSummaryTone, setScanSummaryTone] = useState('info')

  const refresh = useCallback(async () => {
    if (!enabled) {
      setLoading(false)
      return false
    }
    setLoading(true)
    setError('')
    let ok = true
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
      ok = false
      setError(error_.response?.data?.detail || 'Failed to load Security Center')
    } finally {
      setLoading(false)
    }
    return ok
  }, [enabled])

  useEffect(() => {
    refresh()
  }, [refresh])

  const runScan = useCallback(async () => {
    if (!enabled) return
    setScanning(true)
    setError('')
    setScanSummary('')
    try {
      const { data } = await securityApi.scan({ refresh_intel: true })
      const refreshed = await refresh()
      if (data.errors?.length) {
        const first = data.errors[0]
        const location = first.site_url || first.site_id || 'security scan'
        const more = data.errors.length > 1 ? ` (+${data.errors.length - 1} more)` : ''
        setScanSummary(`Scan completed with issues on ${location}: ${first.detail}${more}`)
        setScanSummaryTone('warning')
      } else if (!refreshed) {
        setScanSummary('Scan completed, but Security Center failed to refresh. Use Refresh to reload the latest findings.')
        setScanSummaryTone('warning')
      } else if ((data.scanned_targets || 0) > 0) {
        setScanSummary(`Scan completed for ${data.scanned_targets} target(s). ${data.findings_created || 0} finding(s) refreshed.`)
        setScanSummaryTone('success')
      } else {
        setScanSummary('Scan completed, but no active protected sites were available to analyze.')
        setScanSummaryTone('info')
      }
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
    scanSummary,
    scanSummaryTone,
    refresh,
    runScan,
    ignoreFinding,
    applyRecommendation,
  }
}
