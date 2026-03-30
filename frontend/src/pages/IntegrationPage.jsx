import { useState } from 'react'
import { Plug, Plus, Trash2, RefreshCw, Copy, Code, CheckCircle, Globe } from 'lucide-react'
import DashboardLayout from '../components/layout/DashboardLayout'
import { Card, Button, Input, Modal, Alert, Badge } from '../components/ui/index'
import { useSites } from '../hooks/useSites'

// ── Integration snippet generators ───────────────────────────────────────────
const TABS = [
  { id: 'html',      label: 'HTML Script' },
  { id: 'gtm',       label: 'Google Tag Manager' },
  { id: 'wordpress', label: 'WordPress' },
  { id: 'python',    label: 'Python / Server' },
  { id: 'rest',      label: 'REST API (curl)' },
]

const TAB_HINTS = {
  html:      <>Paste before the <code className="text-cyan-400">&lt;/body&gt;</code> tag on every page you want to track.</>,
  gtm:       <>In GTM: <strong>New Tag → Custom HTML</strong>, paste this, trigger on <strong>All Pages</strong>.</>,
  wordpress: <>Add to <code className="text-cyan-400">functions.php</code> in your active theme, or use a code snippet plugin.</>,
  python:    <>Server-side tracking from any Python backend. Requires <code className="text-cyan-400">pip install httpx</code>.</>,
  rest:      <>Works from any language or platform. Send the <code className="text-cyan-400">X-SkyNet-Key</code> header with every request.</>,
}

function buildSnippets(apiKey, origin) {
  return {
    html: `<!-- SkyNet Tracker -->
<script>window._skynet = { key: '${apiKey}' };</script>
<script async src="${origin}/tracker/skynet.js"></script>

<!-- Optional: identify users after login -->
<!-- <script>SkyNet.identify('your-internal-user-id')</script> -->`,

    gtm: `<!-- Custom HTML Tag — Google Tag Manager -->
<script>
  window._skynet = window._skynet || {};
  window._skynet.key = '${apiKey}';
  (function() {
    var s = document.createElement('script');
    s.async = true;
    s.src = '${origin}/tracker/skynet.js';
    document.head.appendChild(s);
  })();
</script>`,

    wordpress: `<?php
// functions.php — enqueue SkyNet tracker on all frontend pages
function skynet_tracker_enqueue() {
    ?>
    <script>window._skynet = { key: '<?php echo esc_js('${apiKey}'); ?>' };</script>
    <?php
    wp_enqueue_script(
        'skynet-tracker',
        '${origin}/tracker/skynet.js',
        [], null, true   // load in footer
    );
}
add_action('wp_enqueue_scripts', 'skynet_tracker_enqueue');`,

    python: `import httpx  # pip install httpx

SKYNET_KEY = "${apiKey}"
SKYNET_BASE = "${origin}/api/v1/track"
HEADERS = {"X-SkyNet-Key": SKYNET_KEY, "Content-Type": "application/json"}

# Track a server-side pageview
httpx.post(f"{SKYNET_BASE}/pageview", headers=HEADERS, json={
    "page_url": "https://yoursite.com/dashboard",
    "referrer": "",
})

# Track a custom event
httpx.post(f"{SKYNET_BASE}/event", headers=HEADERS, json={
    "event_type": "purchase",
    "page_url": "https://yoursite.com/checkout",
    "properties": {"plan": "pro", "amount": 49.99},
})

# Identify a user (link session to your user ID)
httpx.post(f"{SKYNET_BASE}/identify", headers=HEADERS, json={
    "user_id": "usr_123",
    "fingerprint": "<device_fingerprint>",
})`,

    rest: `# Track a pageview
curl -X POST ${origin}/api/v1/track/pageview \\
  -H "X-SkyNet-Key: ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"page_url":"https://yoursite.com/page","referrer":""}'

# Track a custom event
curl -X POST ${origin}/api/v1/track/event \\
  -H "X-SkyNet-Key: ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"event_type":"signup","page_url":"https://yoursite.com","properties":{"plan":"free"}}'

# Identify a user after login
curl -X POST ${origin}/api/v1/track/identify \\
  -H "X-SkyNet-Key: ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"user_id":"usr_123","fingerprint":"<fp>"}'

# Check if an IP is blocked (server-side gate)
curl "${origin}/api/v1/track/check/ip?ip=1.2.3.4" \\
  -H "X-SkyNet-Key: ${apiKey}"`,
  }
}

// ── Page component ────────────────────────────────────────────────────────────
export default function IntegrationPage() {
  const { sites, loading, refresh, createSite, deleteSite, regenerateKey } = useSites()
  const [createModal, setCreateModal] = useState(false)
  const [integModal, setIntegModal] = useState(null)   // site object
  const [activeTab, setActiveTab] = useState('html')
  const [form, setForm] = useState({ name: '', url: '', description: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState('')

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

  const snips = integModal ? buildSnippets(integModal.api_key, window.location.origin) : null

  return (
    <DashboardLayout title="Integration" onRefresh={refresh}>
      <Alert type="info">
        <p className="font-medium">Embed SkyNet in any website or app</p>
        <p className="mt-0.5 text-xs opacity-80">Add a site, grab the integration snippet, or send events directly from your backend.</p>
      </Alert>

      {/* Sites list */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-white">Registered Sites / Apps ({sites.length})</h2>
          <Button icon={Plus} onClick={() => setCreateModal(true)}>Add Site</Button>
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
                    <div key={label} className="bg-gray-800 rounded-lg p-2 text-center">
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
            {/* Tab bar */}
            <div className="flex gap-1 bg-gray-900 rounded-lg p-1 flex-wrap">
              {TABS.map(t => (
                <button key={t.id} onClick={() => setActiveTab(t.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${activeTab === t.id ? 'bg-cyan-500 text-gray-900' : 'text-gray-400 hover:text-white'}`}>
                  {t.label}
                </button>
              ))}
            </div>

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
