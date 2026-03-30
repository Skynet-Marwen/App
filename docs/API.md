# SkyNet — API Reference

> Version: v1 | Base URL: `/api/v1`
> Dashboard auth: `Authorization: Bearer <JWT>`
> Tracker auth: `X-SkyNet-Key: <site_api_key>`

---

## Error Format

All errors return a consistent JSON body:
```json
{ "detail": "Human-readable message", "code": "ERROR_CODE" }
```

See `shared/error_codes.json` for the full code list.

---

## Authentication

### `POST /auth/login`
Authenticate with email/username and password.

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
Auth required. Invalidates the current session.

**Response `200`** `{ "message": "Logged out" }`

---

### `GET /auth/me`
Auth required. Returns current user profile.

**Response `200`**
```json
{ "id": "uuid", "email": "...", "username": "...", "role": "admin", "status": "active" }
```

---

## Stats

### `GET /stats/overview?range=24h`
Auth required.

**Query params:** `range` = `1h | 24h | 7d | 30d`

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
  "users_change": -1.4,
  "blocked_change": 15.0,
  "traffic_chart": [{ "time": "00:00", "visitors": 12, "blocked": 1 }],
  "top_countries": [{ "country": "Tunisia", "country_code": "TN", "flag": "🇹🇳", "percent": 42 }],
  "blocking_chart": [{ "reason": "VPN", "count": 18 }],
  "recent_incidents": [{ "id": "uuid", "title": "VPN_DETECTED", "severity": "high", "time": "2026-03-29 14:22" }]
}
```

---

### `GET /stats/realtime`
Auth required. Active visitors in last 5 minutes.

**Response `200`**
```json
{ "active_visitors": 42, "blocked_attempts_last_minute": 3, "suspicious_sessions": 7 }
```

---

## Visitors

### `GET /visitors`
Auth required.

**Query params:** `page` (default 1) · `page_size` (default 20, max 100) · `search` (IP/country/browser)

**Response `200`**
```json
{
  "total": 1420,
  "items": [{
    "id": "uuid", "ip": "1.2.3.4", "country": "Tunisia", "country_flag": "🇹🇳",
    "city": "Tunis", "isp": "Topnet", "device_type": "desktop",
    "browser": "Chrome 120", "os": "Windows 11", "status": "active",
    "page_views": 8, "first_seen": "2026-03-29 10:00", "last_seen": "2026-03-29 14:30"
  }]
}
```

---

### `GET /visitors/{id}`
Auth required. Full visitor record.

### `POST /visitors/{id}/block`
Auth required.

**Body** `{ "reason": "Spam" }`
**Response `200`** `{ "message": "Blocked" }`

### `DELETE /visitors/{id}/block`
Auth required. Unblock visitor.

---

## Users

### `GET /users`
Auth required. Params: `page`, `page_size`, `search`

### `POST /users`
Auth required (admin).

**Body**
```json
{ "email": "user@example.com", "username": "johndoe", "password": "s3cur3!", "role": "user" }
```
**Errors:** `409` Email or username already exists

### `GET /users/{id}`
### `PUT /users/{id}`
**Body** `{ "role": "moderator", "status": "active" }`

### `DELETE /users/{id}`
Admin only. Cannot delete self.

### `POST /users/{id}/block`
### `DELETE /users/{id}/block`
### `POST /users/{id}/reset-password`
Triggers password reset email (or returns temp password).

### `GET /users/{id}/sessions`
Returns active Redis sessions for this user.

### `DELETE /users/{id}/sessions/{session_id}`
Revoke a specific session.

---

## Devices

### `GET /devices`
Auth required. Params: `page`, `page_size`, `search`

**Response** includes `visitor_count` (number of distinct visitors sharing this device fingerprint) and ISO 8601 timestamps for `first_seen` / `last_seen`.

### `GET /devices/{id}/visitors`
Auth required. Returns all visitors recorded on this device fingerprint — covers multiple browser/OS/IP combinations that resolved to the same hardware fingerprint.

**Response `200`**
```json
{
  "items": [
    {
      "id": "uuid",
      "ip": "1.2.3.4",
      "browser": "Chrome 120",
      "os": "Windows 10",
      "device_type": "desktop",
      "country": "Tunisia",
      "country_flag": "🇹🇳",
      "page_views": 12,
      "status": "active",
      "last_seen": "2026-03-29T14:30:00+00:00"
    }
  ]
}
```

### `POST /devices/{id}/link`
**Body** `{ "user_id": "uuid" }` Links device to user account.

### `DELETE /devices/{id}/link`
Unlinks device from user.

### `POST /devices/{id}/block`
Blocks device + cascades to all visitors with this `device_id`.

### `DELETE /devices/{id}/block`
Unblocks device + cascades to all associated visitors.

---

## Blocking

### `GET /blocking/rules`
Auth required. Returns all blocking rules.

### `POST /blocking/rules`
**Body**
```json
{ "type": "ip", "value": "10.0.0.0/8", "reason": "Internal", "action": "block" }
```
Types: `ip | country | device | user_agent | asn`
Actions: `block | challenge | rate_limit`

### `DELETE /blocking/rules/{id}`

### `GET /blocking/ips`
Params: `page`, `page_size`, `search`

### `POST /blocking/ips`
**Body** `{ "ip": "1.2.3.4", "reason": "Abuse" }`
**Errors:** `409` Already blocked

### `DELETE /blocking/ips/{ip}`

---

## Anti-Evasion

### `GET /anti-evasion/config`
### `PUT /anti-evasion/config`
**Body:** any subset of config keys (partial update supported).

### `GET /anti-evasion/incidents`
Params: `page`, `page_size`

### `POST /anti-evasion/incidents/{id}/resolve`

---

## Integration

### `GET /integration/sites`
### `POST /integration/sites`
**Body** `{ "name": "My Site", "url": "https://example.com", "description": "..." }`

### `DELETE /integration/sites/{id}`
### `POST /integration/sites/{id}/regenerate-key`
Returns new `api_key`.

### `GET /integration/tracker-script?site_id={id}`
Returns the HTML embed snippet for the site.

---

## Tracker (Public — X-SkyNet-Key required)

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
  "timezone": "Africa/Tunis"
}
```

