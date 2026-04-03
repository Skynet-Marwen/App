import { useCallback, useEffect, useState } from 'react'
import { usersApi } from '../services/api'

export function useUserSessions(userId) {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!userId) {
      setSessions([])
      return
    }
    setLoading(true)
    try {
      const res = await usersApi.sessions(userId)
      setSessions(res.data)
    } catch {
      setSessions([])
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => { refresh() }, [refresh])

  const revoke = useCallback(async (sessionId) => {
    if (!userId) return
    await usersApi.revokeSession(userId, sessionId)
    setSessions((prev) => prev.filter((item) => item.id !== sessionId))
  }, [userId])

  return { sessions, loading, refresh, revoke }
}
