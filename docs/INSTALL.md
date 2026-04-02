# SkyNet — Self-Hosted Installation Guide

> Last updated: 2026-04-02 — shipped app version `1.6.0`

---

## Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| Docker | 24.x | latest |
| Docker Compose | v2.x | latest |
| RAM | 2 GB | 4 GB |
| CPU | 2 cores | 4 cores |
| Disk | 10 GB | 50 GB |
| OS | Ubuntu 22.04+ / Debian 12+ | Ubuntu 24.04 |

---

## Quick Start (5 minutes)

```bash
# 1. Clone
git clone https://github.com/Skynet-Marwen/App.git skynet
cd skynet

# 2. Configure
cp backend/.env.example backend/.env
# Edit backend/.env — at minimum set:
#   APP_SECRET_KEY  (openssl rand -hex 32)
#   JWT_SECRET      (openssl rand -hex 32)

# 3. Start
docker compose up -d
docker compose --profile keycloak up -d keycloak   # optional local IdP for identity-link testing

# 4. Access
# SKYNET Dashboard: http://localhost:3000
# API docs:         http://localhost:8000/docs
# Keycloak Admin:   http://localhost:8080   (only if you started the optional profile)
#
# Default SKYNET login: admin@skynet.local / admin
# Default Keycloak:     admin / admin
#
# ⚠️  Change all default passwords immediately after first deployment.
```

---

## Environment Variables

Edit `backend/.env`:

```bash
# ── App ──────────────────────────────────────────────────────────
APP_SECRET_KEY=<openssl rand -hex 32>
DEVICE_COOKIE_SECRET=<openssl rand -hex 32>   # optional explicit override for _skynet_did signing
APP_DEBUG=false
APP_BASE_URL=https://skynet.yourdomain.com
APP_HTTPS_MODE=edge
APP_HTTPS_PROVIDER=reverse_proxy
APP_TRUST_PROXY_HEADERS=true
APP_HSTS_ENABLED=true

# ── Database ─────────────────────────────────────────────────────
DATABASE_URL=postgresql+asyncpg://skynet:skynet_secret@db:5432/skynet

# ── Redis ────────────────────────────────────────────────────────
REDIS_URL=redis://redis:6379/0

# ── JWT (SKYNET operators only — never shared with Keycloak) ─────
JWT_SECRET=<openssl rand -hex 32>
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=1440

# ── GeoIP (optional) ────────────────────────────────────────────
# Used only for local/offline lookup mode. Default runtime provider is ip-api.com.
GEOIP_DB_PATH=./data/GeoLite2-City.mmdb

# ── CORS ─────────────────────────────────────────────────────────
CORS_ORIGINS=https://skynet.yourdomain.com

# ── Keycloak Integration ─────────────────────────────────────────
# Used to validate JWTs from end-users of YOUR protected applications.
# SKYNET operators always authenticate locally — this does NOT affect admin login.
# Can also be configured at runtime via Settings → Auth in the dashboard.
KEYCLOAK_JWKS_URL=http://keycloak:8080/realms/myrealm/protocol/openid-connect/certs
KEYCLOAK_ISSUER=http://keycloak:8080/realms/myrealm
KEYCLOAK_AUDIENCE=        # optional — leave blank to skip audience validation
KEYCLOAK_CACHE_TTL_SEC=300
```

Persistent operator assets live under `backend/data/`:

- `backend/data/theme-assets/` — uploaded theme logos
- `backend/data/certs/` — self-signed and uploaded HTTPS certificate material

Keep that directory on persistent storage in every deployment target.

---

## Keycloak Setup

Keycloak is included in `docker-compose.yml` as an optional service (profile-gated).
Start it with:

```bash
docker compose --profile keycloak up -d
```

Or skip it entirely and point `KEYCLOAK_JWKS_URL` to any external OIDC provider
(Auth0, Azure AD, Google, etc.) — no local Keycloak required.

Port: **8080**

### Default credentials
- Admin console: `http://localhost:8080` → `admin` / `admin`
- **Change these immediately.**

### Create a realm for your protected app
1. Open Keycloak Admin console.
2. Create a new realm (e.g. `myapp`).
3. Create a client for your application (e.g. `myapp-frontend`).
4. Note the realm name — your JWKS URL will be:
   ```
   http://keycloak:8080/realms/myapp/protocol/openid-connect/certs
   ```
5. Set `KEYCLOAK_JWKS_URL` and `KEYCLOAK_ISSUER` in `backend/.env` (or via Settings → Auth).

### SKYNET operators are never Keycloak users
SKYNET dashboard operators authenticate with their local `email + password`.
Keycloak is only used to validate tokens issued to end-users of **your** applications.

