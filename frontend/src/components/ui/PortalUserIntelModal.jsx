/**
 * PortalUserIntelModal — Multi-angle decision workspace.
 * Layout: Persistent Decision Header → Tab bar → Tab content
 * Tabs: Overview | Identity | Timeline | Audit | Raw Data
 */
import { useState } from 'react'
import { Download, RefreshCw, ShieldCheck, ShieldOff, Trash2 } from 'lucide-react'
import { Badge, Button } from './index'
import { OverviewTab, IdentityTab, TimelineTab } from './PortalUserIntelSections'
import { AuditTab, RawDataTab } from './PortalUserIntelAudit'
import { generateRiskNarrative } from '../../utils/riskNarrative'

const pretty      = (v) => v ? v.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '—'
const trustVariant = (t) => t === 'blocked' ? 'danger' : t === 'suspicious' ? 'warning' : t === 'trusted' ? 'info' : 'success'
const confVariant  = (k) => k === 'high' ? 'success' : k === 'medium' ? 'warning' : 'default'

// ─── Decision Header (persistent, above all tabs) ────────────────────────────

function DecisionHeader({ profile, devices, flags, narrative, busyAction, onRecompute, onAuditToggle, onDelete, onExportDetail, onTrustLevel }) {
  const { score, label: riskLabel, color: riskColor, border: riskBorder, bg: riskBg, recommendedAction: action, confidence, trend } = narrative
  const tl = profile?.trust_level

  return (
    <div className={`rounded-xl border ${riskBorder} ${riskBg} p-4 space-y-3`}>
      {/* Row 1: score + identity + action buttons */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4 min-w-0 flex-1">
          {/* Score block */}
          <div className="text-center flex-shrink-0 w-14">
            <p className={`text-5xl font-black font-mono leading-none ${riskColor}`}>{score}</p>
            <p className={`text-[10px] font-bold uppercase tracking-wider mt-1 ${riskColor}`}>{riskLabel}</p>
          </div>
          {/* Identity + badges */}
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold text-white truncate">
              {profile?.display_name || profile?.email || 'Unknown User'}
            </p>
            <p className="text-xs text-gray-400 truncate">{profile?.email}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Badge variant={trustVariant(tl)}>{pretty(tl)}</Badge>
              <Badge variant={confVariant(confidence.key)}>{confidence.key} conf.</Badge>
              <span className={`text-xs font-mono ${trend.color}`}>{trend.label}</span>
              {trend.spikeDetected && <Badge variant="danger">Spike</Badge>}
              {(flags || []).filter((f) => f.status === 'open').length > 0 && (
                <Badge variant="danger">{(flags || []).filter((f) => f.status === 'open').length} open flags</Badge>
              )}
            </div>
            <div className="mt-1.5 grid grid-cols-3 gap-x-3 text-[10px] font-mono text-gray-500">
              <span>Devices: <span className="text-gray-300">{(devices || []).length}</span></span>
              <span>Sessions: <span className="text-gray-300">{profile?.total_sessions ?? 0}</span></span>
              <span>First seen: <span className="text-gray-400">{profile?.first_seen ? new Date(profile.first_seen).toLocaleDateString() : '—'}</span></span>
            </div>
          </div>
        </div>
        {/* Action columns */}
        <div className="flex flex-col gap-2 flex-shrink-0">
          {/* Primary: Trust / Flag / Block */}
          <div className="flex gap-1.5">
            <Button size="sm" variant={tl === 'trusted'    ? 'neon'      : 'ghost'} onClick={() => onTrustLevel?.('trusted')}>Trust</Button>
            <Button size="sm" variant={tl === 'suspicious' ? 'secondary' : 'ghost'} onClick={() => onTrustLevel?.('suspicious')}>Flag</Button>
            <Button size="sm" variant={tl === 'blocked'    ? 'danger'    : 'ghost'} onClick={() => onTrustLevel?.('blocked')}>Block</Button>
          </div>
          {/* Secondary: system actions */}
          <div className="flex gap-1.5 flex-wrap">
            <Button size="sm" icon={RefreshCw} loading={busyAction.startsWith('recompute')} onClick={onRecompute}>Recompute</Button>
            <Button size="sm" variant={profile?.enhanced_audit ? 'secondary' : 'neon'}
              icon={profile?.enhanced_audit ? ShieldOff : ShieldCheck}
              loading={busyAction.startsWith('audit')} onClick={() => onAuditToggle(!profile?.enhanced_audit)}>
              {profile?.enhanced_audit ? 'Audit Off' : 'Audit On'}
            </Button>
            <Button size="sm" variant="ghost" icon={Download} loading={busyAction.startsWith('export-detail')} onClick={() => onExportDetail('json')}>Export</Button>
            <Button size="sm" variant="danger" icon={Trash2} loading={busyAction.startsWith('delete')} onClick={onDelete} />
          </div>
        </div>
      </div>
      {/* Row 2: Recommendation strip */}
      <div className={`rounded-lg border px-3 py-2 flex items-center justify-between gap-4 ${action.bg}`}>
        <p className="text-[10px] font-mono uppercase tracking-wider text-gray-500">System Recommendation</p>
        <p className={`text-sm font-bold font-mono ${action.color}`}>{action.label}</p>
      </div>
    </div>
  )
}

// ─── Tab Bar ─────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'overview',  label: 'Overview',  question: 'What is the situation?' },
  { id: 'identity',  label: 'Identity',  question: 'Who is this entity?' },
  { id: 'timeline',  label: 'Timeline',  question: 'What happened and when?' },
  { id: 'audit',     label: 'Audit',     question: 'What decisions were made?' },
  { id: 'raw',       label: 'Raw Data',  question: 'Full technical payload' },
]

