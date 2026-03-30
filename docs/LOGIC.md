# SkyNet — Business Logic & Detection Algorithms

> This document defines every business rule, scoring formula, and detection
> algorithm in the system. Code must implement what is described here — not the
> other way around. If you change an algorithm, update this file first.

---

## 1. Device Risk Scoring

Every device gets a `risk_score` from 0 (clean) to 100 (high risk).
The score is a weighted sum of signals. Recalculated on every pageview.

### Exact Device vs Same-Machine Group
- `devices.fingerprint` remains the authoritative exact browser fingerprint used for blocking, incidents, and audit history.
- `devices.match_key` is a strict presentation-layer grouping key derived from `webgl_hash + screen_resolution + timezone + normalized language primary tag`.
- `match_key` is only populated when all four stable signals exist; otherwise the exact fingerprint stands alone.
- Dashboard grouping never hard-merges devices. Parent rows summarize children; all write actions still target exact fingerprints.

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

### 2.1 Execution Model
- Tracking routes commit `Visitor` / `Device` / `Event` writes first.
- After commit, the route dispatches an in-process async task.
- The async worker opens its own DB session and Redis client usage; it never reuses the request DB session.
- On pageview, the route resolves or creates the exact `Device` first, updates stable metadata, computes `match_key`, flushes, then upserts the `Visitor`.
- Visitor upsert key is `site_id + device_id + ip` when a fingerprint is present; fallback remains `site_id + ip` when fingerprint data is absent.

### 2.2 Implemented Checks (v1.1)
- **Bot user-agent detection**: if UA contains `bot | crawler | spider | headless` → incident `BOT_DETECTED` and `+30`.
- **Missing canvas fingerprint**: if `canvas_hash` missing and module enabled → incident `CANVAS_FINGERPRINT_MISSING` and `+10`.
- **Missing WebGL fingerprint**: if `webgl_hash` missing and module enabled → incident `WEBGL_FINGERPRINT_MISSING` and `+15`.
- **IP rotation**: Redis set `ae:ips:{fingerprint}` with TTL 10 min; if unique IP count > 3 → incident `IP_ROTATION` and `+25`.
- **Cookie / session evasion**: Redis set `ae:sessions:{fingerprint}` with TTL 30 min; if more than one distinct browser `session_id` appears for the same fingerprint → incident `COOKIE_EVASION` and `+10`.
- **Multi-account device/IP detection**: count distinct `Visitor.linked_user` values per `device_id` and per `ip`; if counts exceed configured thresholds → incidents `MULTI_ACCOUNT_DEVICE` / `MULTI_ACCOUNT_IP` and `+20` per extra account.
- **Spam burst detection**: Redis counter `spam:{site_id}:{fingerprint|ip}` with TTL 60s; if count exceeds `spam_rate_threshold` → incident `SPAM_DETECTED`.

### 2.3 Risk Score Update
- On async pageview checks, the service recomputes the currently implemented risk signals and writes the resulting score to `devices.risk_score`.
- Score is capped at `100`.
- Spam burst incidents do not currently add a dedicated risk-score weight; they are logged as incidents only.

### 2.4 Deferred Checks
- VPN / Tor / proxy reputation feeds remain deferred until curated list refresh is implemented.
- Behavioral mouse/click entropy and timezone/language mismatch checks remain documented roadmap items, not active code paths.

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
- Per-user index stored in Redis: `user:{user_id}:sessions`.
- TTL: `JWT_EXPIRE_MINUTES` (default 1440 = 24h).
- JWT contains internal `sid` claim; protected API requests require both a valid JWT and a live Redis session key.
- On logout: delete current session key from Redis.
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
| Session revoke | actor_id, action=REVOKE_SESSION, target_type=session, target_id |

Audit logs: write-only via API. No delete endpoint. Retention controlled by `incident_retention_days`.
