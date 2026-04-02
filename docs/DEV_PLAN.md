# SkyNet — Development Plan

> Update this file at the start and end of every work session.
> This is the single source of truth for project state.

---

## Current Version: `1.6.0`
## Phase: Release complete for the active gateway milestone; next focus is `v2.0.0` multi-tenancy

---

## In Progress

- [ ] Run migrations 0005–0011 in all deployment environments

---

## Done (Unreleased Branch)

- [x] 2026-04-02 — feat(gateway-dashboard): shipped proxy analytics on the Overview dashboard and closed the last v1.6.0 item before release prep
  - **Added:** structured `gateway_allow`, `gateway_challenge`, `gateway_block`, and `gateway_challenge_result` events for proxy analytics
  - **Added:** gateway dashboard metrics on `GET /api/v1/stats/overview` covering request volume, bot pressure, challenge rate, latency, top reasons, and challenge outcomes
  - **Changed:** Overview now surfaces gateway operations as a first-class analyst widget instead of leaving gateway status buried in settings only
  - **Changed:** docs, roadmap state, and release prep notes now reflect the completed active-gateway analytics slice

- [x] 2026-04-02 — feat(gateway+antiabuse): challenge pages, bot pipeline, form-spam heuristics, DNSBL checks, and tenant-aware dynamic themes shipped together
  - **Added:** gateway challenge modes for JavaScript proof-of-work, redirect handoff, and honeypot continue flows with short-lived bypass cookies
  - **Added:** crawler-signature, headless-signal, click-farm, honeypot-form, submission-velocity, and content-deduplication detections in the anti-evasion pipeline
  - **Added:** public DNSBL lookups with cached provider hits and operator-selectable challenge vs block behavior
  - **Changed:** `tracker/skynet.js` now captures `navigator.webdriver`, auto-reports form submission metadata, and follows challenge redirects from `/track/check-access`
  - **Changed:** dynamic theme policy now supports host-based tenant maps in addition to risk-band overrides, and the Settings / Anti-Evasion UX reflects the new live roadmap status

- [x] 2026-04-02 — feat(gateway+experience): Keycloak realm sync, deep fingerprint scoring, onboarding, starter packs, and gateway MVP shipped together
  - **Added:** composite fingerprint hash/score, timezone-offset clock-skew detection, and device-level assessment fields via migration `0016`
  - **Added:** explicit user-risk enforcement thresholds for auto-flag, auto-challenge, and auto-block with threshold anomaly flags
  - **Added:** Keycloak Admin API realm sync controls plus `/api/v1/identity/sync/keycloak` for pre-loading external users like `mouwaten`
  - **Added:** dashboard onboarding wizard, curated theme starter-pack installs, and risk-aware dynamic theme resolution for default-theme operators
  - **Added:** `/api/v1/gateway/proxy/*` and `/api/v1/gateway/status` as the first reverse-proxy / decision-engine slice
  - **Changed:** tracker payloads now include raw timezone offset, and devices surface composite fingerprint + clock-skew metadata in the dashboard

- [x] 2026-04-02 — feat(device-identity): signed continuity cookie and fingerprint stability foundation landed on the active branch
  - **Added:** signed `_skynet_did` device continuity cookie with backend issuance/verification and tracker reuse
  - **Added:** tracker navigator/timing entropy capture (`hardware_concurrency`, `device_memory`, `connection_type`, `touch_points`, plugin count, clock resolution, rAF jitter)
  - **Added:** per-device `fingerprint_confidence`, `stability_score`, and persisted fingerprint snapshots
  - **Added:** migration `0015_device_identity_foundation` plus focused backend unit coverage in `backend/tests/test_device_fingerprint.py`
  - **Changed:** tracker device-context/pageview flows now resolve devices by signed cookie continuity before falling back to raw fingerprint only

---

## Done (Operator UX + Theme Engine Foundations — v1.2.0, 2026-04-02)

