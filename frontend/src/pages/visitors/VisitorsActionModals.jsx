import { Ban, Trash2 } from 'lucide-react'
import { Button, Input, Modal } from '../../components/ui'

export default function VisitorsActionModals({
  blockModal,
  blockReason,
  setBlockReason,
  onCloseBlock,
  onConfirmBlock,
  blocking,
  deleteTarget,
  onCloseDelete,
  onConfirmDelete,
  deleting,
}) {
  return (
    <>
      <Modal open={!!deleteTarget} onClose={onCloseDelete} title="Delete Visitor">
        <div className="space-y-4">
          <p className="text-sm text-gray-400">
            Permanently delete visitor <code className="text-cyan-400">{deleteTarget?.ip}</code>?
            <br />
            <span className="text-red-400">All events for this visitor will be deleted. Linked device will be unlinked.</span>
          </p>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={onCloseDelete}>Cancel</Button>
            <Button variant="danger" loading={deleting} onClick={onConfirmDelete} icon={Trash2}>Delete</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!blockModal} onClose={onCloseBlock} title="Block Visitor">
        <div className="space-y-4">
          <p className="text-sm text-gray-400">
            {blockModal?.ids?.length === 1 ? (
              <>
                Block IP <code className="text-cyan-400">{blockModal?.ips?.[0] || blockModal?.label}</code> from all tracked sites?
              </>
            ) : (
              <>
                Block <code className="text-cyan-400">{blockModal?.label}</code> from all tracked sites?
              </>
            )}
          </p>
          <Input
            label="Reason (optional)"
            placeholder="Spam, abuse, investigation, etc."
            value={blockReason}
            onChange={(e) => setBlockReason(e.target.value)}
          />
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={onCloseBlock}>Cancel</Button>
            <Button variant="danger" loading={blocking} onClick={onConfirmBlock} icon={Ban}>
              Block
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
