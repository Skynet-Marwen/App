from fastapi import APIRouter
from .routes import (
    audit, auth, stats, visitors, users, devices, blocking,
    anti_evasion, integration, track, settings, settings_geoip,
    settings_https, settings_backup, settings_storage, settings_integrations, themes, theme_packages, security, stats_live,
    settings_smtp, settings_notifications, system, identity, risk, search, gateway,
    tenants,
)

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(audit.router)
api_router.include_router(auth.router)
api_router.include_router(stats.router)
api_router.include_router(stats_live.router)
api_router.include_router(visitors.router)
api_router.include_router(users.router)
api_router.include_router(devices.router)
api_router.include_router(blocking.router)
api_router.include_router(anti_evasion.router)
api_router.include_router(integration.router)
api_router.include_router(track.router)
api_router.include_router(settings.router)
api_router.include_router(settings_backup.router)
api_router.include_router(settings_storage.router)
api_router.include_router(settings_geoip.router)
api_router.include_router(settings_integrations.router)
api_router.include_router(settings_https.router)
api_router.include_router(settings_smtp.router)
api_router.include_router(settings_notifications.router)
api_router.include_router(system.router)
api_router.include_router(identity.router)
api_router.include_router(risk.router)
api_router.include_router(search.router)
api_router.include_router(themes.router)
api_router.include_router(theme_packages.router)
api_router.include_router(security.router)
api_router.include_router(gateway.router)
api_router.include_router(tenants.router)