---

## Database Migrations

Migrations run automatically on backend startup via Alembic.

To run manually:
```bash
docker compose exec backend alembic upgrade head
```

To check current migration state:
```bash
docker compose exec backend alembic current
```

---

## Development Mode (Hot Reload)

```bash
docker compose -f docker-compose.dev.yml up -d
```

- Backend: FastAPI + uvicorn `--reload` on port **8000**
- Frontend: Vite dev server with HMR on port **5173**
- DB + Redis: same as production
- Keycloak is **not** included in `docker-compose.dev.yml`; start it separately with `docker compose --profile keycloak up -d keycloak` or point to an external OIDC provider

Optional tools:
```bash
docker compose -f docker-compose.dev.yml --profile tools up -d
# Adminer (DB GUI):    http://localhost:8888
# RedisInsight:        http://localhost:5540
```

If a browser API or test flow needs a secure context:

```bash
docker compose -f docker-compose.dev.yml -f docker-compose.dev-https.yml up -d
# Open https://localhost:8443
```

See [HTTPS guide](HTTPS.md) for the full deployment matrix.

---

## Settings Navigation

The dashboard settings workspace is now grouped into 9 operator domains:

1. Security & Detection
2. Access & Network
3. Authentication & Identity
4. UI / Theme Engine
5. Data & Storage
6. Integrations
7. Notifications & Messaging
8. Blocking & Response
9. System & Debug

Theme creation, branding, logo upload, and per-user theme selection now live under **Settings → UI / Theme Engine**.

---

## Unified Deployment CLI

The repository now ships with a lightweight deploy tool:

```bash
cp infra/targets.example.json infra/targets.json
# Fill in your target-specific SSH host/user/key values or export them as env vars.

./skynet list-targets
./skynet deploy local
./skynet deploy synology
./skynet status synology
./skynet rollback synology
```

### What it does on each deploy

1. Validates the selected target configuration.
2. Creates a timestamped release directory under the target `deploy_path`.
3. Uses `rsync` incremental sync with `--link-dest` to avoid re-copying unchanged files.
4. Re-links persistent paths such as `backend/.env` and `backend/data`.
5. Restarts the runtime:
   - Docker targets: `docker compose` build/migrate/up
   - Native Python targets: `systemd` or a configured restart command
6. Calls `GET /api/health`.
7. If health fails and rollback is enabled, restores the previous release automatically.

### Synology-specific recommendation

Use `health_check.execute_on: "target"` for NAS deployments so health checks can succeed even when the box is only reachable through a reverse proxy, Cloudflare Tunnel, or another internal-only path.

### SMB Sync on Synology

The default Synology target now uses SMB file sync for the release payload and SSH only for remote Docker commands:

1. Share `/volume1/docker` over SMB in DSM.
2. Give your deploy user access to that share.
3. Keep the target `sync` block pointed at `smb://<host>/docker` with `sync.remote_root: /volume1/docker`.
4. Run `./skynet --dry-run deploy synology` to confirm the mount + sync path.

If your Linux desktop cannot open SMB shares through `gio`, mount the share once in the file manager and set `sync.mount_path` in `infra/targets.json` to that mounted folder.

### Registry v2 on Synology

If your Synology already exposes Docker Registry v2 on `http://10.0.0.9:32769`, the deploy CLI can use it automatically for the `synology` target:

1. Build `backend` and `frontend` images on the dev machine
2. Push them to the registry
3. Connect to the Synology over SSH
4. Pull those images on the Synology
5. Restart the stack and run the health check

Important for plain HTTP registries:

- Docker on your dev machine must trust `10.0.0.9:32769` as an insecure registry
- Docker on the Synology must also trust `10.0.0.9:32769` as an insecure registry
- If you add TLS later, switch the registry URL to `https://...` and remove the insecure-registry exception

### Step-by-Step Tutorial: Auto-Connect and Deploy to Synology

The connection becomes automatic after a one-time SSH key setup. After that, `./skynet deploy synology` connects to the NAS by itself, syncs files through SMB, runs Docker commands remotely over SSH, and checks `/api/health`.

#### 1. Prepare the Synology

On the NAS:

1. Enable SSH access in DSM.
2. Create or choose a deployment user that can run Docker commands and write to your deployment folder.
3. Create a deployment directory such as `/volume1/docker/skynet`.
4. Make sure Docker Container Manager is installed and working.

#### 2. Create a dedicated SSH key on your dev machine

```bash
mkdir -p ~/.ssh
ssh-keygen -t ed25519 -f ~/.ssh/skynet_deploy -C "skynet deploy key"
chmod 600 ~/.ssh/skynet_deploy
```

