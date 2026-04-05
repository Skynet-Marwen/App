# SkyNet — Security Model

> Last reviewed: 2026-04-04 — shipped app version `1.7.1`

---

## Known Hardening Gaps

No open hardening gaps as of v1.7.1. Previous gaps (resolved):

- ~~RBAC over-permissive: settings/blocking/integration/maintenance routes accepted any authenticated user.~~ → **Fixed v1.7.1**: all high-impact routes now enforce `require_admin_user` or `require_superadmin_user`.
- ~~`webhook_secret` stored in plaintext in runtime settings, returned unmasked by `GET /api/v1/settings`.~~ → **Fixed v1.7.1**: migrated to `webhook_secret_enc` (Fernet-encrypted), masked on read, encrypted on write, decrypted only at delivery time.
- ~~`GET /api/v1/system/info` publicly accessible, exposing component versions.~~ → **Fixed v1.7.1**: now requires authentication (`get_current_user`).

---

## Threat Model

| Threat | Vector | Mitigation | Status |
|--------|--------|-----------|--------|
| Operator credential brute force | `POST /auth/login` | Runtime Redis-backed rate limit per IP (default 10 req/min) | ✅ |
| JWT theft (operator) | XSS / network | Short expiry (24h) + Redis session revocation + HTTPS | ✅ |
| JWT theft (external IdP) | XSS in protected app | SKYNET validates signature + expiry against configured JWKS providers | ✅ |
| External token replay | Replayed expired token | `python-jose` validates `exp` claim on every request | ✅ |
| Fake external subject | Attacker forges identity | RS256/ES256 signature verified against JWKS public key | ✅ |
| JWKS poisoning | Man-in-the-middle on JWKS fetch | HTTPS required for production JWKS URLs | Planned |
| Multi-account abuse | Same device → many users | `detect_multi_account()` → AnomalyFlag severity=high | ✅ v1.2 |
| Impossible travel | Geo jump between sessions | activity_events IP+country delta check + anomaly flag + risk recompute | ✅ v1.3 |
| API key leak | Exposed in client source | Per-site keys, revocable instantly, per-request logging | ✅ |
| Over-reactive DNSBL on residential WAN space | Dynamic-IP markets look abusive to public blocklists | Country-based DNSBL soft-fail list keeps DNSBL additive without direct enforcement | ✅ v1.6.10 |
| Over-reactive locale mismatch heuristics | Multilingual countries legitimately use neighboring/global UI languages | Country-aware language allowances keep `LANGUAGE_MISMATCH` low-noise in regions such as Tunisia | ✅ v1.7.1 |
| IP spoofing | X-Forwarded-For manipulation | Forwarded IP headers only trusted when `trust_proxy_headers=true` | ✅ |
| Fingerprint evasion | Private mode, canvas block | Multi-signal composite; flag absent signals | ✅ |
| Device cookie tampering | User edits `_skynet_did` manually | HMAC-signed cookie verified server-side before use | ✅ v1.6 |
| Challenge bypass forgery | User crafts a fake gateway bypass token | Short-lived HMAC-signed bypass token validated against request subject | ✅ v1.6 |
| Fingerprint drift / browser upgrades | Legitimate signal changes across visits | Signed cookie continuity + fingerprint stability scoring | ✅ v1.6 |
| CSRF | Cross-site form submission | Bearer token auth (not cookie-based) | ✅ |
| SQL injection | User-supplied params | SQLAlchemy ORM + Pydantic validation | ✅ |
| XSS via stored data | User-agent / URL fields | bleach HTML stripping on ingest; CSP headers | ✅ v1.1 |
| Clickjacking | iframe embedding | `X-Frame-Options: DENY` + CSP `frame-ancestors 'none'` | ✅ v1.1 |
| MIME sniffing | Content-type confusion | `X-Content-Type-Options: nosniff` | ✅ v1.1 |
| Information leakage | Cross-origin referer | `Referrer-Policy: strict-origin-when-cross-origin` | ✅ v1.1 |
| Secret exposure | `.env` committed to git | `.gitignore` enforced; `.env.example` as template | ✅ |
| Insider threat | Admin account abuse | Write-only audit log for all state changes | ✅ v1.1 |
| Operator lockout | Last owner account deleted/demoted/blocked | Superadmin guardrails prevent removing the final `superadmin` | ✅ |
| Over-broad operator permissions | Non-admin operator can reach privileged settings/system actions | Route-level `require_admin_user` / `require_superadmin_user` enforcement across all critical routes | ✅ v1.7.1 |
| Malicious branding asset upload | Admin uploads oversized or unsafe theme file | MIME allowlist + 2 MB cap + backend-served logo route only | ✅ |
| False same-device merge | Cross-browser similarity | Strict tuple grouping; exact fingerprint is block authority | ✅ v1.1 |
| Over-escalation from grouped behavior | One risky child blocks an unrelated parent immediately | Parent escalation is additive, threshold-based, exact-device first, disabled by default | ✅ v1.6.10 |
| VPN/proxy bypass via WebRTC | WebRTC ICE candidates leak real LAN IP behind VPN | `detectWebRTCLeak()` tracker probe → `WEBRTC_VPN_BYPASS` incident (+35 risk); no raw IPs collected | ✅ v1.7.0 |
| Subtle bot/anomaly not covered by rules | Hardcoded thresholds miss novel patterns | Isolation Forest ML model (additive +15 risk, feature-flagged, retrained every 24h on healthy traffic) | ✅ v1.7.0 |
| Container escape | Docker misconfiguration | Non-root user in containers (planned) | Planned v1.3 |

