# SkyNet Frontend

React 19 + Vite dashboard for the SkyNet operator console.

## What Lives Here

- Route shell and navigation: `src/App.jsx`, `src/components/layout/`
- Dashboard pages: `src/pages/`
- Reusable UI primitives: `src/components/ui/`
- Overview-specific cards: `src/components/overview/`
- Data fetching hooks: `src/hooks/`
- API client: `src/services/api.js`
- Shared JSDoc shapes: `src/types/index.js`

## Current Route Map

- `/` — Overview
- `/visitors` — visitor intelligence
- `/users` — Portal Users intelligence workspace with risk, activity, devices, and anomaly details
- `/devices` — exact and grouped device fingerprints
- `/blocking` — rules + blocked IPs
- `/anti-evasion` — anti-evasion settings and incidents
- `/audit` — operator audit trail
- `/integration` — site registration and tracker instructions
- `/settings` — 9-domain settings workspace covering security, access, auth, theme engine, storage, integrations, notifications, blocking, and system/debug

## Local Development

```bash
npm install
npm run dev
```

By default the frontend expects the backend API under `/api/v1`. In Docker dev mode, `docker-compose.dev.yml` injects `VITE_PROXY_TARGET=http://backend:8000`.

## Build and Lint

```bash
npm run build
npm run lint
```

## Notes

- The app uses a single Axios client in `src/services/api.js` and attaches `skynet_token` from `localStorage`.
- Theme logos are served by the backend via `/api/v1/themes/:id/logo`; frontend pages consume the resolved URL from the theme payload instead of relying on local static assets.
- The dashboard shell is now fixed for desktop: header, sidebar, and footer stay in place while `main` is the scroll region.
- Integration snippets now include the browser-side device UUID handoff helper used by `/identity/link` and `/track/activity`.
- The current shipped backend version is `1.2.0`; the active unreleased branch also includes tracker/backend device-identity hardening (`_skynet_did`, fingerprint confidence, stability scoring).
