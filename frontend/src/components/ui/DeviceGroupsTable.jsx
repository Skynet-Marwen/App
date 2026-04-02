import { useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Eye,
  Fingerprint,
  Link2,
  Monitor,
  Shield,
  Trash2,
  Unlink,
  Users,
} from 'lucide-react'
import { Badge, Button } from './index'

const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : '—'

const riskBadge = (score) => {
  if (score >= 80) return <Badge variant="danger">{score} High</Badge>
  if (score >= 50) return <Badge variant="warning">{score} Medium</Badge>
  return <Badge variant="success">{score} Low</Badge>
}

const groupStatusBadge = (status) => {
  if (status === 'blocked') return <Badge variant="danger">Blocked</Badge>
  if (status === 'mixed') return <Badge variant="warning">Mixed</Badge>
  return <Badge variant="success">Active</Badge>
}

const linkedUserLabel = (group) => {
  if (group.linked_user_state === 'single') return group.linked_user
  if (group.linked_user_state === 'mixed') return 'Mixed'
  return '—'
}

const browserSummary = (devices) => {
  const labels = [...new Set(devices.map((device) => device.browser).filter(Boolean))]
  if (labels.length === 0) return 'Unknown browsers'
  if (labels.length <= 2) return labels.join(' + ')
  return `${labels.slice(0, 2).join(' + ')} +${labels.length - 2}`
}

const groupBadgeVariant = (matchStrength) => {
  if (matchStrength === 'strict') return 'info'
  if (matchStrength === 'probable_mobile') return 'warning'
  return 'default'
}

const evidenceSummary = (group) => {
  if (!Array.isArray(group.match_evidence) || group.match_evidence.length === 0) return null
  return group.match_evidence.join(' + ')
}

export default function DeviceGroupsTable({
  groups,
  loading,
  onViewDevice,
  onOpenLink,
  onOpenDelete,
  onOpenShield,
}) {
  const [expanded, setExpanded] = useState({})

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 bg-black/40 rounded-lg animate-pulse border border-cyan-500/5" />
        ))}
      </div>
    )
  }

  if (groups.length === 0) {
    return (
      <div className="px-4 py-10 text-center text-gray-600 font-mono text-xs border border-cyan-500/10 rounded-xl">
        No device groups found
      </div>
    )
  }

  const toggle = (groupId) => {
    setExpanded((current) => ({ ...current, [groupId]: !current[groupId] }))
  }

  return (
    <div className="overflow-x-auto overscroll-x-contain">
      <div className="min-w-[1080px] overflow-hidden rounded-xl border border-cyan-500/10">
        <div className="grid grid-cols-[minmax(0,2.2fr)_100px_100px_160px_120px_140px_90px] gap-3 px-4 py-3 border-b border-cyan-500/10 text-[10px] font-mono text-gray-500 uppercase tracking-widest bg-black/40">
          <span>Device Cluster</span>
          <span>Prints</span>
          <span>Visitors</span>
          <span>Linked User</span>
          <span>Risk</span>
          <span>Last Seen</span>
          <span>Status</span>
        </div>
        <div className="divide-y divide-cyan-500/5">
          {groups.map((group) => {
            const isExpanded = !!expanded[group.group_id]
            const maxRisk = Math.max(...group.devices.map((device) => device.risk_score ?? 0), 0)
            return (
              <div key={group.group_id} className="bg-black/15">
                <button
                  type="button"
                  onClick={() => toggle(group.group_id)}
                  className="w-full grid grid-cols-[minmax(0,2.2fr)_100px_100px_160px_120px_140px_90px] gap-3 px-4 py-3 text-left hover:bg-cyan-500/4 transition"
                >
                  <div className="min-w-0 flex items-start gap-3">
                    <span className="mt-0.5 text-gray-500">
                      {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm text-white font-medium truncate">
                          {browserSummary(group.devices)}
                        </span>
                        <Badge variant={groupBadgeVariant(group.match_strength)}>
                          {group.match_label}
                        </Badge>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-gray-500 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Monitor size={12} />
                          {group.devices[0]?.os ?? 'Unknown OS'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Fingerprint size={12} />
                          {group.match_key ? group.match_key.slice(0, 18) : group.devices[0]?.fingerprint?.slice(0, 18)}
                          …
                        </span>
                      </div>
                      {evidenceSummary(group) && (
                        <div className="mt-2 text-xs text-gray-500">
                          {evidenceSummary(group)}
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-gray-300 self-center">{group.fingerprint_count}</span>
                  <span className="text-xs text-gray-300 self-center">{group.visitor_count}</span>
                  <span className="text-xs text-cyan-400 self-center truncate">{linkedUserLabel(group)}</span>
                  <span className="self-center">{riskBadge(maxRisk)}</span>
                  <span className="text-xs text-gray-400 self-center">{fmtDate(group.last_seen)}</span>
                  <span className="self-center">{groupStatusBadge(group.status)}</span>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4">
                    <div className="rounded-xl border border-cyan-500/10 bg-black/35 overflow-hidden">
                      {group.devices.map((device, index) => (
                        <div
                          key={device.id}
                          className={`grid grid-cols-[minmax(0,2fr)_160px_100px_140px_1fr] gap-3 px-4 py-3 ${index > 0 ? 'border-t border-cyan-500/5' : ''}`}
                        >
                          <button
                            type="button"
                            onClick={() => onViewDevice(device)}
                            className="min-w-0 text-left hover:text-white transition"
                          >
                            <div className="flex items-center gap-2">
                              <Fingerprint size={13} className="text-cyan-400 flex-shrink-0" />
                              <code className="text-xs text-cyan-400 truncate">{device.fingerprint}</code>
                            </div>
                            <div className="mt-1 text-xs text-gray-500">
                              {device.browser ?? 'Unknown browser'} / {device.os ?? 'Unknown OS'}
                            </div>
                          </button>
                          <div className="text-xs text-gray-400 self-center">
                            <div className="flex items-center gap-1">
                              <Users size={12} className="text-gray-500" />
                              {device.visitor_count ?? 0} visitors
                            </div>
                            <div className="mt-1">{fmtDate(device.last_seen)}</div>
                          </div>
                          <div className="self-center">{riskBadge(device.risk_score ?? 0)}</div>
                          <div className="self-center">
                            {device.status === 'blocked' ? (
                              <Badge variant="danger">Blocked</Badge>
                            ) : (
                              <Badge variant="success">Active</Badge>
                            )}
                          </div>
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            <Button variant="secondary" size="sm" icon={Eye} onClick={() => onViewDevice(device)}>
                              View
                            </Button>
                            <Button
                              variant={device.status === 'blocked' ? 'secondary' : 'danger'}
                              size="sm"
                              icon={Shield}
                              onClick={() => onOpenShield(device)}
                            >
                              {device.status === 'blocked' ? 'Unblock' : 'Block'}
                            </Button>
                            {device.linked_user ? (
                              <Button variant="secondary" size="sm" icon={Unlink} onClick={() => onOpenLink(device)}>
                                Unlink
                              </Button>
                            ) : (
                              <Button variant="secondary" size="sm" icon={Link2} onClick={() => onOpenLink(device)}>
                                Link
                              </Button>
                            )}
                            <Button variant="danger" size="sm" icon={Trash2} onClick={() => onOpenDelete(device)} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
