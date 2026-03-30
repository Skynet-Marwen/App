# SkyNet — Architecture

> Living document. Update on every structural change.
> Last updated: 2026-03-30 — v1.1.0-dev — GeoIP enrichment, HTTP security headers middleware, traffic heatmap, top_countries live data

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        EXTERNAL WORLD                           │
│                                                                 │
│   Any Website / App                Mobile App / Backend         │
│   <script src="skynet.js">         REST API calls               │
└──────────────┬──────────────────────────────┬───────────────────┘
               │ HTTP (tracker events)         │ HTTP (check/identify)
               ▼                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     NGINX (port 80/443)                         │
│           Reverse proxy + SPA static file serving               │
└──────┬──────────────────────────────────────┬───────────────────┘
       │ /api/*  /tracker/*                   │ /* (frontend)
       ▼                                      ▼
┌──────────────────┐                ┌────────────────────┐
│  FastAPI Backend │                │  React Dashboard   │
│  (port 8000)     │                │  (Vite / Nginx)    │
│                  │                │                    │
│  ┌────────────┐  │                │  pages/            │
│  │   routes/  │  │   JWT Auth     │  components/       │
│  │  schemas/  │  │◄──────────────►│  hooks/            │
│  │  services/ │  │                │  services/         │
│  │   models/  │  │                │  store/ (Zustand)  │
│  └────────────┘  │                └────────────────────┘
│        │         │
│        ▼         │
│  ┌───────────┐   │     ┌──────────────┐
│  │PostgreSQL │   │     │    Redis      │
│  │(port 5432)│   │     │  (port 6379) │
│  └───────────┘   │     │  sessions    │
│                  │     │  rate limits │
│  ┌───────────┐   │     │  realtime    │
│  │ Keycloak  │   │     └──────────────┘
│  │(port 8080)│   │
│  │ (optional)│   │
│  └───────────┘   │
└──────────────────┘
```

---

## Layer Boundaries

| Layer | File Location | Owns | Never Contains |
|-------|--------------|------|----------------|
| Tracker Script | `tracker/skynet.js` | Fingerprint collection, event dispatch | Server logic, secrets |
| API Routes | `backend/app/api/routes/` | HTTP contract, request validation | Business logic, DB queries |
| Schemas | `backend/app/schemas/` | Pydantic request/response shapes | DB access, business rules |
| Services | `backend/app/services/` | Business rules, orchestration | HTTP concerns, ORM |
| Models | `backend/app/models/` | ORM table definitions | Business logic |
| Core | `backend/app/core/` | Config, DB engine, security utils | Domain logic |
| Pages | `frontend/src/pages/` | Route-level composition | Direct API calls, business logic |
| UI Components | `frontend/src/components/ui/` | Rendering, props, layout only | State, API calls |
| Hooks | `frontend/src/hooks/` | Data fetching, derived state | DOM manipulation |
| Services | `frontend/src/services/` | Axios call definitions | Business logic, UI state |
| Store | `frontend/src/store/` | Global state shape | API calls |

---

## Data Flows

### 1. Visitor Tracking Flow (Public — no auth)
```
Browser
  │
  ├─ 1. Loads skynet.js (served by FastAPI /tracker/ static)
  ├─ 2. Collects signals: canvas hash, WebGL hash, screen, timezone,
  │      language, UA, session ID
  └─ 3. POST /api/v1/track/pageview
           Header: X-SkyNet-Key: <site_api_key>
           Body: { page_url, referrer, fingerprint, canvas_hash,
                   webgl_hash, screen, language, timezone }

FastAPI /track/pageview
  │
  ├─ 4. Validate X-SkyNet-Key → resolve Site record
  ├─ 5. Extract client IP (X-Forwarded-For / client.host)
  ├─ 6. Check BlockedIP table → if blocked: increment hits, return 403
  ├─ 7. Parse User-Agent (ua-parser)
  ├─ 8. GeoIP lookup (MaxMind GeoLite2-City) → country, city, flag emoji (new visitors only)
  ├─ 9. Upsert Visitor (by IP + site_id) — geo fields set on creation
  ├─ 10. Upsert Device (by fingerprint) → calculate risk score
  ├─ 11. Insert Event record
  └─ 12. Dispatch async anti-evasion checks (background task)

Anti-Evasion Service (async)
  │
  ├─ 12. VPN / Tor / Proxy check (IP reputation DB)
  ├─ 13. Timezone vs GeoIP mismatch
  ├─ 14. Headless browser signals check
  └─ 15. If anomaly detected → Insert Incident → optionally auto-block
```

### 2. Dashboard Auth Flow (JWT — native only)
```
Browser → POST /api/v1/auth/login (application/x-www-form-urlencoded)
          Body: username=admin@skynet.local&password=...
FastAPI  → OAuth2PasswordRequestForm → validate credentials → issue JWT (24h)
Browser  → Stores JWT in localStorage (key: skynet_token)
Browser  → All dashboard API calls: Authorization: Bearer <token>
FastAPI  → Decode JWT → fetch User from DB → inject as dependency
```

> Note: Keycloak is **not used** for SkyNet admin authentication. Keycloak is
> targeted as a security enforcement layer for *tracked websites* (v1.5.0 roadmap).

### 3. Security Headers Flow
```
Request → SecurityHeadersMiddleware (outermost)
  → CORSMiddleware
  → slowapi limiter
  → route handler
  ← response ← SecurityHeadersMiddleware injects security headers
```
Headers set: `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`,
`Referrer-Policy`, `Permissions-Policy`, `Content-Security-Policy`, `Strict-Transport-Security`.

### 4. Rate Limiting Flow
```
Request → slowapi limiter (app.state.limiter)
  ├─ Limit not exceeded → pass through to route handler
  └─ Limit exceeded     → RateLimitExceeded exception
                            → typed 429 response { "detail": "Rate limit exceeded" }
```

Limits applied (see `docs/SECURITY.md` for the full table):
- `/api/v1/track/*` — 200 req/min per IP
- `/api/v1/auth/login` — 10 req/min per IP
- All other `/api/v1/*` — 300 req/min per authenticated user

### 5. Device Linking Flow
```
Dashboard Admin → POST /api/v1/devices/{id}/link { user_id }
  OR
tracker: SkyNet.identify("user-123") → POST /api/v1/track/identify
FastAPI → Find Device by fingerprint → Set linked_user = user_id
Dashboard → Device detail shows linked user + shared sessions
```

---

## Database Schema

### Core Tables

```
users
  id            UUID PK
  email         VARCHAR(255) UNIQUE
  username      VARCHAR(100) UNIQUE
  hashed_password VARCHAR(255) nullable (null = Keycloak-only)
  role          ENUM(admin, moderator, user)
  status        ENUM(active, blocked, pending)
  keycloak_id   VARCHAR(100) nullable
  last_login    TIMESTAMPTZ
  created_at    TIMESTAMPTZ

visitors
  id            UUID PK
  ip            VARCHAR(45) INDEX
  country       VARCHAR(100)
  country_code  VARCHAR(2)
  country_flag  VARCHAR(10)
  city          VARCHAR(100)
  isp           VARCHAR(200)
  device_type   VARCHAR(50)
  browser       VARCHAR(100)
  os            VARCHAR(100)
  user_agent    TEXT
  status        VARCHAR(20) INDEX  (active | blocked | suspicious)
  page_views    INTEGER
  site_id       UUID FK → sites
  linked_user   UUID FK → users
  device_id     UUID FK → devices
  first_seen    TIMESTAMPTZ
  last_seen     TIMESTAMPTZ

devices
  id            UUID PK
  fingerprint   VARCHAR(128) UNIQUE INDEX
  type          VARCHAR(50)  (desktop | mobile | tablet)
  browser       VARCHAR(100)
  os            VARCHAR(100)
  screen_resolution VARCHAR(20)
  language      VARCHAR(20)
  timezone      VARCHAR(50)
  canvas_hash   VARCHAR(64)
  webgl_hash    VARCHAR(64)
  audio_hash    VARCHAR(64)
  font_list     TEXT
  risk_score    INTEGER  (0-100)
  status        VARCHAR(20) INDEX
  linked_user   UUID FK → users
  first_seen    TIMESTAMPTZ
  last_seen     TIMESTAMPTZ

sites
  id            UUID PK
  name          VARCHAR(200)
  url           VARCHAR(500)
  description   TEXT
  api_key       VARCHAR(64) UNIQUE INDEX
  active        BOOLEAN
  created_at    TIMESTAMPTZ

events
  id            UUID PK
  site_id       UUID FK → sites INDEX
  visitor_id    UUID INDEX
  user_id       UUID
  device_id     UUID
  event_type    VARCHAR(100) INDEX  (pageview | click | identify | custom)
  page_url      VARCHAR(2048)
  referrer      VARCHAR(2048)
  properties    TEXT (JSON)
  ip            VARCHAR(45)
  created_at    TIMESTAMPTZ INDEX

blocking_rules
  id            UUID PK
  type          VARCHAR(30)  (ip | country | device | user_agent | asn)
  value         VARCHAR(500)
  reason        VARCHAR(500)
  action        VARCHAR(20)  (block | challenge | rate_limit)
  hits          INTEGER
  created_at    TIMESTAMPTZ

blocked_ips
  ip            VARCHAR(50) PK
  country       VARCHAR(100)
  country_flag  VARCHAR(10)
  reason        VARCHAR(500)
  hits          INTEGER
  blocked_at    TIMESTAMPTZ

incidents
  id            UUID PK
  type          VARCHAR(100)
  description   TEXT
  ip            VARCHAR(45)
  device_id     UUID
  user_id       UUID
  severity      VARCHAR(20)  (low | medium | high | critical)
  status        VARCHAR(20)  (open | resolved)
  extra_data    TEXT (JSON)   -- column name in DB: "metadata"
  detected_at   TIMESTAMPTZ
  resolved_at   TIMESTAMPTZ
```

---

## Infrastructure

### Production (`docker-compose.yml`)

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| `backend` | python:3.12-slim | 8000 | FastAPI application |
| `frontend` | node:20 → nginx:alpine | 3000 | React dashboard (built bundle) |
| `db` | postgres:16-alpine | 5432 | Primary data store |
| `redis` | redis:7-alpine | 6379 | Sessions, rate limits, cache |
| `keycloak` | keycloak:24.0 | 8080 | SSO (optional `--profile keycloak`) |

### Development (`docker-compose.dev.yml`)

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| `backend` | python:3.12-slim | 8000 | FastAPI + uvicorn `--reload` (live Python reload) |
| `frontend` | node:20-alpine | 5173 | Vite dev server with HMR (no-refresh code updates) |
| `db` | postgres:16-alpine | 5432 | Same as production |
| `redis` | redis:7-alpine | 6379 | Same as production |
| `adminer` | adminer | 8888 | DB GUI (optional `--profile tools`) |
| `redisinsight` | redis/redisinsight | 5540 | Redis GUI (optional `--profile tools`) |

**HMR configuration:** `VITE_HMR_HOST` must be set to the server's LAN IP in `docker-compose.dev.yml` for WebSocket HMR to work across machines.

**Volumes:**
- `postgres_data` / `postgres_dev_data` — persistent DB storage
- `redis_data` / `redis_dev_data` — persistent Redis AOF
- `./backend:/app` (dev only) — live code mount for uvicorn reload
- `./frontend:/app` (dev only) — live code mount for Vite HMR

**Networks:** All services share the default bridge network. No service exposes a port except those listed above.
