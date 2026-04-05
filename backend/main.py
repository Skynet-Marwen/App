import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

_log = logging.getLogger("skynet.main")

from app.core.config import settings
from app.core.database import init_db
from app.core.redis import close_redis, init_redis
from app.api import api_router
from app.middleware.rate_limit import limiter, rate_limit_exceeded_handler
from app.middleware.access_network import AccessNetworkMiddleware
from app.middleware.security_headers import SecurityHeadersMiddleware
from app.api.routes.track import edge_router as tracker_edge_router
from app.services.theme_assets import theme_assets_root
from app.services.stie_runtime import start_security_runtime
from app.services.ml.ml_task import start_ml_runtime
from app.services.runtime_config import (
    DEFAULT_RUNTIME_SETTINGS,
    load_runtime_config,
    runtime_settings,
    save_runtime_settings_cache,
)
from slowapi.errors import RateLimitExceeded


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await init_redis()
    await create_default_admin()
    await _seed_runtime_settings_from_env()
    security_runtime = start_security_runtime()
    app.state.security_runtime = security_runtime
    ml_runtime = start_ml_runtime()
    app.state.ml_runtime = ml_runtime
    yield
    security_runtime.cancel()
    ml_runtime.cancel()
    try:
        await security_runtime
    except BaseException as exc:
        _log.debug("security_runtime shutdown: %s", exc)
    try:
        await ml_runtime
    except BaseException as exc:
        _log.debug("ml_runtime shutdown: %s", exc)
    await close_redis()


async def _seed_runtime_settings_from_env():
    """Bootstrap runtime settings from environment variables.

    Only overwrites fields that are still at their default empty values,
    so runtime changes via /api/v1/settings are not clobbered on restart
    when the env var is absent.
    """
    from app.core.database import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        await load_runtime_config(db)
        _settings = runtime_settings()
        changed = False
        if settings.APP_BASE_URL and _settings.get("base_url") == DEFAULT_RUNTIME_SETTINGS["base_url"]:
            _settings["base_url"] = settings.APP_BASE_URL
            changed = True
        if settings.APP_HTTPS_MODE and _settings.get("https_mode") == DEFAULT_RUNTIME_SETTINGS["https_mode"]:
            _settings["https_mode"] = settings.APP_HTTPS_MODE
            changed = True
        if settings.APP_HTTPS_PROVIDER and _settings.get("https_provider") == DEFAULT_RUNTIME_SETTINGS["https_provider"]:
            _settings["https_provider"] = settings.APP_HTTPS_PROVIDER
            changed = True
        if settings.APP_TRUST_PROXY_HEADERS and not _settings.get("trust_proxy_headers"):
            _settings["trust_proxy_headers"] = True
            changed = True
        if settings.APP_HSTS_ENABLED and not _settings.get("hsts_enabled"):
            _settings["hsts_enabled"] = True
            changed = True
        if settings.cors_origins_list and _settings.get("cors_allowed_origins") == DEFAULT_RUNTIME_SETTINGS["cors_allowed_origins"]:
            _settings["cors_allowed_origins"] = settings.cors_origins_list
            changed = True
        if settings.APP_HTTPS_PROVIDER == "caddy" and _settings.get("https_certificate_strategy") == DEFAULT_RUNTIME_SETTINGS["https_certificate_strategy"]:
            _settings["https_certificate_strategy"] = "letsencrypt_http"
            changed = True
        if settings.KEYCLOAK_JWKS_URL and not _settings.get("keycloak_jwks_url"):
            _settings["keycloak_jwks_url"] = settings.KEYCLOAK_JWKS_URL
            _settings["keycloak_enabled"] = True
            changed = True
        if settings.KEYCLOAK_ISSUER and not _settings.get("keycloak_issuer"):
            _settings["keycloak_issuer"] = settings.KEYCLOAK_ISSUER
            changed = True
        if settings.KEYCLOAK_AUDIENCE and not _settings.get("keycloak_audience"):
            _settings["keycloak_audience"] = settings.KEYCLOAK_AUDIENCE
            changed = True
        if settings.KEYCLOAK_CACHE_TTL_SEC and _settings.get("keycloak_cache_ttl_sec") != settings.KEYCLOAK_CACHE_TTL_SEC:
            _settings["keycloak_cache_ttl_sec"] = settings.KEYCLOAK_CACHE_TTL_SEC
            changed = True
        if settings.KEYCLOAK_SYNC_BASE_URL and not _settings.get("keycloak_sync_base_url"):
            _settings["keycloak_sync_base_url"] = settings.KEYCLOAK_SYNC_BASE_URL
            _settings["keycloak_sync_enabled"] = True
            changed = True
        if settings.KEYCLOAK_SYNC_REALM and not _settings.get("keycloak_sync_realm"):
            _settings["keycloak_sync_realm"] = settings.KEYCLOAK_SYNC_REALM
            changed = True
        if settings.KEYCLOAK_SYNC_CLIENT_ID and _settings.get("keycloak_sync_client_id") == DEFAULT_RUNTIME_SETTINGS["keycloak_sync_client_id"]:
            _settings["keycloak_sync_client_id"] = settings.KEYCLOAK_SYNC_CLIENT_ID
            changed = True
        if settings.KEYCLOAK_SYNC_CLIENT_SECRET and not _settings.get("keycloak_sync_client_secret_enc"):
            from app.services.email import encrypt_password

            _settings["keycloak_sync_client_secret_enc"] = encrypt_password(settings.KEYCLOAK_SYNC_CLIENT_SECRET)
            changed = True
        if settings.KEYCLOAK_SYNC_USERNAME and not _settings.get("keycloak_sync_username"):
            _settings["keycloak_sync_username"] = settings.KEYCLOAK_SYNC_USERNAME
            changed = True
        if settings.KEYCLOAK_SYNC_PASSWORD and not _settings.get("keycloak_sync_password_enc"):
            from app.services.email import encrypt_password

            _settings["keycloak_sync_password_enc"] = encrypt_password(settings.KEYCLOAK_SYNC_PASSWORD)
            changed = True
        if changed:
            await save_runtime_settings_cache(db)
        await db.commit()


async def create_default_admin():
    from app.core.database import AsyncSessionLocal
    from app.models.user import User
    from app.core.security import hash_password
    from app.services.theme_service import assign_default_theme_to_user
    from sqlalchemy import select
    import uuid

    async with AsyncSessionLocal() as db:
        existing = await db.scalar(select(User).where(User.role.in_(("superadmin", "admin"))))
        if not existing:
            admin = User(
                id=str(uuid.uuid4()),
                email="admin@skynet.local",
                username="admin",
                hashed_password=hash_password("admin"),
                role="superadmin",
                status="active",
            )
            db.add(admin)
            await assign_default_theme_to_user(db, admin)
            await db.commit()
            print("✓ Default superadmin created: admin@skynet.local / admin")


app = FastAPI(
    title="SkyNet API",
    version=settings.APP_VERSION,
    description="SkyNet — Self-Hosted Visitor Tracking & Security Dashboard",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(AccessNetworkMiddleware)

app.include_router(tracker_edge_router)
app.include_router(api_router)

# Serve tracker script and test pages
tracker_path = os.path.join(os.path.dirname(__file__), "tracker")
if os.path.exists(tracker_path):
    app.mount("/tracker", StaticFiles(directory=tracker_path, html=True), name="tracker")

theme_assets_path = theme_assets_root()
theme_assets_path.mkdir(parents=True, exist_ok=True)
app.mount("/theme-assets", StaticFiles(directory=theme_assets_path), name="theme-assets")


@app.get("/health")
@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "SkyNet"}
