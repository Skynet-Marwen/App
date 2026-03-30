# Changelog

All notable changes to SkyNet are documented in this file.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html)

---

## [Unreleased]

## [1.1.0] - 2026-03-30

### Added
- `backend/alembic/versions/0004_device_match_groups.py`: adds `devices.match_key`, `devices.match_version`, strict same-machine backfill, and `visitors(site_id, device_id, ip)` lookup index
- `backend/app/services/device_identity.py`: strict cross-browser device grouping helpers (`webgl_hash + screen + timezone + normalized language`) and grouped Devices response shaping
- `GET /api/v1/devices/groups` — grouped device listing for the Devices page; keeps exact fingerprints as child rows under strict same-machine clusters
- `GET /api/v1/devices/{id}` — exact fingerprint detail endpoint for the Devices modal
- `frontend/src/components/ui/DeviceGroupsTable.jsx`: expandable grouped Devices table with child fingerprint actions and shield block/unblock flow
- `backend/app/core/redis.py` + `backend/app/services/sessions.py`: Redis-backed admin session store with JWT `sid` enforcement, session listing, single-session revoke, and user-wide revoke on block/delete
- `backend/alembic/versions/0003_audit_logs.py`: adds `audit_logs` table and indexes
- `GET /api/v1/audit/logs` — paginated, filterable audit endpoint
- `frontend/src/pages/AuditPage.jsx`: dedicated Audit page with search, action filter, target filter, and pagination
- `frontend/src/hooks/`: added `useOverview`, `useVisitors`, `useUsers`, `useUserSessions`, `useDevices`, `useBlocking`, `useAntiEvasion`, `useSettings`, `useSites`, `useAuditLogs`
- `backend/app/services/sanitize.py`: centralized `bleach`-backed sanitization helpers for stored user-supplied text
- `backend/app/services/anti_evasion.py`: async in-process anti-evasion checks for pageviews/events/identify flows
- `DELETE /api/v1/devices/{id}` — permanently deletes a device; nullifies `events.device_id` and `incidents.device_id` (plain-string columns, no DB FK); linked visitors auto-unlinked via DB FK `ondelete=SET NULL`
- `DELETE /api/v1/visitors/{id}` — permanently deletes a visitor and all their events; linked device is preserved but unlinked via DB FK `ondelete=SET NULL`
- `frontend/src/pages/DevicesPage.jsx`: Delete button (trash icon) per row + confirmation modal with impact warning
- `frontend/src/pages/VisitorsPage.jsx`: Delete button (trash icon) per row + confirmation modal with impact warning
- `frontend/src/services/api.js`: added `devicesApi.delete(id)` and `visitorsApi.delete(id)`
- `backend/app/core/geoip.py`: GeoIP lookup service — lazy-loads MaxMind GeoLite2-City reader, fails silently if DB file absent; `lookup(ip)` returns `country`, `country_code`, `country_flag` (Unicode flag emoji), `city`
- `backend/app/middleware/security_headers.py`: HTTP security headers middleware — sets `X-Content-Type-Options`, `X-Frame-Options: DENY`, `X-XSS-Protection`, `Referrer-Policy`, `Permissions-Policy`, `Content-Security-Policy`, `Strict-Transport-Security` on every response
- `docs/ROADMAP.md`: v1.5.0 Keycloak Security Enforcement Layer — Keycloak as security enforcement for tracked websites (event monitoring, user sync, threat correlation, session revocation)
- `docs/ROADMAP.md`: v1.6.0 Active Anti-Bot / Anti-Spam Gateway — reverse proxy mode, bot detection pipeline, spam prevention, gateway dashboard
- `backend/main.py`: integrated `slowapi` rate limiter — `app.state.limiter` bound; `RateLimitExceeded` returns typed 429 response; all route groups can now apply `@limiter.limit()` decorators
- `GET /api/v1/system/info` — no auth required; returns `app`, `api`, `fastapi`, `python`, `sqlalchemy`, `alembic` version strings for the dashboard footer
- `GET /api/v1/settings/block-page` — auth required; returns customisable block-page config (title, subtitle, message, colors, logo, contact email, flags)
- `PUT /api/v1/settings/block-page` — auth required; persists block-page config to `BlockPageConfig` DB row (id=1 singleton)
- `frontend/src/services/api.js`: added `systemApi.info()` → `GET /system/info`
- `frontend/src/services/api.js`: added `settingsApi.getBlockPage()` and `settingsApi.updateBlockPage()` for block-page customisation
- `GET /api/v1/devices/{id}/visitors` — returns all visitors linked to a device fingerprint (multiple browser/OS/IP combos sharing the same hardware fingerprint)
- `frontend/src/services/api.js`: added `devicesApi.visitors(id)`

