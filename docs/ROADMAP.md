# SkyNet — Roadmap

> This roadmap is intentionally opinionated. Priorities can shift — update when they do.
> Items may move to done on the unreleased branch before a formal release is cut.

---

## v1.0.0 — Foundation ✅ `2026-03-29`
Core scaffold. Functional dashboard. Embeddable tracker. Docker deployment.

- Full-stack scaffold (React + FastAPI + PostgreSQL + Redis)
- All 8 dashboard pages
- Device fingerprinting (canvas, WebGL, audio, font)
- Blocking engine (IP, country, device, user-agent, ASN)
- Anti-evasion detection UI
- Embeddable tracker script (skynet.js)
- JWT auth with default admin (native login only)
- Docker Compose full-stack

---

## v1.1.0 — Hardening ✅ `2026-03-30`
Make v1.0 production-ready. Close all technical debt.

- [x] Alembic migrations (replace `create_all`)
- [x] Rate limiting middleware (slowapi, Redis-backed)
- [x] GeoIP enrichment (provider abstraction + local `.mmdb` support)
- [x] Pydantic schemas layer
- [x] Real chart aggregation queries (traffic heatmap, blocking chart)
- [x] HTTP security headers (CSP, HSTS, X-Frame-Options)
- [x] Redis session store (real session management + revocation)
- [x] Frontend hooks layer
- [x] Audit log table + UI
- [x] Input sanitization (bleach)
- [x] Anti-evasion async background checks
- [x] Strict same-machine device grouping

---

## v1.2.0 — Identity Platform + Operator UX Foundations ✅ `2026-04-02`
Transform SKYNET from device tracker into a user-centric security intelligence platform, while hardening the operator experience around theming, branding, and desktop usability.
This release ships the identity-platform backend, theme engine, and desktop operator UX foundations; analyst-facing intelligence UI remains the next milestone.

- [x] Remove Keycloak SSO for SKYNET operators — local auth only, always
- [x] Keycloak as external IdP for end-users of protected applications
- [x] `POST /identity/link` — link external IdP JWT to device fingerprint
- [x] `POST /track/activity` — authenticated activity tracking
- [x] `identity_links` — persistent user ↔ device mapping
- [x] `user_profiles` — aggregated intelligence profile per external user
- [x] `risk_events` — time-series risk score history
- [x] `activity_events` — structured authenticated-user activity timeline
- [x] `anomaly_flags` — multi-account, impossible travel, new device, risk spike
- [x] `risk_engine` — composite user-level scoring (device scores + behavioral modifiers)
- [x] `jwks_validator` — async JWKS validation with in-process cache + grace period
- [x] Full `/identity/*` and `/risk/*` route groups
- [x] Enhanced audit mode per user (admin-gated)
- [x] Theme registry with admin-managed global themes
- [x] Per-user theme selection + default theme assignment for new accounts
- [x] Branding/logo upload with backend-served theme logo route
- [x] Settings IA reorganized into 9 desktop-friendly domains
- [x] Fixed-shell operator layout (header/nav/footer fixed, `main` scrollable)
- [x] Local Keycloak profile documented as optional; external JWKS-capable OIDC providers remain valid
- [x] Release/version bump from `1.1.0` to `1.2.0`

---

## v1.3.0 — Intelligence UI `Target: Q2 2026`
Build dashboard pages for the identity platform.

- [x] External Users page — UserProfile table (risk score, trust level, device count, flags)
- [x] User detail drawer — risk history chart, device list, activity timeline, anomaly flags
- [x] Integration helper for exposing/exchanging SKYNET `devices.id` to protected apps before `/identity/link`
- [x] Risk leaderboard widget on Overview page (top risky users)
- [x] Anomaly flags management (acknowledge / resolve / false-positive from UI)
- [x] Runtime settings and anti-evasion config persisted in the database
- [x] Desktop UX pass for `Audit`, `Anti-Evasion`, and `Integration`
- [x] Impossible travel detection (activity_events IP + country delta)
- [x] Risk history line chart (time-series per user)
- [x] Activity timeline component (structured events per user)
- [x] Export (CSV/JSON) for identity and risk tables
- [x] Real-time WebSocket visitor feed on Overview
- [x] Activity event retention policy for authenticated-user timelines
- [x] Theme package import/export for registry operations and marketplace-ready single-theme bundles
- [x] Role-aware shell surfaces layered on top of the theme engine

---

## v1.4.0 — Deep Fingerprinting `Target: Q3 2026`
Harden device identity and make risk scoring authoritative.

- [x] Timing fingerprint (`performance.now()` resolution, rAF jitter)
- [x] Navigator entropy (hardwareConcurrency, deviceMemory, connection type)
- [x] Composite fingerprint score: weighted hash of all signals
- [x] Fingerprint stability tracking across sessions (drift detection)
- [x] HMAC-SHA256 signed device cookie (`skynet_did`)
- [x] Clock skew detection (client TZ offset vs GeoIP)
- [x] Behavioral entropy (mouse movement, scroll cadence, click timing)
- [x] Risk score thresholds: auto-flag (>0.60), auto-challenge (>0.80), auto-block (>0.95)
- [x] Anti-spam sliding window (Redis per device)
- [x] Multi-IdP JWT validation (Keycloak + additional JWKS-backed providers)

---

## v1.5.0 — Experience `Target: Q4 2026`
Make the dashboard pleasant to use at scale.

- [x] Chart drill-downs (click country → filter visitors)
- [x] Saved filter presets
- [x] Bulk actions (block selected, export selection)
- [x] Global search bar (across all entities)
- [x] Email / webhook notifications on high-severity incidents
- [x] Dashboard onboarding wizard (first-run flow)
- [x] Curated starter packs and theme marketplace flow
- [x] Dynamic themes by risk level / tenant

---

## v1.6.0 — Active Gateway ✅ `2026-04-02`
SKYNET evolves from observer to active enforcement gateway.

- [x] Reverse proxy mode: route requests through SKYNET before origin
- [x] Decision engine: ALLOW / CHALLENGE / BLOCK per request (sub-10ms via Redis)
- [x] Challenge types: CAPTCHA redirect, JS proof-of-work, honeypot
- [x] Bot detection pipeline: headless signals, crawler signatures, click farm
- [x] Form spam: honeypot fields, submission velocity, content deduplication
- [x] DNSBL integration (submitter IP vs public abuse databases)
- [x] Gateway dashboard: traffic overview, bot %, latency, challenge analytics

---

## v2.0.0 — Multi-Tenancy `Target: 2027`
Support multiple organizations on one SkyNet instance.

- [ ] Tenant isolation (organizations, members, roles)
- [ ] Per-tenant site management
- [ ] Per-tenant billing hooks
- [ ] Admin super-panel
- [ ] API v2 with tenant context

---

## Out of Scope

- Built-in email provider (use webhooks → your own email service)
- Mobile native app (PWA via the dashboard is sufficient)
- Paid cloud hosting (self-hosted-first project)