- [x] 2026-04-02 — feat(identity+alerts): multi-IdP auth, entropy scoring, anti-spam window, and high-severity incident alerts shipped together
  - **Added:** multi-provider JWKS validation via runtime `idp_providers`, issuer-based provider selection, and persisted `identity_links.id_provider`
  - **Added:** tracker behavior snapshots plus low-entropy interaction detection with `behavior_drift` anomaly flags
  - **Added:** Redis sliding-window spam detection keyed by device/fingerprint context instead of the older fixed counter
  - **Added:** high-severity incident email + webhook notifications, plus coordinated Auth / Notifications feature-state in Settings
  - **Changed:** deployment rollout remains pending for real environments; code and docs are ready, but migrations still must be applied on deployed targets

- [x] 2026-04-02 — feat(portal-users): external-user intelligence UI shipped on top of `/identity/*` and `/risk/*`
  - **Added:** real Portal Users table with search, trust/risk filters, and recompute actions
  - **Added:** full-height intelligence drawer with risk history chart, linked devices, activity timeline, and anomaly flag actions
  - **Changed:** `/users` is now an analyst-facing intelligence surface instead of a placeholder marketing page
- [x] 2026-04-02 — feat(overview): risk leaderboard widget shipped on dashboard overview
  - **Added:** `risk_leaderboard` summary payload on `GET /api/v1/stats/overview`
  - **Added:** Overview risk card surfacing highest-risk external identities with open-flag context and direct jump to Portal Users
  - **Changed:** `v1.3.0` analyst workflow now starts from Overview instead of requiring the Portal Users page first
- [x] 2026-04-02 — feat(theme): backend-backed theme registry and per-user theme resolution
  - **Added:** `themes` CRUD, default theme promotion, per-user theme selection, safe fallback resolution
  - **Added:** theme branding/logo upload and API-served logo delivery
  - **Added:** theme shell controls for body, header, nav, footer, panel surfaces, and widget metadata
- [x] 2026-04-02 — feat(settings): new domain-based settings IA
  - **Added:** 9 grouped settings domains with sticky left navigation and roadmap cards
  - **Changed:** settings moved away from the previous flat tab strip
- [x] 2026-04-02 — fix(frontend): desktop shell and content ergonomics
  - **Changed:** fixed shell layout (header/nav/footer pinned, `main` scrollable)
  - **Changed:** centered desktop content frame and improved card/table/action spacing
  - **Fixed:** oversized modal/settings overflow and viewport clipping
- [x] 2026-04-02 — feat(integration): shipped device UUID handoff helper for protected apps
  - **Added:** `POST /api/v1/track/device-context` — public helper to resolve/create SKYNET `devices.id` from tracker signals
  - **Added:** tracker browser helpers `SkyNet.getDeviceId()`, `SkyNet.getDeviceContext()`, and `SkyNet.getFingerprint()`
  - **Changed:** Integration snippets, install docs, and identity examples now use the built-in helper instead of app-specific glue
- [x] 2026-04-02 — test(identity): backend coverage added for identity linking, risk scoring, and JWKS validation
  - **Added:** `backend/tests/test_identity_service.py` covering profile upsert, device linking, and multi-account flagging
  - **Added:** `backend/tests/test_risk_engine.py` covering trust thresholds, weighted risk recompute, and spike flag creation
  - **Added:** `backend/tests/test_jwks_validator.py` covering cache hits, grace-period fallback, and token validation failure modes
- [x] 2026-04-02 — feat(settings): runtime settings and anti-evasion config are now persisted in the database
  - **Added:** `runtime_config` single-row persistence store plus migration `0014`
  - **Changed:** `/settings`, `/anti-evasion/config`, SMTP/HTTPS settings flows, startup env seeding, and backup/restore now read/write durable config instead of memory-only state
  - **Fixed:** general settings and anti-evasion configuration now survive backend restarts
- [x] 2026-04-02 — fix(frontend): completed desktop UX pass for remaining route pages
  - **Changed:** `Audit` now includes summary cards, clearer filtering, and better operator hierarchy
  - **Changed:** `Anti-Evasion` now surfaces incident posture, grouped controls, and a clearer save workflow
  - **Changed:** `Integration` now includes rollout metrics, cleaner site cards, and a structured snippet modal