### `POST /track/event`
```json
{ "event_type": "button_click", "page_url": "...", "fingerprint": "...", "properties": {} }
```

### `POST /track/identify`
```json
{ "user_id": "your-internal-user-id", "fingerprint": "..." }
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

## Settings

### `GET /settings`
Auth required. Returns in-memory general config object.

**Response `200`**
```json
{
  "instance_name": "SkyNet",
  "base_url": "http://localhost:8000",
  "timezone": "UTC",
  "realtime_enabled": true,
  "auto_block_tor_vpn": false,
  "require_auth": false,
  "visitor_retention_days": 90,
  "event_retention_days": 90,
  "incident_retention_days": 365,
  "anonymize_ips": false,
  "webhook_url": "",
  "webhook_secret": "",
  "webhook_events": {}
}
```

### `PUT /settings`
Auth required. Merges partial update into the in-memory settings object.

---

### `GET /settings/block-page`
Auth required. Returns customisable block page configuration.

**Response `200`**
```json
{
  "title": "ACCESS RESTRICTED",
  "subtitle": "Your access to this site has been blocked.",
  "message": "This action was taken automatically for security reasons.",
  "bg_color": "#050505",
  "accent_color": "#ef4444",
  "logo_url": null,
  "contact_email": null,
  "show_request_id": true,
  "show_contact": true
}
```

### `PUT /settings/block-page`
Auth required. Persists block-page config to DB (`BlockPageConfig` singleton, id=1).

**Accepted fields:** `title`, `subtitle`, `message`, `bg_color`, `accent_color`, `logo_url`, `contact_email`, `show_request_id`, `show_contact`

**Response `200`** `{ "ok": true }`

---

## System

### `GET /system/info`
No auth required. Returns component version strings for the dashboard footer.

**Response `200`**
```json
{
  "app": "1.0.1",
  "api": "v1",
  "fastapi": "0.115.5",
  "python": "3.12.0",
  "sqlalchemy": "2.0.36",
  "alembic": "1.13.3"
}
```

---

## Health

### `GET /health`
No auth. Used by Docker and load balancers.
```json
{ "status": "ok", "service": "SkyNet" }
```
