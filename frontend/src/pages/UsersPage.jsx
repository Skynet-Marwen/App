import { useState } from 'react'
import { Search, UserPlus, Ban, Key, Trash2, LogOut, ShieldCheck } from 'lucide-react'
import DashboardLayout from '../components/layout/DashboardLayout'
import { Card, Table, Badge, Button, Input, Pagination, Modal, Select, Alert } from '../components/ui/index'
import { useUsers } from '../hooks/useUsers'
import { useUserSessions } from '../hooks/useUserSessions'

const roleBadge = (role) => {
  if (role === 'admin') return <Badge variant="purple">Admin</Badge>
  if (role === 'moderator') return <Badge variant="info">Moderator</Badge>
  return <Badge variant="default">User</Badge>
}

const statusBadge = (status) => {
  if (status === 'blocked') return <Badge variant="danger">Blocked</Badge>
  if (status === 'pending') return <Badge variant="warning">Pending</Badge>
  return <Badge variant="success">Active</Badge>
}

const EMPTY_FORM = { email: '', username: '', role: 'user', password: '' }

export default function UsersPage() {
  const {
    users,
    total,
    page,
    search,
    loading,
    setPage,
    setSearch,
    refresh,
    createUser,
    blockUser,
    unblockUser,
    resetPassword,
  } = useUsers()
  const [selected, setSelected] = useState(null)
  const [createModal, setCreateModal] = useState(false)
  const [blockModal, setBlockModal] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const { sessions, revoke } = useUserSessions(selected?.id)

  const openUser = async (user) => {
    setSelected(user)
  }

  const handleCreate = async () => {
    setError('')
    setSubmitting(true)
    try {
      await createUser(form)
      setCreateModal(false)
      setForm(EMPTY_FORM)
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to create user')
    } finally { setSubmitting(false) }
  }

  const handleBlock = async () => {
    if (!blockModal) return
    setSubmitting(true)
    try {
      await blockUser(blockModal.id)
      setBlockModal(null)
    } catch (_) {}
    finally { setSubmitting(false) }
  }

  const handleResetPassword = async (userId) => {
    try { await resetPassword(userId) } catch (_) {}
  }

  const handleRevokeSession = async (sessionId) => {
    if (!selected) return
    try {
      await revoke(sessionId)
    } catch (_) {}
  }

  const columns = [
    { key: 'avatar', label: '', width: '50px', render: (_, r) => (
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-xs font-bold text-white">
        {r.username?.[0]?.toUpperCase() ?? r.email?.[0]?.toUpperCase()}
      </div>
    )},
    { key: 'username', label: 'Username', render: (v, r) => (
      <div>
        <p className="text-sm text-white font-medium">{v}</p>
        <p className="text-xs text-gray-500">{r.email}</p>
      </div>
    )},
    { key: 'role', label: 'Role', render: (v) => roleBadge(v) },
    { key: 'status', label: 'Status', render: (v) => statusBadge(v) },
    { key: 'last_login', label: 'Last Login', render: (v) => <span className="text-xs text-gray-400">{v ?? '—'}</span> },
    { key: 'devices_count', label: 'Devices', render: (v) => <span className="text-xs text-white">{v ?? 0}</span> },
    { key: 'keycloak_id', label: 'Keycloak', render: (v) => v ? <Badge variant="success"><ShieldCheck size={11} className="mr-1" />Linked</Badge> : <Badge variant="default">Local</Badge> },
    {
      key: 'actions', label: '', width: '130px',
      render: (_, row) => (
        <div className="flex gap-1">
          <Button variant="secondary" size="sm" icon={Key} onClick={(e) => { e.stopPropagation(); handleResetPassword(row.id) }} title="Reset password" />
          {row.status !== 'blocked' ? (
            <Button variant="danger" size="sm" icon={Ban} onClick={(e) => { e.stopPropagation(); setBlockModal(row) }} title="Block" />
          ) : (
            <Button variant="secondary" size="sm" onClick={(e) => { e.stopPropagation(); unblockUser(row.id) }}>Unblock</Button>
          )}
        </div>
      )
    },
  ]

  return (
    <DashboardLayout title="Users" onRefresh={refresh}>
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              placeholder="Search by email, username..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
            />
          </div>
          <Button icon={UserPlus} onClick={() => setCreateModal(true)}>New User</Button>
        </div>

        <Table columns={columns} data={users} loading={loading} emptyMessage="No users found" onRowClick={openUser} />
        <Pagination page={page} total={total} pageSize={20} onChange={setPage} />
      </Card>

      {/* User Detail Modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title="User Details" width="max-w-2xl">
        {selected && (
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-3">
              {[
                ['Username', selected.username],
                ['Email', selected.email],
                ['Role', selected.role],
                ['Status', selected.status],
                ['Created', selected.created_at],
                ['Last Login', selected.last_login ?? '—'],
              ].map(([label, value]) => (
                <div key={label} className="bg-gray-800 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-0.5">{label}</p>
                  <p className="text-sm text-white">{value}</p>
                </div>
              ))}
            </div>

            {/* Active Sessions */}
            <div>
              <p className="text-sm font-medium text-white mb-2">Active Sessions ({sessions.length})</p>
              {sessions.length === 0 ? (
                <p className="text-xs text-gray-500">No active sessions</p>
              ) : (
                <div className="space-y-2">
                  {sessions.map((s) => (
                    <div key={s.id} className="flex items-center justify-between bg-gray-800 rounded-lg px-3 py-2">
                      <div>
                        <p className="text-xs text-white">{s.ip} · {s.device}</p>
                        <p className="text-xs text-gray-500">{s.last_active}</p>
                      </div>
                      <Button variant="danger" size="sm" icon={LogOut} onClick={() => handleRevokeSession(s.id)}>
                        Revoke
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Create User Modal */}
      <Modal open={createModal} onClose={() => { setCreateModal(false); setError('') }} title="Create User">
        <div className="space-y-4">
          {error && <Alert type="danger">{error}</Alert>}
          <Input label="Email" type="email" placeholder="user@example.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input label="Username" placeholder="johndoe" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
          <Input label="Password" type="password" placeholder="••••••••" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <Select label="Role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
            options={[{ value: 'user', label: 'User' }, { value: 'moderator', label: 'Moderator' }, { value: 'admin', label: 'Admin' }]}
          />
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setCreateModal(false)}>Cancel</Button>
            <Button loading={submitting} onClick={handleCreate} icon={UserPlus}>Create</Button>
          </div>
        </div>
      </Modal>

      {/* Block Modal */}
      <Modal open={!!blockModal} onClose={() => setBlockModal(null)} title="Block User">
        <div className="space-y-4">
          <p className="text-sm text-gray-400">Block <span className="text-white font-medium">{blockModal?.username}</span>? This will terminate all active sessions.</p>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setBlockModal(null)}>Cancel</Button>
            <Button variant="danger" loading={submitting} onClick={handleBlock} icon={Ban}>Block User</Button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  )
}
