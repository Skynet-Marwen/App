import { useState, useEffect, useCallback } from 'react'
import { Plug, Plus, Trash2, RefreshCw, Copy, Code, CheckCircle, Globe } from 'lucide-react'
import DashboardLayout from '../components/layout/DashboardLayout'
import { Card, CardHeader, Button, Input, Modal, Alert, Badge } from '../components/ui/index'
import { integrationApi } from '../services/api'

export default function IntegrationPage() {
  const [sites, setSites] = useState([])
  const [loading, setLoading] = useState(true)
  const [createModal, setCreateModal] = useState(false)
  const [scriptModal, setScriptModal] = useState(null)
  const [form, setForm] = useState({ name: '', url: '', description: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState('')

  const fetchSites = useCallback(async () => {
    setLoading(true)
    try {
      const res = await integrationApi.sites()
      setSites(res.data)
    } catch (_) {}
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchSites() }, [fetchSites])

  const handleCreate = async () => {
    setError('')
    setSubmitting(true)
    try {
      await integrationApi.createSite(form)
      setCreateModal(false)
      setForm({ name: '', url: '', description: '' })
      fetchSites()
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to create site')
    } finally { setSubmitting(false) }
  }

  const handleDelete = async (id) => {
    await integrationApi.deleteSite(id)
    fetchSites()
  }

  const handleRegenKey = async (id) => {
    await integrationApi.regenerateKey(id)
    fetchSites()
  }

  const openScript = async (site) => {
    try {
      const res = await integrationApi.trackerScript(site.id)
      setScriptModal({ site, script: res.data.script })
    } catch (_) {
      setScriptModal({ site, script: generateScript(site.api_key) })
    }
  }

  const generateScript = (apiKey) => `<!-- SkyNet Tracker -->
<script>
  (function(s,k,y,n,e,t){
    s._skynet=s._skynet||{};
    s._skynet.key='${apiKey}';
    var a=y.createElement('script');
    a.async=1;
    a.src=n+'/tracker/skynet.js';
    var b=y.getElementsByTagName('script')[0];
    b.parentNode.insertBefore(a,b);
  })(window,document,document,'${window.location.origin}');
</script>`

  const copy = (text, key) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(''), 2000)
  }

  return (
    <DashboardLayout title="Integration" onRefresh={fetchSites}>
      {/* Intro */}
      <Alert type="info">
        <div>
          <p className="font-medium">Embed SkyNet in any website or app</p>
          <p className="mt-0.5 text-xs opacity-80">Add a site, grab the tracking script or use the REST API with your API key.</p>
        </div>
      </Alert>

      {/* Sites */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-white">Registered Sites / Apps ({sites.length})</h2>
          <Button icon={Plus} onClick={() => setCreateModal(true)}>Add Site</Button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-40 bg-gray-900 border border-gray-800 rounded-xl animate-pulse" />
            ))}
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
                  <Badge variant={site.active ? 'success' : 'default'}>
                    {site.active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>

                {site.description && (
                  <p className="text-xs text-gray-400 mb-3">{site.description}</p>
                )}

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {[
                    ['Visitors', site.stats?.visitors ?? 0],
                    ['Events', site.stats?.events ?? 0],
                    ['Blocked', site.stats?.blocked ?? 0],
                  ].map(([label, val]) => (
                    <div key={label} className="bg-gray-800 rounded-lg p-2 text-center">
                      <p className="text-xs text-gray-500">{label}</p>
                      <p className="text-sm font-medium text-white">{val.toLocaleString()}</p>
                    </div>
                  ))}
                </div>

                {/* API Key */}
                <div className="bg-gray-800 rounded-lg px-3 py-2 mb-3 flex items-center gap-2">
                  <code className="text-xs text-cyan-400 flex-1 truncate">{site.api_key}</code>
                  <button onClick={() => copy(site.api_key, `key-${site.id}`)} className="text-gray-500 hover:text-white transition">
                    {copied === `key-${site.id}` ? <CheckCircle size={14} className="text-green-400" /> : <Copy size={14} />}
                  </button>
                </div>

                {/* Actions */}
                <div className="flex gap-2 mt-auto">
                  <Button variant="secondary" size="sm" icon={Code} className="flex-1 justify-center" onClick={() => openScript(site)}>
                    Get Script
                  </Button>
                  <Button variant="secondary" size="sm" icon={RefreshCw} onClick={() => handleRegenKey(site.id)} title="Regenerate API key" />
                  <Button variant="danger" size="sm" icon={Trash2} onClick={() => handleDelete(site.id)} title="Delete site" />
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* REST API Docs preview */}
      <Card className="mt-6">
        <CardHeader>
          <p className="text-sm font-medium text-white">REST API Endpoints</p>
          <p className="text-xs text-gray-500">Integrate tracking events from backend or mobile apps</p>
        </CardHeader>
        <div className="space-y-3">
          {[
            { method: 'POST', path: '/api/v1/track/event', desc: 'Track a custom event' },
            { method: 'POST', path: '/api/v1/track/pageview', desc: 'Track a page view' },
            { method: 'POST', path: '/api/v1/track/identify', desc: 'Identify a user (link session to user)' },
            { method: 'GET', path: '/api/v1/check/ip', desc: 'Check if an IP is blocked' },
            { method: 'GET', path: '/api/v1/check/device', desc: 'Check device fingerprint status' },
          ].map(({ method, path, desc }) => (
            <div key={path} className="flex items-center gap-3 bg-gray-800 rounded-lg px-4 py-2.5">
              <span className={`text-xs font-bold font-mono w-12 ${method === 'POST' ? 'text-cyan-400' : 'text-green-400'}`}>{method}</span>
              <code className="text-xs text-gray-300 flex-1">{path}</code>
              <span className="text-xs text-gray-500">{desc}</span>
              <button onClick={() => copy(path, path)} className="text-gray-600 hover:text-white transition">
                {copied === path ? <CheckCircle size={13} className="text-green-400" /> : <Copy size={13} />}
              </button>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-3">
          Add header: <code className="text-cyan-400 text-xs">X-SkyNet-Key: your_api_key</code>
        </p>
      </Card>

      {/* Create Site Modal */}
      <Modal open={createModal} onClose={() => { setCreateModal(false); setError('') }} title="Add Site / App">
        <div className="space-y-4">
          {error && <Alert type="danger">{error}</Alert>}
          <Input label="Name" placeholder="My Website" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="URL" type="url" placeholder="https://example.com" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
          <div className="space-y-1.5">
            <label className="block text-sm text-gray-400">Description (optional)</label>
            <textarea
              rows={2}
              placeholder="Production site..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 resize-none"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setCreateModal(false)}>Cancel</Button>
            <Button loading={submitting} onClick={handleCreate} icon={Plus}>Add Site</Button>
          </div>
        </div>
      </Modal>

      {/* Script Modal */}
      <Modal open={!!scriptModal} onClose={() => setScriptModal(null)} title={`Tracking Script — ${scriptModal?.site?.name}`} width="max-w-2xl">
        {scriptModal && (
          <div className="space-y-4">
            <Alert type="info">Paste this snippet before the closing <code>&lt;/body&gt;</code> tag on your site.</Alert>
            <div className="relative">
              <pre className="bg-gray-950 border border-gray-800 rounded-xl p-4 text-xs text-gray-300 overflow-x-auto font-mono">
                {scriptModal.script}
              </pre>
              <button
                onClick={() => copy(scriptModal.script, 'script')}
                className="absolute top-3 right-3 p-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white transition"
              >
                {copied === 'script' ? <CheckCircle size={14} className="text-green-400" /> : <Copy size={14} />}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </DashboardLayout>
  )
}
