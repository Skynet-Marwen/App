# SkyNet — Business Logic & Detection Algorithms

> This document defines every business rule, scoring formula, and detection
> algorithm in the system. Code must implement what is described here — not the
> other way around. If you change an algorithm, update this file first.

---

## 1. Device Risk Scoring (device-level)

Every device gets a `risk_score` from 0 (clean) to 100 (high risk).
Recalculated on each pageview by the async anti-evasion worker.

### Exact Device vs Same-Machine Group
- `devices.fingerprint` — authoritative exact browser fingerprint. Used for blocking, incidents, audit.
- `devices.device_cookie_id` — backend-issued stable continuity key, delivered to the browser as the signed `_skynet_did` cookie.
- `devices.match_key` — strict grouping key: `SHA256(screen_resolution || timezone || normalized_language)[:24]` prefixed with `strict:v2:`.
- `match_key` populated only when screen, timezone, and normalized language are all present.
- Dashboard grouping never hard-merges devices. All write actions target exact fingerprints only.

### Device Identity Foundation

- The tracker now captures a richer browser snapshot: canvas/WebGL, screen, language, timezone, hardware concurrency, device memory, connection type, plugin count, touch points, `performance.now()` resolution, and rAF jitter.
- The backend computes:
  - `fingerprint_confidence` — how complete the current signal set is
  - `stability_score` — how closely the current snapshot matches the previous snapshot for the same device
  - `fingerprint_snapshot` — compact persisted JSON used to measure drift across visits
- These fields now improve continuity, feed threshold-based enforcement, and influence gateway challenge/block decisions.

### Implemented Signal Weights

| Signal | Condition | Points |
|--------|-----------|--------|
| Bot UA | UA matches known bot patterns | +30 |
| Canvas hash absent | canvas fingerprint returned null | +10 |
| WebGL absent | No WebGL support | +15 |
| Multiple accounts | Same device → >3 user accounts | +20 per extra |
| Rapid IP rotation | >3 different IPs in 10 min | +25 |
| Cookie evasion | Session cookies cleared between visits, same device | +10 |

### Additional Implemented Gateway / Anti-Abuse Signals

- `crawler_signature_detection` — known crawler/script client token match
- `headless_browser_detection` — webdriver, headless UA, and plugin anomalies
- `click_farm_detection` — repetitive click-heavy sessions with little human context
- `form_honeypot_detection` — hidden-field abuse detection
- `form_submission_velocity_threshold` — sliding-window form burst detection
- `form_content_dedupe_threshold` — repeated form-content signature detection
- `dnsbl_enabled` / `dnsbl_action` — public DNSBL challenge/block decisions

### Thresholds

| Score | Classification | Auto-action |
|-------|---------------|-------------|
| 0–29 | Low risk | None |
| 30–49 | Suspicious | Flag for review |
| 50–79 | High risk | Alert admin |
| 80–100 | Critical | Escalate for review / protected-app denial |

Automatic device-level blocking from score thresholds is wired into the backend and can feed gateway challenge/block behavior.

---

## 2. User Risk Scoring (user-level — v1.2.0)

Every external user (Keycloak sub) gets a `current_risk_score` from 0.0 (clean) to 1.0 (critical).
Computed by `services/risk_engine.py`. Recalculated on: new identity link, new anomaly flag, manual request.

### Input: device scores
```
linked_device_scores = [device.risk_score / 100.0 for all devices linked to user]
base = max(scores) * 0.6 + avg(scores) * 0.4
```

### Modifiers

| Condition | Modifier |
|-----------|----------|
| Any linked device has `shared_user_count > 0` | +0.20 |
| Any identity link created < 24h ago | +0.10 |
| Open `impossible_travel` or `geo_jump` anomaly flag | +0.30 |
| Open `multi_account` anomaly flag | +0.25 |
| Open `behavior_drift` anomaly flag | +0.15 |
| Any linked device has `risk_score >= 100` (Tor/VPN) | +0.40 |

