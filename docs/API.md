# SkyNet — API Reference

> Version: v1 | Base URL: `/api/v1`
> Last updated: 2026-04-02 — shipped app version `1.6.0`

---

## Authentication Schemes

| Scheme | Used For | Header |
|--------|----------|--------|
| SKYNET JWT | All dashboard/admin routes | `Authorization: Bearer <skynet_jwt>` |
| Site API Key | Tracker routes (`/track/*`) | `X-SkyNet-Key: <key>` or `?key=<key>` |
| External IdP JWT | Identity + activity routes | `Authorization: Bearer <external_jwt>` |

Legacy `keycloak_*` settings are still accepted, but the preferred runtime contract is `idp_providers` for multi-provider JWKS validation.

---

## Error Format

```json
{ "detail": "Human-readable message", "code": "ERROR_CODE" }
```

Common codes: `TOKEN_INVALID`, `TOKEN_EXPIRED`, `MISSING_TOKEN`, `IDP_UNAVAILABLE`, `IDP_NOT_CONFIGURED`, `NOT_FOUND`, `FORBIDDEN`

---

## Authentication (SKYNET Operators)

### `POST /auth/login`
Local login for SKYNET dashboard operators. Keycloak is never used here.

**Request** (`application/x-www-form-urlencoded`)
```
username=admin@skynet.local&password=admin
```

**Response `200`**
```json
{
  "access_token": "eyJ...",
  "token_type": "bearer",
  "user": { "id": "uuid", "email": "...", "username": "admin", "role": "admin" }
}
```

**Errors:** `401` Invalid credentials · `403` Account blocked

---

### `POST /auth/logout`
SKYNET auth required. Invalidates current session.

### `GET /auth/me`
SKYNET auth required. Returns current operator profile.

---

## Identity (External Users — External IdP JWT)

> These endpoints accept Bearer tokens issued to end-users of protected apps by any configured JWKS-backed identity provider.
> Reading endpoints require a SKYNET admin JWT.

### `POST /identity/link`
Links an authenticated external user to a SKYNET device fingerprint.
Called by protected apps after successful login.

**Auth:** `Authorization: Bearer <external_jwt>`

**Request**
```json
{
  "fingerprint_id": "uuid-of-skynet-device",
  "platform": "web",
  "site_id": "optional-uuid"
}
```

`fingerprint_id` is the SKYNET device UUID (`devices.id`), not the raw tracker fingerprint string. Browser integrations can resolve it with `SkyNet.getDeviceId()` or `POST /track/device-context`.

**Response `200`**
```json
{
  "user_id": "external-sub-claim",
  "trust_level": "normal",
  "risk_score": 0.12,
  "flags": []
}
```

`trust_level` values: `trusted` · `normal` · `suspicious` · `blocked`

**Errors:** `400` IDP not configured · `401` Token invalid/expired · `503` identity provider unreachable

---

### `GET /identity/{external_user_id}/profile`
SKYNET auth required. Full intelligence profile for an external user.

**Response `200`**
```json
{
  "id": "uuid",
  "external_user_id": "external-sub",
  "email": "user@example.com",
  "display_name": "Alice",
  "current_risk_score": 0.12,
  "trust_level": "normal",
  "total_devices": 2,
  "total_sessions": 47,
  "first_seen": "2026-03-30T10:00:00Z",
  "last_seen": "2026-03-31T09:12:00Z",
  "last_ip": "1.2.3.4",
  "last_country": "TN",
  "enhanced_audit": false
}
```

---

### `GET /identity/{external_user_id}/devices`
SKYNET auth required. All device links for this user.

**Response `200`**
```json
[
  {
    "id": "link-uuid",
    "fingerprint_id": "device-uuid",
    "platform": "web",
    "ip": "1.2.3.4",
    "linked_at": "2026-03-30T10:00:00Z",
    "last_seen_at": "2026-03-31T09:12:00Z"
  }
]
```

---

### `GET /identity/{external_user_id}/risk-history`
SKYNET auth required.

**Query params:** `limit` (default 50, max 500)