function TabBar({ active, onChange, openFlagCount, deviceCount }) {
  return (
    <div className="flex items-center gap-0.5 rounded-xl border border-cyan-500/10 bg-black/20 p-1 overflow-x-auto">
      {TABS.map((t) => {
        const isActive = active === t.id
        const badge = t.id === 'audit' && openFlagCount > 0 ? openFlagCount : t.id === 'identity' && deviceCount > 0 ? deviceCount : null
        return (
          <button key={t.id} type="button" onClick={() => onChange(t.id)}
            title={t.question}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition whitespace-nowrap ${
              isActive ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/20' : 'text-gray-500 hover:text-gray-300'
            }`}>
            {t.label}
            {badge != null && (
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${isActive ? 'bg-cyan-500/30 text-cyan-200' : 'bg-gray-700 text-gray-400'}`}>
                {badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ─── Main Export ─────────────────────────────────────────────────────────────

export default function PortalUserIntelModal({
  profile, detail, riskHistoryData, detailLoading,
  activityLoading, activityFilters,
  busyAction, onRecompute, onAuditToggle, onDelete, onExportDetail,
  onFlagAction, onTrustLevel, onEventType, onPlatform, onActivityPage,
}) {
  const [tab, setTab] = useState('overview')
  if (!profile) return null

  const narrative = generateRiskNarrative({
    profile, devices: detail.devices, visitors: detail.visitors,
    flags: detail.flags, riskHistory: detail.riskHistory,
  })
  const openFlagCount = (detail.flags || []).filter((f) => f.status === 'open').length

  return (
    <div className="space-y-4">
      <DecisionHeader
        profile={profile} devices={detail.devices} flags={detail.flags} narrative={narrative}
        busyAction={busyAction} onRecompute={onRecompute} onAuditToggle={onAuditToggle}
        onDelete={onDelete} onExportDetail={onExportDetail} onTrustLevel={onTrustLevel}
      />

      <TabBar active={tab} onChange={setTab} openFlagCount={openFlagCount} deviceCount={detail.devices.length} />

      {tab === 'overview' && (
        <OverviewTab narrative={narrative} />
      )}
      {tab === 'identity' && (
        <IdentityTab profile={profile} devices={narrative.rankedDevices} visitors={detail.visitors} />
      )}
      {tab === 'timeline' && (
        <TimelineTab riskHistoryData={riskHistoryData} narrative={narrative} activity={detail.activity} flags={detail.flags} />
      )}
      {tab === 'audit' && (
        <AuditTab
          flags={detail.flags} activity={detail.activity} activityLoading={activityLoading}
          activityFilters={activityFilters} activityTotal={detail.activityTotal}
          busyAction={busyAction} onFlagAction={onFlagAction}
          onEventType={onEventType} onPlatform={onPlatform} onPage={onActivityPage}
        />
      )}
      {tab === 'raw' && (
        <RawDataTab profile={profile} devices={detail.devices} visitors={detail.visitors} signals={narrative.signals} flags={detail.flags} />
      )}

      {detailLoading && <p className="text-xs font-mono text-gray-600 text-center">Refreshing intelligence…</p>}
    </div>
  )
}
