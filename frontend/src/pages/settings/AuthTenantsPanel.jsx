import { useMemo, useState } from 'react'
import { Building2, Pencil, Plus, Shield, Trash2 } from 'lucide-react'

import { Alert, Badge, Button, Card, CardHeader, Input, Modal, Select, Table } from '../../components/ui'
import { useAuthStore } from '../../store/useAppStore'


const EMPTY_FORM = {
  name: '',
  slug: '',
  primary_host: '',
  default_theme_id: '',
  description: '',
  is_active: true,
}

function tenantStatusBadge(active) {
  return active ? <Badge variant="success">Active</Badge> : <Badge variant="danger">Inactive</Badge>
}

export default function AuthTenantsPanel({ tenants, loading, themes, createTenant, updateTenant, deleteTenant }) {
  const currentUser = useAuthStore((state) => state.user)
  const isSuperadmin = currentUser?.role === 'superadmin'
  const [createOpen, setCreateOpen] = useState(false)
  const [editTenant, setEditTenant] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const themeOptions = useMemo(
    () => [{ value: '', label: 'No tenant default theme' }, ...themes.map((theme) => ({ value: theme.id, label: theme.name }))],
    [themes]
  )

  const openCreate = () => {
    setError('')
    setForm(EMPTY_FORM)
    setCreateOpen(true)
  }

  const openEdit = (tenant) => {
    setError('')
    setEditTenant(tenant)
    setForm({
      name: tenant.name || '',
      slug: tenant.slug || '',
      primary_host: tenant.primary_host || '',
      default_theme_id: tenant.default_theme_id || '',
      description: tenant.description || '',
      is_active: tenant.is_active !== false,
    })
  }

  const closeAll = () => {
    setCreateOpen(false)
    setEditTenant(null)
    setDeleteTarget(null)
    setError('')
    setForm(EMPTY_FORM)
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setError('')
    try {
      const payload = {
        ...form,
        default_theme_id: form.default_theme_id || null,
        primary_host: form.primary_host || null,
        description: form.description || null,
      }
      if (editTenant) {
        await updateTenant(editTenant.id, payload)
      } else {
        await createTenant(payload)
      }
      closeAll()
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to save tenant')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setSubmitting(true)
    setError('')
    try {
      await deleteTenant(deleteTarget.id)
      closeAll()
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to delete tenant')
    } finally {
      setSubmitting(false)
    }
  }

  const columns = [
    {
      key: 'name',
      label: 'Tenant',
      render: (_, row) => (
        <div>
          <p className="text-sm text-white">{row.name}</p>
          <p className="text-xs text-gray-500">{row.slug}{row.primary_host ? ` · ${row.primary_host}` : ''}</p>
        </div>
      ),
    },
    { key: 'user_count', label: 'Operators', render: (value) => <span className="text-xs text-white">{value ?? 0}</span> },
    { key: 'default_theme_name', label: 'Default Theme', render: (value) => <span className="text-xs text-gray-300">{value || '—'}</span> },
    { key: 'is_active', label: 'Status', render: (value) => tenantStatusBadge(value) },
    {
      key: 'actions',
      label: '',
      width: '140px',
      render: (_, row) => isSuperadmin ? (
        <div className="flex gap-1">
          <Button variant="secondary" size="sm" icon={Pencil} onClick={(event) => { event.stopPropagation(); openEdit(row) }} />
          <Button variant="danger" size="sm" icon={Trash2} onClick={(event) => { event.stopPropagation(); setDeleteTarget(row); setError('') }} />
        </div>
      ) : null,
    },
  ]

  return (
    <>
      <Card>
        <CardHeader
          action={isSuperadmin ? <Button icon={Plus} onClick={openCreate}>New Tenant</Button> : <Badge variant="info">Read Only</Badge>}
        >
          <div>
            <p className="text-xs font-mono font-medium text-cyan-400 uppercase tracking-widest">Tenant Accounts</p>
            <p className="text-xs text-gray-500">
              Tenant identities can now carry their own host mapping, theme default, and operator membership without becoming full data-isolation mode yet.
            </p>
          </div>
        </CardHeader>
        <div className="grid gap-3 md:grid-cols-3 mb-4">
          <div className="rounded-xl border border-cyan-500/10 bg-black/20 p-4">
            <p className="text-[10px] text-gray-500 uppercase tracking-[0.18em] font-mono">Tenants</p>
            <p className="mt-2 text-2xl font-semibold text-white">{tenants.length}</p>
          </div>
          <div className="rounded-xl border border-cyan-500/10 bg-black/20 p-4">
            <p className="text-[10px] text-gray-500 uppercase tracking-[0.18em] font-mono">Active Tenants</p>
            <p className="mt-2 text-2xl font-semibold text-green-300">{tenants.filter((tenant) => tenant.is_active !== false).length}</p>
          </div>
          <div className="rounded-xl border border-cyan-500/10 bg-black/20 p-4">
            <p className="text-[10px] text-gray-500 uppercase tracking-[0.18em] font-mono">Control Plane</p>
            <p className="mt-2 flex items-center gap-2 text-sm text-white">
              <Shield size={14} className="text-yellow-300" />
              {isSuperadmin ? 'Superadmin-managed' : 'Managed by superadmin'}
            </p>
          </div>
        </div>
        <Table columns={columns} data={tenants} loading={loading} emptyMessage="No tenant accounts configured" />
      </Card>

      <Modal open={createOpen || !!editTenant} onClose={closeAll} title={editTenant ? 'Edit Tenant' : 'New Tenant'}>
        <div className="space-y-3">
          {error && <Alert type="danger">{error}</Alert>}
          <Input label="Tenant Name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          <Input label="Slug" value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value.toLowerCase() })} />
          <Input label="Primary Host" value={form.primary_host} onChange={(event) => setForm({ ...form, primary_host: event.target.value })} placeholder="tenant.example.com" />
          <Select label="Default Theme" value={form.default_theme_id} onChange={(event) => setForm({ ...form, default_theme_id: event.target.value })} options={themeOptions} />
          <Input label="Description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          <Select
            label="Status"
            value={form.is_active ? 'active' : 'inactive'}
            onChange={(event) => setForm({ ...form, is_active: event.target.value === 'active' })}
            options={[
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
            ]}
          />
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={closeAll}>Cancel</Button>
            <Button loading={submitting} icon={Building2} onClick={handleSubmit}>{editTenant ? 'Save Tenant' : 'Create Tenant'}</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!deleteTarget} onClose={closeAll} title="Delete Tenant">
        <div className="space-y-4">
          {error && <Alert type="danger">{error}</Alert>}
          <p className="text-sm text-gray-400">
            Delete <span className="text-white font-medium">{deleteTarget?.name}</span>? Any assigned operators must be unassigned first.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={closeAll}>Cancel</Button>
            <Button variant="danger" loading={submitting} icon={Trash2} onClick={handleDelete}>Delete Tenant</Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