- [x] 2026-04-02 — feat(identity): impossible-travel detection now flags risky authenticated geo jumps
  - **Added:** activity-intelligence heuristics on `POST /track/activity` comparing consecutive country/IP changes inside a short time window
  - **Added:** automatic `impossible_travel` anomaly flags and immediate risk recompute when the heuristic triggers
  - **Changed:** authenticated activity tracking now refreshes the external user profile alongside the event write
- [x] 2026-04-02 — feat(portal-users): export flows shipped for analyst intelligence work
  - **Added:** Portal Users CSV/JSON export for the full filtered table, not just the current visible page
  - **Added:** selected-user intelligence bundle export covering profile, devices, risk history, activity, and flags
- [x] 2026-04-02 — feat(overview): live websocket realtime feed wired into the dashboard HUD
  - **Added:** `GET /api/v1/stats/realtime` snapshot extraction now also powers `WS /api/v1/stats/realtime/ws`
  - **Changed:** Overview prefers a live socket and falls back to polling if the websocket is unavailable
- [x] 2026-04-02 — chore(infra): backend container health check added to Compose
  - **Added:** Docker health check for `backend` hitting `/api/health` from inside the container
  - **Changed:** compose status now exposes backend liveness alongside Postgres, Redis, and optional Keycloak
- [x] 2026-04-02 — feat(theme): theme packaging, role-aware shell surfaces, and activity retention shipped
  - **Added:** runtime pruning for `activity_events` using the live `event_retention_days` setting
  - **Added:** `GET /api/v1/themes/{id}/export` and `POST /api/v1/themes/import` for marketplace-ready single-theme JSON packages with optional embedded logo assets
  - **Added:** theme admin registry package import/export UX plus theme-editor presets for `layout.role_surfaces`
  - **Changed:** the sidebar now honors theme-defined role surface rules to hide or relabel navigation entries per operator role
- [x] 2026-04-02 — feat(experience): search, drill-downs, presets, and bulk visitor workflows shipped together
  - **Added:** `GET /api/v1/search` powering a topbar global search across visitors, devices, and portal users
  - **Added:** Overview hotspot / investigation drill-down into Visitors using URL-driven filters
  - **Added:** Visitors saved filter presets and bulk selection actions for block/export on the current visible slice
  - **Changed:** Settings now show coordinated feature-status summary stats derived from the same capability map used across the page

---

## Done (Identity Platform Backend — v1.2.0, 2026-03-31)

- [x] 2026-03-31 — feat(infra): unified multi-target deployment CLI
  - **Added:** `./skynet` launcher with `deploy`, `restart`, `status`, `rollback`, and `list-targets`
  - **Added:** release-based deploy engine with `current`/`previous` symlinks and incremental `rsync --link-dest`
  - **Added:** `infra/targets.example.json` for local, Synology, and future VPS targets
  - **Added:** `/api/health` alias for deploy health checks
  - **Changed:** install/workflow docs now point to the unified deployment system
- [x] 2026-03-31 — feat(deployment): HTTPS deployment modes and settings foundation
  - **Added:** Settings → HTTPS & Access tab for public URL, HTTPS mode, edge provider, proxy trust, and HSTS
  - **Added:** `docker-compose.https.yml` + `infra/caddy/Caddyfile` for public edge TLS with Caddy
  - **Added:** `docker-compose.tunnel.yml` for Cloudflare Tunnel deployments with no inbound ports
  - **Added:** `docker-compose.dev-https.yml` + `infra/caddy/Caddyfile.dev` for secure-context local development
  - **Changed:** Integration snippets now prefer the configured public base URL instead of the current dashboard origin
  - **Changed:** HSTS is now conditional on HTTPS host matching instead of being sent on every response
