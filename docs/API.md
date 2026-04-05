# SkyNet — API Reference

> Version: v1 | Base URL: `/api/v1`
> Last updated: 2026-04-05 — shipped app version `1.7.1`

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
  "user": {
    "id": "uuid",
    "email": "...",
    "username": "admin",
    "role": "superadmin",
    "tenant_id": null,
    "tenant_name": null,
    "tenant_slug": null
  }
}
```

**Errors:** `401` Invalid credentials · `403` Account blocked

---

### `POST /auth/logout`
SKYNET auth required. Invalidates current session.

### `GET /auth/me`
SKYNET auth required. Returns current operator profile.

The payload now includes `tenant_id`, `tenant_name`, `tenant_slug`, `theme_id`, and `theme_source` so the frontend can coordinate tenant-bound operator UX and theme resolution.

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

Only links with a live `fingerprint_id` are returned. Stale identity-link rows with `fingerprint_id = null` are pruned from the Portal User Intelligence view.

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

### `GET /identity/{external_user_id}/visitors`
SKYNET auth required. Recent tracked visitors currently linked to this external user.

**Query params:** `limit` (default 50, max 200)

**Response `200`**
```json
[
  {
    "id": "visitor-uuid",
    "site_id": "site-uuid",
    "device_id": "device-uuid",
    "ip": "1.2.3.4",
    "country": "Tunisia",
    "country_flag": "TN",
    "browser": "Firefox",
    "os": "Windows",
    "page_views": 12,
    "status": "active",
    "first_seen": "2026-03-30T10:00:00Z",
    "last_seen": "2026-03-31T09:12:00Z"
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

Flag types: `new_device` · `geo_jump` · `multi_account` · `impossible_travel` · `headless` · `risk_spike` · `behavior_drift` · `group_device_risk` · `group_user_risk` · `coordinated_group_behavior` · `repeated_group_spike`

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
SKYNET auth required (**admin role only**). Enable/disable extra authenticated-activity audit metadata for a user under investigation.

**Body**
```json
{ "enabled": true, "reason": "Suspicious login pattern" }
```

Current implementation note:
- when enabled, `/track/activity` can enrich events with audit metadata such as `user_agent`, `referer`, and `enhanced: true`
- this does not by itself block or challenge the user
- this is currently lighter than a full raw device snapshot and should be treated as targeted investigation context, not full forensic capture

---

### `DELETE /identity/{external_user_id}`
SKYNET auth required (**admin role only**). Permanently deletes an external user intelligence profile.

Current delete behavior:
- deletes `user_profiles` row for that external user
- deletes that user's `identity_links`, `anomaly_flags`, `risk_events`, `activity_events`, and user-bound `incidents`
- clears `visitors.external_user_id` for previously linked visitors
- rebalances ownership on affected devices and deletes newly orphaned devices when they have no remaining visitors or identity links
- recomputes affected remaining external-user profiles so Portal User Intelligence counts and posture stay consistent

**Response `200`**
```json
{
  "message": "Deleted",
  "affected_external_user_ids": ["other-external-sub"]
}
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

This route now runs the group-parent orchestration first and then recomputes the canonical user risk score. If `group_escalation_enabled=false`, it falls back to the older base risk-engine behavior.

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

## Tracker (Public — Site API Key)

The public site API key is a revocable integration identifier used by tracker writes. It is not an operator credential.

SkyNet supports two public ingestion shapes:
- legacy public API routes: `/api/v1/track/*` with `X-SkyNet-Key` or `?key=...`
- blocker-resistant edge routes: `/s/{site_key}.js` and `/w/{site_key}/*`

For direct browser deployments, expose the same-origin bait route `/ads.js` to the backend as well; the tracker loads it as a real `<script>` to classify browser-side blocking separately from DNS/network filtering.
For aggressive blocker environments, a protected app can also proxy SkyNet through its own backend or edge so the browser never talks to `skynet.tn` directly and never sees the raw site key.

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
    "raf_jitter_score": 1.4,
    "webrtc_available": true,
    "webrtc_local_ip_count": 1,
    "webrtc_vpn_suspected": true,
    "webrtc_leak_detected": null,
    "webrtc_stun_reachable": true
  }
}
```

`fingerprint_traits.webrtc_*` fields are populated by `detectWebRTCLeak()` in `skynet.js`. All values are derived booleans/counts — no raw IP addresses are transmitted. `webrtc_leak_detected` is always `null` from the client; server-side correlation is not yet implemented.
When runtime probes complete, `fingerprint_traits` may also include blocker-related fields such as `adblock_dom_bait_blocked`, `adblock_same_origin_probe_blocked`, `remote_ad_probe_blocked`, `adblocker_detected`, `dns_filter_suspected`, and `blocker_family`.

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

When `group_escalation_enabled=true`, pageview writes also trigger:
- exact-device parent posture recompute
- strict sibling-device parent posture recompute
- owning external-user parent posture recompute when the device has a single owner

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
When group escalation is enabled, this route can also refresh parent device posture after fingerprint continuity or strict-group signals change.

### `GET /track/check-access?fp=<raw-fingerprint>&dc=<signed-device-cookie>&ct=<challenge-bypass-token>`
Used by `tracker/skynet.js` before tracking writes. Returns `{"blocked": false}`, a block-page payload when the current IP, visitor, or exact device is blocked, or a challenge payload when gateway-style friction is required before tracking continues.
When present, `dc` lets the backend resolve the device by signed cookie continuity before falling back to the raw fingerprint. `ct` is an optional signed challenge bypass token returned by the gateway challenge flow.

Blocker-resistant equivalent:
- `GET /w/{site_key}/a?fp=...&dc=...&ct=...`

### `POST /track/event`
```json
{ "event_type": "button_click", "page_url": "...", "fingerprint": "...", "device_cookie": "v1.signed-cookie-token", "properties": {} }
```

The bundled tracker also emits `behavior_snapshot` events with lightweight interaction timing metrics, which power behavior-entropy scoring and `behavior_drift` flags. Form submissions are emitted as `form_submit` with honeypot, field-count, and content-signature metadata for anti-spam heuristics.
When group escalation is enabled, event writes also refresh exact-device and owning-user parent posture.

Blocker-resistant equivalents:
- `POST /w/{site_key}/d` → `device-context`
- `POST /w/{site_key}/p` → `pageview`
- `POST /w/{site_key}/e` → `event`
- `POST /w/{site_key}/i` → `identify`

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

This route always refreshes the authenticated user’s parent posture after the activity write, and it also refreshes the exact device parent posture when `fingerprint_id` is present.
Protected apps may proxy this route through their own backend to keep `site_key` server-side and avoid cross-origin tracker failures.

**Response `200`** `{ "ok": true, "risk_action": "allow|flag|challenge|block" }`, `{ "blocked": true, "risk_action": "block" }` if user trust_level is effectively blocked, or `{ "ok": true, "flags": ["impossible_travel"], "trust_level": "suspicious" }` when activity triggers a geo-jump flag

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

Notes:
- `visitors_change` and `users_change` compare the selected range with the immediately previous range of the same size.
- `total_blocked` is a current posture count (blocked IPs + blocked visitors + blocked devices), so `blocked_change` may be omitted when a truthful period-over-period comparison is not available.
- Overview widgets should show empty states when these fields are absent; they must not fabricate substitute hotspot, investigation, or enforcement data.

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

Integration note:
- protected apps can proxy challenge pages and verify endpoints through their own origin
- this is the recommended pattern when browsers are on plain HTTP LAN hosts or when third-party challenge redirects are undesirable

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

Admin-only. Tenant-bound admins see their own tenant scope; superadmins can see global operators and all tenant scopes.

### `POST /users`
Admin-only.

**Body** `{ "email": "...", "username": "...", "password": "...", "role": "user", "tenant_id": "optional-uuid-or-null" }`

Notes:
- `role` can be `user`, `moderator`, `admin`, or `superadmin`
- only superadmins can create or promote `superadmin` accounts
- `superadmin` accounts stay global and cannot be tenant-bound

### `GET /users/{id}`
### `PUT /users/{id}`
**Body** `{ "role": "moderator", "status": "active", "tenant_id": null }`

### `DELETE /users/{id}`
### `POST /users/{id}/block` · `DELETE /users/{id}/block`
### `POST /users/{id}/reset-password`
### `GET /users/{id}/sessions`
### `DELETE /users/{id}/sessions/{session_id}`

### `GET /tenants`
Admin-only. Lists tenant accounts visible to the current operator.

**Response `200`**
```json
[
  {
    "id": "uuid",
    "name": "Mouwaten",
    "slug": "mouwaten",
    "primary_host": "mouwaten.example.com",
    "description": "Citizen portal",
    "default_theme_id": "mouwaten-ops",
    "default_theme_name": "Mouwaten Ops",
    "is_active": true,
    "user_count": 6,
    "created_at": "2026-04-02 23:10",
    "updated_at": "2026-04-02 23:10"
  }
]
```

### `POST /tenants`
Superadmin-only. Creates a tenant account.

### `PUT /tenants/{tenant_id}`
Superadmin-only. Updates tenant metadata, primary host, active state, or default theme.

### `DELETE /tenants/{tenant_id}`
Superadmin-only. Deletes a tenant account after operators are unassigned.

---

## Visitors

### `GET /visitors`
Params: `page`, `page_size`, `search`, `country`, `status`

### `GET /visitors/{id}`
### `POST /visitors/{id}/block` · `DELETE /visitors/{id}/block`
### `DELETE /visitors/{id}`

Delete behavior:
- deletes tracker `events` owned by that visitor
- deletes or detaches any `identity_links` pointing at that visitor
- deletes related visitor-bound anomaly flags
- if that visitor was the last remaining child of a device with no remaining identity links, the orphaned device is deleted too
- recomputes affected external-user profiles so Portal User Intelligence device/visitor totals stop showing stale indicators

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

Delete behavior:
- deletes visitors currently attached to that exact device
- deletes or detaches related `identity_links`
- deletes related device/visitor anomaly flags and device-bound incidents
- nulls `events.device_id` and `activity_events.fingerprint_id` for historical records that should remain as timeline evidence
- recomputes affected external-user profiles so Portal User Intelligence and risk posture stay in sync

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
Important DNSBL settings:
- `dnsbl_enabled`
- `dnsbl_providers`
- `dnsbl_action`
- `dnsbl_cache_ttl_sec`
- `dnsbl_soft_fail_country_codes`
- `dnsbl_soft_fail_risk_points`
- `language_mismatch_allowed_languages_by_country`

`dnsbl_soft_fail_country_codes` marks noisy dynamic-IP regions where DNSBL hits remain visible and additive but no longer directly force DNSBL challenge/block on their own. The default runtime now includes `TN`.
`language_mismatch_allowed_languages_by_country` lets multilingual countries accept normal local language choices even when the locale region suffix differs from GeoIP country. The default anti-evasion config now includes `TN: ["ar", "fr", "en"]`.

New in v1.7.0:
- `webrtc_leak_detection` (bool, default `true`) — enables `WEBRTC_VPN_BYPASS` incident generation from tracker WebRTC probe signals.

Feature flags (under `POST /settings` → `feature_flags` key):
- `ml_anomaly_detection` (bool, default `false`) — enables Isolation Forest scoring as an additive risk modifier. Enable after ≥7 days of production traffic to ensure sufficient training data.

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

`GET /integration/sites` returns real per-site aggregates:

```json
[
  {
    "id": "uuid",
    "name": "Mouwaten",
    "url": "https://mouwaten.example.com",
    "description": "Citizen portal",
    "api_key": "hex-key",
    "active": true,
    "stats": {
      "visitors": 1842,
      "events": 9231,
      "blocked": 17
    },
    "created_at": "2026-04-02"
  }
]
```

`stats.blocked` is currently the number of blocked visitors associated with the site.
New site API keys and regenerated keys honor the runtime `integration_api_key_prefix` setting and are rejected when `integration_api_access_enabled=false`.

### `DELETE /integration/sites/{id}`
### `POST /integration/sites/{id}/regenerate-key`
### `GET /integration/tracker-script?site_id={id}`

---

## Security Center

### `GET /security/status`
SKYNET admin auth required. Returns scheduler config, aggregate open counts, and scanned target profiles.

### `GET /security/findings`
SKYNET admin auth required. Returns open STIE findings.

### `GET /security/recommendations`
SKYNET admin auth required. Returns current remediation recommendations.

### `POST /security/scan`
SKYNET admin auth required. Runs a manual STIE scan.

**Body**
```json
{ "refresh_intel": true, "site_id": null }
```

**Response `200`**
```json
{
  "ok": true,
  "scanned_targets": 2,
  "findings_created": 5,
  "recommendations_created": 6,
  "intel_updated": 14,
  "errors": [
    {
      "site_id": "uuid",
      "site_url": "https://broken.example.com",
      "detail": "timed out"
    }
  ]
}
```

Notes:
- STIE scan runs are resilient per site. One failing target should not abort the whole scan.
- When `errors` is non-empty, the matching target profile is marked `scan_status = error` and the note is surfaced in the dashboard.
- Threat-intel refresh now ignores malformed advisory rows from upstream feeds or fallback sources instead of aborting the entire scan.

---

## Settings

### `GET /settings` · `PUT /settings`
SKYNET auth required.

Review note (2026-04-03): this is the intended operator-facing contract, but the active branch still needs RBAC hardening on several settings-adjacent routes so only admin/superadmin users can mutate global configuration consistently.

**Key fields in settings object:**
```json
{
  "instance_name": "SkyNet",
  "base_url": "https://skynet.example.com",
  "https_mode": "edge",
  "https_provider": "reverse_proxy",
  "allowed_domains": ["skynet.example.com", "*.ops.example.com"],
  "cors_allowed_origins": ["https://skynet.example.com", "https://admin.example.com"],
  "cors_allowed_methods": ["GET", "POST", "PUT", "DELETE"],
  "cors_allowed_headers": ["Authorization", "Content-Type", "X-SkyNet-Key"],
  "cors_allow_credentials": true,
  "geoip_provider": "ip-api",
  "risk_modifier_weights": {
    "shared_device": 0.20,
    "new_device": 0.10
  },
  "fingerprint_signal_weights": {
    "canvas_hash": 0.16,
    "webgl_hash": 0.18
  },
  "network_proxy_action": "observe",
  "network_country_watchlist": ["RU", "CN"],
  "network_ip_allowlist": ["10.0.0.0/24"],
  "network_ip_denylist": ["198.51.100.20"],
  "rate_limit_default_per_minute": 300,
  "rate_limit_track_per_minute": 200,
  "rate_limit_auth_per_minute": 30,
  "rate_limit_auth_login_per_minute": 10,
  "integration_api_access_enabled": true,
  "integration_api_key_prefix": "sk_",
  "rate_limit_integration_per_minute": 120,
  "integration_siem_enabled": false,
  "integration_siem_url": "",
  "integration_siem_secret": "",
  "integration_siem_events": ["high_severity_incident", "evasion_detected"],
  "integration_monitoring_enabled": false,
  "integration_monitoring_url": "",
  "integration_monitoring_secret": "",
  "integration_monitoring_events": ["high_severity_incident", "block_triggered"],
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
- `allowed_domains` accepts bare hosts and wildcard hosts like `*.skynet.tn`; when non-empty, requests for other hosts are rejected before routing.
- `cors_allowed_origins` accepts exact origins or `*`; `cors_allowed_methods` and `cors_allowed_headers` accept `*` or explicit values.
- `network_ip_allowlist` and `network_ip_denylist` accept single IPs or CIDR blocks.
- Webhook events can now include `on_high_severity_incident` for alert delivery on open high/critical incidents.
- Escalation settings live in the main settings payload: `notification_escalation_enabled`, `notification_escalation_min_severity`, `notification_escalation_delay_minutes`, `notification_escalation_repeat_limit`, and `notification_escalation_channels`.
- `notification_event_matrix` is the authoritative per-event routing map for notification channels and event-level escalation eligibility.
- Security tuning now also lives in the main settings payload: `risk_modifier_weights`, `fingerprint_signal_weights`, `network_*_action`, `network_country_watchlist`, and `network_provider_watchlist`.
- Access & Network rate limits are enforced per IP at runtime for login, authenticated operator routes, tracker routes, and all other HTTP requests.
- Integration runtime also lives in the main settings payload: `integration_api_access_enabled`, `integration_api_key_prefix`, `rate_limit_integration_per_minute`, and the `integration_*` connector settings for SIEM / monitoring webhook fanout.
- `keycloak_sync_auth_realm` and `keycloak_sync_realm` let Keycloak Admin sync authenticate against one realm while importing users from another.
- Current gap: `webhook_secret` is still a plaintext runtime field on the active branch and should not be treated as hardened secret storage until it is moved to masked encrypted-at-rest handling.

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

### `POST /settings/webhooks/test`
Sends a signed test webhook using the supplied form values without saving them first.

**Body**
```json
{
  "url": "https://hooks.example.com/skynet",
  "secret": "shared-secret",
  "event": "webhook_test"
}
```

### `GET /settings/notifications/deliveries`
Returns recent SMTP and webhook delivery attempts, including failed sends and escalation retries.

### `GET /settings/storage/status`
Returns storage health, retention preview counts, database footprint, index count, Redis memory status, and archive/backup catalog sizes.

### `POST /settings/storage/purge`
Runs retention cleanup immediately for expired tracker events, authenticated activity events, resolved incidents, and stale visitors.

### `POST /settings/storage/archive`
Exports a JSON retention archive of the rows that are currently eligible for cleanup, stores a copy under `backend/data/retention-archives/`, and returns the same archive as a download.

### `POST /settings/storage/tracker-purge`
Admin-only. Deletes collected data for one tracker/site while keeping the site registration itself. The purge removes site-scoped visitors, events, authenticated activity, security findings, target profiles, and orphaned related device/user intelligence that no longer has remaining signal after the purge.

Body:
```json
{ "site_id": "uuid" }
```

### `POST /settings/storage/reset-install`
Superadmin-only. Reinitializes operational database content for a fresh install while preserving operator accounts, runtime settings, themes, and tenant configuration. Requires a typed confirmation phrase.

Body:
```json
{ "confirmation": "RESET SKYNET" }
```

### `GET /settings/integrations/status`
Returns Integration domain health: site/API access posture, SIEM + monitoring connector status, and current threat-intel inventory metadata.

### `POST /settings/integrations/test`
Sends a signed webhook test to either the SIEM or monitoring connector using the supplied runtime values.

**Body**
```json
{
  "connector": "siem",
  "url": "https://collector.example.com/skynet",
  "secret": "shared-secret"
}
```

### `POST /settings/integrations/threat-intel/refresh`
Forces an immediate STIE threat-intel refresh and returns the number of updated entries.

`event_retention_days` now prunes both `events` and `activity_events` during the background maintenance loop. `incident_retention_days` prunes resolved incidents, and `visitor_retention_days` either anonymizes or deletes stale visitors depending on `anonymize_ips`.

---

## Themes

Theme registry and per-user theme resolution are first-class backend features.

### `GET /themes`
SKYNET auth required. Returns the active theme registry for normal users; admins also see inactive themes.

`layout.role_surfaces` is optional and lets themes hide or relabel shell navigation entries per operator role without changing backend authorization.
`layout.shell_mode`, `layout.content_width`, `layout.sidebar_width`, `layout.topbar`, and `layout.header_sticky` now drive the live dashboard shell directly.

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
    "shell_mode": "fixed",
    "content_width": "wide",
    "sidebar_width": "standard",
    "topbar": "default",
    "header_sticky": true,
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
If the operator follows the system default theme, backend resolution may return a dynamic risk/tenant override instead of the stored default theme. Tenant-bound operators can also inherit their tenant account's default theme when the tenant strategy is active.

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

Review note (2026-04-03): this endpoint is currently broader than intended and should be treated as a temporary exposure until the system surface is tightened to operator/admin-only access.

### `GET /system/bootstrap-status`
SKYNET auth required. Returns onboarding and platform-readiness state.

### `GET /system/diagnostics`
SKYNET auth required. Returns database/Redis health, runtime flags, inventory totals, and recent audit activity.

### `POST /system/maintenance/reload-runtime`
SKYNET auth required. Reloads the persisted runtime config into the in-process cache.

### `POST /system/maintenance/reset-onboarding`
SKYNET auth required. Re-enables the onboarding wizard and clears the completion marker.

### `GET /health`
No auth. `{ "status": "ok", "service": "SkyNet" }`