**Response `200`**
```json
{
  "total": 12,
  "items": [
    {
      "id": "uuid",
      "score": 0.32,
      "delta": 0.10,
      "trigger_type": "new_device",
      "trigger_detail": "{\"fingerprint_id\": \"...\"}",
      "created_at": "2026-03-31T08:00:00Z"
    }
  ]
}
```

---

### `GET /identity/{external_user_id}/activity`
SKYNET auth required.

**Query params:** `event_type`, `platform`, `page`, `page_size` (max 100)

**Response `200`**
```json
{
  "total": 142,
  "items": [
    {
      "id": "uuid",
      "event_type": "pageview",
      "platform": "web",
      "site_id": "uuid",
      "fingerprint_id": "uuid",
      "ip": "1.2.3.4",
      "country": "TN",
      "page_url": "https://app.example.com/dashboard",
      "session_id": "kc-session-state",
      "created_at": "2026-03-31T09:00:00Z"
    }
  ]
}
```

---

### `GET /identity/{external_user_id}/flags`
SKYNET auth required. Returns anomaly flags for this user.

**Response `200`**
```json
[
  {
    "id": "uuid",
    "flag_type": "multi_account",
    "severity": "high",
    "status": "open",
    "related_device_id": "uuid",
    "evidence": "{\"other_user\": \"other-sub\"}",
    "detected_at": "2026-03-31T08:30:00Z",
    "resolved_at": null
  }
]
```

Flag types: `new_device` · `geo_jump` · `multi_account` · `impossible_travel` · `headless` · `risk_spike` · `behavior_drift`

---

### `PUT /identity/{external_user_id}/flags/{flag_id}`
SKYNET auth required. Update flag status.

**Body**
```json
{ "status": "acknowledged" }
```

Valid statuses: `acknowledged` · `resolved` · `false_positive`

---

### `POST /identity/{external_user_id}/enhanced-audit`
SKYNET auth required (**admin role only**). Enable/disable deep event logging for a user.

**Body**
```json
{ "enabled": true, "reason": "Suspicious login pattern" }
```

---

## Risk

### `GET /risk/users`
SKYNET auth required. List all external users sorted by risk score.

**Query params:**
- `search` (matches `external_user_id`, `email`, `display_name`)
- `min_score` (float 0.0–1.0, default 0.0)
- `trust_level` (trusted | normal | suspicious | blocked)
- `has_flags` (bool, default false)
- `page`, `page_size` (max 100)

**Response `200`**
```json
{
  "total": 24,
  "items": [
    {
      "external_user_id": "external-sub",
      "email": "user@example.com",
      "display_name": "Alice",
      "current_risk_score": 0.82,
      "trust_level": "blocked",
      "total_devices": 5,
      "total_sessions": 19,
      "last_seen": "2026-03-31T09:00:00Z",
      "last_country": "XX",
      "enhanced_audit": true,
      "open_flags_count": 2
    }
  ]
}
```

---

### `POST /risk/{external_user_id}/recompute`
SKYNET auth required. Manually trigger risk recomputation.

**Response `200`**
```json
{
  "external_user_id": "external-sub",
  "previous_score": 0.42,
  "new_score": 0.55,
  "delta": 0.13,
  "trust_level": "suspicious"
}
```

---

## Tracker (Public — X-SkyNet-Key)

### `POST /track/pageview`
```json
{
  "page_url": "https://example.com/about",
  "referrer": "https://google.com",
  "fingerprint": "a1b2c3d4-e5f6...",
  "canvas_hash": "abc123...",
  "webgl_hash": "def456...",
  "screen": "1920x1080",
  "language": "en-US",
  "timezone": "Africa/Tunis",
  "session_id": "browser-session-id",
  "device_cookie": "v1.signed-cookie-token",
  "fingerprint_traits": {
    "hardware_concurrency": 8,
    "device_memory": 8,
    "platform": "Linux x86_64",
    "connection_type": "4g",
    "plugin_count": 4,
    "touch_points": 0,
    "clock_resolution_ms": 0.1,
    "raf_mean_ms": 16.7,
    "raf_jitter_score": 1.4
  }
}
```

