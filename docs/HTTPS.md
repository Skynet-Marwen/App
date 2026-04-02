# SkyNet — HTTPS Deployment Modes

> Last updated: 2026-04-02

SkyNet should treat HTTPS as an edge concern.
The dashboard, tracker, and API can stay on internal HTTP while a trusted edge handles certificates and public access.

---

## Core Rule

Set one canonical public URL:

```bash
APP_BASE_URL=https://skynet.example.com
```

That URL is used for:
- tracker snippets
- integration examples
- email/login links
- browser mixed-content safety
- HSTS host matching

Do not set `APP_BASE_URL` to an internal container address like `http://backend:8000`.

---

## Supported Modes

| Mode | Best for | Public HTTPS | Open ports required |
|------|----------|--------------|---------------------|
| `off` | local-only dev | no | no |
| `edge + caddy` | VPS, Proxmox, home server with domain | yes | usually 80/443 |
| `edge + reverse_proxy` | existing Nginx Proxy Manager / Traefik / HAProxy | yes | depends on your proxy |
| `edge + cloudflare_tunnel` | ISP blocks ports, CGNAT, no port-forwarding | yes | no inbound ports |

Settings values:

```bash
APP_HTTPS_MODE=edge
APP_HTTPS_PROVIDER=caddy
APP_TRUST_PROXY_HEADERS=true
APP_HSTS_ENABLED=true
```

---

## Option 1: Bundled Caddy

Recommended for most public deployments.

1. Set in `backend/.env`:

```bash
APP_BASE_URL=https://skynet.example.com
APP_HTTPS_MODE=edge
APP_HTTPS_PROVIDER=caddy
APP_TRUST_PROXY_HEADERS=true
APP_HSTS_ENABLED=true
CORS_ORIGINS=https://skynet.example.com
```

2. Export host/env values before starting:

```bash
export SKYNET_PUBLIC_HOSTNAME=skynet.example.com
export SKYNET_TLS_EMAIL=admin@example.com
```

3. Start:

```bash
docker compose -f docker-compose.yml -f docker-compose.https.yml up -d
```

Files:
- [docker-compose.https.yml](../docker-compose.https.yml)
- [infra/caddy/Caddyfile](../infra/caddy/Caddyfile)

---

## Option 2: Cloudflare Tunnel

Recommended when the network cannot expose ports 80/443.

1. In Cloudflare Zero Trust, create a tunnel and a public hostname pointing to SkyNet.
2. Set the service target to the frontend container path for the same host, for example `http://frontend:80`.
3. Put the tunnel token in your shell or `.env`:

```bash
export CLOUDFLARE_TUNNEL_TOKEN=your-token
```

4. Set in `backend/.env`:

```bash
APP_BASE_URL=https://skynet.example.com
APP_HTTPS_MODE=edge
APP_HTTPS_PROVIDER=cloudflare_tunnel
APP_TRUST_PROXY_HEADERS=true
APP_HSTS_ENABLED=true
CORS_ORIGINS=https://skynet.example.com
```

5. Start:

```bash
docker compose -f docker-compose.yml -f docker-compose.tunnel.yml up -d
```

File:
- [docker-compose.tunnel.yml](../docker-compose.tunnel.yml)

Notes:
- no inbound port forwarding is required
- Cloudflare provides the public certificate
- SkyNet continues to use internal HTTP between containers

---

## Option 3: Secure-Context Dev HTTPS

Use this when browser APIs or dev options require HTTPS locally.

Start the dev stack behind local Caddy:

```bash
docker compose -f docker-compose.dev.yml -f docker-compose.dev-https.yml up -d
```

Open:

```text
https://localhost:8443
```

Files:
- [docker-compose.dev-https.yml](../docker-compose.dev-https.yml)
- [infra/caddy/Caddyfile.dev](../infra/caddy/Caddyfile.dev)

Notes:
- the dev overlay uses `tls internal`
- browsers may ask you to trust Caddy's local CA the first time
- this is for development only, not public hosting
- if you want copied tracker snippets to use `https://localhost:8443`, set `APP_BASE_URL=https://localhost:8443` or save that value in Settings while testing

---

## Settings Domain

SkyNet now exposes HTTPS deployment settings in the dashboard under **Settings → Access & Network**:
- Public Base URL
- HTTPS Mode
- Edge Provider
- Certificate Mode
- Self-signed certificate generation
- Let's Encrypt HTTP/DNS configuration
- Uploaded PEM certificate staging
- Trust Proxy Headers
- HSTS

UI file:
- [frontend/src/pages/settings/HttpsTab.jsx](../frontend/src/pages/settings/HttpsTab.jsx)

Important:
- runtime settings are still in-memory today
- the theme registry persists separately in the database; this note only applies to the general runtime settings object
- for persistent deployments, also mirror these values in `backend/.env`
- self-signed generation writes files to `backend/data/certs/self-signed`
- uploaded PEM files are stored in `backend/data/certs/uploaded`
- Let's Encrypt HTTP challenge works automatically with the bundled Caddy edge profile once the public hostname resolves to the host and ports 80/443 are reachable
- Let's Encrypt DNS settings are stored in SkyNet, but DNS issuance still needs an ACME-capable DNS client or custom Caddy build at the edge

---

## Recommended Values by Environment

| Environment | Recommendation |
|-------------|----------------|
| Home server with domain and port forwarding | `edge + caddy` |
| Home server with ISP/CGNAT blocking inbound ports | `edge + cloudflare_tunnel` |
| Proxmox with central reverse proxy VM/LXC | `edge + reverse_proxy` |
| VPS | `edge + caddy` |
| Local secure-context development | `off` for normal dev, `edge + caddy` via dev HTTPS overlay when needed |

---

## Troubleshooting

- Mixed-content errors in tracked apps:
  `APP_BASE_URL` is still `http://...` somewhere.
- Tracker snippet shows the wrong origin:
  save the Public Base URL in Settings and mirror it in `backend/.env`.
- Theme logos work locally but not through the public frontend:
  uploaded theme logos resolve through `/api/v1/themes/{id}/logo`, so your edge must forward `/api/` correctly to the backend.
- HSTS header missing:
  ensure `APP_HSTS_ENABLED=true`, public URL is `https://...`, and the request host matches that public host.
- Tunnel works but snippets point to LAN IP:
  the public URL is wrong; do not use internal IPs in `APP_BASE_URL`.
- Browser console shows `static.cloudflareinsights.com/beacon.min.js` CORS, DNS, or SRI errors:
  this script is injected by Cloudflare Web Analytics at the edge, not by SkyNet. Disable Cloudflare Web Analytics / Browser Insights for the zone, or fix outbound DNS/connectivity from the client network to `static.cloudflareinsights.com`.
- Browser console shows `installHook.js.map` or `react_devtools_backend_compact.js.map` errors:
  these usually come from browser extensions such as React DevTools, not from the production SkyNet bundle.
