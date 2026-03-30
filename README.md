# SkyNet

> Self-hosted visitor tracking, device security, and user management platform.
> Embed in any website or app. Own your data.

---

## What is SkyNet?

SkyNet is a **self-hosted analytics and security dashboard** you can integrate with any website or application. It gives you:

- **Visitor tracking** — who visits, from where, on which device
- **Device fingerprinting** — canvas, WebGL, audio, font signals combined into a persistent identity
- **Device linking** — connect devices to user accounts across sessions
- **Blocking engine** — block by IP, CIDR, country, ASN, user-agent, or device fingerprint
- **Anti-evasion** — detect VPN, Tor, proxy, headless browsers, bots, IP rotation, multi-account abuse
- **GeoIP enrichment** — country, city, flag emoji on every new visitor via MaxMind GeoLite2
- **User management** — native dashboard users; Keycloak integration planned (v1.5.0)
- **Embeddable tracker** — one `<script>` tag, works on any site

---

## Quick Start

```bash
git clone https://github.com/Skynet-Marwen/App.git skynet && cd skynet
cp backend/.env.example backend/.env   # set APP_SECRET_KEY and JWT_SECRET
docker compose up -d
```

Dashboard: `http://localhost:3000` — Login: `admin@skynet.local` / `admin`

> Change the default password on first login.

---

## Embed the Tracker

```html
<script>window._skynet = { key: 'YOUR_SITE_API_KEY' };</script>
<script async src="https://skynet.yourdomain.com/tracker/skynet.js"></script>
```

Get your API key from **Integration → Add Site** in the dashboard.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Dashboard | React 18 + Vite + Tailwind CSS |
| API | FastAPI (Python 3.12) + SQLAlchemy |
| Database | PostgreSQL 16 |
| Cache / Sessions | Redis 7 |
| Auth (optional) | Keycloak 24 |
| Deployment | Docker Compose |

---

## Documentation

| Document | Purpose |
|----------|---------|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design, data flows, DB schema |
| [docs/API.md](docs/API.md) | Full REST API reference |
| [docs/LOGIC.md](docs/LOGIC.md) | Detection algorithms and business rules |
| [docs/SECURITY.md](docs/SECURITY.md) | Threat model, secrets, rate limiting |
| [docs/INSTALL.md](docs/INSTALL.md) | Self-hosted deployment guide |
| [docs/WORKFLOW.md](docs/WORKFLOW.md) | Git workflow and release process |
| [docs/DEV_PLAN.md](docs/DEV_PLAN.md) | Active sprint and backlog |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Versioned feature roadmap |
| [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) | How to contribute |
| [CHANGELOG.md](CHANGELOG.md) | Release history |
| [CLAUDE.md](CLAUDE.md) | AI assistant behavioral contract |

---

## Version

Current: **v1.0.1** (v1.1.0-dev in progress)
See [CHANGELOG.md](CHANGELOG.md) for release history.
