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
