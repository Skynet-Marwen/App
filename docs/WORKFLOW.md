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

## Do Not

- `git push --force` on `main` or `dev` — ever.
- Commit directly to `main`.
- Skip the PR for hotfixes (even urgent ones need a PR review).
- Merge a PR with failing checks.