- [x] 2026-03-31 — feat(identity): complete identity platform redesign
  - **Removed:** Keycloak SSO for SKYNET operators (`users.keycloak_id`, SSO settings, AuthTab card, AuthOperatorsPanel badge)
  - **Added:** `identity_links` — persistent user ↔ device mapping table (migration 0006)
  - **Added:** `user_profiles` — aggregated intelligence profile per external user (migration 0007)
  - **Added:** `risk_events` — time-series risk score history (migration 0008)
  - **Added:** `activity_events` — structured authenticated-user activity timeline (migration 0009)
  - **Added:** `anomaly_flags` — security anomaly records per user (migration 0010)
  - **Added:** devices extended with `owner_user_id`, `shared_user_count`, `last_known_platform` (migration 0011)
  - **Added:** `services/jwks_validator.py` — async JWKS fetch, in-process cache, 10-min grace period
  - **Added:** `services/identity_service.py` — link upsert, multi-account detection, device ownership
  - **Added:** `services/risk_engine.py` — composite scoring (device scores + modifiers), spike flagging, trust levels
  - **Added:** `routes/identity.py` — 8 endpoints: link, profile, devices, risk-history, activity, flags, enhanced-audit
  - **Added:** `routes/risk.py` — list risky users, manual recompute
  - **Added:** `POST /track/activity` — authenticated activity tracking via external IdP JWT
  - **Added:** `KEYCLOAK_JWKS_URL/ISSUER/AUDIENCE/CACHE_TTL_SEC` env vars + startup seeding
  - **Changed:** Settings Auth card now configures JWT validation for end-users (not operator SSO)
  - **Changed:** Documentation now reflects the shipped `1.2.0` identity-platform release

---

## Done (Release 1.1.0 — 2026-03-30)

- [x] 2026-03-30 — feat(devices): strict same-machine grouping (match_key via migration 0004)
- [x] 2026-03-30 — feat(auth): Redis-backed session enforcement (JWT sid + Redis session store)
- [x] 2026-03-30 — feat(audit): write-only audit log backend + dashboard page
- [x] 2026-03-30 — feat(geoip): MaxMind GeoLite2 enrichment on visitor upsert
- [x] 2026-03-30 — feat(geoip+smtp): GeoIP provider switching + SMTP email service
- [x] 2026-03-30 — security(middleware): HTTP security headers (CSP, HSTS, X-Frame-Options DENY)
- [x] 2026-03-30 — feat(rate-limit): slowapi rate limiter with typed 429 responses
- [x] 2026-03-30 — refactor(frontend): hooks layer extracted from pages
- [x] 2026-03-30 — security(input): bleach-backed HTML stripping on all stored user input
- [x] 2026-03-30 — feat(anti-evasion): async in-process checks after tracking writes
- [x] 2026-03-30 — feat(delete): DELETE /devices/{id} and DELETE /visitors/{id}

---

## Done (v1.0.0 Foundation — 2026-03-29)

- [x] Full-stack scaffold (React + FastAPI + PostgreSQL + Redis)
- [x] Embeddable tracker script (skynet.js)
- [x] Docker Compose full-stack deployment
- [x] JWT authentication + auto-created default admin
- [x] All 8 dashboard pages
- [x] CLAUDE.md behavioral contract
- [x] docs/ directory (all 11 documents)
- [x] shared/ contracts (error_codes.json, event_types.json)

---

## Backlog — Priority Order

### P0 — Critical (needed for identity platform to be usable)

### P1 — High
- [x] Activity event retention policy — prune activity_events older than retention setting
- [x] Theme import/export and marketplace-ready theme packaging
- [x] Role-based UI surface differences layered on top of the theme engine

### P2 — Medium
- [x] Chart drill-downs — click country → filter visitors
- [x] Anti-spam sliding window (Redis per device)
- [x] Behavioral entropy scoring (scroll/click timing)
- [x] Multi-IdP support — `id_provider` field already in identity_links; add Google/GitHub resolvers
- [x] Dynamic themes by risk / tenant
- [x] Challenge types and gateway friction flows
- [x] Form spam and DNSBL enforcement hooks

### P3 — Low
- [ ] Dashboard onboarding wizard (first-run flow)
- [ ] Theme import/export UX and curated starter packs
- [ ] `skynet.dev.js` — unminified tracker for dev debugging
- [ ] `shared/error_codes.json` usage in frontend

---

## Blocked

*(none currently)*

---

## Technical Debt Log

| Debt | Introduced | Impact | Resolution Target |
|------|-----------|--------|------------------|
| VITE_HMR_HOST hardcoded in dev compose | v1.0.0 | Must change per deployment | v1.3.0 |
| activity_events no partitioning | unreleased identity branch | Slow queries at scale | v1.4.0 |
