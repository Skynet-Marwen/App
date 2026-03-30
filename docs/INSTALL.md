# SkyNet — Self-Hosted Installation Guide

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
#   DATABASE_URL    (use the default or your own PostgreSQL)

# 3. Start
docker compose up -d

# 4. Access
# Dashboard: http://localhost:3000
# API docs:  http://localhost:8000/docs
# Default login: admin@skynet.local / admin
#
# ⚠️  Change the default password immediately after first login.
```

---

## Environment Variables

Edit `backend/.env`:

```bash
# ── App ──────────────────────────────────────────────────────────
APP_SECRET_KEY=<openssl rand -hex 32>
APP_DEBUG=false
APP_BASE_URL=https://skynet.yourdomain.com

# ── Database ─────────────────────────────────────────────────────
DATABASE_URL=postgresql+asyncpg://skynet:skynet_secret@db:5432/skynet

# ── Redis ────────────────────────────────────────────────────────
REDIS_URL=redis://redis:6379/0

# ── JWT ──────────────────────────────────────────────────────────
JWT_SECRET=<openssl rand -hex 32>
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=1440

# ── GeoIP (optional but recommended) ────────────────────────────
# Download GeoLite2-City.mmdb from MaxMind and place in backend/data/
GEOIP_DB_PATH=./data/GeoLite2-City.mmdb

# ── CORS ─────────────────────────────────────────────────────────
CORS_ORIGINS=https://skynet.yourdomain.com
```

---

## Development Mode (Hot Reload)

For active development — code changes reflect instantly without rebuilding or refreshing.

```bash
# Set your VM's LAN IP in docker-compose.dev.yml → VITE_HMR_HOST
# Then start the dev stack:
docker compose -f docker-compose.dev.yml up
```

| URL | Purpose |
|-----|---------|
| `http://<VM_IP>:5173` | Frontend — Vite HMR (JSX/CSS changes patch live) |
| `http://<VM_IP>:8000` | Backend — uvicorn `--reload` (Python changes restart in ~1s) |
| `http://<VM_IP>:8000/docs` | FastAPI auto-generated API docs |

**How it works:**
- `./frontend/src` is volume-mounted into the Vite container. Save a `.jsx` or `.css` file → Vite pushes a diff to the browser via WebSocket — no page reload.
- `./backend` is volume-mounted into the FastAPI container. Save a `.py` file → uvicorn detects the change and restarts within ~1 second.
- The prod stack (`:3000`) and dev stack (`:5173`) can run simultaneously on separate volumes.

```bash
# With optional DB/Redis GUIs:
docker compose -f docker-compose.dev.yml --profile tools up
# Adminer (DB):    http://<VM_IP>:8888
# RedisInsight:    http://<VM_IP>:5540
```

---

## Production Deployment (with HTTPS)

### Option A: Nginx Reverse Proxy on Host

```nginx
# /etc/nginx/sites-available/skynet
server {
    listen 443 ssl;
    server_name skynet.yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/skynet.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/skynet.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/ {
        proxy_pass http://localhost:8000;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /tracker/ {
        proxy_pass http://localhost:8000;
    }
}
server {
    listen 80;
    server_name skynet.yourdomain.com;
    return 301 https://$host$request_uri;
}
```

```bash
# Get SSL cert
certbot --nginx -d skynet.yourdomain.com
```

### Option B: Cloudflare Proxy
Set `APP_BASE_URL` to your domain. Cloudflare handles TLS automatically.
Set `CORS_ORIGINS` to your domain only.

---

## GeoIP Setup (MaxMind)

```bash
# 1. Create free account at https://www.maxmind.com/en/geolite2/signup
# 2. Download GeoLite2-City.mmdb
# 3. Place in backend/data/GeoLite2-City.mmdb
mkdir -p backend/data
cp ~/Downloads/GeoLite2-City.mmdb backend/data/

# 4. Verify in .env:
GEOIP_DB_PATH=./data/GeoLite2-City.mmdb

# 5. Restart backend
docker compose restart backend
```

---

## Embedding the Tracker

### Quick Test (no real site needed)

A ready-made test page is included at `tracker/test-site.html`. It simulates a real website with clicks, scroll, mouse movement, and form interactions.

1. Create a site in **Integration → Add Site**, copy the API key.
2. Edit `tracker/test-site.html` — replace `REPLACE_WITH_YOUR_SITE_API_KEY`.
3. Open `http://<VM_IP>:8000/tracker/test-site.html` in a browser.

---

### Real Site Integration

After adding your site in Integration → Add Site:

```html
<!-- Paste before </body> on every page -->
<script>
  window._skynet = { key: 'YOUR_API_KEY' };
</script>
<script async src="https://skynet.yourdomain.com/tracker/skynet.js"></script>
```

**Identify users after login:**
```javascript
SkyNet.identify('your-internal-user-id');
```

**Track custom events:**
```javascript
SkyNet.track('purchase', { plan: 'pro', amount: 49.99 });
```

---

## Updating

```bash
git pull origin master
docker compose build
docker compose up -d
# Alembic migrations run automatically on startup via Dockerfile CMD
```

---

## Backup

```bash
# Database backup
docker exec skynet-db-1 pg_dump -U skynet skynet > backup_$(date +%Y%m%d).sql

# Restore
cat backup_20260329.sql | docker exec -i skynet-db-1 psql -U skynet skynet
```

---

## Troubleshooting

| Problem | Check |
|---------|-------|
| Dashboard shows "Not authenticated" | JWT expired or wrong `APP_BASE_URL` in `.env` |
| No GeoIP data | `GEOIP_DB_PATH` wrong or file missing — service continues without it |
| Visitor country/flag blank | GeoIP DB absent or IP is private/loopback |
| Tracker not sending | `CORS_ORIGINS` missing your site domain |
| Login returns 422 | Ensure `Content-Type: application/x-www-form-urlencoded` on `/auth/login` |
| DB connection refused | Check `DATABASE_URL` and that `db` container is healthy |
| Heatmap empty on dashboard | Ensure events are being tracked (check tracker integration); verify `event_type='pageview'` rows exist in `events` table |
| 502 on `/api/*` | Backend failed to start — check `docker compose logs backend` for Alembic migration errors |

```bash
# Check logs
docker compose logs backend --tail=50
docker compose logs db --tail=20
```
