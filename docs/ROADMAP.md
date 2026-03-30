# SkyNet — Roadmap

> This roadmap is intentionally opinionated. Priorities can shift — update this file when they do.

---

## v1.0.0 — Foundation ✅ `2026-03-29`
Core scaffold. Functional dashboard. Embeddable tracker. Docker deployment.

- Full-stack scaffold (React + FastAPI + PostgreSQL + Redis)
- All 8 dashboard pages
- Device fingerprinting (canvas, WebGL, audio, font)
- Blocking engine (IP, country, device, user-agent, ASN)
- Anti-evasion detection UI
- Embeddable tracker script (skynet.js)
- JWT auth with default admin
- Keycloak settings UI
- Docker Compose full-stack

---

## v1.1.0 — Hardening `Target: Q2 2026`
Make v1.0 production-ready. Close all technical debt.

- [ ] Alembic migrations (replace `create_all`)
- [ ] Rate limiting middleware (slowapi, Redis-backed)
- [ ] GeoIP enrichment (MaxMind GeoLite2)
- [ ] Redis session store (real session management)
- [ ] Pydantic schemas layer (extract from routes)
- [ ] Frontend hooks layer (`useVisitors`, `useUsers`, etc.)
- [ ] Real chart aggregation queries (no more mock data)
- [ ] Audit log table + UI
- [ ] HTTP security headers (CSP, HSTS, X-Frame-Options)
- [ ] Input sanitization (strip HTML from user-supplied fields)
- [ ] Anti-evasion async background checks

---

## v1.2.0 — Intelligence `Target: Q3 2026`
Make the detection smarter and more automated.

- [ ] Real-time WebSocket visitor feed on Overview
- [ ] Behavioral bot detection (mouse entropy, click timing)
- [ ] Tor/VPN IP list auto-update (daily background task)
- [ ] Device risk score live recalculation on each pageview
- [ ] Anti-spam sliding window (Redis-backed per device)
- [ ] Keycloak user sync background task (15-min APScheduler)
- [ ] Keycloak OAuth2 callback flow
- [ ] IP rotation detection (Redis sliding window)
- [ ] Multi-account detection alerts

---

## v1.3.0 — Experience `Target: Q4 2026`
Make the dashboard pleasant to use at scale.

- [ ] Chart drill-downs (click country → filter visitors)
- [ ] Export (CSV, JSON) for all data tables
- [ ] Saved filter presets
- [ ] Dashboard onboarding wizard (first-run flow)
- [ ] Email / webhook notifications on high-severity incidents
- [ ] Bulk actions (block selected visitors, export selection)
- [ ] Search across all entities (global search bar)
- [ ] Dark/light theme toggle

---

## v1.4.0 — Trust & Identity `Target: Q1 2027`
Harden device identity, make risk scoring authoritative, lock down geo access.

### Multi-Layer Browser Fingerprinting
- [ ] **Canvas fingerprint** — already collected; add per-browser variance normalization
- [ ] **WebGL fingerprint** — renderer + vendor string + precision floats
- [ ] **Audio fingerprint** — OfflineAudioContext signal hash
- [ ] **Font enumeration** — CSS `@font-face` probe list (300+ fonts)
- [ ] **Timing fingerprint** — `performance.now()` resolution, requestAnimationFrame jitter
- [ ] **Navigator entropy** — hardwareConcurrency, deviceMemory, connection type
- [ ] Composite fingerprint score: weighted hash of all signals
- [ ] Fingerprint stability tracking across sessions (drift detection)

### Server-Side Risk Scoring
- [ ] **Automation detection** — headless browser signals (missing plugins, navigator.webdriver, broken APIs)
- [ ] **Clock skew detection** — compare client-reported timezone offset vs GeoIP expected offset
- [ ] **VPN/proxy detection** — IP reputation DB (IPInfo or custom curated list, daily refresh)
- [ ] **Rate limiting per device** — Redis sliding window: requests/min, pageviews/hour, sessions/day
- [ ] **Behavioral entropy** — mouse movement, scroll cadence, click timing variance vs bots
- [ ] Risk score composition: 0–100 from weighted signal contributions (documented in LOGIC.md)
- [ ] Risk score thresholds: auto-flag (>60), auto-challenge (>80), auto-block (>95)

### HMAC-SHA256 Signed Device Cookies
- [ ] On first pageview: server issues a signed device token (`skynet_did` cookie)
  - Payload: `{ device_id, fingerprint_hash, issued_at, site_id }`
  - Signature: `HMAC-SHA256(payload, APP_SECRET_KEY)`
- [ ] On every subsequent pageview: server verifies signature before trusting device_id
- [ ] Tamper detection: mismatched fingerprint vs cookie → increment risk score + log incident
- [ ] Cookie rotation: re-issue token every 30 days or on fingerprint drift
- [ ] Fallback: if cookie absent/invalid, treat as new device (no silent trust)

### Identity Engine — Smart Device Linking
- [ ] **User parent graph**: one User → many Devices → many Sessions
- [ ] **Auto-linking heuristics**: same IP + same fingerprint within 1h window → suggest link
- [ ] **Cross-device detection**: same user_id seen on multiple fingerprints → merge into user profile
- [ ] **Session continuity**: cookie-based session chaining across browser restarts
- [ ] Dashboard: User detail page shows full device tree + session timeline
- [ ] API: `GET /api/v1/users/{id}/devices` — all linked devices with risk scores
- [ ] API: `POST /api/v1/devices/{id}/link` — manual admin link
- [ ] API: `POST /api/v1/devices/{id}/unlink` — remove association

### Geo-Based Access Control
- [ ] **Country allowlist/blocklist** — already in blocking engine; promote to first-class ACL
- [ ] **Region/state-level rules** — block by MaxMind subdivision (e.g. block specific US states)
- [ ] **City-level rules** — granular block by city name or coordinates + radius
- [ ] **ASN rules** — block by Autonomous System Number (e.g. block all AWS/GCP/Azure ASNs)
- [ ] **ISP rules** — block by ISP name string match (e.g. block "Tor Project", "NordVPN")
- [ ] Geo ACL rule priority order: IP > ASN > ISP > City > Region > Country
- [ ] Dashboard: visual world map with block/allow overlays
- [ ] Real-time geo rule evaluation on every pageview (cached in Redis, 5-min TTL)

---

## v2.0.0 — Multi-Tenancy `Target: 2027`
Support multiple organizations on one SkyNet instance.

- [ ] Tenant isolation (organizations, members, roles)
- [ ] Per-tenant site management
- [ ] Per-tenant billing hooks (usage metering)
- [ ] Admin super-panel (manage all tenants)
- [ ] API v2 with tenant context

---

## Out of Scope (intentionally)

- Built-in email provider (use webhooks → your own email service)
- Mobile native app (PWA via the dashboard is sufficient)
- Paid cloud hosting (this is a self-hosted-first project)
