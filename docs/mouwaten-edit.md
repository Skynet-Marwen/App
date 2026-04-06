# Mouwaten Edit

> Practical record of the changes and integration steps used to make **Mouwaten** work with **Keycloak** and **SkyNet**.
> Last updated: 2026-04-03

---

## Goal

Make Mouwaten:

- authenticate users with Keycloak
- resolve the current SkyNet device UUID in the browser
- link the authenticated Mouwaten user to that SkyNet device
- send authenticated activity events to SkyNet
- let SkyNet return a trust verdict (`trusted` / `normal` / `suspicious` / `blocked`)
- keep tracker and challenge flow on the Mouwaten origin when blockers or plain-HTTP LAN hosts make direct SkyNet browser calls unreliable

---

## What Was Added On The SkyNet Side

SkyNet was prepared to accept Mouwaten users as external users authenticated by Keycloak, not as SkyNet operators.

### 1. External JWT / JWKS validation

SkyNet now supports validating end-user JWTs from Keycloak through:

- `idp_providers`
- legacy `keycloak_*` bootstrap settings

Relevant behavior already implemented in the project:

- external JWT validation for `/api/v1/identity/link`
- external JWT validation for `/api/v1/track/activity`
- issuer / audience / JWKS-based token verification
- cached JWKS fetching through the backend validator

Reference:

- [API.md](/home/marwen/SkyNet/docs/API.md#L8)
- [ARCHITECTURE.md](/home/marwen/SkyNet/docs/ARCHITECTURE.md#L106)
- [AuthTab.jsx](/home/marwen/SkyNet/frontend/src/pages/settings/AuthTab.jsx#L29)

### 2. Device UUID helper for browser integrations

SkyNet no longer expects Mouwaten to invent its own device identifier.
The browser resolves the real SkyNet device UUID through:

- `SkyNet.getDeviceId()`
- `SkyNet.getDeviceContext()`
- backend `POST /api/v1/track/device-context`

This is important because `fingerprint_id` for identity linking is the SkyNet `devices.id` UUID, not the raw browser fingerprint.

Reference:

- [INSTALL.md](/home/marwen/SkyNet/docs/INSTALL.md#L458)
- [API.md](/home/marwen/SkyNet/docs/API.md#L76)
- [ARCHITECTURE.md](/home/marwen/SkyNet/docs/ARCHITECTURE.md#L131)

### 3. Identity linking flow

After Mouwaten login succeeds with Keycloak, the app sends the Keycloak access token to:

- `POST /api/v1/identity/link`

with:

- `fingerprint_id`
- `platform`
- optional `site_id`

SkyNet then:

1. validates the Keycloak token
2. extracts `sub`, `email`, `name`, and session-related claims
3. creates or updates `user_profiles`
4. creates or updates `identity_links`
5. recomputes user risk
6. returns the trust verdict to the app

Reference:

- [ARCHITECTURE.md](/home/marwen/SkyNet/docs/ARCHITECTURE.md#L106)
- [API.md](/home/marwen/SkyNet/docs/API.md#L76)

### 4. Authenticated activity tracking

Mouwaten can now send post-login activity to:

- `POST /api/v1/track/activity`

using the same Keycloak access token and the same SkyNet device UUID.

This lets SkyNet correlate:

- user identity
- device identity
- session behavior
- anomalies like impossible travel or multi-account patterns

Reference:

- [API.md](/home/marwen/SkyNet/docs/API.md#L398)
- [ARCHITECTURE.md](/home/marwen/SkyNet/docs/ARCHITECTURE.md#L158)

### 5. Keycloak realm sync for Mouwaten users

SkyNet also includes Keycloak Admin sync so Mouwaten realm users can be imported into `user_profiles` before they hit the app.

The test coverage in this repo already uses the `mouwaten` realm as the concrete example.

Reference:

- [test_keycloak_admin.py](/home/marwen/SkyNet/backend/tests/test_keycloak_admin.py#L23)
- [AuthTab.jsx](/home/marwen/SkyNet/frontend/src/pages/settings/AuthTab.jsx#L239)

### 6. Tenant / theme hooks for Mouwaten

There is already tenant-aware theme resolution using a Mouwaten host example:

- `mouwaten.local`

This means Mouwaten can be mapped to a dedicated tenant theme when SkyNet resolves UI context.

Reference:

- [test_theme_service.py](/home/marwen/SkyNet/backend/tests/test_theme_service.py#L163)

---

## What Mouwaten Needed To Do

This section reflects the live Mouwaten-side integration pattern now used with SkyNet.

### 1. Serve the tracker through Mouwaten itself

Mouwaten no longer needs to expose the raw SkyNet site key in public bootstrap config or call `https://skynet.tn` directly from the browser.

The live pattern is:

- public config returns:
  - `tracker_url: /api/auth/skynet.js`
  - `base_url: ""`
  - `site_key: ""`
- Mouwaten backend fetches the real SkyNet tracker server-side
- Mouwaten injects same-origin relay paths for tracker, identity, activity, and challenge flow

Result:

- browser tracking is enabled
- the raw SkyNet site API key stays server-side
- SkyNet can resolve device context
- `_skynet_did` continuity cookie can be maintained
- blocker-sensitive browsers stay on the Mouwaten origin
- challenge pages no longer need to redirect the browser to `https://skynet.tn`
- Mouwaten can require tracker readiness before protected flows continue, instead of silently tolerating blocked tracker JS

### 2. Resolve the real SkyNet device UUID in the browser

Before calling identity endpoints, Mouwaten must do:

```js
const deviceId = await SkyNet.getDeviceId();
```

This avoids using raw browser fingerprints directly in app code.

### 3. Send the Keycloak access token after login through the Mouwaten relay

After Mouwaten authenticates the user with Keycloak, it calls its own same-origin relay:

```js
// browser-side call (e.g. after Keycloak login)
const linkRes = await fetch('/api/auth/skynet/link', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    fingerprint_id: deviceId,
    platform: 'web',
  }),
});
const identity = await linkRes.json();
```

The **server-side Next.js relay** at `pages/api/auth/skynet/link.js` must:

1. Extract the Keycloak `access_token` stored in the NextAuth JWT — **not** the NextAuth JWT itself (the NextAuth JWT is signed with `NEXTAUTH_SECRET` / HS256 and will always fail SkyNet JWKS validation).
2. Proxy SkyNet's actual HTTP status code back to the browser so the browser sees `401` / `503` instead of a masked `500`.

```js
// pages/api/auth/skynet/link.js
import { getToken } from 'next-auth/jwt';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  // getToken() decodes the NextAuth session cookie — access_token is the
  // raw Keycloak access token stored there by the NextAuth Keycloak provider.
  const nextAuthToken = await getToken({ req });
  if (!nextAuthToken?.access_token) {
    return res.status(401).json({ code: 'NOT_AUTHENTICATED', message: 'No Keycloak session' });
  }

  let skynetRes;
  try {
    skynetRes = await fetch(`${process.env.SKYNET_API_URL}/api/v1/identity/link`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${nextAuthToken.access_token}`,
        'Content-Type': 'application/json',
        'X-Forwarded-For': req.headers['x-forwarded-for'] || req.socket.remoteAddress || '',
      },
      body: JSON.stringify(req.body),
    });
  } catch (err) {
    console.error('[SkyNet relay] identity/link fetch failed', err);
    return res.status(502).json({ code: 'SKYNET_UNREACHABLE', message: 'SkyNet backend unreachable' });
  }

  const data = await skynetRes.json().catch(() => ({}));
  // Proxy SkyNet's real status — never swallow 401/403/503 as 500
  return res.status(skynetRes.status).json(data);
}
```

> **Why this pattern fails silently without the fix:**
> When NextAuth stores the session as a JWT cookie, `req.headers.authorization` in the relay is usually absent — the browser sends a cookie, not a Bearer token. The relay must call `getToken({ req })` to decrypt the NextAuth cookie and extract `access_token`. Forwarding the raw NextAuth JWT (signed with HS256) to SkyNet will always produce `TOKEN_INVALID` because SkyNet's JWKS validator only accepts asymmetric algorithms (RS256/ES256).
> The relay must also forward SkyNet's status code verbatim — returning `200` on a `401` or crashing on any non-2xx response hides the real error from the browser and makes debugging impossible.

Also ensure `next.config.js` does **not** strip the `Authorization` header when proxying internally.

Mouwaten should then enforce the returned verdict:

- `trusted` or `normal`: allow
- `suspicious`: require extra verification
- `blocked`: deny access or stop the sensitive action

### 4. Send authenticated activity through the same-origin relay

Once logged in, Mouwaten should send user activity such as pageviews or important actions:

```js
await fetch('/api/auth/skynet/activity', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${keycloakAccessToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    event_type: 'pageview',
    platform: 'web',
    fingerprint_id: deviceId,
    page_url: window.location.href,
    session_id: window.sessionStorage.getItem('_sn_sid'),
  }),
});
```

The Mouwaten backend injects the real SkyNet `site_key` server-side before forwarding the request to `/api/v1/track/activity`.

### 5. Proxy challenge pages on the Mouwaten origin

When `/api/auth/skynet/check-access` returns a challenge, Mouwaten now keeps the browser on:

### 6. Treat tracker readiness as mandatory when enforcement is active

Mouwaten should not silently continue when the SkyNet tracker relay is blocked by extension filtering or never exposes a usable device API.

The live integration now supports a strict behavior:

- load the tracker from `/api/auth/skynet.js`
- require `window.__skynetTrackerReady === true`
- require `SkyNet.getDeviceId()` to exist
- if the tracker never becomes ready, stop the protected app flow and show a security message instead of continuing without tracking

This is the practical answer to “no tracker, no protected use” for Mouwaten.

- `/api/auth/skynet/challenge/{token}`
- `/api/auth/skynet/challenge/{token}/verify`
- `/api/auth/skynet/challenge/{token}/verify-honeypot`

This keeps the browser on `http://10.0.0.39:8081` instead of bouncing to `https://skynet.tn`.

The current relay also injects a SHA-256 fallback into the JS proof-of-work page so the challenge still works on plain-HTTP LAN hosts where `crypto.subtle` may be unavailable.

### 6. Keep Keycloak token claims compatible

For Mouwaten to work correctly with SkyNet, the Keycloak-issued token needs to provide claims that SkyNet expects during validation and profile upsert, mainly:

- `sub`
- `iss`
- `aud` when audience validation is enabled
- `email` when available
- `name` or equivalent profile fields when available

---

## SkyNet Settings Used For Mouwaten

These are the important settings SkyNet had to expose or support for the Mouwaten integration.

### External provider settings

In Settings -> Authentication & Identity -> External JWT Providers:

- provider name: `keycloak`
- provider enabled: `true`
- JWKS URL: Mouwaten Keycloak realm certs endpoint
- issuer: Mouwaten Keycloak realm issuer
- audience: optional, depending on Keycloak client setup
- cache TTL: typically `300`

Example shape:

```json
{
  "name": "keycloak",
  "enabled": true,
  "jwks_url": "https://keycloak.example.com/realms/mouwaten/protocol/openid-connect/certs",
  "issuer": "https://keycloak.example.com/realms/mouwaten",
  "audience": "mouwaten-web",
  "cache_ttl_sec": 300
}
```

### Keycloak sync settings

If pre-importing Mouwaten users into SkyNet:

- `keycloak_sync_enabled`
- `keycloak_sync_base_url`
- `keycloak_sync_realm`
- `keycloak_sync_client_id`
- `keycloak_sync_client_secret`
- `keycloak_sync_username` or service account auth
- `keycloak_sync_password`
- `keycloak_sync_user_limit`

The repo tests already use:

- realm: `mouwaten`

Reference:

- [AuthTab.jsx](/home/marwen/SkyNet/frontend/src/pages/settings/AuthTab.jsx#L239)
- [test_keycloak_admin.py](/home/marwen/SkyNet/backend/tests/test_keycloak_admin.py#L23)

---

## End-To-End Flow For Mouwaten

```text
1. User opens Mouwaten
2. Mouwaten serves `/api/auth/skynet.js` from its own origin
3. Browser resolves SkyNet device context
4. User signs in through Keycloak
5. Mouwaten receives Keycloak access token
6. Mouwaten calls `/api/auth/skynet/link` with:
   - Bearer <keycloak_token>
   - fingerprint_id = SkyNet device UUID
7. SkyNet validates token against Keycloak JWKS
8. SkyNet upserts user profile and device link
9. SkyNet computes risk and trust level
10. Mouwaten receives verdict and acts on it
11. Mouwaten keeps sending authenticated activity to `/api/auth/skynet/activity`
12. If challenge is needed, Mouwaten serves the challenge page and verify endpoints locally
```

---

## Practical Mouwaten Checklist

- Serve the SkyNet tracker through `/api/auth/skynet.js` on Mouwaten itself.
- Make sure Mouwaten uses `SkyNet.getDeviceId()` before identity linking.
- After Keycloak login, call the Mouwaten relay for identity linking.
- Use the returned `trust_level` in Mouwaten access decisions.
- Send authenticated events through the Mouwaten relay.
- Keep challenge pages proxied on the Mouwaten origin.
- Do not expose the raw SkyNet site API key in public bootstrap config unless you intentionally choose the direct browser integration model.
- Configure the Mouwaten Keycloak realm in SkyNet JWKS settings.
- Optionally enable Keycloak realm sync for the `mouwaten` realm.
- Optionally map Mouwaten hostnames to a dedicated tenant/theme inside SkyNet.

---

## Source References In This Repo

- [INSTALL.md](/home/marwen/SkyNet/docs/INSTALL.md#L449)
- [API.md](/home/marwen/SkyNet/docs/API.md#L8)
- [ARCHITECTURE.md](/home/marwen/SkyNet/docs/ARCHITECTURE.md#L106)
- [snippets.jsx](/home/marwen/SkyNet/frontend/src/pages/integration/snippets.jsx#L19)
- [AuthTab.jsx](/home/marwen/SkyNet/frontend/src/pages/settings/AuthTab.jsx#L29)
- [test_keycloak_admin.py](/home/marwen/SkyNet/backend/tests/test_keycloak_admin.py#L23)
- [test_theme_service.py](/home/marwen/SkyNet/backend/tests/test_theme_service.py#L163)
