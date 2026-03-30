# SkyNet — Security Model

> Last reviewed: 2026-03-29

---

## Threat Model

| Threat | Vector | Mitigation | Status |
|--------|--------|-----------|--------|
| Credential brute force | `POST /auth/login` | Rate limit: 10 req/min per IP (slowapi) | ✅ v1.1 |
| JWT theft | XSS / network intercept | Short expiry (24h), HTTPS enforced | ✅ JWT, HTTPS infra |
| API key leak | Exposed in client source | Per-site keys, revocable instantly, per-request logging | ✅ |
| IP spoofing | X-Forwarded-For manipulation | Trusted proxy list in config; validate header chain | Planned v1.1 |
| Fingerprint evasion | Private mode, canvas block | Multi-signal composite score; flag absent signals | ✅ Risk scoring |
| CSRF | Cross-site form submission | Bearer token auth (not cookie-based) | ✅ |
| SQL injection | User-supplied query params | SQLAlchemy ORM + Pydantic validation | ✅ |
| XSS via stored data | User-agent / URL fields | Strip HTML on ingest; CSP headers via middleware | Planned v1.1 |
| Clickjacking | iframe embedding | `X-Frame-Options: DENY` + CSP `frame-ancestors 'none'` | ✅ v1.1 |
| MIME sniffing | Content-type confusion | `X-Content-Type-Options: nosniff` | ✅ v1.1 |
| Information leakage via Referer | Cross-origin requests | `Referrer-Policy: strict-origin-when-cross-origin` | ✅ v1.1 |
| Secret exposure | `.env` committed to git | `.gitignore` enforced; `.env.example` as template | ✅ |
| Mass account creation | Tracker identify abuse | Max accounts per device/IP thresholds | ✅ Logic |
| Insider threat | Admin account abuse | Audit log (write-only) for all state changes | Planned v1.1 |
| Container escape | Docker misconfiguration | Non-root user in containers; read-only FS planned | Planned v1.2 |

---

## Secret Management

### Rules
```
NEVER committed to git:
  .env
  *.pem  *.key  *.crt
  data/GeoLite2-*.mmdb

ALWAYS committed:
  .env.example          (placeholder values only)
  .gitignore            (enforces the above)
```

### Required Secrets
```bash
# Generate strong secrets:
openssl rand -hex 32    # → APP_SECRET_KEY
openssl rand -hex 32    # → JWT_SECRET
```

| Variable | Minimum Entropy | Rotation Period |
|----------|----------------|----------------|
| `APP_SECRET_KEY` | 32 bytes random hex | 90 days |
| `JWT_SECRET` | 32 bytes random hex | 90 days |
| `DATABASE_URL` | Strong DB password | On personnel change |
| `GEOIP_DB_PATH` | N/A — file path | On MaxMind DB refresh |

### Secret Rotation Procedure
1. Generate new secret.
2. Update `.env` on all instances.
3. Restart backend (zero-downtime rolling restart in prod).
4. Invalidate all existing JWTs by changing `JWT_SECRET` (forces re-login).
5. Log rotation event in audit log.

---

## Rate Limiting

Implemented via `slowapi` (wraps `limits` library, Redis-backed).

| Endpoint Group | Limit | Window | Key |
|---------------|-------|--------|-----|
| `POST /auth/login` | 10 req | 1 minute | IP |
| `POST /auth/*` | 30 req | 1 minute | IP |
| `POST /track/*` | 200 req | 1 minute | IP |
| `GET /track/check/*` | 100 req | 1 minute | API key |
| All `/api/v1/*` (auth) | 300 req | 1 minute | user_id |

Rate limit exceeded response: `HTTP 429` with `Retry-After` header.

---

## Audit Logging

### Required Events

| Event | actor | action | target | Extra fields |
|-------|-------|--------|--------|-------------|
| Login success | user.id | `LOGIN` | — | ip |
| Login failure | null | `LOGIN_FAILED` | — | ip, attempted_username |
| Logout | user.id | `LOGOUT` | — | ip |
| Block visitor | user.id | `BLOCK` | visitor.id | reason, ip |
| Unblock visitor | user.id | `UNBLOCK` | visitor.id | — |
| Block IP | user.id | `BLOCK_IP` | ip | reason |
| Unblock IP | user.id | `UNBLOCK_IP` | ip | — |
| Create user | user.id | `CREATE_USER` | new_user.id | role |
| Delete user | user.id | `DELETE_USER` | target.id | — |
| Block user | user.id | `BLOCK_USER` | target.id | reason |
| Config change | user.id | `CONFIG_CHANGE` | setting_key | old_value, new_value |
| API key regen | user.id | `REGEN_KEY` | site.id | — |
| Resolve incident | user.id | `RESOLVE_INCIDENT` | incident.id | — |

### Storage Rules
- Audit logs stored in dedicated `audit_logs` table.
- No `DELETE` or `UPDATE` endpoint for audit logs — write-only.
- Retention: same as `incident_retention_days` setting.
- Format: JSONB for `extra` fields to allow flexible querying.

---

## Input Validation Rules

- All request bodies validated by Pydantic schemas before reaching route logic.
- String fields: strip leading/trailing whitespace.
- URL fields: validate scheme is `http` or `https`.
- IP fields: validate with Python `ipaddress` module.
- CIDR fields: validate via `ipaddress.ip_network()`.
- HTML/script tags: strip via `bleach` library before DB storage.
- Max lengths enforced at both Pydantic and DB column levels.

---

## HTTP Security Headers

Applied by `backend/app/middleware/security_headers.py` (`SecurityHeadersMiddleware`) on **every response** — backend and tracker endpoints included.

| Header | Value |
|--------|-------|
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `X-XSS-Protection` | `1; mode=block` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `geolocation=(), microphone=(), camera=()` |
| `Content-Security-Policy` | `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'` |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` |

**CSP note:** `'unsafe-inline'` is required for the Vite/React production bundle and Tailwind inline styles. To tighten this, switch to nonce-based CSP when the nginx reverse proxy is updated to inject nonces.

**HSTS note:** Browsers ignore HSTS over HTTP — safe to ship in all environments. Takes effect once served over HTTPS in production.

Status: ✅ **v1.1**

---

## HTTPS / TLS

- Production deployments must run behind HTTPS.
- Recommended: Nginx + Certbot (Let's Encrypt) or Cloudflare Proxy.
- Internal Docker communication does not require TLS (private network).
- `KEYCLOAK_URL` must be HTTPS in production.
