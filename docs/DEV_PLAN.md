# SkyNet — Development Plan

> Update this file at the start and end of every work session.
> This is the single source of truth for project state.

---

## Current Version: `1.0.1`
## Phase: Hardening — P0 items next (see Backlog)

---

## In Progress

*(nothing active — ready for next sprint)*

---

## Done (Block-Page Config & Rate Limiter — 2026-03-29)

- [x] 2026-03-29 — feat(settings): `GET /settings/block-page` + `PUT /settings/block-page` — persists custom block page (title, subtitle, message, colors, logo, contact) to `BlockPageConfig` DB singleton; `settingsApi.getBlockPage()` / `settingsApi.updateBlockPage()` added to frontend
- [x] 2026-03-29 — feat(system): `GET /system/info` — no-auth endpoint returning app/api/fastapi/python/sqlalchemy/alembic version strings; `systemApi.info()` added to frontend
- [x] 2026-03-29 — feat(middleware): `slowapi` rate limiter integrated in `main.py` — `app.state.limiter` bound; `RateLimitExceeded` → typed 429 response

---

## Done (Metric Synchronization — 2026-03-30)

- [x] 2026-03-30 — fix(stats): synchronized visitor/blocked/event metrics in dashboard
  - Backend: `overview()` endpoint now properly aggregates distinct visitors, summed blocked attempts, device count, traffic hourly chart, blocking by incident type
  - Backend: `realtime()` endpoint now calculates active visitors (5-min window), blocked attempts (1-min window), suspicious sessions (1-hour incidents)
  - Frontend: real-time refresh reduced from 30s → 10s, overview auto-refresh every 60s
  - `backend/app/api/routes/stats.py` — 156 lines (split if crosses 300)

---

## Done (HTTP Security Headers — 2026-03-30)

- [x] 2026-03-30 — security(middleware): HTTP security headers on all responses
  - `backend/app/middleware/security_headers.py`: `SecurityHeadersMiddleware` — sets CSP, HSTS, X-Frame-Options DENY, X-Content-Type-Options nosniff, X-XSS-Protection, Referrer-Policy, Permissions-Policy
  - Registered in `main.py` before CORS middleware

---

## Done (GeoIP Enrichment — 2026-03-30)

- [x] 2026-03-30 — feat(geoip): P0 GeoIP enrichment on visitor upsert
  - `backend/app/core/geoip.py`: lazy-load GeoLite2-City reader, silent fallback if DB absent, flag emoji via Unicode regional indicators
  - `backend/app/api/routes/track.py`: `geoip_lookup(ip)` called on new visitor creation only; populates `country`, `country_code`, `country_flag`, `city`
  - `backend/app/api/routes/stats.py`: `top_countries` now real data — grouped visitor counts by country/flag, percent share, limit 10; WorldGlobe visualization now functional
  - `backend/app/schemas/stats.py`: `CountryStats` aligned to actual response contract (`count` added, `country_code` removed)

---

## Done (Audit Pass — 2026-03-30)

- [x] 2026-03-30 — audit(project): full codebase audit against DEV_PLAN
  - fix(track): removed `site_id=site.id` from `Incident(...)` constructor — field absent on model → `TypeError` at runtime on every bot detection event
  - fix(schemas): replaced stale `TrafficPoint` / `traffic_chart` with `HeatmapBucket` / `traffic_heatmap` in `OverviewResponse`; exported `HeatmapBucket` from `schemas/__init__.py`
  - confirmed done: Pydantic schemas layer (9 schema files, imported and used in routes) — removed from P1 backlog

---

## Done (Post-Scaffold Fixes — 2026-03-29, continued)

- [x] 2026-03-29 — refactor(auth): removed Keycloak SSO from SkyNet admin — native JWT only; Keycloak repurposed as security enforcement layer for tracked websites (v1.5.0)
- [x] 2026-03-29 — feat(roadmap): added v1.5.0 Keycloak Security Enforcement Layer to ROADMAP.md
- [x] 2026-03-29 — feat(roadmap): added v1.6.0 Active Anti-Bot / Anti-Spam Gateway to ROADMAP.md

---

## Done (Post-Scaffold Fixes — 2026-03-29)

---

## Backlog — Priority Order