This creates:

- Private key: `~/.ssh/skynet_deploy`
- Public key: `~/.ssh/skynet_deploy.pub`

#### 3. Authorize the key on the Synology

If `ssh-copy-id` is available on your dev machine:

```bash
ssh-copy-id -i ~/.ssh/skynet_deploy.pub youruser@10.0.0.9
```

If not, copy the public key manually:

```bash
cat ~/.ssh/skynet_deploy.pub
```

Then append that key to:

```bash
~/.ssh/authorized_keys
```

for the deploy user on the Synology.

#### 4. Test passwordless SSH

```bash
ssh -i ~/.ssh/skynet_deploy youruser@10.0.0.9
```

This must work without asking for a password. If it still prompts for one, the deploy CLI will not be fully automatic yet.

#### 5. Create the target configuration

```bash
cp infra/targets.example.json infra/targets.json
```

Then export the target values:

```bash
export SKYNET_SYNOLOGY_HOST=10.0.0.9
export SKYNET_SYNOLOGY_USER=youruser
export SKYNET_DEPLOY_KEY=$HOME/.ssh/skynet_deploy
```

Or replace those `${...}` values directly inside `infra/targets.json`.

#### 6. Check the Synology target entry

The `synology` target should look like this:

```json
{
  "deploy_path": "/volume1/docker/skynet",
  "sync": {
    "type": "smb",
    "uri": "smb://${SKYNET_SYNOLOGY_HOST}/docker",
    "username": "${SKYNET_SYNOLOGY_USER}",
    "remote_root": "/volume1/docker"
  },
  "connection": {
    "type": "ssh",
    "host": "${SKYNET_SYNOLOGY_HOST}",
    "user": "${SKYNET_SYNOLOGY_USER}",
    "port": 22,
    "identity_file": "${SKYNET_DEPLOY_KEY}"
  },
  "runtime": {
    "type": "docker",
    "compose_files": ["docker-compose.yml"],
    "project_name": "skynet-prod",
    "build": true,
    "pull": true,
    "migrate_service": "backend",
    "migrate_command": ["alembic", "upgrade", "head"]
  },
  "restart_strategy": "compose_up",
  "health_check": {
    "url": "http://127.0.0.1:8000/api/health",
    "execute_on": "target"
  }
}
```

#### 7. Run a dry-run first

```bash
./skynet --dry-run deploy synology
```

This shows the commands without changing the target.

#### 8. Deploy for real

```bash
./skynet deploy synology
```

What happens:

1. The CLI validates `infra/targets.json`.
2. It mounts or reuses the Synology SMB share for `/volume1/docker`.
3. It syncs the repo to a new timestamped release on the Synology share.
4. It opens an SSH connection automatically using the configured key.
5. It re-links shared data such as `backend/.env`.
6. It runs `docker compose pull`, `docker compose build`, migration, and `docker compose up -d` on the Synology.
7. It checks `http://127.0.0.1:8000/api/health` from the Synology itself.
8. If health fails, it switches back to the previous release automatically.

#### 9. Useful day-2 commands

```bash
./skynet status synology
./skynet restart synology
./skynet rollback synology
./skynet rollback synology --release 20260331184500
```

#### 10. When auto-connection is considered ready

Your setup is ready for automatic deploys when all of these are true:

- `ssh -i ~/.ssh/skynet_deploy youruser@10.0.0.9` works with no password prompt
- the Synology `docker` SMB share is reachable from the dev machine, either through `gio` or an already mounted folder
- `./skynet list-targets` shows `synology`
- `./skynet --dry-run deploy synology` completes cleanly

After that, deployment is a single command:

```bash
./skynet deploy synology
```

#### 11. Post-deploy validation for the active gateway release

After a successful deploy, validate these release-critical paths:

1. Open SKYNET and confirm **Overview** shows the new Gateway Dashboard widget.
2. In **Settings → Access & Network**, confirm gateway mode is enabled and the upstream target is reachable.
3. Hit a protected route through `/api/v1/gateway/proxy/*` and confirm `X-SkyNet-Decision` appears as `allow`, `challenge`, or `block`.
4. If challenge mode is enabled, verify the configured JS PoW / redirect / honeypot flow returns the user to the app and then stops re-challenging.
5. Trigger a test form submit from a protected site and confirm the tracker still reports normally.

---

## Embedding the Tracker

```html
<script>window._skynet = { key: 'YOUR_SITE_API_KEY' };</script>
<script async src="https://skynet.yourdomain.com/tracker/skynet.js"></script>
```

Get your site API key from **Integration → Add Site** in the dashboard.
The bundled tracker also maintains a signed first-party `_skynet_did` cookie once the browser resolves its SKYNET device context.

