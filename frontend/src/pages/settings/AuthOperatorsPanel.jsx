import { useState } from 'react'
import { Search, UserPlus, Ban, Key, LogOut, Pencil, Trash2, Copy, Check } from 'lucide-react'
import { Card, CardHeader, Table, Badge, Button, Input, Pagination, Modal, Select, Alert } from '../../components/ui/index'
import { useUsers } from '../../hooks/useUsers'
import { useUserSessions } from '../../hooks/useUserSessions'

const roleBadge = (r) => {
  if (r === 'admin') return <Badge variant="purple">Admin</Badge>
  if (r === 'moderator') return <Badge variant="info">Moderator</Badge>
  return <Badge variant="default">User</Badge>
}
const statusBadge = (s) => {
  if (s === 'blocked') return <Badge variant="danger">Blocked</Badge>
  if (s === 'pending') return <Badge variant="warning">Pending</Badge>
  return <Badge variant="success">Active</Badge>
}

const EMPTY = { email: '', username: '', role: 'user', password: '' }

export default function AuthOperatorsPanel() {
  const { users, total, page, search, loading, setPage, setSearch, refresh,
          createUser, updateUser, deleteUser, blockUser, unblockUser, resetPassword } = useUsers()
  const [selected, setSelected]     = useState(null)
  const [createModal, setCreate]    = useState(false)
  const [blockModal, setBlock]      = useState(null)
  const [editModal, setEdit]        = useState(null)
  const [deleteModal, setDelete]    = useState(null)
  const [resetResult, setResetResult] = useState(null)
  const [copied, setCopied]         = useState(false)
  const [form, setForm]             = useState(EMPTY)
  const [editForm, setEditForm]     = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState('')
  const [editError, setEditError]   = useState('')
  const { sessions, revoke }        = useUserSessions(selected?.id)

  const handleCreate = async () => {
    setError('')
    setSubmitting(true)
    try {
      await createUser(form)
      setCreate(false)
      setForm(EMPTY)
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed')
    } finally { setSubmitting(false) }
  }

  const handleBlock = async () => {
    if (!blockModal) return
    setSubmitting(true)
    try { await blockUser(blockModal.id); setBlock(null) }
    catch (_) {} finally { setSubmitting(false) }
  }

  const handleUpdate = async () => {
    setEditError('')
    setSubmitting(true)
    try {
      await updateUser(editModal.id, editForm)
      setEdit(null)
      if (selected?.id === editModal.id) setSelected((s) => ({ ...s, ...editForm }))
    } catch (e) {
      setEditError(e.response?.data?.detail || 'Failed')
    } finally { setSubmitting(false) }
  }

  const handleDelete = async () => {
    setSubmitting(true)
    try { await deleteUser(deleteModal.id); setDelete(null); setSelected(null) }
    catch (_) {} finally { setSubmitting(false) }
  }

  const handleReset = async (user) => {
    setSubmitting(true)
    try {
      const data = await resetPassword(user.id)
      setResetResult({ username: user.username, ...data })
    } catch (_) {} finally { setSubmitting(false) }
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const columns = [
    { key: 'avatar', label: '', width: '44px',
      render: (_, r) => (
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-xs font-bold text-white">
          {(r.username?.[0] ?? r.email?.[0] ?? '?').toUpperCase()}
        </div>
      )},
    { key: 'username', label: 'Operator',
      render: (v, r) => <div><p className="text-sm text-white">{v}</p><p className="text-xs text-gray-500">{r.email}</p></div> },
    { key: 'role',   label: 'Role',   render: (v) => roleBadge(v) },
    { key: 'status', label: 'Status', render: (v) => statusBadge(v) },
    { key: 'last_login', label: 'Last Login', render: (v) => <span className="text-xs text-gray-400">{v ?? '—'}</span> },
    { key: 'actions', label: '', width: '140px',
      render: (_, row) => (
        <div className="flex gap-1">
          <Button variant="secondary" size="sm" icon={Pencil}
            onClick={(e) => { e.stopPropagation(); setEdit(row); setEditForm({ email: row.email, username: row.username, role: row.role }); setEditError('') }}
            title="Edit operator" />
          <Button variant="secondary" size="sm" icon={Key}
            onClick={(e) => { e.stopPropagation(); handleReset(row) }} title="Force reset password" />
          {row.status !== 'blocked'
            ? <Button variant="danger" size="sm" icon={Ban}
                onClick={(e) => { e.stopPropagation(); setBlock(row) }} />
            : <Button variant="secondary" size="sm"
                onClick={(e) => { e.stopPropagation(); unblockUser(row.id) }}>Unblock</Button>
          }
        </div>
      )},
  ]

  return (
    <>
      <Card>
        <CardHeader>
          <p className="text-xs font-mono font-medium text-cyan-400 uppercase tracking-widest">SkyNet Operators</p>
          <p className="text-xs text-gray-500">Accounts with access to this dashboard</p>
        </CardHeader>
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input placeholder="Search…" value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500" />
          </div>
          <Button icon={UserPlus} onClick={() => setCreate(true)}>New Operator</Button>
        </div>
        <Table columns={columns} data={users} loading={loading} emptyMessage="No operators" onRowClick={setSelected} />
        <Pagination page={page} total={total} pageSize={20} onChange={setPage} />
      </Card>

      {/* Detail modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title="Operator Details" width="max-w-xl">
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {[['Username', selected.username], ['Email', selected.email], ['Role', selected.role],
                ['Status', selected.status], ['Created', selected.created_at], ['Last Login', selected.last_login ?? '—']
              ].map(([l, v]) => (
                <div key={l} className="bg-gray-800 rounded-lg p-2.5">
                  <p className="text-xs text-gray-500 mb-0.5">{l}</p>
                  <p className="text-xs text-white">{v}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-1 border-t border-gray-800">
              <Button variant="secondary" size="sm" icon={Pencil}
                onClick={() => { setEdit(selected); setEditForm({ email: selected.email, username: selected.username, role: selected.role }); setEditError('') }}>
                Edit Info
              </Button>
              <Button variant="secondary" size="sm" icon={Key} loading={submitting}
                onClick={() => handleReset(selected)}>
                Force Reset Password
              </Button>
              <Button variant="danger" size="sm" icon={Trash2}
                onClick={() => setDelete(selected)}>
                Delete
              </Button>
            </div>
            <div>
              <p className="text-xs font-medium text-white mb-2">Active Sessions ({sessions.length})</p>
              {sessions.length === 0
                ? <p className="text-xs text-gray-500">No active sessions</p>
                : sessions.map((s) => (
                  <div key={s.id} className="flex items-center justify-between bg-gray-800 rounded-lg px-3 py-2 mb-1">
                    <div>
                      <p className="text-xs text-white">{s.ip} · {s.device}</p>
                      <p className="text-xs text-gray-500">{s.last_active}</p>
                    </div>
                    <Button variant="danger" size="sm" icon={LogOut} onClick={() => revoke(s.id)}>Revoke</Button>
                  </div>
                ))
              }
            </div>
          </div>
        )}
      </Modal>

      {/* Create modal */}
      <Modal open={createModal} onClose={() => { setCreate(false); setError('') }} title="New Operator">
        <div className="space-y-3">
          {error && <Alert type="danger">{error}</Alert>}
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input label="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
          <Input label="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <Select label="Role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
            options={[{ value: 'user', label: 'User' }, { value: 'moderator', label: 'Moderator' }, { value: 'admin', label: 'Admin' }]} />
          <div className="flex gap-2 justify-end pt-1">
            <Button variant="secondary" onClick={() => setCreate(false)}>Cancel</Button>
            <Button loading={submitting} icon={UserPlus} onClick={handleCreate}>Create</Button>
          </div>
        </div>
      </Modal>

      {/* Block confirm */}
      <Modal open={!!blockModal} onClose={() => setBlock(null)} title="Block Operator">
        <div className="space-y-4">
          <p className="text-sm text-gray-400">Block <span className="text-white font-medium">{blockModal?.username}</span>? All active sessions will be terminated.</p>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setBlock(null)}>Cancel</Button>
            <Button variant="danger" loading={submitting} icon={Ban} onClick={handleBlock}>Block</Button>
          </div>
        </div>
      </Modal>

      {/* Edit operator */}
      <Modal open={!!editModal} onClose={() => { setEdit(null); setEditError('') }} title="Edit Operator">
        <div className="space-y-3">
          {editError && <Alert type="danger">{editError}</Alert>}
          <Input label="Email" type="email" value={editForm.email ?? ''}
            onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
          <Input label="Username" value={editForm.username ?? ''}
            onChange={(e) => setEditForm({ ...editForm, username: e.target.value })} />
          <Select label="Role" value={editForm.role ?? 'user'}
            onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
            options={[{ value: 'user', label: 'User' }, { value: 'moderator', label: 'Moderator' }, { value: 'admin', label: 'Admin' }]} />
          <div className="flex gap-2 justify-end pt-1">
            <Button variant="secondary" onClick={() => setEdit(null)}>Cancel</Button>
            <Button loading={submitting} icon={Pencil} onClick={handleUpdate}>Save Changes</Button>
          </div>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!deleteModal} onClose={() => setDelete(null)} title="Delete Operator">
        <div className="space-y-4">
          <p className="text-sm text-gray-400">Permanently delete <span className="text-white font-medium">{deleteModal?.username}</span>? This cannot be undone.</p>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setDelete(null)}>Cancel</Button>
            <Button variant="danger" loading={submitting} icon={Trash2} onClick={handleDelete}>Delete</Button>
          </div>
        </div>
      </Modal>

      {/* Reset password result */}
      <Modal open={!!resetResult} onClose={() => setResetResult(null)} title="Password Reset">
        <div className="space-y-4">
          {resetResult?.temp_password ? (
            <>
              <p className="text-sm text-gray-400">
                Temporary password for <span className="text-white font-medium">{resetResult.username}</span>.
                Share it securely — it will not be shown again.
              </p>
              <div className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2.5">
                <code className="flex-1 text-sm text-cyan-400 font-mono">{resetResult.temp_password}</code>
                <button onClick={() => copyToClipboard(resetResult.temp_password)}
                  className="text-gray-400 hover:text-white transition-colors">
                  {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                </button>
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-400">
              Reset email sent to <span className="text-white font-medium">{resetResult?.username}</span>.
            </p>
          )}
          <div className="flex justify-end">
            <Button onClick={() => setResetResult(null)}>Done</Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
