import { Eye, Users, Monitor, Shield, AlertTriangle, Activity } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '../components/layout/DashboardLayout'
import { Badge, StatCard, Card } from '../components/ui/index'
import { TrafficHeatmap } from '../components/ui/TrafficHeatmap'
import ThreatHotspotsCard from '../components/overview/ThreatHotspotsCard'
import EnforcementPressureCard from '../components/overview/EnforcementPressureCard'
import GatewayOperationsCard from '../components/overview/GatewayOperationsCard'
import PriorityInvestigationsCard from '../components/overview/PriorityInvestigationsCard'
import RiskLeaderboardCard from '../components/overview/RiskLeaderboardCard'
import { useOverview } from '../hooks/useOverview'
import { useUIStore } from '../store/useAppStore'
import { useThemeStore } from '../store/themeStore'
import { themeHasWidget } from '../services/themeEngine'

export default function OverviewPage() {
  const { statsRange } = useUIStore()
  const navigate = useNavigate()
  const currentTheme = useThemeStore((state) => state.currentTheme)
  const { overview, realtime, loading, realtimeSource, refresh } = useOverview(statsRange)
  const showWidget = (widgetId) => themeHasWidget(currentTheme, widgetId)
  const realtimeBadge = realtimeSource === 'websocket'
    ? <Badge variant="success">Live socket</Badge>
    : <Badge variant="warning">Polling fallback</Badge>
  const openVisitorsSearch = (search) => {
    const query = new URLSearchParams()
    if (search) query.set('search', search)
    navigate(`/visitors${query.toString() ? `?${query.toString()}` : ''}`)
  }

  return (
    <DashboardLayout title="Overview" showRange onRefresh={refresh}>

      {/* Realtime HUD banner */}
      {showWidget('realtime-banner') && (
      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-cyan-500/15 px-4 py-3 xl:px-5 animate-border-breathe"
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
          {realtimeBadge}
        </div>
      </div>
      )}

      {/* Stat cards */}
      {showWidget('stat-cards') && (
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <StatCard label="Total Visitors" rawValue={overview?.total_visitors} value={overview?.total_visitors?.toLocaleString() ?? '—'} change={overview?.visitors_change} icon={Eye} color="cyan" loading={loading} />
        <StatCard label="Unique Users"   rawValue={overview?.unique_users}    value={overview?.unique_users?.toLocaleString() ?? '—'}    change={overview?.users_change}    icon={Users} color="blue" loading={loading} />
        <StatCard label="Devices"        rawValue={overview?.total_devices}   value={overview?.total_devices?.toLocaleString() ?? '—'}   icon={Monitor} color="purple" loading={loading} />
        <StatCard label="Blocked"        rawValue={overview?.total_blocked}   value={overview?.total_blocked?.toLocaleString() ?? '—'}   change={overview?.blocked_change}  icon={Shield} color="red" loading={loading} />
        <StatCard label="Evasion"        rawValue={overview?.evasion_attempts} value={overview?.evasion_attempts?.toLocaleString() ?? '—'} icon={AlertTriangle} color="yellow" loading={loading} />
        <StatCard label="Spam"           rawValue={overview?.spam_detected}   value={overview?.spam_detected?.toLocaleString() ?? '—'}   icon={Activity} color="green" loading={loading} />
      </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">

        {/* Traffic — Heatmap */}
        {showWidget('traffic-heatmap') && (
        <Card className="xl:col-span-2 !p-0">
          <div className="p-5 pb-3">
            <p className="text-xs font-mono font-medium text-cyan-400 uppercase tracking-widest">Traffic Intensity</p>
            <p className="text-[10px] font-mono text-gray-600 mt-0.5">Request volume heatmap</p>
          </div>
          <div className="px-5 pb-5">
            <TrafficHeatmap data={overview?.traffic_heatmap} range={statsRange} />
          </div>
        </Card>
        )}

        {showWidget('threat-hotspots') && (
        <ThreatHotspotsCard
          hotspots={overview?.threat_hotspots ?? []}
          fallbackCountries={overview?.top_countries ?? []}
          onCountryClick={(item) => openVisitorsSearch(item?.country || item?.top_reason || '')}
        />
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
        {showWidget('enforcement-pressure') && (
        <EnforcementPressureCard
          pressure={overview?.enforcement_pressure}
          fallbackChart={overview?.blocking_chart ?? []}
          loading={loading}
        />
        )}
        {showWidget('gateway-operations') && (
        <GatewayOperationsCard
          gateway={overview?.gateway_dashboard}
          loading={loading}
        />
        )}
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {showWidget('risk-leaderboard') && (
        <RiskLeaderboardCard
          leaders={overview?.risk_leaderboard ?? []}
        />
        )}
        {showWidget('priority-investigations') && (
        <PriorityInvestigationsCard
          investigations={overview?.priority_investigations ?? []}
          fallbackIncidents={overview?.recent_incidents ?? []}
          onInspect={(item) => openVisitorsSearch(item?.target_label || item?.title || '')}
        />
        )}
      </div>
    </DashboardLayout>
  )
}
