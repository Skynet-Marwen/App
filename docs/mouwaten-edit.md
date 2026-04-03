# Mouwaten Edit

> Practical record of the changes and integration steps used to make **Mouwaten** work with **Keycloak** and **SkyNet**.
> Last updated: 2026-04-03

---

## Goal

Make Mouwaten:

- authenticate users with Keycloak
- expose the Keycloak access token to SkyNet
- resolve the current SkyNet device UUID in the browser
- link the authenticated Mouwaten user to that SkyNet device
- send authenticated activity events to SkyNet
- let SkyNet return a trust verdict (`trusted` / `normal` / `suspicious` / `blocked`)

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

The actual Mouwaten codebase is not inside this repository, so this section documents the integration contract that Mouwaten had to follow.

### 1. Load the SkyNet tracker on Mouwaten pages

Mouwaten needs the SkyNet tracker script on the pages that should be tracked:

```html
<script>window._skynet = { key: 'YOUR_SITE_API_KEY' };</script>
<script async src="https://skynet.yourdomain.com/tracker/skynet.js"></script>
```

Result:

- browser tracking is enabled
- SkyNet can resolve device context
- `_skynet_did` continuity cookie can be maintained

### 2. Resolve the real SkyNet device UUID in the browser

Before calling identity endpoints, Mouwaten must do:

```js
const deviceId = await SkyNet.getDeviceId();
```

This avoids using raw browser fingerprints directly in app code.

### 3. Send the Keycloak access token to SkyNet after login

After Mouwaten authenticates the user with Keycloak, it must call:

```js
const linkRes = await fetch('https://skynet.example.com/api/v1/identity/link', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${keycloakAccessToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    fingerprint_id: deviceId,
    platform: 'web',
    site_id: '<mouwaten-site-id>',
  }),
});

const identity = await linkRes.json();
```

Mouwaten should then enforce the returned verdict:

- `trusted` or `normal`: allow
- `suspicious`: require extra verification
- `blocked`: deny access or stop the sensitive action

### 4. Send authenticated activity to SkyNet

Once logged in, Mouwaten should send user activity such as pageviews or important actions:

```js
await fetch('https://skynet.example.com/api/v1/track/activity', {
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
    site_id: '<mouwaten-site-id>',
  }),
});
```

### 5. Keep Keycloak token claims compatible

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
2. Mouwaten loads skynet.js with its site API key
3. Browser resolves SkyNet device context
4. User signs in through Keycloak
5. Mouwaten receives Keycloak access token
6. Mouwaten calls SkyNet /identity/link with:
   - Bearer <keycloak_token>
   - fingerprint_id = SkyNet device UUID
7. SkyNet validates token against Keycloak JWKS
8. SkyNet upserts user profile and device link
9. SkyNet computes risk and trust level
10. Mouwaten receives verdict and acts on it
11. Mouwaten keeps sending authenticated activity to /track/activity
```

---

## Practical Mouwaten Checklist

- Add the SkyNet tracker script to Mouwaten pages.
- Make sure Mouwaten uses `SkyNet.getDeviceId()` before identity linking.
- After Keycloak login, call `/api/v1/identity/link`.
- Use the returned `trust_level` in Mouwaten access decisions.
- Send authenticated events to `/api/v1/track/activity`.
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