### P0 — Critical (blocks production use)
- [x] ~~Alembic migration setup~~ — ✅ resolved v1.1.0-dev
- [x] ~~Rate limiting middleware~~ — ✅ resolved (slowapi, 2026-03-29)
- [x] GeoIP enrichment — ✅ resolved 2026-03-30
- [x] HTTP security headers — ✅ resolved 2026-03-30
- [ ] Redis session store — implement real session tracking (currently returns `[]`)
- [ ] Anti-evasion background tasks — wire up async checks after pageview

### P1 — High (needed for full feature set)
- [ ] Real-time WebSocket feed — live visitor stream on Overview page
- [ ] Keycloak user sync background task — 15-min cron using APScheduler
- [ ] Audit log table + endpoints — write-only, tracked per the LOGIC.md spec
- [ ] Frontend `hooks/` layer — extract `useVisitors`, `useUsers`, etc. from pages
- [ ] Chart data — real aggregation queries (currently mocked in stats routes)
- [ ] GeoIP country → flag emoji mapping utility

### P2 — Medium (improves completeness)
- [ ] Export feature — CSV/JSON download for Visitors, Users, Events tables
- [ ] Chart drill-downs — click country → filter visitors by that country
- [ ] Device risk score recalculation on every pageview (currently static 0)
- [ ] Anti-spam sliding window — Redis-backed rate tracking per device
- [ ] Keycloak callback route — `/auth/keycloak/callback` OAuth2 flow
- [ ] Email notifications — webhook-based alerts for high-severity incidents
- [ ] Docker health check for backend container

### P3 — Low (nice to have)
- [ ] Dark/light theme toggle on dashboard
- [ ] Dashboard onboarding wizard (first-run: add site → get script)
- [ ] Tor/VPN IP list auto-update background task
- [ ] `skynet.dev.js` — unminified tracker for development debugging
- [ ] `shared/error_codes.json` usage in frontend (map codes → messages)
- [ ] OpenAPI spec export (already built-in via FastAPI `/docs`)

---

## Done

- [x] 2026-03-29 — Full-stack scaffold (React + FastAPI + PostgreSQL + Redis)
- [x] 2026-03-29 — Embeddable tracker script v1 (skynet.js)
- [x] 2026-03-29 — Docker Compose full-stack deployment
- [x] 2026-03-29 — JWT authentication + auto-created default admin
- [x] 2026-03-29 — All 8 dashboard pages (Overview, Visitors, Users, Devices, Blocking, Anti-Evasion, Integration, Settings)
- [x] 2026-03-29 — Keycloak settings UI (config persisted in-memory, pending DB)
- [x] 2026-03-29 — CLAUDE.md behavioral contract
- [x] 2026-03-29 — docs/ directory (ARCHITECTURE, LOGIC, WORKFLOW, DEV_PLAN, API, SECURITY, INSTALL, CONTRIBUTING, ROADMAP)
- [x] 2026-03-29 — shared/ contracts (error_codes.json, event_types.json)
- [x] 2026-03-29 — Fix: `Incident.metadata` → `extra_data` (SQLAlchemy reserved name crash)
- [x] 2026-03-29 — Fix: `pydantic[email]` + `bcrypt==4.0.1` added to requirements.txt
- [x] 2026-03-29 — Fix: login API call converted to `application/x-www-form-urlencoded`
- [x] 2026-03-29 — Fix: LoginPage error handler guards against Pydantic 422 array response
- [x] 2026-03-29 — Dev stack with Vite HMR + uvicorn --reload (docker-compose.dev.yml)
- [x] 2026-03-29 — tracker/test-site.html — standalone tracker test page

---

## Blocked

*(none currently)*

---

## Technical Debt Log

| Debt | Introduced | Impact | Resolution Target |
|------|-----------|--------|------------------|
| Settings stored in-memory (not DB) | v1.0.0 | Lost on restart | v1.1.0 |
| Anti-evasion config in-memory | v1.0.0 | Lost on restart | v1.1.0 |
| ~~`create_all()` instead of Alembic~~ | ~~v1.0.0~~ | ~~No migration history~~ | ✅ resolved v1.1.0-dev |
| Inline Pydantic models in routes | v1.0.0 | Violates Phase 2 rules | v1.1.0 |
| Stats charts return mock data | v1.0.0 | Dashboard shows no real data | v1.1.0 |
| Sessions endpoint returns `[]` | v1.0.0 | No session management | v1.1.0 |
| `VITE_HMR_HOST` hardcoded to `10.0.0.39` in dev compose | v1.0.0 | Must be changed per deployment | v1.1.0 |