**Response `200`**
```json
{
  "ok": true,
  "device_id": "uuid",
  "device_cookie": "v1.signed-cookie-token",
  "linked_user": null,
  "status": "active"
}
```

### `POST /track/device-context`
Resolve or create the current SKYNET device record from raw browser fingerprint signals.

```json
{
  "fingerprint": "a1b2c3d4-e5f6...",
  "canvas_hash": "abc123...",
  "webgl_hash": "def456...",
  "screen": "1920x1080",
  "language": "en-US",
  "timezone": "Africa/Tunis",
  "session_id": "browser-session-id",
  "device_cookie": "v1.signed-cookie-token",
  "fingerprint_traits": {
    "hardware_concurrency": 8,
    "device_memory": 8,
    "platform": "Linux x86_64",
    "connection_type": "4g",
    "plugin_count": 4,
    "touch_points": 0,
    "clock_resolution_ms": 0.1,
    "raf_mean_ms": 16.7,
    "raf_jitter_score": 1.4
  },
  "page_url": "https://example.com/login"
}
```

**Response `200`**
```json
{
  "ok": true,
  "site_id": "uuid",
  "device_id": "uuid",
  "fingerprint": "a1b2c3d4-e5f6...",
  "device_cookie": "v1.signed-cookie-token",
  "linked_user": null,
  "risk_score": 0,
  "status": "active",
  "fingerprint_confidence": 0.82,
  "stability_score": 0.94
}
```

This is the public helper that powers `SkyNet.getDeviceId()` and `SkyNet.getDeviceContext()` in the bundled tracker. The tracker stores `device_cookie` as a signed first-party `_skynet_did` cookie for continuity across visits.

### `GET /track/check-access?fp=<raw-fingerprint>&dc=<signed-device-cookie>&ct=<challenge-bypass-token>`
Used by `tracker/skynet.js` before tracking writes. Returns `{"blocked": false}`, a block-page payload when the current IP, visitor, or exact device is blocked, or a challenge payload when gateway-style friction is required before tracking continues.
When present, `dc` lets the backend resolve the device by signed cookie continuity before falling back to the raw fingerprint. `ct` is an optional signed challenge bypass token returned by the gateway challenge flow.

### `POST /track/event`
```json
{ "event_type": "button_click", "page_url": "...", "fingerprint": "...", "device_cookie": "v1.signed-cookie-token", "properties": {} }
```

The bundled tracker also emits `behavior_snapshot` events with lightweight interaction timing metrics, which power behavior-entropy scoring and `behavior_drift` flags. Form submissions are emitted as `form_submit` with honeypot, field-count, and content-signature metadata for anti-spam heuristics.

### `POST /track/activity`
Track an authenticated user activity event.
**Auth:** `Authorization: Bearer <external_jwt>` (external IdP token, not SKYNET)

```json
{
  "event_type": "login",
  "platform": "web",
  "fingerprint_id": "device-uuid",
  "page_url": "https://app.example.com/login",
  "properties": {},
  "session_id": "kc-session-state",
  "site_id": "optional-uuid"
}
```

**Response `200`** `{ "ok": true }`, `{ "blocked": true }` if user trust_level is "blocked", or `{ "ok": true, "flags": ["impossible_travel"], "trust_level": "suspicious" }` when activity triggers a geo-jump flag

### `POST /track/identify`
```json
{ "user_id": "your-internal-user-id", "fingerprint": "...", "device_cookie": "v1.signed-cookie-token" }
```

### `GET /track/check/ip?ip=1.2.3.4`
```json
{ "ip": "1.2.3.4", "blocked": false }
```

### `GET /track/check/device?fingerprint=abc`
```json
{ "fingerprint": "abc", "found": true, "blocked": false, "risk_score": 15, "linked_user": null }
```

---

## Stats

### `GET /stats/overview?range=24h`
SKYNET auth required. `range` = `1h | 24h | 7d | 30d`

