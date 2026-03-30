# Changelog

All notable changes to SkyNet are documented in this file.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html)

---

## [Unreleased]

### Added
- Dev stack in `docker-compose.dev.yml`: Vite HMR (port 5173) + uvicorn `--reload` with live volume mounts
- `tracker/test-site.html` — standalone single-file test site for SkyNet tracker integration testing

### Changed
- `frontend/vite.config.js`: added `host`, `port`, `hmr.host` (via `VITE_HMR_HOST`), `VITE_PROXY_TARGET` env var support, and `/tracker/` proxy rule
- `docker-compose.dev.yml`: complete rewrite — now runs full dev stack (backend + frontend + db + redis) with hot reload

### Fixed
- `backend/app/models/incident.py`: renamed column `metadata` → `extra_data` (SQLAlchemy reserved name conflict, caused startup crash)
- `backend/requirements.txt`: added `pydantic[email]` (missing `email-validator` dependency)
- `backend/requirements.txt`: pinned `bcrypt==4.0.1` (bcrypt 5.x incompatible with passlib 1.7.4)
- `frontend/src/services/api.js`: login now sends `application/x-www-form-urlencoded` (OAuth2PasswordRequestForm requires form data, not JSON)
- `frontend/src/pages/LoginPage.jsx`: error handler now safely stringifies Pydantic 422 array responses (prevented React error #31)

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
