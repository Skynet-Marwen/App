# SkyNet — Contributing Guide

> Last updated: 2026-04-02

---

## Before You Start

1. Read [CLAUDE.md](../CLAUDE.md) — the behavioral contract. Non-negotiable.
2. Read [docs/ARCHITECTURE.md](ARCHITECTURE.md) — understand the system boundaries.
3. Read [docs/DEV_PLAN.md](DEV_PLAN.md) — pick from the backlog; don't duplicate work.
4. Open an issue or comment on an existing one before starting significant work.

---

## Development Setup

```bash
# Prerequisites: Docker, Node 22+, Python 3.12+

# Clone
git clone https://github.com/Skynet-Marwen/App.git skynet
cd skynet

# Start dependencies only (DB + Redis)
docker compose -f docker-compose.dev.yml up -d
# Shared IdP for identity-link testing is hosted by /home/marwen/mouwaten
# and exposed as https://auth.mouwaten.org (LAN fallback: http://10.0.0.39:8080)

# Backend
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env    # fill in values
uvicorn main:app --reload --port 8000

# Frontend (new terminal)
cd frontend
npm install
npm run dev             # → http://localhost:5173
```

---

## Contribution Rules

### Code Rules (enforced — see CLAUDE.md Phase 2)

- Max **300 lines per file**. Split before submitting.
- **No business logic in React components** — move to `hooks/` or `services/`.
- **No direct DB access from frontend** — all data via `/api/v1/`.
- **No inline secrets** — read from `process.env` / `os.environ`.
- **No `SELECT *`** — explicit column selection only.
- **Pydantic schemas** in `backend/app/schemas/` — not inline in routes.
- **No synthetic operator metrics** — if data is unavailable, show an empty state instead of invented counts, hotspots, or trends.

### Git Rules

- Branch from `dev`: `feature/your-feature-name`
- Conventional commit messages — required (see [WORKFLOW.md](WORKFLOW.md))
- One logical change per commit
- No force-push on shared branches

### PR Checklist

Before opening a PR, confirm:
- [ ] Code follows all Phase 2 rules
- [ ] New API endpoints documented in `docs/API.md`
- [ ] `CHANGELOG.md` updated under `[Unreleased]`
- [ ] `DEV_PLAN.md` task moved to Done
- [ ] No hardcoded secrets or localhost references
- [ ] Build passes: `npm run build` (frontend), app starts without errors (backend)
- [ ] `.env.example` updated if new env vars added
- [ ] Docs distinguish shipped releases from unreleased branch work when versions do not yet match `APP_VERSION`
- [ ] Settings/theme/shell UX changes reflected in `README.md`, `docs/ARCHITECTURE.md`, and `frontend/README.md`
- [ ] Tracker/device-identity changes reflected in `docs/API.md`, `docs/LOGIC.md`, and `docs/SECURITY.md`

---

## Adding a New Feature

1. **Design first** — describe boundary, data flow, affected files.
2. Create backend schema in `backend/app/schemas/<domain>.py`.
3. Add business logic to `backend/app/services/<domain>.py`.
4. Add/update route in `backend/app/api/routes/<domain>.py`.
5. Add API service call in `frontend/src/services/api.js`.
6. Add data hook in `frontend/src/hooks/use<Feature>.js`.
7. Update page component in `frontend/src/pages/`.
8. Update `docs/API.md` and `CHANGELOG.md`.

---

## Code Style

### Python (backend)
- Follow PEP 8
- Type annotations on all function signatures
- Pydantic models for all I/O
- `snake_case` for variables and functions, `PascalCase` for classes

### JavaScript (frontend)
- ES2022+ features
- Functional components only (no class components)
- `camelCase` for variables/functions, `PascalCase` for components
- JSDoc for shared type shapes in `frontend/src/types/`
- No unused imports (lint rule)

---

## Reporting Issues

Use GitHub Issues with the appropriate label:
- `bug` — something is broken
- `security` — security vulnerability (use private disclosure for serious issues)
- `enhancement` — new feature request
- `debt` — technical debt that needs resolution
- `docs` — documentation gap or error
