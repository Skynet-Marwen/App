/**
 * StatsTab — Historical analytics, gateway ops, and enforcement metrics.
 * Answers: What does traffic look like over time? How is enforcement performing?
 */
import { Eye, Users, Monitor, Shield, AlertTriangle, Activity } from 'lucide-react'
import { Card, StatCard } from '../ui/index'
import { TrafficHeatmap } from '../ui/TrafficHeatmap'
import EnforcementPressureCard from './EnforcementPressureCard'
import GatewayOperationsCard from './GatewayOperationsCard'
import { useUIStore } from '../../store/useAppStore'

export default function StatsTab({ overview, loading }) {
  const { statsRange } = useUIStore()

  return (
    <div className="flex flex-col gap-3">

      {/* Stat cards — full version with change indicators */}
      <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Total Visitors" rawValue={overview?.total_visitors} value={overview?.total_visitors?.toLocaleString() ?? '—'} change={overview?.visitors_change} icon={Eye}          color="cyan"   loading={loading} nano />
        <StatCard label="Unique Users"   rawValue={overview?.unique_users}   value={overview?.unique_users?.toLocaleString() ?? '—'}   change={overview?.users_change}    icon={Users}        color="blue"   loading={loading} nano />
        <StatCard label="Devices"        rawValue={overview?.total_devices}  value={overview?.total_devices?.toLocaleString() ?? '—'}                                     icon={Monitor}      color="purple" loading={loading} nano />
        <StatCard label="Blocked"        rawValue={overview?.total_blocked}  value={overview?.total_blocked?.toLocaleString() ?? '—'}  change={overview?.blocked_change}  icon={Shield}       color="red"    loading={loading} nano />
        <StatCard label="Evasion"        rawValue={overview?.evasion_attempts} value={overview?.evasion_attempts?.toLocaleString() ?? '—'}                                icon={AlertTriangle} color="yellow" loading={loading} nano />
        <StatCard label="Spam"           rawValue={overview?.spam_detected}  value={overview?.spam_detected?.toLocaleString() ?? '—'}                                    icon={Activity}     color="green"  loading={loading} nano />
      </div>

      {/* Traffic heatmap + enforcement side-by-side */}
      <div className="grid grid-cols-1 gap-2 xl:grid-cols-2 xl:h-[18rem]">
        <Card className="h-full">
          <div className="flex h-full min-h-0 flex-col">
            <p className="mb-2 shrink-0 text-xs font-mono font-medium text-cyan-400 uppercase tracking-widest">Traffic Intensity</p>
            <TrafficHeatmap data={overview?.traffic_heatmap} range={statsRange} fill className="min-h-0 flex-1" />
          </div>
        </Card>
        <EnforcementPressureCard pressure={overview?.enforcement_pressure} loading={loading} className="h-full overflow-hidden" />
      </div>

      {/* Gateway operations — full width */}
      <GatewayOperationsCard gateway={overview?.gateway_dashboard} loading={loading} />
    </div>
  )
}
