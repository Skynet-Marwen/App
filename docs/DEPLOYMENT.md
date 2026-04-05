# SkyNet — Deployment System

> Last updated: 2026-04-05

## Design Proposal

```text
Affected layers   : infra, backend, docs
New files         : skynet, tools/skynet_deploy/*, infra/targets.example.json, docs/DEPLOYMENT.md
Modified files    : backend/main.py, README.md, docs/INSTALL.md, docs/WORKFLOW.md, docs/DEV_PLAN.md
Data flow         : Dev machine -> skynet CLI -> local/SSH transport -> target release dir -> docker/systemd restart -> /api/health validation
Open questions    : Per-environment targets.json values, SSH key rollout, optional DB backup hooks for destructive migrations
```

### Boundary Diagram

```text
Developer machine
  owns: target selection, config loading, file sync, orchestration, logs
      |
      v
skynet CLI (Python, stdlib only)
  owns: validation, release creation, rollback coordination, health policy
      |
      +--> local target
      |     owns: rsync to local release dir, docker/systemd restart
      |
      +--> ssh target
            owns: rsync over SSH, remote command execution, remote health checks
                  |
                  v
            target runtime
              docker compose OR native python/systemd
              owns: running SKYNET services
```

## Impact Assessment

```text
Change summary    : Replace ad hoc deployment with a release-based multi-target CLI.
Affected files    : skynet launcher, tools/skynet_deploy/*, infra/targets.example.json, backend/main.py, deployment docs
Affected tests    : tests/test_skynet_deploy.py
Breaking changes  : No for app runtime; yes for docs/workflow because deploy.sh is no longer the recommended path
Rollback plan     : Remove new CLI files, restore previous docs, keep existing deploy.sh as fallback
Migration needed  : No schema migration; operators only need infra/targets.json and SSH keys
Estimated risk    : MEDIUM
```

## File Structure

```text
SkyNet/
├── skynet
├── infra/
│   └── targets.example.json
├── tools/
│   └── skynet_deploy/
│       ├── cli/
│       ├── deploy/
│       ├── targets/
│       └── utils/
└── docs/
    └── DEPLOYMENT.md
```

## Release Model

- Every deploy creates a timestamped release under `<deploy_path>/releases/<release_id>`.
- `current` points to the active release.
- `previous` points to the last known-good release.
- Shared state such as `backend/.env` and `backend/data` lives under `<deploy_path>/shared/` and is symlinked into each release.
- File sync uses `rsync --link-dest` when a current release exists, so unchanged files are hard-linked instead of copied again.
- Theme logos, uploaded HTTPS assets, and local GeoIP databases all live under `backend/data/`, so that shared path must remain persistent on every target.

## Target Schema

Each target defines:

- `connection.type`: `local` or `ssh`
- `deploy_path`: release root on the target host
- `runtime.type`: `docker` or `python`
- `restart_strategy`: `compose_up`, `compose_down_up`, `compose_restart`, `systemd`, or `command`
- `health_check`: URL, retry policy, and whether the check runs from the dev machine or on the target host
- `shared_paths`: repo-relative files or directories that must survive across releases
- `environment`: optional command-time environment variables with `${ENV_VAR}` interpolation support

## Commands

```bash
./skynet list-targets
./skynet deploy local
./skynet deploy synology
./skynet restart synology
./skynet status synology
./skynet rollback synology
./skynet rollback synology --release 20260331184500
./skynet deploy local,synology --dry-run
```

## Synology Notes

- Keep `health_check.execute_on` set to `target` when the NAS is behind a reverse proxy or tunnel and no inbound port is exposed directly.
- Use an SSH deploy user with key-based auth only.
- Point `deploy_path` at a writable volume such as `/volume1/docker/skynet`.
- If Docker Container Manager is already running the stack, keep `runtime.project_name` aligned with the existing project name to avoid duplicate containers.
- For SMB-backed deploys, set `sync.type` to `smb`, point `sync.uri` at the shared folder such as `smb://10.0.0.9/docker`, and set `sync.remote_root` to the NAS filesystem root for that share such as `/volume1/docker`.
- SMB auto-mount is best-effort through `gio`. If your desktop does not expose SMB through GIO, mount the share once in the file manager and set `sync.mount_path` to the mounted folder.
- For Registry v2 deployments, set `runtime.registry.url` and map each app service to its repository.
- Plain HTTP registries such as `http://10.0.0.9:32769` require insecure-registry trust on both Docker daemons unless you terminate TLS in front of the registry.