```
new_score = clamp(base + sum(modifiers), 0.0, 1.0)
```

### Trust Levels

| Score Range | Trust Level | Recommended Action |
|-------------|-------------|-------------------|
| < 0.20 | `trusted` | Allow |
| 0.20–0.50 | `normal` | Allow |
| 0.50–0.75 | `suspicious` | Challenge / additional verification |
| >= 0.75 | `blocked` | Deny |

### Spike Auto-Flagging
If `delta >= 0.20` (positive): auto-create `AnomalyFlag { flag_type: "risk_spike", severity: "high" }`.

### Persistence
Each recomputation inserts a `RiskEvent` record with: `score`, `delta`, `trigger_type`, `trigger_detail`.
These form the time-series risk history accessible via `GET /identity/{uid}/risk-history`.

---

## 3. Anomaly Detection

### 3.1 Multi-Account (Identity Level)
- Trigger: on `POST /identity/link`
- Check: does any other `IdentityLink` exist with same `fingerprint_id` but different `external_user_id`?
- Result: `AnomalyFlag { flag_type: "multi_account", severity: "high" }`
- Also increments `devices.shared_user_count`.

### 3.2 Device-Level Anti-Evasion (v1.1 implemented)
Async worker dispatched after each tracking write:

- **Bot UA**: UA contains `bot|crawler|spider|headless` → incident `BOT_DETECTED` +30
- **Missing canvas**: `canvas_hash` absent → incident `CANVAS_FINGERPRINT_MISSING` +10
- **Missing WebGL**: `webgl_hash` absent → incident `WEBGL_FINGERPRINT_MISSING` +15
- **IP rotation**: Redis set `ae:ips:{fingerprint}` TTL 10 min; >3 unique IPs → incident `IP_ROTATION` +25
- **Cookie evasion**: Redis set `ae:sessions:{fingerprint}` TTL 30 min; >1 distinct session_id → incident `COOKIE_EVASION` +10
- **Multi-account device/IP**: distinct `linked_user` count > threshold → `MULTI_ACCOUNT_DEVICE/IP` +20/extra
- **Spam burst**: Redis counter `spam:{site_id}:{fp|ip}` TTL 60s; exceeds threshold → `SPAM_DETECTED`
- **Crawler signatures**: known crawler/script UA token match → incident `CRAWLER_SIGNATURE`
- **Headless browser**: webdriver / headless UA / zero-plugin anomalies → incident `HEADLESS_BROWSER`
- **Click farm**: repetitive click-heavy sessions with little scroll/keyboard context → incident `CLICK_FARM_PATTERN`
- **Form honeypot**: hidden field filled on submit → incident `FORM_HONEYPOT_TRIGGERED`
- **Form velocity / dedupe**: submission bursts or repeated content signature → incidents `FORM_SUBMISSION_VELOCITY` / `FORM_CONTENT_DUPLICATED`
- **DNSBL**: source IP listed by configured public DNSBL providers → incident `DNSBL_LISTED`

### 3.3 Deferred Checks
- VPN / datacenter / provider keyword heuristics are live when GeoIP/provider metadata is available from the configured provider
- Timezone mismatch and language-region mismatch now create incidents and can influence challenge/block posture through Security & Detection settings
- Impossible travel (geo + time delta on activity_events) — shipped in v1.3.0 as an `impossible_travel` anomaly flag heuristic

---

## 4. Blocking Engine

### Current Runtime Enforcement
1. `BlockedIP` exact match
2. `Visitor.status = blocked`
3. `Device.status = blocked`
4. `User.status = blocked` (SKYNET operator session access)
5. Gateway request decision engine: `allow | challenge | block`
6. Gateway challenge flows: JS proof-of-work, redirect handoff, or honeypot continue page
7. DNSBL-listed IPs can challenge or block before the origin sees the request

