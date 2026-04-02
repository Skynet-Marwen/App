import { useCallback, useEffect, useRef, useState } from 'react'
import { statsApi } from '../services/api'

const SOCKET_RETRY_MS = 15000
const FALLBACK_POLL_MS = 10000
const OVERVIEW_REFRESH_MS = 60000

function buildRealtimeSocketUrl(range) {
  if (typeof window === 'undefined' || !window.WebSocket) return null
  const token = window.localStorage.getItem('skynet_token')
  if (!token) return null
  const url = new URL('/api/v1/stats/realtime/ws', window.location.origin)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  if (range) url.searchParams.set('range', range)
  url.searchParams.set('token', token)
  return url.toString()
}

function parseRealtimePayload(message) {
  if (!message || typeof message !== 'object') return null
  if (message.type === 'realtime' && message.data && typeof message.data === 'object') {
    return message.data
  }
  if (message.realtime && typeof message.realtime === 'object') return message.realtime
  if (
    typeof message.active_visitors === 'number' ||
    typeof message.blocked_attempts_last_minute === 'number' ||
    typeof message.suspicious_sessions === 'number'
  ) {
    return message
  }
  return null
}

export function useOverview(range) {
  const [overview, setOverview] = useState(null)
  const [realtime, setRealtime] = useState(null)
  const [realtimeSource, setRealtimeSource] = useState('polling')
  const [loading, setLoading] = useState(true)
  const socketRef = useRef(null)
  const pollRef = useRef(null)
  const overviewRefreshRef = useRef(null)
  const retryRef = useRef(null)
  const mountedRef = useRef(false)

  const loadOverview = useCallback(async () => {
    try {
      const overviewRes = await statsApi.overview(range)
      setOverview(overviewRes.data)
    } catch {
      return null
    } finally {
      setLoading(false)
    }
  }, [range])

  const loadRealtime = useCallback(async () => {
    try {
      const res = await statsApi.realtime()
      setRealtime(res.data)
      return res.data
    } catch {
      return null
    }
  }, [])

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      window.clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const stopRetry = useCallback(() => {
    if (retryRef.current) {
      window.clearTimeout(retryRef.current)
      retryRef.current = null
    }
  }, [])

  const startPolling = useCallback(() => {
    if (pollRef.current) return
    pollRef.current = window.setInterval(() => {
      loadRealtime()
    }, FALLBACK_POLL_MS)
  }, [loadRealtime])

  const connectSocket = useCallback(() => {
    stopPolling()
    stopRetry()

    const socketUrl = buildRealtimeSocketUrl(range)
    if (!socketUrl) {
      setRealtimeSource('polling')
      startPolling()
      return
    }

    let socket
    try {
      socket = new WebSocket(socketUrl)
    } catch {
      setRealtimeSource('polling')
      startPolling()
      return
    }

    socketRef.current = socket
    socket.onopen = () => {
      if (!mountedRef.current) return
      setRealtimeSource('websocket')
      stopPolling()
    }
    socket.onmessage = (event) => {
      try {
        const payload = parseRealtimePayload(JSON.parse(event.data))
        if (payload) setRealtime((current) => ({ ...current, ...payload }))
      } catch {
        return
      }
    }
    socket.onerror = () => {
      if (!mountedRef.current) return
      setRealtimeSource('polling')
      startPolling()
      stopRetry()
      retryRef.current = window.setTimeout(() => {
        if (mountedRef.current) connectSocket()
      }, SOCKET_RETRY_MS)
    }
    socket.onclose = () => {
      if (!mountedRef.current) return
      setRealtimeSource('polling')
      startPolling()
      stopRetry()
      retryRef.current = window.setTimeout(() => {
        if (mountedRef.current) connectSocket()
      }, SOCKET_RETRY_MS)
    }
  }, [range, startPolling, stopPolling, stopRetry])

  const refresh = useCallback(async () => {
    setLoading(true)
    await Promise.all([loadOverview(), loadRealtime()])
  }, [loadOverview, loadRealtime])

  useEffect(() => {
    mountedRef.current = true
    refresh()
    connectSocket()
    overviewRefreshRef.current = window.setInterval(() => {
      loadOverview()
    }, OVERVIEW_REFRESH_MS)

    return () => {
      mountedRef.current = false
      stopPolling()
      stopRetry()
      if (overviewRefreshRef.current) {
        window.clearInterval(overviewRefreshRef.current)
        overviewRefreshRef.current = null
      }
      if (socketRef.current) {
        socketRef.current.onopen = null
        socketRef.current.onmessage = null
        socketRef.current.onerror = null
        socketRef.current.onclose = null
        socketRef.current.close()
        socketRef.current = null
      }
    }
  }, [connectSocket, loadOverview, refresh, stopPolling, stopRetry])

  return { overview, realtime, loading, realtimeSource, refresh }
}