---

## Identity Integration

After a user authenticates in your app via a configured external OIDC/JWKS provider, call SKYNET to link their identity:

`fingerprint_id` is the SKYNET device UUID (`devices.id`), not the raw tracker fingerprint string. The bundled tracker now resolves that UUID for you through `SkyNet.getDeviceId()`.

```js
// 1. Resolve the current SKYNET device UUID
const skynetDeviceId = await SkyNet.getDeviceId();

// 2. After external IdP login:
const response = await fetch('/api/v1/identity/link', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${externalAccessToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    fingerprint_id: skynetDeviceId,
    platform: 'web',
  }),
});

const { trust_level, risk_score, flags } = await response.json();

if (trust_level === 'blocked') {
  // Deny access to your app
} else if (trust_level === 'suspicious') {
  // Trigger additional verification (MFA, CAPTCHA, etc.)
}

// Optional: inspect the full tracker-resolved context
const deviceContext = await SkyNet.getDeviceContext();
console.log(
  deviceContext.device_id,
  deviceContext.risk_score,
  deviceContext.status,
  deviceContext.fingerprint_confidence,
  deviceContext.stability_score
);
```

To track activity events:
```js
const skynetDeviceId = await SkyNet.getDeviceId();

await fetch('/api/v1/track/activity', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${externalAccessToken}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    event_type: 'pageview',
    platform: 'web',
    fingerprint_id: skynetDeviceId,
    page_url: window.location.href,
  }),
});
```

---

## Production Checklist

- [ ] `APP_SECRET_KEY` and `JWT_SECRET` set to strong random values
- [ ] `DEVICE_COOKIE_SECRET` set explicitly if you do not want `_skynet_did` signing to inherit `APP_SECRET_KEY`
- [ ] If using local Keycloak: admin password changed from default
- [ ] SKYNET admin password changed from `admin`
- [ ] `APP_DEBUG=false`
- [ ] `APP_BASE_URL` set to the public `https://` URL clients will use
- [ ] `APP_HTTPS_MODE=edge` for proxy/tunnel deployments
- [ ] `APP_TRUST_PROXY_HEADERS=true` when using a trusted proxy or tunnel
- [ ] if using uploaded or self-signed certs, certificate files staged under `backend/data/certs/`
- [ ] `CORS_ORIGINS` set to your actual domain(s)
- [ ] `KEYCLOAK_JWKS_URL` uses `https://` (required for security)
- [ ] If using local GeoIP mode: `.mmdb` database placed in `backend/data/`
- [ ] HTTPS enabled via edge proxy or tunnel
- [ ] `.env` not committed to git (verify with `git status`)

---

## HTTPS Options

Recommended paths:

- Bundled Caddy profile:
  `docker compose -f docker-compose.yml -f docker-compose.https.yml up -d`
- Cloudflare Tunnel:
  `docker compose -f docker-compose.yml -f docker-compose.tunnel.yml up -d`
- Local secure-context dev:
  `docker compose -f docker-compose.dev.yml -f docker-compose.dev-https.yml up -d`

Full guide:
- [HTTPS guide](HTTPS.md)

---

## Upgrading

```bash
git pull origin master
docker compose pull
docker compose up -d --build
docker compose exec backend alembic upgrade head
```

Migrations are idempotent — safe to re-run.

---

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| `IDP_NOT_CONFIGURED` on `/identity/link` | `keycloak_enabled` is false | Enable in Settings → Auth or set `KEYCLOAK_JWKS_URL` in `.env` |
| `IDP_UNAVAILABLE` | Keycloak container not running | `docker compose --profile keycloak up -d keycloak` |
| `TOKEN_INVALID` | Wrong JWKS URL or issuer mismatch | Check `keycloak_jwks_url` and `keycloak_issuer` match your realm |
| Same browser keeps getting new `device_id` values | `_skynet_did` blocked, missing, or signing secret changed | Allow first-party cookies for the site and keep `APP_SECRET_KEY` / `DEVICE_COOKIE_SECRET` stable across restarts |
| Backend 500 on startup | Migration failed | `docker compose exec backend alembic upgrade head` |
| Visitors not recorded | Event model missing import | Resolved in v1.1 — ensure latest version |
| GeoIP returns null | local provider selected but `.mmdb` missing, or `ip-api` unreachable | Upload a local `.mmdb` in Settings → Integrations or switch provider back to `ip-api` |
| Theme logo does not appear | stale frontend/backend process or stale uploaded asset path | Restart the stack, then re-upload the logo if needed; uploaded logos are served through `GET /api/v1/themes/{id}/logo` |