`UserProfile.trust_level = blocked` is currently enforced through protected-app flows (`/identity/link` response handling and `/track/activity` returning `{ "blocked": true }`), not through anonymous tracker pageview blocking.

### Stored Rule Types
`BlockingRule` records can already store `ip`, `country`, `asn`, `user_agent`, and `device` rules with `block`, `challenge`, or `rate_limit` actions. Direct IP/visitor/device states are enforced today, and the gateway runtime now executes first-class challenge/block decisions from risk and DNSBL posture.

### Actions
| Action | Behavior |
|--------|----------|
| `block` | 403. Log attempt. Increment hits. |
| `challenge` | `429` JSON or `302` interactive challenge flow with short-lived signed bypass token. |
| `rate_limit` | Stored for policy/analytics; dedicated adaptive throttling is still pending. |

---

## 5. Identity Linking Logic

### Link Upsert Rules
```
POST /identity/link { fingerprint_id, platform }
  → If (external_user_id, fingerprint_id) link exists: update last_seen_at, platform
  → If not: INSERT new IdentityLink
  → Device.owner_user_id: set on first link; if different user links same device → increment shared_user_count
```

`fingerprint_id` above is the SKYNET `devices.id` UUID, not the raw browser fingerprint string sent to `/track/pageview`.
Browser apps should resolve it with `SkyNet.getDeviceId()` or `POST /track/device-context`.

### Profile Upsert Rules
```
→ If UserProfile exists for sub: update last_seen, email, display_name, last_ip, last_country
→ If not: INSERT UserProfile (first_seen = now, trust_level = "normal", risk_score = 0.0)
```

### Session Count
`UserProfile.total_sessions` incremented on every successful `/identity/link` call.
`UserProfile.total_devices` updated after each `risk_engine.recompute()`.

---

## 6. Same-Machine Grouping

```
match_key = "strict:v2:" + SHA256(
    screen_resolution + "||" + timezone + "||" + normalize_language(language)
)[:24]
```

`normalize_language(lang)`: take first tag from `Accept-Language` style header, strip region subtag, lowercase.
Example: `"en-US,en;q=0.9"` → `"en"`.

`match_key` is `NULL` if any of the three required inputs is absent.

---

## 7. Session Management (SKYNET Operators)

- Sessions stored in Redis: `session:{user_id}:{session_id}`
- Per-user index: `user:{user_id}:sessions` (Redis set)
- TTL: `JWT_EXPIRE_MINUTES` (default 1440 = 24h)
- JWT `sid` claim must match a live Redis key — no orphaned tokens
- On logout: delete current session key
- On block: delete ALL `user:{user_id}:sessions` keys
- Admin revoke: `DELETE /api/v1/users/{id}/sessions/{session_id}`

---

## 8. GeoIP Enrichment

Triggered on **new Visitor creation only**:
1. Lookup IP via `backend/app/core/geoip.py`
   - default provider: `ip-api.com` with 24h Redis cache per IP
   - optional local provider: uploaded `.mmdb` file via Settings → Integrations
2. Extract: `country`, `country_code`, `city`
3. Map ISO 3166-1 alpha-2 → Unicode flag emoji (regional indicator letters)
4. Store on Visitor: `country`, `country_code`, `country_flag`, `city`

Also triggered on `POST /identity/link` for `UserProfile.last_country`.

If the configured provider returns no result, fields are left `null` and tracking continues.

---

## 9. Audit Log Rules

Every state-changing action must produce an audit entry via `services/audit.log_action()`.

---

## 10. Operational Metric Truthfulness

- Overview hotspot, investigation, and enforcement widgets consume only backend-generated payloads.
- Integration site stats consume live aggregate queries over `visitors` and `events`; placeholder zeros are not acceptable.
- `visitors_change` and `users_change` compare the current selected range against the immediately preceding range of the same duration.
- `total_blocked` is currently a point-in-time posture metric, not a range metric, so no synthetic blocked trend should be displayed until a historical blocked series exists.

