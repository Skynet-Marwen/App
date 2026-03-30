# SkyNet — Business Logic & Detection Algorithms

> This document defines every business rule, scoring formula, and detection
> algorithm in the system. Code must implement what is described here — not the
> other way around. If you change an algorithm, update this file first.

---

## 1. Device Risk Scoring

Every device gets a `risk_score` from 0 (clean) to 100 (high risk).
The score is a weighted sum of signals. Recalculated on every pageview.

### Signal Weights

| Signal | Condition | Points |
|--------|-----------|--------|
| VPN detected | IP in VPN range DB | +30 |
| Tor exit node | IP in Tor list | +40 |
| Datacenter IP | IP in datacenter ASN list | +20 |
| Headless browser | Navigator properties indicate Puppeteer/Playwright | +35 |
| Bot UA | UA matches known bot patterns | +30 |
| Timezone mismatch | Browser TZ ≠ GeoIP TZ (>2hr delta) | +15 |
| Language mismatch | Browser lang country ≠ IP country | +10 |
| Canvas hash absent | canvas fingerprint returned null | +10 |
| WebGL absent | No WebGL support (common in headless) | +15 |
| Multiple accounts | Same device → >3 user accounts | +20 per extra |
| Rapid IP rotation | >3 different IPs in 10 min | +25 |
| Cookie evasion | Session cookies cleared between visits, same device | +10 |

### Thresholds

| Score Range | Classification | Auto-action |
|-------------|---------------|-------------|
| 0 – 29 | Low risk | None |
| 30 – 49 | Suspicious | Flag for review |
| 50 – 79 | High risk | Alert admin |
| 80 – 100 | Critical | Auto-block (if enabled) |

Auto-block is only triggered if `anti_evasion.auto_block_high_risk = true` in settings.

---

## 2. Anti-Evasion Detection Rules

### 2.1 VPN / Proxy / Tor Detection
- Source: MaxMind GeoIP2 + curated IP reputation lists (updated every 24h via background task).
- Logic: Check IP against `vpn_ranges`, `tor_exit_nodes`, `proxy_ranges` sets in Redis.
- On match: Add to incident log with type = `VPN_DETECTED | TOR_DETECTED | PROXY_DETECTED`.

### 2.2 Headless Browser Detection
Signals checked (any 2 = headless confirmed):
- `navigator.webdriver === true`
- `navigator.plugins.length === 0` on non-mobile
- Chrome runtime missing (`!window.chrome`)
- `navigator.languages` is empty
- WebGL renderer contains `SwiftShader | llvmpipe | ANGLE`
- Screen dimensions = 0×0 or `window.outerWidth === 0`

### 2.3 Bot Detection (Behavioral)
- Mouse movement entropy < threshold (no movement = bot)
- Click timing too regular (< 50ms variance = scripted)
- Scroll events missing entirely on long pages
- Event order violations (click before mouseover)
- Page load → action time < 200ms

### 2.4 IP Rotation Detection
- Track last 5 IPs per device fingerprint in Redis (TTL: 10 min).
- If unique IP count > 3 within window → incident: `IP_ROTATION`.

### 2.5 Timezone Mismatch
- GeoIP provides country → lookup canonical TZ for country.
- Browser reports `Intl.DateTimeFormat().resolvedOptions().timeZone`.
- If delta > 120 minutes → mismatch incident.
- Exception: countries spanning multiple TZs (US, RU, CN) use range check.

### 2.6 Multi-Account Detection
- When `SkyNet.identify(userId)` is called, link device → user.
- Query: how many distinct users linked to this device fingerprint?
- If count > `settings.max_accounts_per_device` → incident: `MULTI_ACCOUNT`.
- Same check per IP: count distinct users with same IP → compare to `max_accounts_per_ip`.

---

## 3. Blocking Engine

### Rule Evaluation Order (first match wins)
1. `BlockedIP` exact match (fastest — hash lookup)
2. `BlockingRule` type=`ip` CIDR match
3. `BlockingRule` type=`country` match
4. `BlockingRule` type=`asn` match
5. `BlockingRule` type=`user_agent` regex match
6. `BlockingRule` type=`device` fingerprint match
7. Device `status = blocked`
8. User `status = blocked`

### Actions
| Action | Behavior |
|--------|----------|
| `block` | Return 403. Log attempt. Increment hits counter. |
| `challenge` | Return 429 with `X-SkyNet-Challenge: true`. Frontend shows CAPTCHA. |
| `rate_limit` | Allow request but throttle to 1 req/10s per IP. |

---

## 4. Spam Detection

### Rate Thresholds (configurable in anti-evasion settings)
- `spam_rate_threshold` (default: 10) — max form submissions or custom events per minute per device.
- Tracked in Redis with sliding window (key: `spam:{site_id}:{device_fingerprint}`).
- On exceed → incident: `SPAM_DETECTED` + optionally auto-block device.

### Spam Signals
- Same form submitted >N times in 60s from same device.
- Identical `properties` payload sent in >3 consecutive events.
- Event burst: >50 events in 10s from single IP.

---

## 5. Session Management

- Sessions stored in Redis: key `session:{user_id}:{session_id}`.
- TTL: `JWT_EXPIRE_MINUTES` (default 1440 = 24h).
- On logout: delete session key from Redis.
- On block: delete ALL session keys for `user:{user_id}:sessions`.
- Admin can revoke individual sessions via `DELETE /api/v1/users/{id}/sessions/{session_id}`.

---

## 6. GeoIP Enrichment

Triggered on **new Visitor creation only** (not on revisit — avoids redundant lookups):
1. Lookup IP in `backend/app/core/geoip.py` → lazy-loaded MaxMind GeoLite2-City reader.
2. Extract: `country`, `country_code`, `city`.
3. Map `country_code` (ISO 3166-1 alpha-2) → Unicode flag emoji via regional indicator letters.
4. Store on Visitor record (`country`, `country_code`, `country_flag`, `city`).

If MaxMind DB absent or IP unresolvable (private, loopback, unknown): fields left `null`, no error raised, tracking continues normally.

**Planned (v1.4.0):** ASN lookup, ISP name, latitude/longitude, Redis cache (`geo:{ip}`, TTL 1h).

---

## 7. Keycloak User Sync

Background task (runs every 15 min if `keycloak.sync_users = true`):
1. Fetch all users from Keycloak Admin API (`GET /admin/realms/{realm}/users`).
2. For each Keycloak user: upsert local User record (match on `keycloak_id` or email).
3. Map Keycloak roles → local roles:
   - `skynet-admin` → `admin`
   - `skynet-moderator` → `moderator`
   - anything else → `user`
4. If local user blocked → set Keycloak user `enabled=false`.
5. Log sync result (added/updated/skipped counts) to audit log.

---

## 8. Audit Log Rules

Every write to the system that changes state must produce an audit entry:

| Action | Logged Fields |
|--------|--------------|
| User login | actor_id=user.id, action=LOGIN, ip |
| Login failure | actor_id=null, action=LOGIN_FAILED, ip, attempted_email |
| Block visitor/IP | actor_id, action=BLOCK, target_type=visitor/ip, target_id, reason |
| Unblock | actor_id, action=UNBLOCK, target_type, target_id |
| Create user | actor_id, action=CREATE_USER, target_id |
| Delete user | actor_id, action=DELETE_USER, target_id |
| Config change | actor_id, action=CONFIG_CHANGE, field, old_value, new_value |
| API key regen | actor_id, action=REGEN_KEY, target_type=site, target_id |

Audit logs: write-only via API. No delete endpoint. Retention controlled by `incident_retention_days`.