## Step-by-Step: Automatic Synology Deploys

Automatic connection means this:

```bash
./skynet deploy synology
```

opens SSH by itself with the configured key, pushes the new release, restarts the stack, and runs the health check. The one-time setup is:

1. Enable SSH on the Synology and prepare a deploy user.
2. Generate a dedicated SSH key on the dev machine:
   ```bash
   ssh-keygen -t ed25519 -f ~/.ssh/skynet_deploy -C "skynet deploy key"
   ```
3. Install the public key on the Synology deploy user:
   ```bash
   ssh-copy-id -i ~/.ssh/skynet_deploy.pub youruser@10.0.0.9
   ```
4. Verify passwordless access:
   ```bash
   ssh -i ~/.ssh/skynet_deploy youruser@10.0.0.9
   ```
5. Create the config:
   ```bash
   cp infra/targets.example.json infra/targets.json
   export SKYNET_SYNOLOGY_HOST=10.0.0.9
   export SKYNET_SYNOLOGY_USER=youruser
   export SKYNET_DEPLOY_KEY=$HOME/.ssh/skynet_deploy
   ```
6. Share `/volume1/docker` over SMB and give the deploy user access.
7. Validate with a dry-run:
   ```bash
   ./skynet --dry-run deploy synology
   ```
8. Deploy:
   ```bash
   ./skynet deploy synology
   ```

If step 4 works without a password prompt, the target connection is automatic from that point on.

With the SMB-enabled Synology target, the deploy sequence becomes:

```text
local SMB sync -> ssh to Synology -> docker compose pull/build/up -> /api/health
```

## Current Limitations

- Rollback restores code, compose definitions, and shared symlink state. It does not yet include first-class database snapshot hooks.
- `rsync` is required on the development machine; `ssh` is additionally required for remote targets.
- SMB deploys need either working GIO SMB support on the dev machine or a pre-mounted share path configured with `sync.mount_path`.
- Native Python deployments are designed for `systemd` first; non-systemd process managers should use `restart_strategy: command`.
- Theme logo delivery now rides on `/api/v1/themes/{id}/logo`, so public edges only need `/api/` forwarded to the backend; no extra static `theme-assets` path is required.

## Public Edge Notes

- Public tracker deployments should forward both legacy tracker paths and the blocker-resistant edge paths to the backend:
  - `/tracker/*`
  - `/api/v1/track/*`
  - `/ads.js`
  - `/s/*`
  - `/w/*`
- Protected apps that use a first-party relay pattern, such as Mouwaten, may instead keep tracker, challenge, and authenticated activity flows on their own origin and forward to SkyNet server-side.
- Site API keys are public integration identifiers. If an app wants to hide them from the browser entirely, that must be done by the app-side relay rather than by changing SkyNet operator secrets.
- The same-origin `/ads.js` route is used only to classify browser-level blocker behavior. DNS/network filtering is still inferred separately from the remote ad-domain probe.

## Post-Deploy Smoke Checklist

Run these after every production deploy:

1. Open Overview and confirm hotspot, investigation, and enforcement widgets either show real backend data or an explicit empty state.
2. Open Integration and confirm site cards show non-placeholder visitor/event counts for active tracked apps.
3. Trigger a manual Security Center rescan and confirm the UI either reports success or lists per-site scan errors instead of a generic failure.
4. Confirm realtime HUD updates through websocket or polling fallback.
5. Confirm operator list counts active devices from live sessions instead of a fixed zero.
6. If blocker-resistant tracking is enabled, confirm `GET /s/<site_key>.js` returns JavaScript, `GET /ads.js` returns JavaScript on the same origin, and `POST /w/<site_key>/p` reaches the backend successfully.
7. If you plan to enforce browser-side blocker actions, validate at least these scenarios on production-like browsers: clean browser, DNS filter only, extension-only blocker, and extension + DNS filter together.
