# SkyNet

> Self-hosted user-centric security intelligence platform.
> Track, profile, and risk-score users across devices and platforms. Own your data.

---

## What is SkyNet?

SkyNet is a **self-hosted security intelligence platform** that turns device fingerprinting into full user-level behavioral analysis. Integrate it with any website, mobile app, or API. It gives you:

- **Visitor tracking** — who visits, from where, on which device
- **Device fingerprinting** — canvas, WebGL, and richer browser entropy signals combined into a persistent identity
- **Device identity foundation** — signed `_skynet_did` continuity cookie plus fingerprint confidence/stability scoring across visits
- **Same-machine grouping** — strict cross-browser clustering for Chrome/Firefox fingerprints from the same hardware
- **Identity linking** — connect external OIDC/JWKS-authenticated end-users to device fingerprints across platforms
- **Cross-device correlation** — one user, many devices; fraud signal when one device is shared by many users
- **User-level risk scoring** — aggregate device risk + behavioral anomalies into a per-user composite score (0.0–1.0)
- **Risk history** — time-series snapshots of each user's risk score with spike auto-detection
- **Anomaly flags** — multi-account abuse, impossible travel, new devices, headless browsers, geo jumps
- **Activity timeline** — structured login/pageview/custom events per authenticated user
- **Enhanced audit mode** — extra authenticated-activity audit metadata for investigated users
- **Blocking engine** — block by IP, CIDR, country, ASN, user-agent, or device fingerprint
- **Anti-evasion** — detect VPN, Tor, proxy, headless browsers, crawler signatures, click farms, DNSBL-listed IPs, form spam, and IP rotation, with regional DNSBL soft-fail support for noisy dynamic-IP markets
- **Active gateway** — reverse proxy mode with allow/challenge/block decisions, challenge flows, and live gateway analytics on the Overview dashboard
- **Access & network policy** — runtime-controlled allowed domains, browser CORS trust, trusted proxy handling, IP allow/deny lists, and per-IP request limits
- **Authentication & identity control plane** — local operator auth, guarded `superadmin` tier, tenant accounts, and tenant-bound operator assignment for protected-app fleets
- **Theme engine** — admin-managed global themes, per-user theme selection, tenant-aware defaults, branding/logo upload, shell-level header/nav/footer/body control, and curated widget sets
- **Operator UX** — fixed desktop shell, viewport-aware settings/editor modals, a domain-organized settings experience, and a compact overview layout with symmetric fixed-height analyst cards
- **GeoIP enrichment** — country, city, flag emoji on every new visitor via `ip-api.com` by default or an uploaded local `.mmdb` database
- **Embeddable tracker** — one `<script>` tag on any site, SDK for mobile/API

---

## Architecture

```
Protected App  ──JWT──►  SKYNET Backend  ──JWKS──►  External OIDC / JWKS IdP
skynet.js      ──Key──►  SKYNET Backend             (end-user auth only)
                              │
                    Identity + Risk Engine
                              │
                    PostgreSQL · Redis
                              │
                    SKYNET Dashboard (operators)
                    (local auth — never external IdP)
```

**Separation of concerns:**
- **External IdP** = Identity (issues tokens to end-users of protected apps)
- **SKYNET** = Trust / Risk / Behavior (validates tokens, links identities, scores risk)
- **Theme Engine** = Operator-facing presentation runtime (global registry + per-user resolution + branding assets served by the backend)
- **SKYNET operators** always authenticate locally — external IdPs are never used for dashboard login

---

## Quick Start

```bash
git clone https://github.com/Skynet-Marwen/App.git skynet && cd skynet
cp backend/.env.example backend/.env   # set APP_SECRET_KEY and JWT_SECRET
docker compose up -d
```

Dashboard: `http://localhost:3000` — Login: `admin@skynet.local` / `admin`
Shared Keycloak: `https://auth.mouwaten.org` or `http://10.0.0.39:8080`  (hosted by the `mouwaten` stack)

> Change both default passwords on first deployment.

Need public HTTPS or secure-context dev?

