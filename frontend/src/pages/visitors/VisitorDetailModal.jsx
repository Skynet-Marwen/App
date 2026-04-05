import { Modal } from '../../components/ui'
import TrackingSignalsSummary from '../../components/ui/TrackingSignalsSummary'

export default function VisitorDetailModal({ visitor, onClose }) {
  return (
    <Modal open={!!visitor} onClose={onClose} title="Visitor Details" width="max-w-2xl">
      {visitor && (
        <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.95fr)]">
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {[
                ['IP Address', visitor.ip],
                ['Country', `${visitor.country_flag} ${visitor.country}`],
                ['City', visitor.city],
                ['ISP', visitor.isp],
                ['Device', visitor.device_type],
                ['Browser', visitor.browser],
                ['OS', visitor.os],
                ['Page Views', visitor.page_views],
                ['First Seen', visitor.first_seen],
                ['Last Seen', visitor.last_seen],
                ['Device ID', visitor.device_id],
                ['External User', visitor.external_user_id],
              ].map(([label, value]) => (
                <div key={label} className="bg-gray-800 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-0.5">{label}</p>
                  <p className="text-sm text-white break-all">{value || '—'}</p>
                </div>
              ))}
            </div>

            {visitor.user_agent && (
              <div className="bg-gray-800 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-0.5">User Agent</p>
                <p className="text-xs text-gray-300 font-mono break-all">{visitor.user_agent}</p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            {visitor.linked_user && (
              <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-3">
                <p className="text-xs text-cyan-400 mb-0.5">Linked User</p>
                <p className="text-sm text-white break-all">{visitor.linked_user}</p>
              </div>
            )}

            <TrackingSignalsSummary
              summary={visitor.tracking_signals}
              title="Tracking & Blocker Signals"
              emptyMessage="No adblock, DNS-filter, or ISP-resolution incidents are attached to this visitor yet."
            />
          </div>
        </div>
      )}
    </Modal>
  )
}