---

## Secret Management

### Rules
```
NEVER committed to git:
  .env
  *.pem  *.key  *.crt
  data/GeoLite2-*.mmdb

ALWAYS committed:
  .env.example   (placeholder values only)
  .gitignore     (enforces the above)
```

### Required Secrets

```bash
openssl rand -hex 32    # → APP_SECRET_KEY
openssl rand -hex 32    # → JWT_SECRET
openssl rand -hex 32    # → DEVICE_COOKIE_SECRET (optional explicit override)
```

| Variable | Minimum Entropy | Rotation Period |
|----------|----------------|----------------|
| `APP_SECRET_KEY` | 32 bytes random hex | 90 days |
| `JWT_SECRET` | 32 bytes random hex | 90 days |
| `DEVICE_COOKIE_SECRET` | 32 bytes random hex | 90 days |
| `DATABASE_URL` | Strong DB password | On personnel change |
| Keycloak admin password | 16+ chars random | 90 days |

### Runtime Integration Secrets
External IdP settings are configured at runtime via `Settings → Auth` and stored in the database-backed runtime config layer, with optional bootstrap defaults from `.env`. The JWKS URL is not secret. SKYNET does not use an OAuth client secret because it validates external tokens; it does not authenticate end-users itself.
`DEVICE_COOKIE_SECRET` can be set explicitly; if omitted, the backend falls back to `APP_SECRET_KEY` for `_skynet_did` signing.
Gateway challenge bypass tokens also derive their signature from application secrets and expire quickly by design.

SMTP passwords are stored as Fernet-encrypted ciphertext (`smtp_password_enc`) derived from `APP_SECRET_KEY`, and are only decrypted at send time or through the admin-only reveal endpoint.
Integration connector secrets (`integration_siem_secret_enc`, `integration_monitoring_secret_enc`) are stored the same way and are only decrypted at send time or when an operator explicitly reuses the masked value during a connector test.
Theme definitions and per-user theme assignments are stored in the database. Uploaded theme logos are stored under `backend/data/theme-assets/` and served through backend API routes.
Current gap: the global webhook signing secret is still stored as plaintext runtime config (`webhook_secret`) and can be returned by `GET /settings`; it should be migrated to encrypted-at-rest storage with masked read semantics.
Site API keys are intentionally public integration identifiers, not operator secrets. When a protected app wants to avoid exposing the raw site key in browser bootstrap config, it should proxy SkyNet through its own origin and keep the site key server-side.

