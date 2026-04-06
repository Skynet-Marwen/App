# SkyNet — Architecture

> Living document. Update on every structural change.
> Last updated: 2026-04-06 — runtime app version `1.7.4`

---

## System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                        PROTECTED APPLICATIONS                         │
│                                                                      │
│   Web App (skynet.js)     Mobile App       Backend Service           │
│   POST /track/pageview    POST /identity   POST /track/activity      │
└──────────┬────────────────────────┬────────────────────┬─────────────┘
           │ X-SkyNet-Key           │ Bearer <external JWT> │ Bearer <external JWT>
           ▼                        ▼                    ▼
┌──────────────────────────────────────────────────────────────────────┐
│              EDGE HTTPS (Caddy / Nginx / Tunnel / LB)                │
│ Public TLS, hostname routing, /ads.js bait route, /s/* + /w/* paths,│
│                  optional tunnel termination                         │
└───────┬──────────────────────────────────────────────┬───────────────┘
        │ /api/*  /tracker/*  /docs                     │ /* (frontend)
        ▼                                              ▼
┌───────────────────────┐                  ┌─────────────────────────┐
│   FastAPI Backend     │                  │   React Dashboard       │
│   (port 8000)         │                  │   (Vite / Nginx)        │
│                       │                  │                         │
│  ┌─────────────────┐  │   SKYNET JWT     │  pages/                 │
│  │ Identity Routes │  │◄────────────────►│  components/            │
│  │ Risk Routes     │  │                  │  hooks/                 │
│  │ Track Routes    │  │                  │  services/              │
│  │ Gateway Routes  │  │                  │  overview widgets       │
│  │ Theme Routes    │  │                  │  theme store / engine   │
│  │ Admin Routes    │  │                  │  store/ (Zustand)       │
│  └────────┬────────┘  │                  └─────────────────────────┘
│           │           │
│  ┌────────▼────────┐  │     ┌──────────────────┐
│  │ Services        │  │     │     Redis         │
│  │ identity_service│  │     │  (port 6379)      │
│  │ risk_engine     │  │     │  operator sessions│
│  │ jwks_validator  │  │     │  rate limits      │
│  │ anti_evasion    │  │     └──────────────────┘
│  │ gateway_analytics│ │
│  │ theme_service   │  │
│  └────────┬────────┘  │
│           │           │     ┌──────────────────┐
│  ┌────────▼────────┐  │     │ OIDC / JWKS IdP   │
│  │  PostgreSQL     │◄─┼─────│  (Keycloak opt.)  │
│  │  (port 5432)    │  │JWKS │  end-user IdP     │
│  └─────────────────┘  │ val.│  (NOT for ops)    │
└───────────────────────┘     └──────────────────┘
```

**Identity boundary:**
- An external OIDC/JWKS provider issues JWT tokens to end-users of *protected applications*.
- SKYNET validates those tokens via JWKS — it never proxies login.
- SKYNET operator login is always local (username + bcrypt + JWT).
- SKYNET now distinguishes global `superadmin` operators from tenant-bound operators in the settings control plane.
- External IdP outage does not affect operator access.
- The local Keycloak container is optional and profile-gated in `docker-compose.yml`; external OIDC/JWKS providers are valid too.
- The public `APP_BASE_URL` may be HTTPS even when backend/frontend containers talk plain HTTP internally.

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
| Overview Components | `frontend/src/components/overview/` | Overview widget rendering | API calls, data synthesis |
| Hooks | `frontend/src/hooks/` | Data fetching, derived state | DOM manipulation |
| Services | `frontend/src/services/` | Axios call definitions | Business logic, UI state |
| Store | `frontend/src/store/` | Global state shape + theme resolution state | API calls |
| Utils | `frontend/src/utils/` | Pure decision/intelligence functions | Side effects, API calls |

---

## Data Flows

### 1. Visitor Tracking Flow (Public — Site API Key)
```
Browser
  │
  ├─ 1. Loads tracker from `/s/{site_key}.js` (preferred) or legacy `/tracker/skynet.js`
  ├─ 2. Collects signals: canvas hash, WebGL hash, screen, timezone, language, UA,
  │      signed device cookie, navigator entropy, timing entropy
  └─ 3. POST `/w/{site_key}/p` (preferred) or legacy `/api/v1/track/pageview`
           Site API key acts as a public integration identifier, not an operator secret

FastAPI /track/pageview
  ├─ 4. Validate site API key (header/query or edge path) → resolve Site
  ├─ 5. Check BlockedIP → if blocked: increment hits, return 403
  ├─ 6. Parse UA → browser / os / device_type
  ├─ 7. Upsert Device (by signed cookie or exact fingerprint) → enrich metadata + match_key
  ├─ 8. Compute fingerprint confidence + stability snapshot
  ├─ 9. GeoIP lookup (`ip-api` or local `.mmdb`) → country, city, flag emoji (new visitors only)
  ├─ 10. Upsert Visitor (site_id + device_id + ip)
  ├─ 11. Insert Event record
  └─ 12. Dispatch async anti-evasion checks (background)
           ├─ Heuristic checks (bot, headless, VPN, DNSBL, entropy, …)
           ├─ WebRTC leak check (_check_webrtc_leak → WEBRTC_VPN_BYPASS +35)
           └─ ML anomaly score (Isolation Forest, additive +0..15, feature-flagged)
```

### 2. Identity Linking Flow (External IdP JWT)
```
Protected App
  │
  ├─ 1. User authenticates in protected app → external IdP issues JWT
  ├─ 2. Browser tracker resolves SKYNET device UUID via SkyNet.getDeviceId()
  │      (internally: POST /api/v1/track/device-context)
  └─ 3. POST /api/v1/identity/link
           Authorization: Bearer <external_jwt>
           Body: { fingerprint_id, platform }

FastAPI /identity/link
  ├─ 4. jwks_validator: fetch JWKS (cached 5 min) → validate signature/expiry/issuer
  ├─ 5. Extract: sub, email, name, session_state
  ├─ 6. upsert_profile: create/update UserProfile for sub
  ├─ 7. link_device: create/update IdentityLink (sub ↔ fingerprint_id)
  ├─ 8. detect_multi_account: flag if device already linked to different sub
  ├─ 9. risk_engine.recompute: aggregate device scores + modifiers → new risk score
  ├─ 10. Insert RiskEvent snapshot; update UserProfile.current_risk_score + trust_level
  └─ 11. Return { user_id, trust_level, risk_score, flags[] }

Protected app acts on response:
  trust_level = "trusted" | "normal" → allow
  trust_level = "suspicious"         → challenge / additional verification
  trust_level = "blocked"            → deny
```

### 2b. Tracker Device Context Helper
```
Browser
  │
  ├─ 1. `tracker/skynet.js` builds raw fingerprint + browser metadata
  ├─ 2. POST `/w/{site_key}/d` (preferred) or `/api/v1/track/device-context`
  │      Body: { fingerprint, canvas_hash, webgl_hash, screen, language, timezone, session_id,
  │              device_cookie, fingerprint_traits, page_url }
  │
FastAPI /track/device-context
  ├─ 3. Validate site API key
  ├─ 4. Resolve Device by signed cookie or raw fingerprint
  ├─ 5. Update browser / OS / screen / timezone metadata
  ├─ 6. Compute confidence + stability snapshot
  └─ 7. Return { device_id, risk_score, status, linked_user, device_cookie,
                 fingerprint_confidence, stability_score }

Tracker
  └─ 8. Cache device context locally, write `_skynet_did`, and expose:
         SkyNet.getDeviceId()
         SkyNet.getDeviceContext()
         SkyNet.getFingerprint()
```

### 3. Activity Tracking Flow (External IdP JWT)
```
Protected App → POST /api/v1/track/activity
  Authorization: Bearer <external_jwt>
  Body: { event_type, platform, fingerprint_id, page_url, properties, session_id }

FastAPI /track/activity
  ├─ 1. Validate JWT → extract sub
  ├─ 2. Check UserProfile.trust_level == "blocked" → 200 { blocked: true }
  ├─ 3. Insert ActivityEvent
  └─ 4. If enhanced_audit: store targeted extra audit metadata on the event when properties are otherwise empty
```

### 4. Risk Recomputation Flow
```
Trigger: new IdentityLink | new AnomalyFlag | manual POST /risk/{uid}/recompute

risk_engine.recompute(external_user_id, trigger_type)
  ├─ 1. Load all IdentityLinks for user → device_id list
  ├─ 2. Load Devices → raw device risk_scores (0–100, normalize to 0–1)
  ├─ 3. base = max(scores)*0.6 + avg(scores)*0.4
  ├─ 4. Apply modifiers:
  │      shared_device (>1 user on same device)  +0.20
  │      new_device (link < 24h old)             +0.10
  │      impossible_travel flag open             +0.30
  │      multi_account flag open                 +0.25
  │      behavior_drift flag open                +0.15
  │      tor/vpn (device.risk_score >= 100)      +0.40
  ├─ 5. new_score = clamp(base + modifier, 0.0, 1.0)
  ├─ 6. trust_level = trusted(<0.20) | normal(0.20-0.50) | suspicious(0.50-0.75) | blocked(>0.75)
  ├─ 7. Insert RiskEvent { score, delta, trigger_type, trigger_detail }
  ├─ 8. Update UserProfile.current_risk_score + trust_level
  └─ 9. If delta >= 0.20 (spike): auto-create AnomalyFlag { flag_type: "risk_spike" }
```

### 5. SKYNET Operator Auth Flow (Local — never Keycloak)
```
Browser → POST /api/v1/auth/login
          Body: username=admin@skynet.local&password=...
FastAPI  → bcrypt verify → create Redis session → issue SKYNET JWT (HS256)
Browser  → stores JWT in localStorage (key: skynet_token)
All dashboard API calls: Authorization: Bearer <skynet_jwt>
FastAPI  → decode JWT → require live Redis session → inject User dependency
```

### 6. JWKS Validation (Internal Service)
```
On first /identity/link or /track/activity request:
  1. jwks_validator resolves a provider from idp_providers (or legacy keycloak_* bootstrap settings)
  2. Fetch JWKS from provider jwks_url and cache keys in-process for cache_ttl_sec (default: 300s)
  3. JWT validated: signature + expiry + issuer + optional audience
  4. If provider unreachable + cache < 600s old: use cached keys (grace period)
  5. If provider unreachable + no valid cache: HTTP 503 IDP_UNAVAILABLE
  6. SKYNET operator routes are NEVER affected by external IdP availability
```

### 7. Same-Machine Device Grouping
```
Tracker pageview
  → exact Device row resolved by fingerprint
  → match_key computed from screen + timezone + normalized language
  → GET /api/v1/devices/groups aggregates by match_key
  → Devices dashboard: one parent cluster + child exact fingerprints
  → block/link/delete still target exact child fingerprint only
```

### 8. Audit Logging
```
Any dashboard mutation
  → FastAPI route
  → services/audit.log_action(actor_id, action, target_type, target_id, ip, extra)
  → INSERT audit_logs (write-only — no DELETE/UPDATE endpoint)
```

### 9. Gateway Proxy + Analytics Flow
```
Client
  └─ 1. Request /api/v1/gateway/proxy/*

FastAPI /gateway/proxy/*
  ├─ 2. Evaluate blocked IP, blocked device, external-user risk, and DNSBL status
  ├─ 3. Decide allow | challenge | block
  ├─ 4. For challenge: issue token and serve JS proof-of-work, redirect handoff, or honeypot flow
  ├─ 5. For allow: proxy upstream response and measure request latency
  └─ 6. Persist gateway analytics events for Overview aggregation

FastAPI /stats/overview
  ├─ 7. Aggregate gateway request volume, decision mix, top reasons, challenge outcomes, avg latency, and p95 latency
  └─ 8. Return `gateway_dashboard` for the operator Overview widget
```

### 9c. First-Party Relay Pattern (Mouwaten-style)
```
Protected App (same origin)
  ├─ 1. Serves local bootstrap config without exposing the raw SkyNet site_key
  ├─ 2. Serves relayed tracker JS from its own origin
  ├─ 3. Proxies tracker writes, identity linking, activity writes, and challenge pages
  └─ 4. Forwards the real site_key server-side to SkyNet

Benefits
  - avoids cross-origin tracker failures
  - reduces adblock/uBlock path matching issues
  - keeps the raw SkyNet site API key out of the public browser bootstrap config
```

### 9b. Overview Security Command Center — Intelligence Synthesis Flow
```
FastAPI GET /stats/overview
  └─ returns raw payload: threat_hotspots, enforcement_pressure, risk_leaderboard,
                          priority_investigations, gateway_dashboard, traffic_heatmap, …

React OverviewPage
  ├─ useMemo(() => generateGlobalSecurityState(overview), [overview])
  │   └─ securityIntelligence.js
  │       ├─ computeGlobalTrend(overview)        → { trend, label, color, spikeDetected }
  │       ├─ generateAIInsights(overview)        → string[] (max 5 pattern sentences)
  │       ├─ rankEntitiesForInvestigation(overview) → Entity[] (max 10, priority-sorted)
  │       ├─ generateRecommendedActions(level)   → string[] (max 3 operator actions)
  │       └─ returns: { globalRiskLevel, activeThreats, criticalEntities, trend,
  │                     keyInsights, priorityActions, confidence, rankedEntities }
  │
  ├─ CommandHeader           ← globalRiskLevel, trend, activeThreats, criticalEntities, priorityActions
  ├─ AIInsightsPanel         ← keyInsights
  ├─ PriorityInvestigationsCard ← priority_investigations + recommended action per item
  ├─ RiskLeaderboardCard     ← risk_leaderboard + action labels + rank delta
  ├─ SignalIntelligenceCard  ← evasion + spam + enforcement + hotspot + gateway signals
  └─ ThreatHotspotsCard      ← threat_hotspots + trend from intelligence synthesis
```

### 9b-old. Overview + Integration Data Lineage
```
PostgreSQL
  ├─ visitors       → total visitors, top countries, per-site visitor counts
  ├─ events         → heatmap, per-site event counts, gateway analytics
  ├─ incidents      → evasion attempts, investigations, threat hotspots
  ├─ blocked_ips    → blocked posture and blocked-attempt counters
  ├─ devices        → blocked device posture
  └─ user_profiles  → risk leaderboard

FastAPI
  ├─ GET /stats/overview
  └─ GET /integration/sites

React
  ├─ Overview: raw payload → intelligence synthesis → command center widgets
  └─ Integration cards render per-site aggregate stats as-is
```

Design rule:
- If the backend does not have a trustworthy metric, the frontend must show an empty or unavailable state instead of synthesizing placeholder values.

### 9b-c. Portal User Intelligence Decision Flow
```
Operator clicks a user row → PortalUsersPage
  ├─ GET /identity/{external_user_id}/profile
  ├─ GET /identity/{external_user_id}/devices
  ├─ GET /identity/{external_user_id}/visitors
  ├─ GET /identity/{external_user_id}/flags
  ├─ GET /identity/{external_user_id}/risk-history
  └─ GET /identity/{external_user_id}/activity

PortalUserIntelModal (5-tab layout)
  ├─ Decision Header (persistent, all tabs)
  │   └─ riskNarrative.js: generateDecisionSummary(entity)
  │       ├─ computeConfidenceLevel({ profile, devices, visitors, flags, riskHistory })
  │       ├─ computeTrendInfo(riskHistory)
  │       ├─ aggregateSignalsForDecision(profile, devices, visitors)
  │       ├─ rankLinkedDevices(devices)
  │       └─ generateRecommendedAction(score, confidence, trend, openFlagCount, signals)
  │
  ├─ Overview tab   → decision block (reasons) + top signals
  ├─ Identity tab   → user card → device tree with roles + visitor counts
  ├─ Timeline tab   → risk history AreaChart + labeled event timeline
  ├─ Audit tab      → anomaly flags with Ack/Resolve/FP + paginated activity feed
  └─ Raw Data tab   → collapsible: profile fields, device fingerprints, signals dump, flags raw
  
Trust level mutation:
  Trust/Flag/Block buttons → PATCH /identity/{external_user_id}/trust-level
    Body: { trust_level, reason }
    Admin guard → validate → update UserProfile → audit log → return { ok, trust_level }
```

### 10. Theme Resolution Flow
```
Browser login / app bootstrap
  └─ 1. GET /api/v1/user/theme

FastAPI /user/theme
  ├─ 2. ensure_default_theme() creates or repairs the system default if needed
  ├─ 3. resolve_user_theme() loads the user's theme_id + theme_source
  ├─ 4. If selected theme is missing/inactive/corrupt → fallback to default and rewrite user theme state
  ├─ 5. serialize_theme() rewrites uploaded branding logos to /api/v1/themes/{id}/logo?v=<updated_at>
  └─ 6. Return resolved theme + available theme list + fallback metadata

Frontend theme engine
  ├─ 7. apply CSS variables
  ├─ 8. apply shell layout metadata (body/header/nav/footer/panel, shell mode, width, sticky header)
  ├─ 9. apply optional role-based shell surface rules from layout.role_surfaces
  ├─ 10. apply widget-set rules to Overview cards
  ├─ 11. update branding/title/logo surfaces
  └─ 12. allow instant runtime switching without reload
```

### 10a. Tenant Control Plane Flow
```
Settings -> Authentication & Identity
  ├─ 1. Superadmin manages /api/v1/tenants
  ├─ 2. Admin or superadmin manages /api/v1/users with optional tenant_id
  ├─ 3. /auth/me and /users now carry tenant metadata back to the frontend
  └─ 4. Theme resolution may inherit a tenant default theme for default-theme operators
```

### 10b. Theme Package Flow
```
Admin theme registry
  └─ 1. GET /api/v1/themes/{id}/export or POST /api/v1/themes/import

FastAPI theme package route
  ├─ 2. validate admin access
  ├─ 3. theme_packages.export_theme_package() or import_theme_package()
  ├─ 4. embed or restore optional logo payloads through theme_assets
  └─ 5. return a typed package/import response
```

### 9c. Storage Retention + Archive Flow
```
Runtime settings
  └─ 1. visitor/event/incident retention + anonymize_ips stored in runtime_config

STIE maintenance loop
  ├─ 2. read runtime_settings()
  ├─ 3. run_storage_purge() deletes expired events/activity rows, prunes resolved incidents, and anonymizes or deletes stale visitors
  ├─ 4. Settings -> Data & Storage can also trigger purge or export the current retention archive on demand
  └─ 5. log pruning counts when rows are removed
```

### 9d. Intelligence Delete Cleanup Flow
```
Operator delete action
  ├─ 1. DELETE /visitors/{id} OR DELETE /devices/{id} OR DELETE /identity/{external_user_id}
  └─ 2. routes delegate graph cleanup to services/intelligence_cleanup.py

Cleanup service
  ├─ 3. remove or detach related identity_links
  ├─ 4. remove related anomaly_flags and device-bound/user-bound incidents where the target entity no longer exists
  ├─ 5. preserve historical timeline rows by nulling selected references such as events.device_id or activity_events.fingerprint_id where appropriate
  ├─ 6. rebalance remaining device ownership and prune orphaned devices when they lose every child visitor and identity link
  └─ 7. recompute affected external-user profiles so Portal User Intelligence counters and posture stay consistent
```

### 9e. Integration Connector Flow
```
Settings -> Integrations
  ├─ 1. operator configures API access, SIEM webhook, monitoring webhook, and threat-intel refresh controls
  └─ 2. runtime_config stores connector URLs, encrypted secrets, event lists, and integration-specific rate limits

FastAPI
  ├─ 3. /track/* rejects site API keys when integration_api_access_enabled=false
  ├─ 4. /integration/sites create/regenerate operations honor the runtime API-key prefix
  ├─ 5. incident_notifications fan out selected events into SIEM / monitoring connectors
  └─ 6. notification_deliveries stores connector send history beside webhook / SMTP records
```

### 9d. Access & Network Enforcement Flow
```
Operator updates Settings -> Access & Network
  └─ 1. PUT /api/v1/settings stores allowed_domains, CORS policy, IP lists, and rate buckets in runtime_config

HTTP request enters FastAPI
  ├─ 2. AccessNetworkMiddleware reads runtime_settings()
  ├─ 3. host allowlist check rejects disallowed Host / X-Forwarded-Host values
  ├─ 4. get_client_ip() only trusts forwarded IP headers when trust_proxy_headers=true
  ├─ 5. IP allowlist / denylist gate the request before auth, tracking, or gateway logic
  ├─ 6. Redis-backed per-IP counters enforce runtime request limits by route class
  ├─ 7. dynamic CORS policy handles preflight and response headers
  └─ 8. request continues into API, tracker, or gateway handlers
```

---

## Database Schema

### SKYNET Operator Tables

```
users
  id              UUID PK
  email           VARCHAR(255) UNIQUE
  username        VARCHAR(100) UNIQUE
  hashed_password VARCHAR(255)
  role            ENUM(superadmin, admin, moderator, user)
  status          ENUM(active, blocked, pending)
  tenant_id       UUID FK → tenants.id nullable
  theme_id        VARCHAR(100) FK → themes.id nullable
  theme_source    VARCHAR(20)  ← default | user
  last_login      TIMESTAMPTZ
  created_at      TIMESTAMPTZ

tenants
  id               UUID PK
  name             VARCHAR(120) UNIQUE
  slug             VARCHAR(80) UNIQUE
  primary_host     VARCHAR(255) nullable
  description      TEXT nullable
  default_theme_id VARCHAR(100) FK → themes.id nullable
  is_active        BOOLEAN
  created_at       TIMESTAMPTZ
  updated_at       TIMESTAMPTZ
```

### Tracking Tables

```
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
  status        VARCHAR(20) INDEX
  page_views    INTEGER
  site_id       UUID FK → sites
  linked_user   UUID FK → users
  device_id     UUID FK → devices
  first_seen    TIMESTAMPTZ
  last_seen     TIMESTAMPTZ

devices
  id                  UUID PK
  fingerprint         VARCHAR(128) UNIQUE INDEX
  device_cookie_id    VARCHAR(64) UNIQUE INDEX nullable
  match_key           VARCHAR(80) INDEX nullable
  match_version       INTEGER nullable
  fingerprint_version INTEGER DEFAULT 1
  fingerprint_confidence FLOAT DEFAULT 0.0
  stability_score     FLOAT DEFAULT 1.0
  fingerprint_snapshot TEXT nullable
  type                VARCHAR(50)
  browser             VARCHAR(100)
  os                  VARCHAR(100)
  screen_resolution   VARCHAR(20)
  language            VARCHAR(20)
  timezone            VARCHAR(50)
  canvas_hash         VARCHAR(64)
  webgl_hash          VARCHAR(64)
  audio_hash          VARCHAR(64)
  font_list           TEXT
  risk_score          INTEGER (0–100)
  status              VARCHAR(20) INDEX
  linked_user         UUID FK → users (SKYNET operator link — legacy)
  owner_user_id       VARCHAR(255) nullable  ← external IdP sub of primary external user
  shared_user_count   INTEGER DEFAULT 0      ← >0 = fraud signal
  last_known_platform VARCHAR(20) nullable
  first_seen          TIMESTAMPTZ
  last_seen           TIMESTAMPTZ

themes
  id            VARCHAR(100) PK
  name          VARCHAR(255) UNIQUE
  colors        JSON
  layout        JSON
  widgets       JSON
  branding      JSON nullable
  is_default    BOOLEAN
  is_active     BOOLEAN
  created_at    TIMESTAMPTZ
  updated_at    TIMESTAMPTZ

sites
  id          UUID PK
  name        VARCHAR(200)
  url         VARCHAR(500)
  description TEXT
  api_key     VARCHAR(64) UNIQUE INDEX
  active      BOOLEAN
  created_at  TIMESTAMPTZ

events
  id          UUID PK
  site_id     UUID FK → sites INDEX
  visitor_id  UUID INDEX
  user_id     UUID
  device_id   UUID
  event_type  VARCHAR(100) INDEX
  page_url    VARCHAR(2048)
  referrer    VARCHAR(2048)
  properties  TEXT (JSON)
  ip          VARCHAR(45)
  created_at  TIMESTAMPTZ INDEX
```

### Identity Intelligence Tables

```
identity_links
  id               UUID PK
  external_user_id VARCHAR(255) NOT NULL INDEX   ← external IdP sub
  id_provider      VARCHAR(50) DEFAULT 'keycloak'
  fingerprint_id   UUID FK → devices SET NULL INDEX
  visitor_id       UUID FK → visitors SET NULL
  platform         VARCHAR(20)                   ← web | mobile | api
  ip               VARCHAR(45)
  linked_at        TIMESTAMPTZ
  last_seen_at     TIMESTAMPTZ
  UNIQUE (external_user_id, fingerprint_id)

user_profiles
  id                 UUID PK
  external_user_id   VARCHAR(255) UNIQUE INDEX   ← external IdP sub
  email              VARCHAR(255)
  display_name       VARCHAR(255)
  current_risk_score FLOAT INDEX     ← 0.0 – 1.0
  trust_level        VARCHAR(20) INDEX ← trusted | normal | suspicious | blocked
  total_devices      INTEGER
  total_sessions     INTEGER
  first_seen         TIMESTAMPTZ
  last_seen          TIMESTAMPTZ
  last_ip            VARCHAR(45)
  last_country       VARCHAR(2)
  enhanced_audit     BOOLEAN DEFAULT false
  profile_data       TEXT (JSON, extensible)

risk_events
  id               UUID PK
  external_user_id VARCHAR(255) NOT NULL
  score            FLOAT
  delta            FLOAT
  trigger_type     VARCHAR(50)   ← login | new_device | manual | risk_spike | geo_anomaly
  trigger_detail   TEXT (JSON)
  created_at       TIMESTAMPTZ
  INDEX (external_user_id, created_at)

activity_events
  id               UUID PK
  external_user_id VARCHAR(255) NOT NULL
  event_type       VARCHAR(50) INDEX  ← login | pageview | api_call | logout | custom
  platform         VARCHAR(20)
  site_id          UUID FK → sites SET NULL
  fingerprint_id   UUID FK → devices SET NULL
  ip               VARCHAR(45)
  country          VARCHAR(2)
  page_url         VARCHAR(2048)
  properties       TEXT (JSON)
  session_id       VARCHAR(255) INDEX   ← external IdP session identifier
  created_at       TIMESTAMPTZ
  INDEX (external_user_id, created_at)

anomaly_flags
  id                 UUID PK
  external_user_id   VARCHAR(255) NOT NULL INDEX
  flag_type          VARCHAR(50)  ← new_device | geo_jump | multi_account |
                                     impossible_travel | headless | risk_spike
  severity           VARCHAR(20)  ← low | medium | high | critical
  status             VARCHAR(20) INDEX ← open | acknowledged | resolved | false_positive
  related_device_id  UUID nullable
  related_visitor_id UUID nullable
  evidence           TEXT (JSON)
  detected_at        TIMESTAMPTZ INDEX
  resolved_at        TIMESTAMPTZ nullable
```

### Security / Blocking Tables

```
blocking_rules
  id         UUID PK
  type       VARCHAR(30)   ← ip | country | device | user_agent | asn
  value      VARCHAR(500)
  reason     VARCHAR(500)
  action     VARCHAR(20)   ← block | challenge | rate_limit
  hits       INTEGER
  created_at TIMESTAMPTZ

blocked_ips
  ip           VARCHAR(50) PK
  country      VARCHAR(100)
  country_flag VARCHAR(10)
  reason       VARCHAR(500)
  hits         INTEGER
  blocked_at   TIMESTAMPTZ

incidents
  id          UUID PK
  type        VARCHAR(100)
  description TEXT
  ip          VARCHAR(45)
  device_id   UUID
  user_id     UUID
  severity    VARCHAR(20)
  status      VARCHAR(20)
  extra_data  TEXT (JSON)
  detected_at TIMESTAMPTZ
  resolved_at TIMESTAMPTZ

audit_logs
  id          UUID PK
  actor_id    UUID INDEX
  action      VARCHAR(100) INDEX
  target_type VARCHAR(100) INDEX
  target_id   VARCHAR(255) INDEX
  ip          VARCHAR(45) INDEX
  extra       TEXT (JSON)
  created_at  TIMESTAMPTZ INDEX
```

---

## Migration History

| ID | Description |
|----|-------------|
| 0001 | Initial schema (users, sites, devices, visitors, events, blocking, incidents) |
| 0002 | Block page config singleton |
| 0003 | Audit logs table |
| 0004 | Device match grouping (match_key, match_version) |
| 0005 | Drop users.keycloak_id (operators use local auth only) |
| 0006 | identity_links table |
| 0007 | user_profiles table |
| 0008 | risk_events table |
| 0009 | activity_events table |
| 0010 | anomaly_flags table |
| 0011 | Extend devices (owner_user_id, shared_user_count, last_known_platform) |
| 0012 | User theme assignments |
| 0013 | STIE / security center foundation |
| 0014 | Runtime config persistence store |
| 0015 | Device identity foundation (signed cookie + fingerprint stability fields) |

---

## Infrastructure

### Production (`docker-compose.yml`)

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| `backend` | python:3.12-slim | 8000 | FastAPI application |
| `frontend` | node:20 → nginx:alpine | 3000 | React dashboard |
| `db` | postgres:16-alpine | 5432 | Primary data store |
| `redis` | redis:7-alpine | 6379 | Sessions, rate limits, cache |
| external Keycloak | keycloak:24.0 | 8080 | Shared IdP hosted by the `mouwaten` stack, or any other OIDC provider |

### Development (`docker-compose.dev.yml`)

| Service | Port | Purpose |
|---------|------|---------|
| `backend` | 8000 | FastAPI + uvicorn `--reload` |
| `frontend` | 5173 | Vite dev server with HMR |
| `db` | 5432 | PostgreSQL |
| `redis` | 6379 | Redis |
| `adminer` | 8888 | DB GUI (`--profile tools`) |
| `redisinsight` | 5540 | Redis GUI (`--profile tools`) |
