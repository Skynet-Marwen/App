import { useState } from 'react'
import { Shield, Plus, Trash2, Search, Globe, Monitor, User } from 'lucide-react'
import DashboardLayout from '../components/layout/DashboardLayout'
import { Card, CardHeader, Table, Badge, Button, Input, Modal, Select, Alert, Pagination, PageToolbar, SegmentedTabs } from '../components/ui/index'
import { useBlocking } from '../hooks/useBlocking'

const RULE_TYPES = [
  { value: 'ip', label: 'IP Address / CIDR' },
  { value: 'country', label: 'Country' },
  { value: 'device', label: 'Device Fingerprint' },
  { value: 'user_agent', label: 'User Agent Pattern' },
  { value: 'asn', label: 'ASN / ISP' },
]

const EMPTY_RULE = { type: 'ip', value: '', reason: '', action: 'block' }

export default function BlockingPage() {
  const {
    rules,
    ips,
    ipTotal,
    ipPage,
    search,
    loading,
    setIpPage,
    setSearch,
    refresh,
    createRule,
    deleteRule,
    blockIp,
    unblockIp,
  } = useBlocking()
  const [tab, setTab] = useState('rules')
  const [ruleModal, setRuleModal] = useState(false)
  const [ipModal, setIpModal] = useState(false)
  const [form, setForm] = useState(EMPTY_RULE)
  const [ipForm, setIpForm] = useState({ ip: '', reason: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleCreateRule = async () => {
    setError('')
    setSubmitting(true)
    try {
      await createRule(form)
      setRuleModal(false)
      setForm(EMPTY_RULE)
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to create rule')
    } finally { setSubmitting(false) }
  }

  const handleDeleteRule = async (id) => {
    await deleteRule(id)
  }

  const handleBlockIp = async () => {
    setError('')
    setSubmitting(true)
    try {
      await blockIp(ipForm.ip, ipForm.reason)
      setIpModal(false)
      setIpForm({ ip: '', reason: '' })
    } catch (e) {
      setError(e.response?.data?.detail || 'Invalid IP')
    } finally { setSubmitting(false) }
  }

  const handleUnblockIp = async (ip) => {
    await unblockIp(ip)
  }

  const typeIcon = (type) => {
    if (type === 'ip') return <Globe size={13} className="text-cyan-400" />
    if (type === 'device') return <Monitor size={13} className="text-purple-400" />
    if (type === 'user') return <User size={13} className="text-blue-400" />
    return <Shield size={13} className="text-yellow-400" />
  }

  const ruleColumns = [
    { key: 'type', label: 'Type', render: (v) => (
      <span className="flex items-center gap-1.5 text-xs text-gray-300">{typeIcon(v)} {v.toUpperCase()}</span>
    )},
    { key: 'value', label: 'Value', render: (v) => <code className="text-xs text-cyan-400">{v}</code> },
    { key: 'reason', label: 'Reason', render: (v) => <span className="text-xs text-gray-400">{v || '—'}</span> },
    { key: 'action', label: 'Action', render: (v) => (
      v === 'challenge' ? <Badge variant="warning">Challenge</Badge> :
      v === 'rate_limit' ? <Badge variant="info">Rate Limit</Badge> :
      <Badge variant="danger">Block</Badge>
    )},
    { key: 'hits', label: 'Hits', render: (v) => <span className="text-xs text-white font-medium">{v ?? 0}</span> },
    { key: 'created_at', label: 'Created', render: (v) => <span className="text-xs text-gray-400">{v}</span> },
    { key: 'actions', label: '', width: '60px', render: (_, row) => (
      <Button variant="danger" size="sm" icon={Trash2} onClick={() => handleDeleteRule(row.id)} />
    )},
  ]

  const ipColumns = [
    { key: 'ip', label: 'IP / CIDR', render: (v) => <code className="text-xs text-cyan-400">{v}</code> },
    { key: 'country', label: 'Country', render: (v, r) => <span className="text-xs text-gray-300">{r.country_flag} {v}</span> },
    { key: 'reason', label: 'Reason', render: (v) => <span className="text-xs text-gray-400">{v || '—'}</span> },
    { key: 'blocked_at', label: 'Blocked At', render: (v) => <span className="text-xs text-gray-400">{v}</span> },
    { key: 'hits', label: 'Hits', render: (v) => <span className="text-xs text-white">{v ?? 0}</span> },
    { key: 'actions', label: '', width: '90px', render: (_, row) => (
      <Button variant="secondary" size="sm" onClick={() => handleUnblockIp(row.ip)}>Unblock</Button>
    )},
  ]

  return (
    <DashboardLayout title="Blocking" onRefresh={refresh}>
      {/* Stats */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[
          { label: 'Active Rules', value: rules.length, color: 'text-cyan-400' },
          { label: 'Blocked IPs', value: ipTotal, color: 'text-red-400' },
          { label: 'Total Hits Today', value: rules.reduce((a, r) => a + (r.hits ?? 0), 0), color: 'text-yellow-400' },
        ].map((s) => (
          <Card key={s.label}>
            <p className="text-xs text-gray-500 mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value.toLocaleString()}</p>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <SegmentedTabs
        className="mb-4"
        value={tab}
        onChange={setTab}
        items={[
          { value: 'rules', label: 'Rules' },
          { value: 'ips', label: 'Blocked IPs' },
        ]}
      />

      {tab === 'rules' && (
        <Card>
          <CardHeader action={<Button icon={Plus} onClick={() => setRuleModal(true)}>New Rule</Button>}>
            <p className="text-sm font-medium text-white">Blocking Rules</p>
            <p className="text-xs text-gray-500">Block by IP, country, device, user agent, ASN</p>
          </CardHeader>
          <Table columns={ruleColumns} data={rules} loading={loading} emptyMessage="No blocking rules configured" />
        </Card>
      )}

      {tab === 'ips' && (
        <Card>
          <PageToolbar>
            <div className="relative w-full xl:max-w-[28rem]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                placeholder="Search IP..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setIpPage(1) }}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3 xl:justify-end">
              <span className="text-sm text-gray-500">{ipTotal.toLocaleString()} blocked</span>
              <Button icon={Plus} onClick={() => setIpModal(true)}>Block IP</Button>
            </div>
          </PageToolbar>
          <Table columns={ipColumns} data={ips} loading={loading} emptyMessage="No blocked IPs" />
          <Pagination page={ipPage} total={ipTotal} pageSize={20} onChange={setIpPage} />
        </Card>
      )}

      {/* Rule Modal */}
      <Modal open={ruleModal} onClose={() => { setRuleModal(false); setError('') }} title="Create Blocking Rule">
        <div className="space-y-4">
          {error && <Alert type="danger">{error}</Alert>}
          <Select label="Rule Type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} options={RULE_TYPES} />
          <Input label="Value" placeholder={form.type === 'ip' ? '192.168.1.0/24' : 'Enter value...'} value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
          <Input label="Reason" placeholder="Spam, abuse..." value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          <Select label="Action" value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value })}
            options={[{ value: 'block', label: 'Block' }, { value: 'challenge', label: 'Challenge (CAPTCHA)' }, { value: 'rate_limit', label: 'Rate Limit' }]}
          />
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setRuleModal(false)}>Cancel</Button>
            <Button loading={submitting} onClick={handleCreateRule} icon={Shield}>Create Rule</Button>
          </div>
        </div>
      </Modal>

      {/* Block IP Modal */}
      <Modal open={ipModal} onClose={() => { setIpModal(false); setError('') }} title="Block IP / CIDR">
        <div className="space-y-4">
          {error && <Alert type="danger">{error}</Alert>}
          <Input label="IP Address or CIDR" placeholder="1.2.3.4 or 10.0.0.0/8" value={ipForm.ip} onChange={(e) => setIpForm({ ...ipForm, ip: e.target.value })} />
          <Input label="Reason" placeholder="Manual block..." value={ipForm.reason} onChange={(e) => setIpForm({ ...ipForm, reason: e.target.value })} />
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setIpModal(false)}>Cancel</Button>
            <Button variant="danger" loading={submitting} onClick={handleBlockIp} icon={Shield}>Block</Button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  )
}