- Public edge HTTPS: [docs/HTTPS.md](docs/HTTPS.md)
- Local dev HTTPS overlay: `docker compose -f docker-compose.dev.yml -f docker-compose.dev-https.yml up -d`

---

## Settings Domains

The admin console now groups settings into 9 domains instead of one long flat tab row:

1. Security & Detection
2. Access & Network
3. Authentication & Identity
4. UI / Theme Engine
5. Data & Storage
6. Integrations
7. Notifications & Messaging
8. Blocking & Response
9. System & Debug

This keeps the shipped controls easy to find while leaving clear space for future SaaS, response-engine, and deep-risk features.

Notifications & Messaging now includes SMTP delivery, signed webhook alerts, operator-side webhook test sends, escalation reminders for open incidents, and a recent delivery log for troubleshooting.
Access & Network now includes real host allowlisting, CORS origin/method/header policy, trusted proxy-aware client IP extraction, IP allow/deny controls, and runtime rate-limit buckets for auth, tracking, and general API traffic.
Authentication & Identity now includes a live `superadmin` tier, tenant account registry, and tenant-bound operator assignment; UI / Theme Engine now includes runtime shell-mode, width, sticky-header, and widget-set controls.
Data & Storage now includes storage health, cache pressure, retention archive export, and retention cleanup actions; Integrations now includes API-access governance, threat-intel refresh, and live SIEM / monitoring connectors.

## Operational Truths

SkyNet now prefers explicit "no data yet" states over synthetic dashboard filler:

- Overview hotspot, investigation, and enforcement widgets only render backend-derived signals.
- Integration site cards show real per-site aggregates from `visitors`, `events`, and blocked visitors instead of placeholder zeroes.
- Overview visitor and unique-user deltas are computed against the previous matching time window.
- The blocked total is a point-in-time posture count, so the UI intentionally avoids a fake trend percentage for it until a comparable historical series exists.

---

## Theme Engine

SkyNet now includes a backend-backed operator theme engine:

- global theme registry managed by admins
- per-user theme override with backend persistence
- tenant-level default theme linkage for default-theme operators
- default theme assignment for newly created accounts
- safe fallback to the active default when a stored theme is missing or inactive
- granular shell styling for body, header, nav, footer, panels, shell mode, content width, sticky header, and sidebar width
- curated widget-set control for the Overview dashboard, with empty widget lists inheriting the platform default dashboard
- uploaded logo branding served from `GET /api/v1/themes/{theme_id}/logo`

Theme assets live under `backend/data/theme-assets/` and should be treated as persistent deployment data.

---

## Latest Release Highlights

The current release also includes the newer device-identity and active-gateway foundation:

- signed first-party `_skynet_did` continuity cookie issued by the tracker/backend handshake
- richer browser entropy capture: hardware concurrency, device memory, connection type, touch points, plugin count, `performance.now()` resolution, and rAF jitter
- per-device fingerprint confidence and stability scoring to measure how trustworthy and drift-resistant the collected signal set is
- gateway request analytics: proxy traffic, bot pressure, latency, and challenge outcomes in Overview
- Security Center manual scans now survive malformed upstream threat-intel rows and report target-level issues inline instead of collapsing into a generic scan failure
- post-`1.6.0` settings completion for `superadmin`, tenant accounts, tenant-bound operators, and runtime theme shell/widget controls
- post-`1.6.9` settings completion for storage lifecycle operations, integration API governance, and signed SIEM / monitoring connector delivery
- post-`1.6.10` group-parent escalation orchestration plus DNSBL soft-fail defaults for dynamic-IP regions such as Tunisia
- post-`1.7.1` anti-evasion language-mismatch softening for multilingual countries: Tunisia now treats Arabic, French, and English device/browser language settings as locally normal
- post-`1.6.10` overview-density pass: compact stat strip, shorter traffic heatmap, lightweight Threat Hotspots ranking bars instead of the animated globe, and fixed-height scrollable analyst cards for cleaner same-row symmetry
- Mouwaten-style first-party relay support: same-origin tracker bootstrapping, same-origin challenge flow, and no raw SkyNet site key in the public bootstrap config
- visitor attribution and browser classification hardening: better shared-network separation, stronger desktop/mobile detection, and tighter visitor-to-device/user ownership reconciliation
- intelligence delete cleanup: visitor, device, and external-user deletion now clear related indicators and recompute affected Portal User Intelligence profiles instead of leaving stale devices, flags, or counts behind

