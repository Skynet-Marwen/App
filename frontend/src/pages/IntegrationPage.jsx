import { useEffect, useState } from 'react'
import { Plug, Plus, Trash2, RefreshCw, Copy, Code, CheckCircle, Globe, Layers3 } from 'lucide-react'
import DashboardLayout from '../components/layout/DashboardLayout'
import { Alert, Badge, Button, Card, Input, Modal, PageToolbar, SegmentedTabs, StatCard } from '../components/ui/index'
import { useSites } from '../hooks/useSites'
import { settingsApi } from '../services/api'
import { TAB_HINTS, TABS, buildSnippets } from './integration/snippets'

// ── Page component ────────────────────────────────────────────────────────────
export default function IntegrationPage() {
  const { sites, loading, refresh, createSite, deleteSite, regenerateKey } = useSites()
  const [createModal, setCreateModal] = useState(false)
  const [integModal, setIntegModal] = useState(null)   // site object
  const [activeTab, setActiveTab] = useState('html')
  const [publicOrigin, setPublicOrigin] = useState(window.location.origin)
  const [form, setForm] = useState({ name: '', url: '', description: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState('')

  const totals = sites.reduce((acc, site) => {
    acc.visitors += site.stats?.visitors ?? 0
    acc.events += site.stats?.events ?? 0
    acc.blocked += site.stats?.blocked ?? 0
    acc.active += site.active ? 1 : 0
    return acc
  }, { visitors: 0, events: 0, blocked: 0, active: 0 })

  useEffect(() => {
    let mounted = true
    settingsApi.get()
      .then((res) => {
        const baseUrl = (res.data?.base_url || '').trim()
        if (!mounted || !baseUrl) return
        setPublicOrigin(baseUrl.replace(/\/+$/, ''))
      })
      .catch(() => {})
    return () => { mounted = false }
  }, [])

  const handleCreate = async () => {
    setError(''); setSubmitting(true)
    try {
      await createSite(form)
      setCreateModal(false); setForm({ name: '', url: '', description: '' })
    } catch (e) { setError(e.response?.data?.detail || 'Failed to create site') }
    finally { setSubmitting(false) }
  }

  const copy = (text, key) => {
    navigator.clipboard.writeText(text); setCopied(key)
    setTimeout(() => setCopied(''), 2000)
  }

  const snips = integModal ? buildSnippets(integModal.api_key, publicOrigin, integModal.id) : null

  return (
    <DashboardLayout title="Integration" onRefresh={refresh}>
      <PageToolbar>
        <div className="space-y-2">
          <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-cyan-400/80">Integration Hub</p>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">Integration</h1>
            <Badge variant="default">{sites.length} registered site{sites.length === 1 ? '' : 's'}</Badge>
          </div>
          <p className="max-w-3xl text-sm text-gray-400">
            Register apps, copy the tracker snippet, and hand authenticated users into SKYNET without changing your API contracts.
          </p>
        </div>
        <Button icon={Plus} onClick={() => setCreateModal(true)}>Add site</Button>
      </PageToolbar>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Registered sites" value={sites.length.toLocaleString()} rawValue={sites.length} icon={Plug} color="cyan" loading={loading} />
        <StatCard label="Active sites" value={totals.active.toLocaleString()} rawValue={totals.active} icon={CheckCircle} color="green" loading={loading} />
        <StatCard label="Visitors tracked" value={totals.visitors.toLocaleString()} rawValue={totals.visitors} icon={Globe} color="blue" loading={loading} />
        <StatCard label="Events recorded" value={totals.events.toLocaleString()} rawValue={totals.events} icon={Layers3} color="yellow" loading={loading} />
      </div>

      <Alert type="info">
        <div className="space-y-1">
          <p className="font-medium">Embed SkyNet in any website or app</p>
          <p className="text-xs opacity-80">
            Current public base URL: <code className="text-cyan-300">{publicOrigin}</code>. Use the built-in device UUID helper before calling `/identity/link`.
          </p>
        </div>
      </Alert>

      {/* Sites list */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-white">Registered sites and apps</h2>
          <Button variant="secondary" size="sm" onClick={refresh}>Refresh list</Button>
        </div>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => <div key={i} className="h-40 bg-gray-900 border border-gray-800 rounded-xl animate-pulse" />)}
          </div>
        ) : sites.length === 0 ? (
          <Card className="text-center py-12">
            <Plug size={32} className="text-gray-600 mx-auto mb-3" />
            <p className="text-white font-medium">No sites registered</p>
            <p className="text-sm text-gray-500 mb-4">Add your first site to start tracking</p>
            <Button icon={Plus} onClick={() => setCreateModal(true)}>Add Site</Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {sites.map((site) => (
              <Card key={site.id} className="flex flex-col">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-cyan-500/10 border border-cyan-500/20 rounded-lg flex items-center justify-center">
                      <Globe size={16} className="text-cyan-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{site.name}</p>
                      <p className="text-xs text-gray-500 truncate max-w-[150px]">{site.url}</p>
                    </div>
                  </div>
                  <Badge variant={site.active ? 'success' : 'default'}>{site.active ? 'Active' : 'Inactive'}</Badge>
                </div>

                {site.description && <p className="text-xs text-gray-400 mb-3">{site.description}</p>}

                <div className="grid grid-cols-3 gap-2 mb-3">
                  {[['Visitors', site.stats?.visitors ?? 0], ['Events', site.stats?.events ?? 0], ['Blocked', site.stats?.blocked ?? 0]].map(([label, val]) => (
                    <div key={label} className="rounded-lg border border-cyan-500/10 bg-black/35 p-2 text-center">
                      <p className="text-xs text-gray-500">{label}</p>
                      <p className="text-sm font-medium text-white">{val.toLocaleString()}</p>
                    </div>
                  ))}
                </div>

                <div className="bg-gray-800 rounded-lg px-3 py-2 mb-3 flex items-center gap-2">
                  <code className="text-xs text-cyan-400 flex-1 truncate">{site.api_key}</code>
                  <button onClick={() => copy(site.api_key, `key-${site.id}`)} className="text-gray-500 hover:text-white transition">
                    {copied === `key-${site.id}` ? <CheckCircle size={14} className="text-green-400" /> : <Copy size={14} />}
                  </button>
                </div>

                <div className="flex gap-2 mt-auto">
                  <Button variant="secondary" size="sm" icon={Code} className="flex-1 justify-center"
                    onClick={() => { setActiveTab('html'); setIntegModal(site) }}>
                    Integrate
                  </Button>
                  <Button variant="secondary" size="sm" icon={RefreshCw} onClick={() => regenerateKey(site.id)} title="Regenerate API key" />
                  <Button variant="danger" size="sm" icon={Trash2} onClick={() => deleteSite(site.id)} title="Delete site" />
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* ── Create Site Modal ── */}
      <Modal open={createModal} onClose={() => { setCreateModal(false); setError('') }} title="Add Site / App">
        <div className="space-y-4">
          {error && <Alert type="danger">{error}</Alert>}
          <Input label="Name" placeholder="My Website" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="URL" type="url" placeholder="https://example.com" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
          <div className="space-y-1.5">
            <label className="block text-sm text-gray-400">Description (optional)</label>
            <textarea rows={2} placeholder="Production site..." value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 resize-none" />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setCreateModal(false)}>Cancel</Button>
            <Button loading={submitting} onClick={handleCreate} icon={Plus}>Add Site</Button>
          </div>
        </div>
      </Modal>

      {/* ── Integration Modal ── */}
      <Modal open={!!integModal} onClose={() => setIntegModal(null)} title={`Integrate — ${integModal?.name}`} width="max-w-2xl">
        {snips && (
          <div className="space-y-4">
            <SegmentedTabs items={TABS.map((tab) => ({ value: tab.id, label: tab.label }))} value={activeTab} onChange={setActiveTab} />

            {/* Hint */}
            <Alert type="info"><span className="text-xs">{TAB_HINTS[activeTab]}</span></Alert>

            {/* Code block */}
            <div className="relative">
              <pre className="bg-gray-950 border border-gray-800 rounded-xl p-4 text-xs text-gray-300 overflow-x-auto font-mono leading-relaxed">
                {snips[activeTab]}
              </pre>
              <button onClick={() => copy(snips[activeTab], 'snip')}
                className="absolute top-3 right-3 p-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white transition">
                {copied === 'snip' ? <CheckCircle size={14} className="text-green-400" /> : <Copy size={14} />}
              </button>
            </div>

            {/* Footer note */}
            <p className="text-xs text-gray-500">
              API key: <code className="text-cyan-400">{integModal.api_key}</code>
              <button onClick={() => copy(integModal.api_key, 'modal-key')} className="ml-2 text-gray-600 hover:text-white transition align-middle">
                {copied === 'modal-key' ? <CheckCircle size={12} className="text-green-400 inline" /> : <Copy size={12} className="inline" />}
              </button>
            </p>
          </div>
        )}
      </Modal>
    </DashboardLayout>
  )
}
