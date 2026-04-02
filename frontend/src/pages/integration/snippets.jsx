export const TABS = [
  { id: 'html', label: 'HTML Script' },
  { id: 'identity', label: 'Identity / OIDC' },
  { id: 'gtm', label: 'Google Tag Manager' },
  { id: 'wordpress', label: 'WordPress' },
  { id: 'python', label: 'Python / Server' },
  { id: 'rest', label: 'REST API (curl)' },
]

export const TAB_HINTS = {
  html: <>Paste before the <code className="text-cyan-400">&lt;/body&gt;</code> tag on every page you want to track.</>,
  identity: <>Use the tracker helper APIs to resolve SKYNET <code className="text-cyan-400">devices.id</code> before calling <code className="text-cyan-400">/identity/link</code> or <code className="text-cyan-400">/track/activity</code>.</>,
  gtm: <>In GTM: <strong>New Tag → Custom HTML</strong>, paste this, trigger on <strong>All Pages</strong>.</>,
  wordpress: <>Add to <code className="text-cyan-400">functions.php</code> in your active theme, or use a code snippet plugin.</>,
  python: <>Server-side tracking from any Python backend. Requires <code className="text-cyan-400">pip install httpx</code>.</>,
  rest: <>Works from any language or platform. Send the <code className="text-cyan-400">X-SkyNet-Key</code> header with every request.</>,
}

export function buildSnippets(apiKey, origin, siteId) {
  return {
    html: `<!-- SkyNet Tracker -->
<script>window._skynet = { key: '${apiKey}' };</script>
<script async src="${origin}/tracker/skynet.js"></script>

<!-- Browser helpers exposed after load:
     SkyNet.getDeviceId()
     SkyNet.getDeviceContext()
     SkyNet.getFingerprint()
-->`,

    identity: `// Resolve the SKYNET device UUID created from tracker signals
const deviceId = await SkyNet.getDeviceId();

// Link the authenticated OIDC / Keycloak user to this SKYNET device
const linkRes = await fetch('${origin}/api/v1/identity/link', {
  method: 'POST',
  headers: {
    'Authorization': \`Bearer \${keycloakAccessToken}\`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    fingerprint_id: deviceId,
    platform: 'web',
    site_id: '${siteId}',
  }),
});

const identity = await linkRes.json();
console.log('SkyNet identity verdict', identity);

if (identity.trust_level === 'blocked') {
  // deny access
}

// Later, send authenticated activity with the same SKYNET device UUID
await fetch('${origin}/api/v1/track/activity', {
  method: 'POST',
  headers: {
    'Authorization': \`Bearer \${keycloakAccessToken}\`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    event_type: 'pageview',
    platform: 'web',
    fingerprint_id: deviceId,
    page_url: window.location.href,
    session_id: window.sessionStorage.getItem('_sn_sid'),
    site_id: '${siteId}',
  }),
});`,

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

# Resolve the SKYNET device UUID from browser fingerprint data
device_ctx = httpx.post(f"{SKYNET_BASE}/device-context", headers=HEADERS, json={
    "fingerprint": "<raw-browser-fingerprint>",
    "screen": "1920x1080",
    "language": "en-US",
    "timezone": "Europe/Paris",
}).json()
skynet_device_id = device_ctx["device_id"]

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
})

# Link an external IdP user after login
httpx.post("${origin}/api/v1/identity/link", headers={
    "Authorization": f"Bearer {keycloak_access_token}",
    "Content-Type": "application/json",
}, json={
    "fingerprint_id": skynet_device_id,
    "platform": "web",
    "site_id": "${siteId}",
})`,

    rest: `# Track a pageview
curl -X POST ${origin}/api/v1/track/pageview \\
  -H "X-SkyNet-Key: ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"page_url":"https://yoursite.com/page","referrer":""}'

# Resolve the SKYNET device UUID from raw tracker signals
curl -X POST ${origin}/api/v1/track/device-context \\
  -H "X-SkyNet-Key: ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"fingerprint":"<raw-browser-fingerprint>","screen":"1920x1080","language":"en-US","timezone":"Europe/Paris"}'

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

# Link an authenticated external user to that SKYNET device UUID
curl -X POST ${origin}/api/v1/identity/link \\
  -H "Authorization: Bearer <keycloak_access_token>" \\
  -H "Content-Type: application/json" \\
  -d '{"fingerprint_id":"<device_uuid>","platform":"web","site_id":"${siteId}"}'

# Check if an IP is blocked (server-side gate)
curl "${origin}/api/v1/track/check/ip?ip=1.2.3.4" \\
  -H "X-SkyNet-Key: ${apiKey}"`,
  }
}
