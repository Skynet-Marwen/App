import { useEffect, useState } from 'react'
import { Eye, Users, Monitor, Shield, AlertTriangle, Activity } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '../components/layout/DashboardLayout'
import { StatCard, Card } from '../components/ui/index'
import { TrafficHeatmap } from '../components/ui/TrafficHeatmap'
import ThreatHotspotsCard from '../components/overview/ThreatHotspotsCard'
import EnforcementPressureCard from '../components/overview/EnforcementPressureCard'
import GatewayOperationsCard from '../components/overview/GatewayOperationsCard'
import PriorityInvestigationsCard from '../components/overview/PriorityInvestigationsCard'
import PriorityInvestigationModal from '../components/overview/PriorityInvestigationModal'
import RiskLeaderboardCard from '../components/overview/RiskLeaderboardCard'
import { useOverview } from '../hooks/useOverview'
import { antiEvasionApi } from '../services/api'
import { useUIStore, useRuntimeSettingsStore } from '../store/useAppStore'
import { useThemeStore } from '../store/themeStore'
import { themeHasWidget } from '../services/themeEngine'
import { isUiVisible } from '../services/uiVisibility'

const OVERVIEW_VISIBILITY_KEYS = {
  'realtime-banner': 'realtime_banner',
  'stat-cards': 'stat_cards',
  'traffic-heatmap': 'traffic_heatmap',
  'threat-hotspots': 'threat_hotspots',
  'enforcement-pressure': 'enforcement_pressure',
  'gateway-operations': 'gateway_operations',
  'risk-leaderboard': 'risk_leaderboard',
  'priority-investigations': 'priority_investigations',
}

