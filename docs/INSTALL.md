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
git clone https://github.com/your-org/skynet.git
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

# ── Keycloak (optional) ──────────────────────────────────────────
KEYCLOAK_URL=https://auth.yourdomain.com
KEYCLOAK_REALM=master
KEYCLOAK_CLIENT_ID=skynet
KEYCLOAK_CLIENT_SECRET=
KEYCLOAK_ADMIN_USERNAME=admin
KEYCLOAK_ADMIN_PASSWORD=

# ── GeoIP (optional but recommended) ────────────────────────────
# Download GeoLite2-City.mmdb from MaxMind and place in backend/data/
GEOIP_DB_PATH=./data/GeoLite2-City.mmdb

# ── CORS ─────────────────────────────────────────────────────────
CORS_ORIGINS=https://skynet.yourdomain.com
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

## With Keycloak (SSO)

```bash
# Start with Keycloak profile
docker compose --profile keycloak up -d

# Access Keycloak admin: http://localhost:8080
# Default: admin / admin

# Create a realm and client:
# 1. Create realm: skynet
# 2. Create client: skynet
#    - Client Protocol: openid-connect
#    - Access Type: confidential
#    - Valid Redirect URIs: https://skynet.yourdomain.com/*
# 3. Copy client secret to .env → KEYCLOAK_CLIENT_SECRET
# 4. Enable Keycloak in SkyNet Settings → Keycloak
```

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
git pull origin main
docker compose build
docker compose up -d
# Migrations run automatically on startup
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
| No GeoIP data | `GEOIP_DB_PATH` wrong or file missing |
| Tracker not sending | `CORS_ORIGINS` missing your site domain |
| Keycloak not working | Verify client secret and redirect URIs |
| DB connection refused | Check `DATABASE_URL` and that `db` container is healthy |

```bash
# Check logs
docker compose logs backend --tail=50
docker compose logs db --tail=20
```
