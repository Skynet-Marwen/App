import { useMemo, useState } from 'react'
import { Ban, Check, Copy, Key, LogOut, Pencil, Search, Shield, Trash2, UserPlus } from 'lucide-react'

import { Alert, Badge, Button, Card, CardHeader, Input, Modal, Pagination, Select, Table } from '../../components/ui/index'
import { useAuthStore } from '../../store/useAppStore'
import { useUserSessions } from '../../hooks/useUserSessions'
import { useUsers } from '../../hooks/useUsers'


const EMPTY_FORM = { email: '', username: '', role: 'user', password: '', tenant_id: '' }

function roleBadge(role) {
  if (role === 'superadmin') return <Badge variant="warning">Superadmin</Badge>
  if (role === 'admin') return <Badge variant="purple">Admin</Badge>
  if (role === 'moderator') return <Badge variant="info">Moderator</Badge>
  return <Badge variant="default">User</Badge>
}

function statusBadge(status) {
  if (status === 'blocked') return <Badge variant="danger">Blocked</Badge>
  if (status === 'pending') return <Badge variant="warning">Pending</Badge>
  return <Badge variant="success">Active</Badge>
}

export default function AuthOperatorsPanel({ tenants = [], canManageSuperadmin = false }) {
  const currentUser = useAuthStore((state) => state.user)
  const currentTenantId = currentUser?.tenant_id || ''
  const {
    users,
    total,
    page,
    search,
    loading,
    setPage,
    setSearch,
    createUser,
    updateUser,
    deleteUser,
    blockUser,
    unblockUser,
    resetPassword,
  } = useUsers()
  const [selected, setSelected] = useState(null)
  const [createModal, setCreate] = useState(false)
  const [blockModal, setBlock] = useState(null)
  const [editModal, setEdit] = useState(null)
  const [deleteModal, setDelete] = useState(null)
  const [resetResult, setResetResult] = useState(null)
  const [copied, setCopied] = useState(false)
  const [form, setForm] = useState({ ...EMPTY_FORM, tenant_id: currentTenantId })
  const [editForm, setEditForm] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [editError, setEditError] = useState('')
  const { sessions, revoke } = useUserSessions(selected?.id)

  const tenantOptions = useMemo(() => {
    const scopedTenants = currentTenantId ? tenants.filter((tenant) => tenant.id === currentTenantId) : tenants
    return [{ value: '', label: currentTenantId ? 'Current tenant only' : 'Global operator' }, ...scopedTenants.map((tenant) => ({
      value: tenant.id,
      label: `${tenant.name}${tenant.primary_host ? ` · ${tenant.primary_host}` : ''}`,
    }))]
  }, [currentTenantId, tenants])

  const roleOptions = useMemo(() => {
    const options = [
      { value: 'user', label: 'User' },
      { value: 'moderator', label: 'Moderator' },
      { value: 'admin', label: 'Admin' },
    ]
    if (canManageSuperadmin) {
      options.push({ value: 'superadmin', label: 'Superadmin' })
    }
    return options
  }, [canManageSuperadmin])

  const handleCreate = async () => {
    setError('')
    setSubmitting(true)
    try {
      await createUser({
        ...form,
        tenant_id: currentTenantId ? currentTenantId : (form.tenant_id || null),
      })
      setCreate(false)
      setForm({ ...EMPTY_FORM, tenant_id: currentTenantId })
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed')
    } finally {
      setSubmitting(false)
    }
  }

  const handleBlock = async () => {
    if (!blockModal) return
    setSubmitting(true)
    try {
      await blockUser(blockModal.id)
      setBlock(null)
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdate = async () => {
    if (!editModal) return
    setEditError('')
    setSubmitting(true)
    try {
      await updateUser(editModal.id, {
        ...editForm,
        tenant_id: currentTenantId ? currentTenantId : (editForm.tenant_id || null),
      })
      setEdit(null)
      if (selected?.id === editModal.id) setSelected((state) => ({ ...state, ...editForm }))
    } catch (e) {
      setEditError(e.response?.data?.detail || 'Failed')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteModal) return
    setSubmitting(true)
    try {
      await deleteUser(deleteModal.id)
      setDelete(null)
      setSelected(null)
    } finally {
      setSubmitting(false)
    }
  }

  const handleReset = async (user) => {
    setSubmitting(true)
    try {
      const data = await resetPassword(user.id)
      setResetResult({ username: user.username, ...data })
    } finally {
      setSubmitting(false)
    }
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const openEdit = (row) => {
    setEdit(row)
    setEditForm({
      email: row.email,
      username: row.username,
      role: row.role,
      tenant_id: row.tenant_id || '',
      status: row.status,
    })
    setEditError('')
  }

  const columns = [
    {
      key: 'avatar',
      label: '',
      width: '44px',
      render: (_, row) => (
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-xs font-bold text-white">
          {(row.username?.[0] ?? row.email?.[0] ?? '?').toUpperCase()}
        </div>
      ),
    },
    {
      key: 'username',
      label: 'Operator',
      render: (value, row) => (
        <div>
          <p className="text-sm text-white">{value}</p>
          <p className="text-xs text-gray-500">{row.email}</p>
        </div>
      ),
    },
    { key: 'role', label: 'Role', render: (value) => roleBadge(value) },
    {
      key: 'tenant_name',
      label: 'Tenant',
      render: (_, row) => <span className="text-xs text-gray-300">{row.tenant_name || 'Global'}</span>,
    },
    { key: 'status', label: 'Status', render: (value) => statusBadge(value) },
    { key: 'last_login', label: 'Last Login', render: (value) => <span className="text-xs text-gray-400">{value ?? '—'}</span> },
    {
      key: 'actions',
      label: '',
      width: '140px',
      render: (_, row) => (
        <div className="flex gap-1">
          <Button
            variant="secondary"
            size="sm"
            icon={Pencil}
            onClick={(event) => { event.stopPropagation(); openEdit(row) }}
            title="Edit operator"
          />
          <Button
            variant="secondary"
            size="sm"
            icon={Key}
            onClick={(event) => { event.stopPropagation(); handleReset(row) }}
            title="Force reset password"
          />
          {row.status !== 'blocked' ? (
            <Button variant="danger" size="sm" icon={Ban} onClick={(event) => { event.stopPropagation(); setBlock(row) }} />
          ) : (
            <Button variant="secondary" size="sm" onClick={(event) => { event.stopPropagation(); unblockUser(row.id) }}>Unblock</Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <>
      <Card>
        <CardHeader
          action={(
            <div className="flex items-center gap-2">
              {canManageSuperadmin ? <Badge variant="warning">Superadmin controls unlocked</Badge> : currentTenantId ? <Badge variant="info">Tenant admin scope</Badge> : null}
              <Button icon={UserPlus} onClick={() => setCreate(true)}>New Operator</Button>
            </div>
          )}
        >
          <div>
            <p className="text-xs font-mono font-medium text-cyan-400 uppercase tracking-widest">SkyNet Operators</p>
            <p className="text-xs text-gray-500">Operator access, tenant assignment, and superadmin escalation now share one control surface.</p>
          </div>
        </CardHeader>
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              placeholder="Search…"
              value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(1) }}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>
        <Table columns={columns} data={users} loading={loading} emptyMessage="No operators" onRowClick={setSelected} />
        <Pagination page={page} total={total} pageSize={20} onChange={setPage} />
      </Card>

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Operator Details" width="max-w-xl">
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {[
                ['Username', selected.username],
                ['Email', selected.email],
                ['Role', selected.role],
                ['Tenant', selected.tenant_name || 'Global'],
                ['Status', selected.status],
                ['Created', selected.created_at],
                ['Last Login', selected.last_login ?? '—'],
              ].map(([label, value]) => (
                <div key={label} className="bg-gray-800 rounded-lg p-2.5">
                  <p className="text-xs text-gray-500 mb-0.5">{label}</p>
                  <p className="text-xs text-white">{value}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-1 border-t border-gray-800">
              <Button variant="secondary" size="sm" icon={Pencil} onClick={() => openEdit(selected)}>Edit Info</Button>
              <Button variant="secondary" size="sm" icon={Key} loading={submitting} onClick={() => handleReset(selected)}>Force Reset Password</Button>
              <Button variant="danger" size="sm" icon={Trash2} onClick={() => setDelete(selected)}>Delete</Button>
            </div>
            <div>
              <p className="text-xs font-medium text-white mb-2">Active Sessions ({sessions.length})</p>
              {sessions.length === 0 ? (
                <p className="text-xs text-gray-500">No active sessions</p>
              ) : sessions.map((session) => (
                <div key={session.id} className="flex items-center justify-between bg-gray-800 rounded-lg px-3 py-2 mb-1">
                  <div>
                    <p className="text-xs text-white">{session.ip} · {session.device}</p>
                    <p className="text-xs text-gray-500">{session.last_active}</p>
                  </div>
                  <Button variant="danger" size="sm" icon={LogOut} onClick={() => revoke(session.id)}>Revoke</Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>

      <Modal open={createModal} onClose={() => { setCreate(false); setError('') }} title="New Operator">
        <div className="space-y-3">
          {error && <Alert type="danger">{error}</Alert>}
          <Input label="Email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          <Input label="Username" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} />
          <Input label="Password" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
          <Select label="Role" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value, tenant_id: event.target.value === 'superadmin' ? '' : form.tenant_id })} options={roleOptions} />
          <Select
            label="Tenant"
            value={currentTenantId || form.tenant_id}
            disabled={!!currentTenantId || form.role === 'superadmin'}
            onChange={(event) => setForm({ ...form, tenant_id: event.target.value })}
            options={tenantOptions}
          />
          {form.role === 'superadmin' && (
            <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/8 px-3 py-2 text-xs text-yellow-200 font-mono flex items-start gap-2">
              <Shield size={14} className="mt-0.5 shrink-0" />
              Superadmin accounts stay global and are not assigned to a tenant.
            </div>
          )}
          <div className="flex gap-2 justify-end pt-1">
            <Button variant="secondary" onClick={() => setCreate(false)}>Cancel</Button>
            <Button loading={submitting} icon={UserPlus} onClick={handleCreate}>Create</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!blockModal} onClose={() => setBlock(null)} title="Block Operator">
        <div className="space-y-4">
          <p className="text-sm text-gray-400">Block <span className="text-white font-medium">{blockModal?.username}</span>? All active sessions will be terminated.</p>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setBlock(null)}>Cancel</Button>
            <Button variant="danger" loading={submitting} icon={Ban} onClick={handleBlock}>Block</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!editModal} onClose={() => { setEdit(null); setEditError('') }} title="Edit Operator">
        <div className="space-y-3">
          {editError && <Alert type="danger">{editError}</Alert>}
          <Input label="Email" type="email" value={editForm.email ?? ''} onChange={(event) => setEditForm({ ...editForm, email: event.target.value })} />
          <Input label="Username" value={editForm.username ?? ''} onChange={(event) => setEditForm({ ...editForm, username: event.target.value })} />
          <Select
            label="Role"
            value={editForm.role ?? 'user'}
            onChange={(event) => setEditForm({ ...editForm, role: event.target.value, tenant_id: event.target.value === 'superadmin' ? '' : editForm.tenant_id })}
            options={roleOptions}
          />
          <Select
            label="Tenant"
            value={currentTenantId || editForm.tenant_id || ''}
            disabled={!!currentTenantId || editForm.role === 'superadmin'}
            onChange={(event) => setEditForm({ ...editForm, tenant_id: event.target.value })}
            options={tenantOptions}
          />
          <div className="flex gap-2 justify-end pt-1">
            <Button variant="secondary" onClick={() => setEdit(null)}>Cancel</Button>
            <Button loading={submitting} icon={Pencil} onClick={handleUpdate}>Save Changes</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!deleteModal} onClose={() => setDelete(null)} title="Delete Operator">
        <div className="space-y-4">
          <p className="text-sm text-gray-400">Permanently delete <span className="text-white font-medium">{deleteModal?.username}</span>? This cannot be undone.</p>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setDelete(null)}>Cancel</Button>
            <Button variant="danger" loading={submitting} icon={Trash2} onClick={handleDelete}>Delete</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!resetResult} onClose={() => setResetResult(null)} title="Password Reset">
        <div className="space-y-4">
          {resetResult?.temp_password ? (
            <>
              <p className="text-sm text-gray-400">
                Temporary password for <span className="text-white font-medium">{resetResult.username}</span>. Share it securely.
              </p>
              <div className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2.5">
                <code className="flex-1 text-sm text-cyan-400 font-mono">{resetResult.temp_password}</code>
                <button onClick={() => copyToClipboard(resetResult.temp_password)} className="text-gray-400 hover:text-white transition-colors">
                  {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                </button>
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-400">
              Reset email sent to <span className="text-white font-medium">{resetResult?.username}</span>.
            </p>
          )}
        </div>
      </Modal>
    </>
  )
}
