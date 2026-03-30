from fastapi import APIRouter
from .routes import auth, stats, visitors, users, devices, blocking, anti_evasion, integration, track, settings, system

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth.router)
api_router.include_router(stats.router)
api_router.include_router(visitors.router)
api_router.include_router(users.router)
api_router.include_router(devices.router)
api_router.include_router(blocking.router)
api_router.include_router(anti_evasion.router)
api_router.include_router(integration.router)
api_router.include_router(track.router)
api_router.include_router(settings.router)
api_router.include_router(system.router)