export default function OverviewPage() {
  const { statsRange } = useUIStore()
  const navigate = useNavigate()
  const currentTheme = useThemeStore((state) => state.currentTheme)
  const uiVisibility = useRuntimeSettingsStore((state) => state.uiVisibility)
  const fetchRuntimeSettings = useRuntimeSettingsStore((state) => state.fetchRuntimeSettings)
  const { overview, loading, refresh } = useOverview(statsRange)
  const [selectedInvestigation, setSelectedInvestigation] = useState(null)
  const [investigationDetail, setInvestigationDetail] = useState(null)
  const [investigationLoading, setInvestigationLoading] = useState(false)
  const [investigationError, setInvestigationError] = useState('')

  useEffect(() => {
    fetchRuntimeSettings().catch(() => {})
  }, [fetchRuntimeSettings])

  const showWidget = (widgetId) =>
    themeHasWidget(currentTheme, widgetId) &&
    isUiVisible(uiVisibility, `overview.${OVERVIEW_VISIBILITY_KEYS[widgetId]}`)
  const showStatCards = showWidget('stat-cards')
  const showTrafficHeatmap = showWidget('traffic-heatmap')
  const showThreatHotspots = showWidget('threat-hotspots')
  const showEnforcementPressure = showWidget('enforcement-pressure')
  const showGatewayOperations = showWidget('gateway-operations')
  const showRiskLeaderboard = showWidget('risk-leaderboard')
  const showPriorityInvestigations = showWidget('priority-investigations')
  const openVisitorsSearch = (search) => {
    const query = new URLSearchParams()
    if (search) query.set('search', search)
    navigate(`/visitors${query.toString() ? `?${query.toString()}` : ''}`)
  }
  const openInvestigation = async (item) => {
    setSelectedInvestigation(item)
    setInvestigationDetail(null)
    setInvestigationError('')
    setInvestigationLoading(true)
    try {
      const res = await antiEvasionApi.incident(item.id)
      setInvestigationDetail(res.data)
    } catch (err) {
      setInvestigationError(err.response?.data?.detail || 'Failed to load investigation detail')
    } finally {
      setInvestigationLoading(false)
    }
  }
  const closeInvestigation = () => {
    setSelectedInvestigation(null)
    setInvestigationDetail(null)
    setInvestigationError('')
    setInvestigationLoading(false)
  }

  return (
      <DashboardLayout title="Overview" showRange onRefresh={refresh}>

      {/* Stat cards */}
      {showStatCards && (
      <div className="mb-1 grid grid-cols-2 gap-1 sm:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Total Visitors" rawValue={overview?.total_visitors} value={overview?.total_visitors?.toLocaleString() ?? '—'} change={overview?.visitors_change} icon={Eye} color="cyan" loading={loading} nano />
        <StatCard label="Unique Users"   rawValue={overview?.unique_users}    value={overview?.unique_users?.toLocaleString() ?? '—'}    change={overview?.users_change}    icon={Users} color="blue" loading={loading} nano />
        <StatCard label="Devices"        rawValue={overview?.total_devices}   value={overview?.total_devices?.toLocaleString() ?? '—'}   icon={Monitor} color="purple" loading={loading} nano />
        <StatCard label="Blocked"        rawValue={overview?.total_blocked}   value={overview?.total_blocked?.toLocaleString() ?? '—'}   change={overview?.blocked_change}  icon={Shield} color="red" loading={loading} nano />
        <StatCard label="Evasion"        rawValue={overview?.evasion_attempts} value={overview?.evasion_attempts?.toLocaleString() ?? '—'} icon={AlertTriangle} color="yellow" loading={loading} nano />
        <StatCard label="Spam"           rawValue={overview?.spam_detected}   value={overview?.spam_detected?.toLocaleString() ?? '—'}   icon={Activity} color="green" loading={loading} nano />
      </div>
      )}

      {/* Heatmap + Threat Hotspots + Enforcement Pressure — 3-column equal row */}
      {(showTrafficHeatmap || showThreatHotspots || showEnforcementPressure) && (
      <div className="grid grid-cols-1 gap-1.5 xl:grid-cols-3 xl:h-[20rem]">
        {showTrafficHeatmap && (
        <Card className="h-full">
          <div className="flex h-full min-h-0 flex-col">
            <p className="mb-2 shrink-0 text-xs font-mono font-medium text-cyan-400 uppercase tracking-widest">Traffic Intensity</p>
            <TrafficHeatmap data={overview?.traffic_heatmap} range={statsRange} fill className="min-h-0 flex-1" />
          </div>
        </Card>
        )}
        {showThreatHotspots && (
        <ThreatHotspotsCard
          hotspots={overview?.threat_hotspots ?? []}
          onCountryClick={(item) => openVisitorsSearch(item?.country || item?.top_reason || '')}
          className="h-full"
        />
        )}
        {showEnforcementPressure && (
        <EnforcementPressureCard
          pressure={overview?.enforcement_pressure}
          loading={loading}
          className="h-full"
        />
        )}
      </div>
      )}

      {/* Gateway Operations — full width */}
      {showGatewayOperations && (
      <GatewayOperationsCard
        gateway={overview?.gateway_dashboard}
        loading={loading}
        className="w-full"
      />
      )}

      {/* Bottom row: Risk Leaderboard + Priority Investigations */}
      {(showRiskLeaderboard || showPriorityInvestigations) && (
      <div className="grid grid-cols-1 gap-2 xl:auto-rows-fr xl:grid-cols-2">
        {showRiskLeaderboard && (
        <RiskLeaderboardCard
          leaders={overview?.risk_leaderboard ?? []}
          className="xl:h-[32rem]"
        />
        )}
        {showPriorityInvestigations && (
        <PriorityInvestigationsCard
          investigations={overview?.priority_investigations ?? []}
          onInspect={openInvestigation}
          className="xl:h-[32rem]"
        />
        )}
      </div>
      )}

      <PriorityInvestigationModal
        open={!!selectedInvestigation}
        loading={investigationLoading}
        error={investigationError}
        investigation={investigationDetail || selectedInvestigation}
        onClose={closeInvestigation}
        onOpenVisitors={(visitor) => {
          closeInvestigation()
          openVisitorsSearch(visitor?.ip || visitor?.id || '')
        }}
        onOpenUsers={() => {
          closeInvestigation()
          navigate('/users')
        }}
        onOpenDevices={(device) => {
          closeInvestigation()
          navigate('/devices', { state: { investigationDeviceId: device?.id, investigationFingerprint: device?.fingerprint } })
        }}
      />
    </DashboardLayout>
  )
}
