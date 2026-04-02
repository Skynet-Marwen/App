# SkyNet — Git Workflow & Release Process

> Last updated: 2026-04-02

---

## Branch Model

```
master        Production-ready. Protected. No direct commits.
dev           Integration branch. Default working branch.
feature/*     New features — branch from dev
hotfix/*      Critical prod fixes — branch from master
release/*     Release prep — branch from dev
```

### Creating a Feature Branch
```bash
git checkout dev
git pull origin dev
git checkout -b feature/geoip-enrichment
# work, commit...
git push origin feature/geoip-enrichment
# open PR → dev
```

### Hotfix Process
```bash
git checkout master
git pull origin master
git checkout -b hotfix/block-bypass-ipv6
# fix, commit with: fix(blocking): ...
git push origin hotfix/block-bypass-ipv6
# PR → master AND cherry-pick to dev
git checkout dev && git cherry-pick <commit-sha>
```

---

## Conventional Commits

Format: `<type>(<scope>): <description>`

Required body for: `feat`, `fix`, `security`, `refactor`

```
feat(anti-evasion): add Tor exit node detection

Integrates MaxMind GeoIP2 with a Tor exit node list refreshed every 24h.
Incidents logged at severity=high. Auto-block if threshold config enabled.

Closes #42
```

### Scopes
`auth` `visitors` `users` `devices` `blocking` `anti-evasion` `integration`
`tracker` `stats` `settings` `theme` `identity` `risk` `geoip` `smtp` `keycloak` `ux`
`db` `infra` `docs` `deps`

---

## Release Process

```bash
# 1. Branch from dev
git checkout dev && git checkout -b release/1.2.0

# 2. Bump version in both places
#    backend/app/core/config.py → APP_VERSION = "1.2.0"
#    frontend/package.json      → "version": "1.2.0"

# 3. Update CHANGELOG.md — move [Unreleased] → [1.2.0] - YYYY-MM-DD

# 4. Commit
git commit -m "chore(release): bump version to 1.2.0"

# 5. PR release/1.2.0 → master
# 6. After merge, tag
git checkout master && git pull
git tag -a v1.2.0 -m "Release v1.2.0"
git push origin v1.2.0

# 7. Merge master back to dev
git checkout dev && git merge master && git push origin dev
```

---

## PR Requirements

- Title must follow Conventional Commits format.
- Description must include: what changed, how to test, screenshots (UI changes).
- Must pass: lint, build, tests.
- At least one approval required before merge to `master`.
- Squash merge preferred for feature branches. Merge commit for releases.

---

---

## Deployment Workflow

Production and staging deploys should use the unified CLI instead of ad hoc shell steps:

```bash
cp infra/targets.example.json infra/targets.json
# Fill in target values or export the referenced env vars.

./skynet deploy synology
./skynet status synology
./skynet rollback synology
```

### Standard Deploy Path

```bash
git checkout dev
git pull origin dev
./skynet deploy local --dry-run
./skynet deploy synology
```

UI/IA work that changes operator behavior should land with doc updates in the same PR: `README.md`, `docs/ARCHITECTURE.md`, `docs/API.md`, and `frontend/README.md` at minimum.

### What the CLI guarantees

- Validates the target definition before touching a host.
- Creates timestamped releases under `deploy_path/releases/`.
- Uses `rsync --link-dest` for incremental sync.
- Re-links persistent files and directories from `deploy_path/shared/`.
- Restarts Docker or native Python targets using the configured runtime strategy.
- Runs `GET /api/health` and automatically reactivates the previous release if health fails.

### Operational Rules

- Keep `infra/targets.json` out of commits when it contains environment-specific hostnames or paths.
- Use SSH keys only; never depend on password prompts in deployment flows.
- Prefer `health_check.execute_on: "target"` for private NAS or tunnel-backed deployments.
- Treat destructive DB restore logic as an explicit extension; the current CLI rolls back code and runtime state, not full database snapshots.

---

## Do Not

- `git push --force` on `master` or `dev` — ever.
- Commit directly to `master`.
- Skip the PR for hotfixes (even urgent ones need a PR review).
- Merge a PR with failing checks.
- Deploy to prod without creating a checkpoint first.