### Secret Rotation Procedure
1. Generate new secret.
2. Update `.env` on all instances.
3. Restart backend (rolling restart in prod).
4. Changing `JWT_SECRET` invalidates all operator sessions (forces re-login).
5. Changing `APP_SECRET_KEY` or `DEVICE_COOKIE_SECRET` invalidates previously issued signed `_skynet_did` cookies.
6. Log rotation event in audit log.

---

## Rate Limiting

Implemented via runtime Redis-backed per-IP counters in `AccessNetworkMiddleware`.

| Endpoint Group | Limit | Window | Key |
|---------------|-------|--------|-----|
| `POST /auth/login` | `rate_limit_auth_login_per_minute` (default 10) | 1 minute | client IP |
| `POST /auth/*` | `rate_limit_auth_per_minute` (default 30) | 1 minute | client IP |
| `GET/POST /integration/*` and `POST /settings/integrations/*` | `rate_limit_integration_per_minute` (default 120) | 1 minute | client IP |
| `POST /track/*` and `GET /track/check-access` | `rate_limit_track_per_minute` (default 200) | 1 minute | client IP |
| All other HTTP routes | `rate_limit_default_per_minute` (default 300) | 1 minute | client IP |

Rate limit exceeded: `HTTP 429` with `Retry-After` header.
When `trust_proxy_headers=false`, the limiter keys off the raw TCP peer address and ignores `CF-Connecting-IP`, `X-Real-IP`, and `X-Forwarded-For`.

---

## Audit Logging

### Required Events

| Event | action | target | Extra |
|-------|--------|--------|-------|
| Login success | `LOGIN` | — | ip |
| Login failure | `LOGIN_FAILED` | — | ip, attempted_username |
| Logout | `LOGOUT` | — | ip |
| Block visitor | `BLOCK` | visitor.id | reason, ip |
| Unblock visitor | `UNBLOCK` | visitor.id | — |
| Block IP | `BLOCK_IP` | ip | reason |
| Unblock IP | `UNBLOCK_IP` | ip | — |
| Create operator | `CREATE_USER` | user.id | role |
| Delete operator | `DELETE_USER` | user.id | — |
| Block operator | `BLOCK_USER` | user.id | reason |
| Config change | `CONFIG_CHANGE` | setting_key | updated_keys |
| API key regen | `REGEN_KEY` | site.id | — |
| Resolve incident | `RESOLVE_INCIDENT` | incident.id | — |
| Anomaly flag update | `FLAG_UPDATE` | flag.id | status, user |
| Enhanced audit toggle | `ENHANCED_AUDIT_TOGGLE` | external_user_id | enabled, reason |
| Delete external user intelligence | `DELETE_EXTERNAL_USER` | external_user_id | — |

### Storage Rules
- `audit_logs` table is **write-only** — no `DELETE` or `UPDATE` endpoint.
- Retention: `incident_retention_days` for incidents and `event_retention_days` for authenticated activity timelines.
- `extra` field is JSON for flexible querying.

### Identity Enforcement Boundary
- `devices.fingerprint` is the enforcement key for block/link/delete.
- `devices.device_cookie_id` is a continuity helper only; it improves matching across visits but is not the primary enforcement key.
- gateway challenge bypass tokens are friction helpers only; they temporarily suppress repeated challenge prompts for the same request subject
- first-party relay patterns can proxy challenge pages and verification endpoints through the protected app origin so challenge flow does not leave that application
- `identity_links.external_user_id` (external IdP subject) is the enforcement key for identity/risk actions.
- These two namespaces are intentionally separate — a blocked device does not auto-block the user profile, and vice versa.
- Group parent escalation can raise device or user posture from linked child behavior, but it stays additive and threshold-based; there is no separate `ban` state and no immediate hard block path from group logic alone.
- `UserProfile.trust_level = blocked` currently affects protected-app identity flows and `/track/activity`; anonymous tracker pageviews are not yet hard-blocked by external-user profile state.
- Visitor blocks remain exact visitor-scoped. Group-parent posture can raise risk on the owning device or user, but a visitor block itself is not allowed to spill onto unrelated visitors or sibling devices.
- Delete operations now perform intelligence cleanup rather than leaving stale references behind: related anomaly flags, device-bound incidents, and orphaned identity links are removed or detached, and remaining external-user profiles are recomputed after visitor/device/external-user deletion.
- Site API keys are also governed by the runtime `integration_api_access_enabled` toggle, so operators can disable protected-app ingestion without deleting registered sites.
- Security Center scans are safe-read oriented and now degrade per site: a single unreachable or broken target should produce an `error` scan status for that profile, not collapse the full scan run.
- Threat-intel refresh used by Security Center is defensive against malformed upstream advisory rows; invalid entries are ignored so feed noise does not become a denial of scan visibility.

