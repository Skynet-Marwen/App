import { useEffect, useState, useCallback } from 'react'
import { Eye, Users, Monitor, Shield, AlertTriangle, Activity } from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts'
import DashboardLayout from '../components/layout/DashboardLayout'
import { StatCard, Card, CardHeader, Badge } from '../components/ui/index'
import { statsApi } from '../services/api'
import { useUIStore } from '../store/useAppStore'

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs">
      <p className="text-gray-400 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }}>{p.name}: {p.value}</p>
      ))}
    </div>
  )
}

export default function OverviewPage() {
  const { statsRange } = useUIStore()
  const [overview, setOverview] = useState(null)
  const [realtime, setRealtime] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const [ovRes, rtRes] = await Promise.all([
        statsApi.overview(statsRange),
        statsApi.realtime(),
      ])
      setOverview(ovRes.data)
      setRealtime(rtRes.data)
    } catch (_) {}
    finally { setLoading(false) }
  }, [statsRange])

  useEffect(() => { fetchData() }, [fetchData])

  // Auto-refresh realtime every 30s
  useEffect(() => {
    const id = setInterval(() => statsApi.realtime().then((r) => setRealtime(r.data)).catch(() => {}), 30000)
    return () => clearInterval(id)
  }, [])

  return (
    <DashboardLayout title="Overview" showRange onRefresh={fetchData}>
      {/* Realtime Banner */}
      {realtime && (
        <div className="flex items-center gap-3 mb-6 bg-gray-900 border border-gray-800 rounded-xl px-5 py-3">
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span className="text-sm text-gray-300">
            <span className="text-white font-semibold">{realtime.active_visitors}</span> active visitors right now
          </span>
          <span className="text-gray-600">·</span>
          <span className="text-sm text-gray-300">
            <span className="text-white font-semibold">{realtime.blocked_attempts_last_minute}</span> blocked attempts / min
          </span>
          <span className="text-gray-600">·</span>
          <span className="text-sm text-gray-300">
            <span className="text-yellow-400 font-semibold">{realtime.suspicious_sessions}</span> suspicious sessions
          </span>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        <StatCard label="Total Visitors" value={overview?.total_visitors?.toLocaleString() ?? '—'} change={overview?.visitors_change} icon={Eye} color="cyan" loading={loading} />
        <StatCard label="Unique Users" value={overview?.unique_users?.toLocaleString() ?? '—'} change={overview?.users_change} icon={Users} color="blue" loading={loading} />
        <StatCard label="Devices" value={overview?.total_devices?.toLocaleString() ?? '—'} icon={Monitor} color="purple" loading={loading} />
        <StatCard label="Blocked" value={overview?.total_blocked?.toLocaleString() ?? '—'} change={overview?.blocked_change} icon={Shield} color="red" loading={loading} />
        <StatCard label="Evasion Attempts" value={overview?.evasion_attempts?.toLocaleString() ?? '—'} icon={AlertTriangle} color="yellow" loading={loading} />
        <StatCard label="Spam Detected" value={overview?.spam_detected?.toLocaleString() ?? '—'} icon={Activity} color="green" loading={loading} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
        {/* Traffic Chart */}
        <Card className="xl:col-span-2">
          <CardHeader>
            <p className="text-sm font-medium text-white">Traffic Over Time</p>
            <p className="text-xs text-gray-500">Visitors and blocked requests</p>
          </CardHeader>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={overview?.traffic_chart ?? []}>
              <defs>
                <linearGradient id="visitorsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="blockedGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="time" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="visitors" name="Visitors" stroke="#06b6d4" fill="url(#visitorsGrad)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="blocked" name="Blocked" stroke="#ef4444" fill="url(#blockedGrad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* Top Countries */}
        <Card>
          <CardHeader>
            <p className="text-sm font-medium text-white">Top Countries</p>
          </CardHeader>
          <div className="space-y-3">
            {(overview?.top_countries ?? []).map((c) => (
              <div key={c.country} className="flex items-center gap-3">
                <span className="text-base">{c.flag}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between mb-1">
                    <span className="text-xs text-gray-300 truncate">{c.country}</span>
                    <span className="text-xs text-gray-500">{c.percent}%</span>
                  </div>
                  <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${c.percent}%` }} />
                  </div>
                </div>
              </div>
            ))}
            {!loading && !overview?.top_countries?.length && (
              <p className="text-sm text-gray-500 text-center py-4">No data</p>
            )}
          </div>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Blocking Activity */}
        <Card>
          <CardHeader>
            <p className="text-sm font-medium text-white">Blocking Activity</p>
            <p className="text-xs text-gray-500">By reason</p>
          </CardHeader>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={overview?.blocking_chart ?? []} layout="vertical">
              <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="reason" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} width={100} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" fill="#ef4444" radius={4} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Recent Incidents */}
        <Card>
          <CardHeader>
            <p className="text-sm font-medium text-white">Recent Incidents</p>
          </CardHeader>
          <div className="space-y-2">
            {(overview?.recent_incidents ?? []).map((inc) => (
              <div key={inc.id} className="flex items-start gap-3 p-3 bg-gray-800/50 rounded-lg">
                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                  inc.severity === 'high' ? 'bg-red-400' :
                  inc.severity === 'medium' ? 'bg-yellow-400' : 'bg-cyan-400'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-white">{inc.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{inc.time}</p>
                </div>
                <Badge variant={inc.severity === 'high' ? 'danger' : inc.severity === 'medium' ? 'warning' : 'info'}>
                  {inc.severity}
                </Badge>
              </div>
            ))}
            {!loading && !overview?.recent_incidents?.length && (
              <p className="text-sm text-gray-500 text-center py-4">No recent incidents</p>
            )}
          </div>
        </Card>
      </div>
    </DashboardLayout>
  )
}