---

## 11. Theme Resolution & Branding Logic

### Theme Priority

```
user-selected theme > dynamic risk/tenant theme > system default theme
```

Each operator stores:

```json
{
  "theme_id": "dark-pro",
  "theme_source": "user"
}
```

If `theme_source = "default"`, the runtime resolves the current global default theme and may apply a dynamic override based on risk band, tenant host mapping, or a tenant account default theme.

### Dynamic Theme Policy

- `theme_dynamic_strategy = "risk"` maps `normal`, `elevated`, `high`, and `critical` bands to theme IDs.
- `theme_dynamic_strategy = "tenant"` maps request host / tenant hint values to theme IDs, with an optional `default` fallback.
- When an operator belongs to a tenant account and that tenant has a `default_theme_id`, tenant strategy resolution can use that account default before the generic host-map fallback.
- Dynamic themes only apply when the operator follows the default theme. Per-user explicit theme selection still wins.

### Default Assignment

- New accounts receive the current default theme on creation.
- Only one default theme may exist at a time.
- Changing the default theme does **not** overwrite existing user-selected themes.

### Safe Fallback

If the selected theme is:

- missing
- inactive
- structurally invalid

the backend falls the user back to the active default theme and rewrites the user assignment to:

```json
{
  "theme_id": "skynet-default",
  "theme_source": "default"
}
```

### Runtime Application

The frontend theme engine applies:

- CSS variables from `theme.colors`
- shell layout metadata from `theme.layout`, including shell mode, content width, sidebar width, topbar density, and sticky-header behavior
- widget visibility from `theme.widgets`
- branding copy/logo/title from `theme.branding`
- role-specific shell overrides from `theme.layout.role_surfaces`

Theme switching is runtime-only and does not require a page reload.

### Role-based Shell Surfaces

Themes can optionally define:

```json
{
  "layout": {
    "role_surfaces": {
      "user": { "hidden": ["settings", "integration"] },
      "moderator": { "hidden": ["settings"], "labels": { "users": "Identity" } }
    }
  }
}
```

This only changes the shell presentation layer. It never replaces backend authorization checks.

### Uploaded Logo Behavior

- Admin uploads are stored under `backend/data/theme-assets/<theme_id>/`
- Serialized uploaded logos resolve through `GET /api/v1/themes/{theme_id}/logo`
- The serialized logo URL includes a cache-busting `?v=<updated_at>` value
- If an uploaded file is removed or missing, the serializer clears stale uploaded logo paths and falls back to text branding

| Action | fields |
|--------|--------|
| `LOGIN` / `LOGIN_FAILED` / `LOGOUT` | actor_id, ip |
| `BLOCK` / `UNBLOCK` | actor_id, target_type, target_id, reason |
| `BLOCK_IP` / `UNBLOCK_IP` | actor_id, ip, reason |
| `CREATE_USER` / `DELETE_USER` | actor_id, target_id, role |
| `CONFIG_CHANGE` | actor_id, updated_keys |
| `REGEN_KEY` | actor_id, site.id |
| `FLAG_UPDATE` | actor_id, flag.id, status, external_user_id |
| `ENHANCED_AUDIT_TOGGLE` | actor_id, external_user_id, enabled, reason |

Audit logs: write-only. No DELETE endpoint. Retention: `incident_retention_days`.
Authenticated activity timelines and tracker `events` are pruned by the runtime loop using `event_retention_days`.
Resolved incidents are pruned using `incident_retention_days`.
Stale visitors are either anonymized or deleted using `visitor_retention_days` plus the `anonymize_ips` toggle.

### Integration Connector Runtime

- `integration_api_access_enabled=false` rejects tracker/site API key traffic without deleting the registered site.
- New and regenerated site API keys inherit `integration_api_key_prefix`.
- Notification fanout can mirror selected events into SIEM and monitoring webhook connectors using signed JSON payloads.
