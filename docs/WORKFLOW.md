# SkyNet — Git Workflow & Release Process

---

## Branch Model

```
main          Production-ready. Protected. No direct commits.
dev           Integration branch. Default working branch.
feature/*     New features — branch from dev
hotfix/*      Critical prod fixes — branch from main
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
git checkout main
git pull origin main
git checkout -b hotfix/block-bypass-ipv6
# fix, commit with: fix(blocking): ...
git push origin hotfix/block-bypass-ipv6
# PR → main AND cherry-pick to dev
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
`tracker` `stats` `settings` `keycloak` `db` `infra` `docs` `deps`

---

## Release Process

```bash
# 1. Branch from dev
git checkout dev && git checkout -b release/1.1.0

# 2. Bump version in both places
#    backend/app/core/config.py → APP_VERSION = "1.1.0"
#    frontend/package.json      → "version": "1.1.0"

# 3. Update CHANGELOG.md — move [Unreleased] → [1.1.0] - YYYY-MM-DD

# 4. Commit
git commit -m "chore(release): bump version to 1.1.0"

# 5. PR release/1.1.0 → main
# 6. After merge, tag
git checkout main && git pull
git tag -a v1.1.0 -m "Release v1.1.0"
git push origin v1.1.0

# 7. Merge main back to dev
git checkout dev && git merge main && git push origin dev
```

---

## PR Requirements

- Title must follow Conventional Commits format.
- Description must include: what changed, how to test, screenshots (UI changes).
- Must pass: lint, build, tests.
- At least one approval required before merge to `main`.
- Squash merge preferred for feature branches. Merge commit for releases.

---

---

## Docker: Dev → Prod Deployment

### Pre-Deployment Checkpoint (MANDATORY before every prod update)

```bash
# 1. Tag the current running state as a rollback checkpoint
VERSION=$(date +%Y%m%d_%H%M%S)
docker tag skynet-backend:latest skynet-backend:checkpoint_${VERSION}
docker tag skynet-frontend:latest skynet-frontend:checkpoint_${VERSION}

# 2. Export checkpoint tags to a local file for reference
echo "checkpoint_${VERSION}" >> .docker_checkpoints

# 3. Snapshot the DB (Postgres)
docker exec skynet-db pg_dump -U postgres skynet > backups/db_${VERSION}.sql

# 4. Record the checkpoint in CoAgentLOG.md
echo "[$(date '+%Y-%m-%d %H:%M')] CHECKPOINT: docker checkpoint_${VERSION} + db backup created before prod deploy" >> CoAgentLOG.md
```

---

### Dev → Prod Container Update

```bash
# Step 1 — Pull latest code on prod server (or locally before build)
git checkout main && git pull origin main

# Step 2 — Create rollback checkpoint (see above — ALWAYS do this first)
VERSION=$(date +%Y%m%d_%H%M%S)
docker tag skynet-backend:latest skynet-backend:checkpoint_${VERSION}
docker tag skynet-frontend:latest skynet-frontend:checkpoint_${VERSION}
docker exec skynet-db pg_dump -U postgres skynet > backups/db_${VERSION}.sql
echo "checkpoint_${VERSION}" >> .docker_checkpoints

# Step 3 — Rebuild images from scratch (no cache for prod)
docker compose -f docker-compose.yml build --no-cache

# Step 4 — Apply DB migrations before swapping containers
docker compose run --rm backend alembic upgrade head

# Step 5 — Rolling restart (zero-downtime where possible)
docker compose -f docker-compose.yml up -d --remove-orphans

# Step 6 — Verify all containers are healthy
docker compose ps
docker compose logs --tail=50 backend
docker compose logs --tail=50 frontend

# Step 7 — Smoke test
curl -sf http://localhost/api/v1/health || echo "HEALTH CHECK FAILED — consider rollback"
```

---

### Rollback Procedure

```bash
# List available checkpoints
cat .docker_checkpoints

# Roll back containers to a specific checkpoint
CHECKPOINT=checkpoint_20260330_143000   # replace with target

docker compose down
docker tag skynet-backend:${CHECKPOINT} skynet-backend:latest
docker tag skynet-frontend:${CHECKPOINT} skynet-frontend:latest
docker compose -f docker-compose.yml up -d

# Roll back DB if schema migration was applied
docker exec -i skynet-db psql -U postgres skynet < backups/db_${CHECKPOINT#checkpoint_}.sql

# Verify rollback
docker compose ps
curl -sf http://localhost/api/v1/health && echo "Rollback OK"

# Log the rollback
echo "[$(date '+%Y-%m-%d %H:%M')] ROLLBACK: restored to ${CHECKPOINT}" >> CoAgentLOG.md
```

---

### Checkpoint Housekeeping

Keep only the last **5 checkpoints** to avoid disk bloat:

```bash
# Prune old checkpoint images (keep last 5)
docker images | grep "skynet-backend.*checkpoint_" | sort -r | tail -n +6 | awk '{print $3}' | xargs -r docker rmi
docker images | grep "skynet-frontend.*checkpoint_" | sort -r | tail -n +6 | awk '{print $3}' | xargs -r docker rmi

# Prune old DB backups (keep last 5)
ls -t backups/db_*.sql | tail -n +6 | xargs -r rm
```

---

## Do Not

- `git push --force` on `main` or `dev` — ever.
- Commit directly to `main`.
- Skip the PR for hotfixes (even urgent ones need a PR review).
- Merge a PR with failing checks.
- Deploy to prod without creating a checkpoint first.
