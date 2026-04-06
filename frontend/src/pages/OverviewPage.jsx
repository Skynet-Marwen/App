import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '../components/layout/DashboardLayout'
import DashboardTabs from '../components/overview/DashboardTabs'
import MonitorTab from '../components/overview/MonitorTab'
import CommandTab from '../components/overview/CommandTab'
import IntelligenceTab from '../components/overview/IntelligenceTab'
import StatsTab from '../components/overview/StatsTab'
import PriorityInvestigationModal from '../components/overview/PriorityInvestigationModal'
import { useOverview } from '../hooks/useOverview'
import { antiEvasionApi } from '../services/api'
import { useUIStore, useRuntimeSettingsStore } from '../store/useAppStore'
import { useThemeStore } from '../store/themeStore'
import { generateGlobalSecurityState } from '../utils/securityIntelligence'

export default function OverviewPage() {
  const { statsRange } = useUIStore()
  const navigate = useNavigate()
  const currentTheme = useThemeStore((state) => state.currentTheme)
  const fetchRuntimeSettings = useRuntimeSettingsStore((state) => state.fetchRuntimeSettings)
  const { overview, loading, refresh } = useOverview(statsRange)

  const [activeTab, setActiveTab] = useState('monitor')
  const [selectedInvestigation, setSelectedInvestigation] = useState(null)
  const [investigationDetail, setInvestigationDetail] = useState(null)
  const [investigationLoading, setInvestigationLoading] = useState(false)
  const [investigationError, setInvestigationError] = useState('')

  useEffect(() => { fetchRuntimeSettings().catch(() => {}) }, [fetchRuntimeSettings])

  const intelligence = useMemo(() => generateGlobalSecurityState(overview), [overview])

  // Alert badge counts per tab
  const alertCounts = useMemo(() => {
    const criticalInv = (overview?.priority_investigations ?? []).filter((i) => i.severity === 'critical').length
    const criticalIds = (overview?.risk_leaderboard ?? []).filter((l) => Number(l.current_risk_score) >= 0.8).length
    return {
      monitor:      criticalInv,
      command:      criticalInv,
      intelligence: criticalIds,
      stats:        0,
    }
  }, [overview])

  const openVisitorsSearch = (search) => {
    const q = new URLSearchParams()
    if (search) q.set('search', search)
    navigate(`/visitors${q.toString() ? `?${q}` : ''}`)
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

  const handleCountryClick = (item) => openVisitorsSearch(item?.country || item?.top_reason || '')

  const tabProps = { overview, intelligence, loading }

  return (
    <DashboardLayout title="Security Command Center" showRange onRefresh={refresh}>
      <DashboardTabs active={activeTab} onChange={setActiveTab} alertCounts={alertCounts} />

      {activeTab === 'monitor' && (
        <MonitorTab
          {...tabProps}
          onInspect={openInvestigation}
          onCountryClick={handleCountryClick}
        />
      )}

      {activeTab === 'command' && (
        <CommandTab
          {...tabProps}
          onInspect={openInvestigation}
        />
      )}

      {activeTab === 'intelligence' && (
        <IntelligenceTab
          {...tabProps}
          onCountryClick={handleCountryClick}
          onOpenUsers={() => navigate('/users')}
        />
      )}

      {activeTab === 'stats' && (
        <StatsTab overview={overview} loading={loading} />
      )}

      <PriorityInvestigationModal
        open={!!selectedInvestigation}
        loading={investigationLoading}
        error={investigationError}
        investigation={investigationDetail || selectedInvestigation}
        onClose={closeInvestigation}
        onOpenVisitors={(visitor) => { closeInvestigation(); openVisitorsSearch(visitor?.ip || visitor?.id || '') }}
        onOpenUsers={() => { closeInvestigation(); navigate('/users') }}
        onOpenDevices={(device) => { closeInvestigation(); navigate('/devices', { state: { investigationDeviceId: device?.id, investigationFingerprint: device?.fingerprint } }) }}
      />
    </DashboardLayout>
  )
}