### Changed
- `backend/app/api/routes/track.py`: pageviews now resolve/create the device before visitor upsert, flush before event creation, preserve separate visitors per `site_id + device_id + ip`, and populate exact device browser/OS/type metadata
- `backend/app/api/routes/devices.py`: exact device responses now expose `match_key` / `match_version`; grouped device summaries aggregate strict same-machine fingerprints without changing exact block/link/delete semantics
- `frontend/src/pages/DevicesPage.jsx`: Devices tab now defaults to grouped same-machine clusters with expandable child fingerprints instead of a flat fingerprint-only table
- `backend/app/core/security.py`: protected requests now validate both JWT and Redis session presence; `sid` is attached to login tokens and touched on authenticated requests
- `backend/app/api/routes/auth.py`: login now creates Redis sessions and audit entries; logout revokes only the current session and writes audit history
- mutating backend admin routes now emit audit entries instead of silently changing state
- tracker routes now dispatch async anti-evasion checks after commit and persist sanitized event payload strings
- frontend dashboard pages now fetch through hooks instead of calling `services/api.js` directly for overview/visitors/users/devices/blocking/anti-evasion/settings/integration/audit domains
- SkyNet admin authentication is **native JWT only** — Keycloak is no longer used or intended for SkyNet dashboard login
- `backend/app/api/routes/stats.py`: overview and realtime endpoints now properly aggregate metrics from Event and Incident tables with distinct visitor counts, summed blocked attempts, device tracking
- `frontend/src/pages/OverviewPage.jsx`: real-time refresh interval reduced from 30s to 10s, overview auto-refreshes every 60s for better metric synchronization
- `backend/main.py`: `version` field now reads from `settings.APP_VERSION` instead of hardcoded string
- `frontend/src/pages/OverviewPage.jsx`: Traffic Over Time area chart replaced with time-based heatmap visualization using CSS Grid; supports 1h/24h/7d/30d modes with normalized color intensity scaling
- `backend/app/api/routes/stats.py`: `GET /api/v1/stats/overview` extended with `traffic_heatmap` field containing pre-aggregated bucket data for heatmap rendering
- `backend/app/api/routes/track.py`: GeoIP enrichment on new visitor creation — `country`, `country_code`, `country_flag`, `city` populated via `geoip_lookup(ip)`
- `backend/app/api/routes/stats.py`: `top_countries` field now populated from real visitor data — grouped by country/flag, sorted by count DESC, limited to 10, with percent share; feeds WorldGlobe visualization
- `backend/app/schemas/stats.py`: `CountryStats` updated — added `count: int`, removed unused `country_code`; matches actual API response and WorldGlobe contract
- `frontend/src/components/ui/TrafficHeatmap.jsx`: new component implementing 3-layer architecture (Container/Grid/Cell) for responsive heatmap display

### Removed
- Keycloak SSO settings tab from `frontend/src/pages/SettingsPage.jsx`
- `GET /api/v1/settings/keycloak` and `PUT /api/v1/settings/keycloak` endpoints
- `KEYCLOAK_*` fields from `backend/app/core/config.py` and `backend/.env.example`
- `settingsApi.keycloak()` and `settingsApi.updateKeycloak()` from `frontend/src/services/api.js`