**Response `200`**
```json
{
  "total_visitors": 1420,
  "unique_users": 230,
  "total_devices": 980,
  "total_blocked": 47,
  "evasion_attempts": 12,
  "spam_detected": 5,
  "visitors_change": 8.2,
  "traffic_heatmap": [{ "timestamp": "2026-03-31 12:00:00", "count": 42 }],
  "top_countries": [{ "country": "Tunisia", "flag": "🇹🇳", "count": 58, "percent": 42.3 }],
  "blocking_chart": [{ "reason": "VPN", "count": 18 }],
  "recent_incidents": [{ "id": "uuid", "title": "VPN_DETECTED", "severity": "high", "time": "..." }],
  "gateway_dashboard": {
    "enabled": true,
    "configured": true,
    "target_origin": "https://app.example.com",
    "total_requests": 1280,
    "request_change_pct": 24,
    "bot_percent": 7.8,
    "challenge_rate": 4.1,
    "avg_latency_ms": 42.5,
    "p95_latency_ms": 118.2,
    "upstream_error_rate": 0.6,
    "decision_totals": { "allow": 1190, "challenge": 52, "block": 38 },
    "challenge_outcomes": [{ "label": "passed", "count": 31 }],
    "challenge_breakdown": [{ "label": "js_pow", "count": 26 }],
    "top_reasons": [{ "label": "device_risk", "count": 40 }]
  },
  "risk_leaderboard": [
    {
      "external_user_id": "external-sub",
      "email": "user@example.com",
      "display_name": "Alice",
      "current_risk_score": 0.91,
      "trust_level": "blocked",
      "total_devices": 4,
      "total_sessions": 18,
      "open_flags_count": 2,
      "top_flag": "multi_account",
      "last_seen": "2026-04-02T10:12:00Z",
      "last_country": "TN",
      "enhanced_audit": true
    }
  ]
}
```

### `GET /gateway/status`
SKYNET auth required. Returns enablement/config reachability for reverse-proxy mode.

### `GET|POST|PUT|PATCH|DELETE /gateway/proxy/{path}`
Public reverse-proxy entrypoint when gateway mode is enabled.
Returns:
- upstream response with `X-SkyNet-Decision: allow`
- `403` block payload with `X-SkyNet-Decision: block`
- `429` JSON or `302` redirect challenge flow with `X-SkyNet-Decision: challenge`

### `GET /gateway/challenge/{token}`
Serve an interactive challenge page for the pending request token.

### `GET /gateway/challenge/{token}/verify`
Verify a JS proof-of-work nonce and redirect back with a short-lived signed bypass token.

### `POST /gateway/challenge/{token}/verify-honeypot`
Verify a honeypot continue form and redirect back with a short-lived signed bypass token.

### `GET /stats/realtime`
SKYNET auth required.

**Response `200`**
```json
{ "active_visitors": 42, "blocked_attempts_last_minute": 3, "suspicious_sessions": 7 }
```

### `WS /stats/realtime/ws?token=<skynet_jwt>`
SKYNET auth required. Sends a realtime snapshot envelope roughly every 5 seconds.

**Message**
```json
{
  "type": "realtime",
  "data": {
    "active_visitors": 42,
    "blocked_attempts_last_minute": 3,
    "suspicious_sessions": 7
  }
}
```

---

## Users (SKYNET Operators)

### `GET /users`
Params: `page`, `page_size`, `search`

### `POST /users`
**Body** `{ "email": "...", "username": "...", "password": "...", "role": "user" }`

### `GET /users/{id}`
### `PUT /users/{id}`
**Body** `{ "role": "moderator", "status": "active" }`

### `DELETE /users/{id}`
### `POST /users/{id}/block` · `DELETE /users/{id}/block`
### `POST /users/{id}/reset-password`
### `GET /users/{id}/sessions`
### `DELETE /users/{id}/sessions/{session_id}`

---

## Visitors

### `GET /visitors`
Params: `page`, `page_size`, `search`, `country`, `status`

### `GET /visitors/{id}`
### `POST /visitors/{id}/block` · `DELETE /visitors/{id}/block`
### `DELETE /visitors/{id}`

---

## Devices

