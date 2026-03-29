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

### `POST /devices/{id}/link`
**Body** `{ "user_id": "uuid" }` Links device to user account.

### `DELETE /devices/{id}/link`
Unlinks device from user.

### `POST /devices/{id}/block`
### `DELETE /devices/{id}/block`

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
### `PUT /settings`
### `GET /settings/keycloak`
Note: `client_secret` and `admin_password` are never returned in GET responses.

### `PUT /settings/keycloak`

---

## Health

### `GET /health`
No auth. Used by Docker and load balancers.
```json
{ "status": "ok", "service": "SkyNet" }
```
