import { Modal } from '../../components/ui'

export default function VisitorDetailModal({ visitor, onClose }) {
  return (
    <Modal open={!!visitor} onClose={onClose} title="Visitor Details" width="max-w-2xl">
      {visitor && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
            ].map(([label, value]) => (
              <div key={label} className="bg-gray-800 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-0.5">{label}</p>
                <p className="text-sm text-white">{value || '—'}</p>
              </div>
            ))}
          </div>
          {visitor.user_agent && (
            <div className="bg-gray-800 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-0.5">User Agent</p>
              <p className="text-xs text-gray-300 font-mono break-all">{visitor.user_agent}</p>
            </div>
          )}
          {visitor.linked_user && (
            <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-3">
              <p className="text-xs text-cyan-400 mb-0.5">Linked User</p>
              <p className="text-sm text-white">{visitor.linked_user}</p>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