---

## Embed the Tracker

```html
<script async src="https://skynet.yourdomain.com/s/YOUR_SITE_API_KEY.js"></script>
```

Get your site API key from **Integration → Add Site** in the dashboard.
Use the stealth `/s/<site_key>.js` path by default; it is the blocker-resistant public loader and injects the matching `/w/<site_key>/*` ingest paths automatically.
Direct browser deployments should also expose the same-origin bait route `/ads.js` to SkyNet so the tracker can distinguish browser-level ad/tracker blocking from upstream DNS/network filtering.
The site API key is a public integration identifier, not an operator secret. For aggressive blocker environments, proxy the tracker through the protected app's own domain so the browser never sees the raw SkyNet site key at all.
The bundled tracker now also maintains a signed first-party `_skynet_did` cookie so device continuity can survive moderate fingerprint drift.
Browser-side adblock detection remains opt-in in Anti-Evasion settings until the new script-tag probe is revalidated on production traffic; DNS-filter detection can stay enabled independently.

---

## Identity Integration (OIDC / Keycloak Example)

After a user authenticates in your app via any configured external OIDC/JWKS provider, send their token to SKYNET.
`fingerprint_id` means the SKYNET device UUID (`devices.id`), not the raw tracker fingerprint string. The bundled tracker now exposes that UUID helper directly in the browser via `SkyNet.getDeviceId()`.
For direct browser integration, call SkyNet itself. For blocker-sensitive or plain-HTTP app environments, proxy these calls through your own backend or edge and keep the site API key server-side.

```js
// After the tracker has loaded:
const skynetDeviceId = await SkyNet.getDeviceId();

await fetch('https://skynet.yourdomain.com/api/v1/identity/link', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${externalAccessToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    fingerprint_id: skynetDeviceId,
    platform: 'web',
  }),
});
```

Response: `{ user_id, trust_level, risk_score, flags[] }`

You can also resolve the full device context manually through `POST /api/v1/track/device-context`, and the tracker exposes `SkyNet.getDeviceContext()` plus `SkyNet.getFingerprint()` for custom flows. The returned context now includes cookie-backed continuity plus fingerprint confidence/stability metadata.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Dashboard | React 19 + Vite + Tailwind CSS 4 |
| API | FastAPI (Python 3.12) + SQLAlchemy |
| Database | PostgreSQL 16 |
| Cache / Sessions | Redis 7 |
| Identity Provider | Keycloak 24 or any JWKS-capable OIDC provider (for end-users of protected apps) |
| Deployment | Docker Compose |

---

## Documentation

| Document | Purpose |
|----------|---------|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design, data flows, DB schema |
| [docs/API.md](docs/API.md) | Full REST API reference |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Unified deploy/rollback system and target schema |
| [docs/LOGIC.md](docs/LOGIC.md) | Detection algorithms and business rules |
| [docs/SECURITY.md](docs/SECURITY.md) | Threat model, secrets, rate limiting |
| [docs/INSTALL.md](docs/INSTALL.md) | Self-hosted deployment guide |
| [docs/HTTPS.md](docs/HTTPS.md) | HTTPS modes: Caddy, reverse proxy, tunnel, dev HTTPS |
| [docs/WORKFLOW.md](docs/WORKFLOW.md) | Git workflow and release process |
| [docs/DEV_PLAN.md](docs/DEV_PLAN.md) | Active sprint and backlog |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Versioned feature roadmap |
| [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) | How to contribute |
| [CHANGELOG.md](CHANGELOG.md) | Release history |
| [CLAUDE.md](CLAUDE.md) | AI assistant behavioral contract |

---

## Version

Current shipped release: **v1.7.1**
Release history and feature milestones are tracked in [CHANGELOG.md](CHANGELOG.md).