### `GET /devices` — exact fingerprint list
### `GET /devices/groups` — same-machine grouped clusters
### `GET /devices/{id}` — exact fingerprint detail
### `GET /devices/{id}/visitors`
### `POST /devices/{id}/link` — `{ "user_id": "uuid" }`
### `DELETE /devices/{id}/link`
### `POST /devices/{id}/block` · `DELETE /devices/{id}/block`
### `DELETE /devices/{id}`

---

## Blocking

### `GET /blocking/rules` · `POST /blocking/rules`
**Body** `{ "type": "ip", "value": "10.0.0.0/8", "reason": "...", "action": "block" }`
Types: `ip | country | device | user_agent | asn`
Note: direct IP / visitor / device block states are enforced immediately, while gateway challenge/block decisions are executed through the reverse-proxy runtime. Stored blocking-rule `challenge` / `rate_limit` actions remain primarily policy and analytics data until dedicated rule-engine execution is expanded.

### `DELETE /blocking/rules/{id}`
### `GET /blocking/ips` · `POST /blocking/ips`
**Body** `{ "ip": "1.2.3.4", "reason": "Abuse" }`
### `DELETE /blocking/ips/{ip}`

---

## Anti-Evasion

### `GET /anti-evasion/config` · `PUT /anti-evasion/config`
### `GET /anti-evasion/incidents`
### `POST /anti-evasion/incidents/{id}/resolve`

---

## Audit

### `GET /audit/logs`
Params: `page`, `page_size`, `action`, `actor_id`, `target_type`, `target_id`, `search`

---

## Integration

### `GET /integration/sites` · `POST /integration/sites`
**Body** `{ "name": "My App", "url": "https://example.com" }`
### `DELETE /integration/sites/{id}`
### `POST /integration/sites/{id}/regenerate-key`
### `GET /integration/tracker-script?site_id={id}`

---

## Settings

### `GET /settings` · `PUT /settings`
SKYNET auth required.

**Key fields in settings object:**
```json
{
  "instance_name": "SkyNet",
  "base_url": "https://skynet.example.com",
  "https_mode": "edge",
  "https_provider": "reverse_proxy",
  "geoip_provider": "ip-api",
  "smtp_enabled": false,
  "smtp_password": "",
  "idp_providers": [
    {
      "name": "google",
      "enabled": true,
      "jwks_url": "https://www.googleapis.com/oauth2/v3/certs",
      "issuer": "https://accounts.google.com",
      "audience": "skynet-api",
      "cache_ttl_sec": 300
    }
  ],
  "keycloak_enabled": true,
  "keycloak_jwks_url": "http://keycloak:8080/realms/myrealm/protocol/openid-connect/certs",
  "keycloak_issuer": "http://keycloak:8080/realms/myrealm",
  "keycloak_audience": "",
  "keycloak_cache_ttl_sec": 300
}
```

Notes:
- `idp_providers[*].jwks_url` and `idp_providers[*].issuer` accept `http`/`https` URLs only.
- Webhook events can now include `on_high_severity_incident` for alert delivery on open high/critical incidents.

### `GET /settings/https/status`
Returns the state of the self-signed and uploaded certificate stores.

### `POST /settings/https/self-signed`
Generates a self-signed certificate bundle and stores it under `backend/data/certs/self-signed`.

### `POST /settings/https/upload`
Uploads PEM certificate/key material and stores it under `backend/data/certs/uploaded`.

### `GET /settings/block-page` · `PUT /settings/block-page`
### `GET /settings/geoip/status` · `POST /settings/geoip/upload`
SMTP state is returned by `GET /settings`.
### `PUT /settings/smtp` · `POST /settings/smtp/test` · `GET /settings/smtp/reveal`
`GET /settings/smtp/reveal` is admin-only and returns the decrypted stored SMTP password.

`event_retention_days` is active at runtime and prunes old `activity_events` during the background maintenance loop.

---

## Themes

Theme registry and per-user theme resolution are first-class backend features.

### `GET /themes`
SKYNET auth required. Returns the active theme registry for normal users; admins also see inactive themes.

`layout.role_surfaces` is optional and lets themes hide or relabel shell navigation entries per operator role without changing backend authorization.

### `POST /themes`
Admin-only. Create a new global theme.