### Fixed
- `backend/app/api/routes/stats.py`: `traffic_heatmap` was absent from overview response (key was incorrectly named `traffic_chart`); invalid 24h `DATE_TRUNC('minute'::interval * 15, ...)` expression replaced with correct floor-division formula; scoped `sql_text` import replaced with module-level `text`; bucket fill-loop now starts from `since_aligned` (boundary-truncated) to prevent key mismatches against SQL results
- `frontend/src/components/ui/TrafficHeatmap.jsx`: enhanced to production-grade — 30d calendar layout with correct day-of-week offset and trailing padding; custom floating tooltip (replaces browser `title`); meta row (total hits / peak); color legend bar; 7d Y-axis day labels derived from bucket timestamps; improved `cellColor()` interpolation and proportional `cellGlow()` at intensity ≥ 0.4
- `backend/app/api/routes/track.py`: removed `site_id=site.id` from `Incident(...)` constructor — `Incident` model has no such field; would raise `TypeError` on every bot detection event
- `backend/app/schemas/stats.py`: replaced stale `TrafficPoint` / `traffic_chart: List[TrafficPoint]` with `HeatmapBucket` / `traffic_heatmap: List[HeatmapBucket]` in `OverviewResponse` to match actual API contract
- `backend/app/api/routes/stats.py`: `range: str` query parameter shadowed Python's built-in `range()` — fill-loop `for _ in range(expected_count)` called the string `"24h"` as a function → `TypeError` silently caught → `traffic_heatmap=[]` on every request for all time ranges; fixed by renaming param to `time_range` with `alias="range"` to preserve the HTTP contract
- `frontend/src/components/ui/TrafficHeatmap.jsx`: tooltip portalled to `document.body` via `createPortal` — ancestor CSS transforms in dashboard layout created a new stacking context breaking `position: fixed` clientX/Y offset; all grid modes now share identical outer dimensions (`aspectRatio: '24/7'`, 7d reference) so 1h/24h/30d no longer take different amounts of vertical space
- `backend/app/api/routes/devices.py`: `last_seen` / `first_seen` now serialised as ISO 8601 (`isoformat()`) — `strftime` was stripping timezone context and would crash on `None` values
- `frontend/src/pages/DevicesPage.jsx`: timestamps rendered via `fmtDate(iso)` → `toLocaleString()`, displaying in the operator's local timezone
- `backend/app/api/routes/devices.py`: `list_devices` now includes `visitor_count` per device via correlated subquery
- Stats dashboard metrics now synchronized: visitor counts, blocked attempts, events, incidents properly aggregated
- Realtime visitor count now uses distinct visitor IDs in 5-minute rolling window
- Blocked count now includes blocked IPs, visitors, and devices based on status fields
- Basic anti-evasion checks added to track endpoint for bot detection
- Traffic chart now shows hourly visitor/blocked aggregation via SQL DATE_TRUNC
- Blocking activity chart now breaks down by incident type
- `backend/app/api/routes/stats.py`: restored migration support for Alembic revision `0002` (missing file caused backend restart and API 502)
- `backend/alembic/versions/0002_block_page_config.py`: created no-op migration to match `alembic_version` table and avoid startup failure
- `frontend/nginx` proxy 502 resolved after backend restart and migration alignment; API routes now reachable (`/api/v1/system/info`, `/api/v1/stats/overview`, `/api/v1/stats/realtime`)

### Security

---

## [1.0.1] - 2026-03-30

### Added
- Dev stack in `docker-compose.dev.yml`: Vite HMR (port 5173) + uvicorn `--reload` with live volume mounts — code changes reflect in browser without page reload
- `tracker/test-site.html` — standalone single-file test site for SkyNet tracker integration testing (simulates clicks, scroll, mouse movement, form interactions)
- Integration page: multi-tab integration guide (HTML Script, Google Tag Manager, WordPress, Python/Server, REST API curl) with per-tab copy button
- `APP_VERSION` field added to `backend/app/core/config.py`

