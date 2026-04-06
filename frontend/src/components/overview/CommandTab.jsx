/**
 * CommandTab — Full incident queue and identity risk ranking.
 * Answers: What incidents need action? Who are the highest-risk identities?
 */
import { useNavigate } from 'react-router-dom'
import CommandHeader from './CommandHeader'
import PriorityInvestigationsCard from './PriorityInvestigationsCard'
import RiskLeaderboardCard from './RiskLeaderboardCard'
import SignalIntelligenceCard from './SignalIntelligenceCard'

export default function CommandTab({ overview, intelligence, loading, onInspect }) {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col gap-2">

      {/* Status bar */}
      <CommandHeader state={intelligence} loading={loading} compact />

      {/* Full action grid */}
      <div className="grid grid-cols-1 gap-2 xl:grid-cols-3" style={{ height: 'calc(100dvh - 240px)', minHeight: '30rem', maxHeight: '52rem' }}>
        {/* Investigations gets 2/3 width on xl */}
        <div className="xl:col-span-2 h-full overflow-hidden">
          <PriorityInvestigationsCard
            investigations={overview?.priority_investigations ?? []}
            onInspect={onInspect}
            className="h-full"
          />
        </div>

        {/* Risk Leaderboard */}
        <RiskLeaderboardCard
          leaders={overview?.risk_leaderboard ?? []}
          className="h-full overflow-hidden"
        />
      </div>
    </div>
  )
}
