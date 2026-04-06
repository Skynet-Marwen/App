/**
 * IntelligenceTab — Cross-signal analysis and geographic threat patterns.
 * Answers: What signals are active? Where are threats originating? Who is risky?
 */
import SignalIntelligenceCard from './SignalIntelligenceCard'
import ThreatHotspotsCard from './ThreatHotspotsCard'
import RiskLeaderboardCard from './RiskLeaderboardCard'
import AIInsightsPanel from './AIInsightsPanel'

export default function IntelligenceTab({ overview, intelligence, loading, onCountryClick, onOpenUsers }) {
  return (
    <div className="flex flex-col gap-2">

      {/* AI pattern summary */}
      <AIInsightsPanel insights={intelligence?.keyInsights ?? []} loading={loading} />

      {/* 3-col analysis grid */}
      <div className="grid grid-cols-1 gap-2 xl:grid-cols-3" style={{ height: 'calc(100dvh - 230px)', minHeight: '30rem', maxHeight: '54rem' }}>
        <SignalIntelligenceCard
          overview={overview}
          loading={loading}
          className="h-full overflow-hidden"
        />
        <ThreatHotspotsCard
          hotspots={overview?.threat_hotspots ?? []}
          trend={intelligence?.trend}
          onCountryClick={onCountryClick}
          className="h-full overflow-hidden"
        />
        <RiskLeaderboardCard
          leaders={overview?.risk_leaderboard ?? []}
          className="h-full overflow-hidden"
        />
      </div>
    </div>
  )
}
