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

## Done (Post-Scaffold Fixes — 2026-03-29)

---

## Backlog — Priority Order

### P0 — Critical (blocks production use)
- [x] Alembic migration setup — replace `create_all()` with proper migrations
- [ ] Rate limiting middleware — implement slowapi on all route groups
- [ ] GeoIP enrichment — integrate MaxMind GeoLite2 on visitor upsert
- [ ] Redis session store — implement real session tracking (currently returns `[]`)
- [ ] Anti-evasion background tasks — wire up async checks after pageview

### P1 — High (needed for full feature set)
- [ ] Real-time WebSocket feed — live visitor stream on Overview page
- [ ] Keycloak user sync background task — 15-min cron using APScheduler
- [ ] Audit log table + endpoints — write-only, tracked per the LOGIC.md spec
- [ ] Pydantic schemas layer — extract inline models from routes to `schemas/`
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