**Body**
```json
{
  "id": "dark-pro",
  "name": "Dark Pro",
  "colors": { "accent": "#22d3ee" },
  "layout": {
    "footer_enabled": true,
    "logo_size": "md",
    "role_surfaces": {
      "user": { "hidden": ["settings", "integration"] },
      "moderator": { "hidden": ["settings"], "labels": { "users": "Identity" } }
    }
  },
  "widgets": ["traffic-heatmap"],
  "branding": {
    "logo_text": "SkyNet",
    "company_name": "SkyNet",
    "title": "SkyNet Dashboard",
    "tagline": "Threat command center"
  },
  "is_active": true,
  "is_default": false
}
```

### `PUT /themes/{theme_id}`
Admin-only. Update name, colors, layout, widgets, branding, or active state.

### `DELETE /themes/{theme_id}`
Admin-only. Deletes a non-default theme and moves affected users back to the current default theme.

### `POST /themes/set-default`
Admin-only.

**Body**
```json
{ "theme_id": "dark-pro" }
```

Only one default theme can exist at a time. Changing the default does not overwrite existing user-selected themes.

### `POST /themes/{theme_id}/logo`
Admin-only. Multipart upload field: `logo`.

- allowed types: `image/png`, `image/jpeg`, `image/webp`, `image/gif`
- max size: 2 MB

### `DELETE /themes/{theme_id}/logo`
Admin-only. Removes the stored uploaded logo for the theme.

### `GET /themes/{theme_id}/logo`
Serves the stored uploaded logo file for the theme. Serialized theme responses point here for uploaded branding assets.

### `GET /themes/{theme_id}/export`
Admin-only. Downloads a single theme as a marketplace-ready JSON package with optional embedded logo data.

### `POST /themes/import`
Admin-only. Multipart form import for a packaged single theme.

**Form fields**
- `file`: exported JSON package
- `replace_existing`: optional boolean, default `false`

**Response `200`**
```json
{
  "theme": {
    "id": "dark-pro",
    "name": "Dark Pro",
    "colors": { "accent": "#22d3ee" },
    "layout": {},
    "widgets": [],
    "branding": {},
    "is_default": false,
    "is_active": true
  },
  "replaced_existing": true,
  "imported_logo": true
}
```

### `GET /user/theme`
SKYNET auth required. Resolves the current operator theme with fallback information.

**Response `200`**
```json
{
  "selected_theme_id": "dark-pro",
  "theme_source": "user",
  "resolved_theme": {
    "id": "dark-pro",
    "name": "Dark Pro",
    "colors": {},
    "layout": {},
    "widgets": [],
    "branding": { "logo_url": "/api/v1/themes/dark-pro/logo?v=1712010000" },
    "is_default": false,
    "is_active": true
  },
  "default_theme_id": "skynet-default",
  "available_themes": [],
  "fallback_applied": false,
  "fallback_reason": null
}
```

### `POST /user/theme`
SKYNET auth required. Persist a per-user theme choice.

**Body**
```json
{
  "theme_id": "dark-pro",
  "theme_source": "user"
}
```

Use `{ "theme_source": "default" }` to reset a user back to the system default.

---

## Search

### `GET /search`
SKYNET auth required. Aggregated dashboard search for fast jumps across visitors, devices, and portal-user intelligence.

**Query params:**
- `q` search text
- `limit` max results per section (default 4, max 8)

**Response `200`**
```json
{
  "query": "alice",
  "totals": {
    "visitors": 1,
    "devices": 2,
    "portal_users": 1,
    "overall": 4
  },
  "sections": [
    {
      "key": "visitors",
      "label": "Visitors",
      "total": 1,
      "items": [
        {
          "id": "visitor-uuid",
          "entity_type": "visitor",
          "title": "1.2.3.4",
          "subtitle": "Tunisia",
          "meta": "Chrome / Windows",
          "status": "active",
          "route": "/visitors?search=1.2.3.4"
        }
      ]
    }
  ]
}
```

---

## System

### `GET /system/info`
No auth. Returns version strings.

### `GET /health`
No auth. `{ "status": "ok", "service": "SkyNet" }`
