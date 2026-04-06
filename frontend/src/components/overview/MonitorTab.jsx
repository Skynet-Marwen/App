/**
 * MonitorTab — Viewport-fit operational overview.
 * Target: zero vertical scroll at 1366×768 @ 100% zoom.
 * Layout budget (768px viewport):
 *   Topbar ~48px + DashboardTabs ~44px + layout gaps ~20px = ~112px chrome
 *   → available: ~656px
 *   Status bar  ~40px + gap 8px
 *   Chip strip  ~30px + gap 8px
 *   Main grid   ~570px  (uses remaining space)
 */
import { Eye, Users, Monitor, Shield, AlertTriangle, Activity } from 'lucide-react'
import CommandHeader from './CommandHeader'
import PriorityInvestigationsCard from './PriorityInvestigationsCard'
import MonitorIntelPanel from './MonitorIntelPanel'

// ── Stat chips ─────────────────────────────────────────────────────────────────
const CHIP_COLORS = {
  cyan:   'text-cyan-400',
  blue:   'text-blue-400',
  purple: 'text-purple-400',
  red:    'text-red-400',
  yellow: 'text-yellow-400',
  green:  'text-green-400',
}

function StatChip({ label, value, color = 'cyan', Icon, loading }) {
  const tc = CHIP_COLORS[color] ?? 'text-gray-400'
  return (
    <span className="flex items-center gap-1.5 shrink-0">
      {Icon && <Icon size={10} className={tc} />}
      <span className="text-[9px] font-mono uppercase tracking-widest text-gray-600">{label}</span>
      {loading
        ? <span className="h-2.5 w-8 rounded bg-gray-800/60 animate-pulse inline-block" />
        : <span className={`text-[11px] font-mono font-bold ${tc}`}>{value ?? '—'}</span>
      }
    </span>
  )
}

function StatChipBar({ overview, loading }) {
  const v = overview
  return (
    <div className="flex items-center gap-0 overflow-x-auto rounded-lg border border-cyan-500/10 bg-black/25 px-3 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden shrink-0">
      <StatChip label="Visitors" value={v?.total_visitors?.toLocaleString()} color="cyan"   Icon={Eye}           loading={loading} />
      <span className="mx-3 shrink-0 text-gray-800 select-none">|</span>
      <StatChip label="Users"    value={v?.unique_users?.toLocaleString()}   color="blue"   Icon={Users}         loading={loading} />
      <span className="mx-3 shrink-0 text-gray-800 select-none">|</span>
      <StatChip label="Devices"  value={v?.total_devices?.toLocaleString()}  color="purple" Icon={Monitor}       loading={loading} />
      <span className="mx-3 shrink-0 text-gray-800 select-none">|</span>
      <StatChip label="Blocked"  value={v?.total_blocked?.toLocaleString()}  color="red"    Icon={Shield}        loading={loading} />
      <span className="mx-3 shrink-0 text-gray-800 select-none">|</span>
      <StatChip label="Evasion"  value={v?.evasion_attempts?.toLocaleString()} color="yellow" Icon={AlertTriangle} loading={loading} />
      <span className="mx-3 shrink-0 text-gray-800 select-none">|</span>
      <StatChip label="Spam"     value={v?.spam_detected?.toLocaleString()}  color="green"  Icon={Activity}      loading={loading} />
    </div>
  )
}

// ── Tab ────────────────────────────────────────────────────────────────────────
export default function MonitorTab({ overview, intelligence, loading, onInspect, onCountryClick }) {
  return (
    <div className="flex flex-col gap-2" style={{ height: 'calc(100dvh - 114px)', minHeight: '34rem' }}>

      {/* Row 1 — Compact status bar ~40px */}
      <CommandHeader state={intelligence} loading={loading} compact />

      {/* Row 2 — Inline stat chips ~30px */}
      <StatChipBar overview={overview} loading={loading} />

      {/* Row 3 — Main grid: fills all remaining height */}
      <div className="grid grid-cols-1 gap-2 min-h-0 flex-1 xl:grid-cols-[60fr_40fr]">

        {/* Left 60%: full incident queue, dense single-line rows */}
        <PriorityInvestigationsCard
          investigations={overview?.priority_investigations ?? []}
          onInspect={onInspect}
          dense
          className="h-full overflow-hidden"
        />

        {/* Right 40%: merged signals + regions panel */}
        <MonitorIntelPanel
          overview={overview}
          intelligence={intelligence}
          loading={loading}
          onCountryClick={onCountryClick}
          className="h-full overflow-hidden"
        />
      </div>
    </div>
  )
}