### Changed
- `frontend/vite.config.js`: added `host: 0.0.0.0`, `port: 5173`, `hmr.host` (via `VITE_HMR_HOST`), `VITE_PROXY_TARGET` env var, `/tracker/` proxy rule
- `docker-compose.dev.yml`: complete rewrite — full dev stack with hot reload for both backend and frontend
- Integration page: "Get Script" button renamed to "Integrate", script modal replaced with tabbed integration guide
- `frontend/package.json`: version bumped from `0.0.0` to `1.0.1`

### Fixed
- `backend/app/models/incident.py`: renamed ORM attribute `metadata` → `extra_data` (SQLAlchemy reserved name conflict caused startup crash on first boot)
- `backend/requirements.txt`: `pydantic` → `pydantic[email]` (missing `email-validator` dependency caused startup crash)
- `backend/requirements.txt`: pinned `bcrypt==4.0.1` (bcrypt 5.x broke passlib 1.7.4 compatibility, caused startup crash)
- `backend/app/api/routes/track.py`: tracker endpoints now accept API key from `?key=` query param in addition to `X-SkyNet-Key` header — required for `sendBeacon()` which cannot set custom headers
- `backend/main.py`: fixed tracker static files path (`../tracker` → `tracker`) — was silently skipping the mount, causing 404 JSON on `/tracker/*`
- `backend/main.py`: added `html=True` to `StaticFiles` mount so `.html` files are served directly

---

## [1.0.0] - 2026-03-29

### Added
- Full-stack scaffold: React 18 + Vite + Tailwind CSS dashboard
- FastAPI backend (Python 3.12) with async SQLAlchemy + PostgreSQL
- Redis integration for sessions and caching
- JWT authentication with auto-created default admin (`admin@skynet.local`)
- **Overview page**: real-time visitor banner, stat cards, traffic chart, top countries, recent incidents
- **Visitors page**: paginated list, search, IP/country/device detail modal, block/unblock
- **Users page**: CRUD, role management, active sessions, Keycloak link indicator
- **Devices page**: fingerprint list, canvas/WebGL hash, risk score, device linking to users
- **Blocking page**: rules engine (IP, country, device, user-agent, ASN), blocked IP list
- **Anti-Evasion page**: detection toggles (VPN, Tor, proxy, headless, bot), fingerprinting config, spam thresholds, incident list
- **Integration page**: site/app registration, API key management, embed script generator, REST API reference
- **Settings page**: general config, Keycloak/SSO settings, data retention, webhooks
- Embeddable tracker script (`tracker/skynet.js`) with canvas, WebGL fingerprinting and SPA support
- `SkyNet.identify()`, `SkyNet.track()`, `SkyNet.checkBlocked()` public API
- Docker Compose full-stack deployment (backend, frontend, PostgreSQL, Redis)
- Keycloak Docker profile (optional SSO)
- Nginx configuration for SPA routing and API proxying
- `CLAUDE.md` behavioral contract for AI-assisted development
- Full documentation suite: ARCHITECTURE, LOGIC, WORKFLOW, DEV_PLAN, API, SECURITY, INSTALL, CONTRIBUTING, ROADMAP
- `shared/error_codes.json` — canonical error code registry
- `shared/event_types.json` — canonical event type definitions
- `.env.example` with all required variables documented

### Technical Debt (tracked in DEV_PLAN.md)
- Settings and anti-evasion config stored in-memory (lost on restart) — target v1.1.0
- `create_all()` used instead of Alembic migrations — target v1.1.0
- Inline Pydantic models in routes instead of `schemas/` layer — target v1.1.0
- Stats charts return mock/empty data — target v1.1.0
- Sessions endpoint returns empty array — target v1.1.0
