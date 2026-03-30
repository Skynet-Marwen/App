import { useEffect, useState, useCallback } from 'react'
import { Eye, Users, Monitor, Shield, AlertTriangle, Activity } from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import DashboardLayout from '../components/layout/DashboardLayout'
import { StatCard, Card, CardHeader } from '../components/ui/index'
import { TrafficHeatmap } from '../components/ui/TrafficHeatmap'
import { statsApi } from '../services/api'
import { useUIStore } from '../store/useAppStore'

const HUDTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg px-3 py-2 text-xs font-mono border border-cyan-500/20"
      style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(8px)' }}>
      <p className="text-gray-500 mb-1">{label}</p>
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

  useEffect(() => {
    const id = setInterval(() => {
      statsApi.realtime().then((r) => setRealtime(r.data)).catch(() => {})
      fetchData()
    }, 10000)
    return () => clearInterval(id)
  }, [fetchData])

  return (
    <DashboardLayout title="Overview" showRange onRefresh={fetchData}>

      {/* Realtime HUD banner */}
      <div className="flex items-center gap-4 mb-6 px-5 py-3 rounded-xl border border-cyan-500/15 animate-border-breathe"
        style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)' }}>
        <span className="w-2 h-2 bg-green-400 rounded-full animate-hud-dot flex-shrink-0" style={{ color: '#4ade80' }} />
        <span className="text-xs font-mono text-gray-400">
          <span className="text-white font-bold neon-text-cyan">{realtime?.active_visitors ?? '—'}</span> active now
        </span>
        <span className="text-cyan-500/20">|</span>
        <span className="text-xs font-mono text-gray-400">
          <span className="text-white font-bold">{realtime?.blocked_attempts_last_minute ?? '—'}</span> blocked/min
        </span>
        <span className="text-cyan-500/20">|</span>
        <span className="text-xs font-mono text-gray-400">
          <span className="text-yellow-400 font-bold neon-text-red">{realtime?.suspicious_sessions ?? '—'}</span> suspicious
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-[10px] font-mono text-cyan-500/50 tracking-widest">LIVE</span>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
        <StatCard label="Total Visitors" rawValue={overview?.total_visitors} value={overview?.total_visitors?.toLocaleString() ?? '—'} change={overview?.visitors_change} icon={Eye} color="cyan" loading={loading} />
        <StatCard label="Unique Users"   rawValue={overview?.unique_users}    value={overview?.unique_users?.toLocaleString() ?? '—'}    change={overview?.users_change}    icon={Users} color="blue" loading={loading} />
        <StatCard label="Devices"        rawValue={overview?.total_devices}   value={overview?.total_devices?.toLocaleString() ?? '—'}   icon={Monitor} color="purple" loading={loading} />
        <StatCard label="Blocked"        rawValue={overview?.total_blocked}   value={overview?.total_blocked?.toLocaleString() ?? '—'}   change={overview?.blocked_change}  icon={Shield} color="red" loading={loading} />
        <StatCard label="Evasion"        rawValue={overview?.evasion_attempts} value={overview?.evasion_attempts?.toLocaleString() ?? '—'} icon={AlertTriangle} color="yellow" loading={loading} />
        <StatCard label="Spam"           rawValue={overview?.spam_detected}   value={overview?.spam_detected?.toLocaleString() ?? '—'}   icon={Activity} color="green" loading={loading} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">

        {/* Traffic — Heatmap */}
        <Card className="xl:col-span-2 !p-0">
          <div className="p-5 pb-3">
            <p className="text-xs font-mono font-medium text-cyan-400 uppercase tracking-widest">Traffic Intensity</p>
            <p className="text-[10px] font-mono text-gray-600 mt-0.5">Request volume heatmap</p>
          </div>
          <div className="px-5 pb-5">
            <TrafficHeatmap data={overview?.traffic_heatmap} range={statsRange} />
          </div>
        </Card>

        {/* Globe */}
        <Card>
          <CardHeader>
            <p className="text-xs font-mono font-medium text-cyan-400 uppercase tracking-widest">Global Threat Map</p>
          </CardHeader>
          <WorldGlobe countries={overview?.top_countries ?? []} />
        </Card>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Blocking activity */}
        <Card>
          <CardHeader>
            <p className="text-xs font-mono font-medium text-cyan-400 uppercase tracking-widest">Blocking Activity</p>
            <p className="text-[10px] font-mono text-gray-600">By incident type</p>
          </CardHeader>
          <div className="space-y-2">
            {(overview?.blocking_chart ?? []).map((b, i) => {
              const maxCount = Math.max(...(overview?.blocking_chart ?? []).map(x => x.count), 1)
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-[10px] font-mono text-gray-500 w-28 truncate flex-shrink-0">{b.reason}</span>
                  <div className="flex-1 h-5 bg-black/50 rounded border border-red-500/10 overflow-hidden">
                    <div className="h-full rounded transition-all"
                      style={{ width: `${(b.count / maxCount) * 100}%`, background: 'rgba(239,68,68,0.6)', boxShadow: '0 0 6px rgba(239,68,68,0.4)' }} />
                  </div>
                  <span className="text-[10px] font-mono text-red-400 w-8 text-right">{b.count}</span>
                </div>
              )
            })}
            {!loading && !(overview?.blocking_chart?.length) && (
              <p className="text-xs font-mono text-gray-700 text-center py-4">// NO DATA</p>
            )}
          </div>
        </Card>

        {/* Combat log */}
        <Card>
          <CardHeader>
            <p className="text-xs font-mono font-medium text-cyan-400 uppercase tracking-widest">Incident Log</p>
            <span className="text-[10px] font-mono text-gray-700 border border-cyan-500/15 px-2 py-0.5 rounded">
              {(overview?.recent_incidents ?? []).length} entries
            </span>
          </CardHeader>
          <CombatLog incidents={overview?.recent_incidents ?? []} />
        </Card>
      </div>
    </DashboardLayout>
  )
}