### Theme Administration Boundary
- Theme CRUD, default-theme promotion, and logo upload/remove are admin-only operations.
- Theme package export/import is admin-only and uses typed JSON documents rather than raw filesystem access.
- Per-user theme selection is available to any authenticated operator via `/api/v1/user/theme`.
- Tenant CRUD and `superadmin` promotion/demotion are superadmin-only operations.
- Tenant-bound admins are constrained to their own tenant scope when managing operators through `/users`.
- Uploaded theme logos are restricted to PNG, JPEG, WEBP, and GIF with a 2 MB maximum payload.
- Uploaded logos are serialized as backend API URLs (`/api/v1/themes/{id}/logo`) rather than anonymous filesystem paths.
- Role-based theme shell surfaces only affect navigation presentation; they do not grant or revoke backend permissions.
- Current gap: a branch review on 2026-04-03 found that several settings, integration, blocking, and system endpoints still rely on generic operator auth in code instead of the stricter admin boundary described here.

---

## External JWT Validation

SKYNET validates external JWTs using one or more configured JWKS endpoints. This is **not** operator authentication — it is external token validation for identity linking.

### Validation steps
1. Resolve a provider from `idp_providers` (or legacy `keycloak_*`) using an explicit hint, unverified issuer claim, or configured default.
2. Fetch public keys from that provider's JWKS URL (HTTPS required in production).
3. Cache keys in-process per provider for `cache_ttl_sec` (default: 300s).
4. Validate: RS256/RS384/RS512/ES256 signature, `exp` claim, `iss` claim (if configured), `aud` claim (if configured).
5. On IdP unreachable: use cached keys for up to 600 additional seconds (grace period).
6. On no valid cache: return `HTTP 503 IDP_UNAVAILABLE` — operator routes are **not** affected.

### SKYNET operator auth is always isolated
The SKYNET JWT (`HS256`, signed with `JWT_SECRET`) is issued by SKYNET itself and is never shared with external IdPs. Operator login never touches external JWKS endpoints.

---

## HTTP Security Headers

Applied by `SecurityHeadersMiddleware` on every response.

| Header | Value |
|--------|-------|
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `X-XSS-Protection` | `1; mode=block` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `geolocation=(), microphone=(), camera=()` |
| `Content-Security-Policy` | `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'` |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` |

---

## Input Validation Rules

- All request bodies validated by Pydantic at the API boundary.
- URL fields (`base_url`, `webhook_url`, legacy `keycloak_*`, and `idp_providers[*].jwks_url/issuer`): validated via `clean_url()` — scheme must be `http` or `https`.
- Host policy fields such as `allowed_domains`: normalized to bare hostnames or wildcard host patterns before storage.
- CORS policy fields such as `cors_allowed_origins`: normalized to exact origins or `*` before middleware evaluation.
- String fields: strip whitespace, strip HTML via `bleach`.
- IP fields: validated with Python `ipaddress` module.
- `external_user_id` (external IdP subject): treated as opaque string — not parsed or interpreted by SKYNET.

---

## HTTPS / TLS

- Production must run behind HTTPS.
- Recommended: Nginx + Certbot or Cloudflare Proxy.
- External JWKS URLs should be `https://` in production to prevent JWKS MitM.
- Internal Docker communication does not require TLS (private bridge network).
