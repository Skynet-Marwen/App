"""System info endpoint — returns component versions for the dashboard footer."""
import sys
import fastapi
import sqlalchemy
import alembic as alembic_pkg
from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.config import settings
from ...core.database import get_db
from ...core.security import get_current_user
from ...models.site import Site
from ...models.theme import Theme
from ...models.user import User
from ...services.runtime_config import runtime_settings

router = APIRouter(prefix="/system", tags=["system"])


@router.get("/info")
async def system_info():
    return {
        "app":        settings.APP_VERSION,
        "api":        "v1",
        "fastapi":    fastapi.__version__,
        "python":     f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
        "sqlalchemy": sqlalchemy.__version__,
        "alembic":    alembic_pkg.__version__,
    }


@router.get("/bootstrap-status")
async def bootstrap_status(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    settings_payload = runtime_settings()
    site_count = await db.scalar(select(func.count()).select_from(Site)) or 0
    theme_count = await db.scalar(select(func.count()).select_from(Theme)) or 0
    providers = settings_payload.get("idp_providers") or []
    enabled_providers = [item for item in providers if isinstance(item, dict) and item.get("enabled", True)]
    onboarding_completed = bool(settings_payload.get("onboarding_completed"))
    return {
        "onboarding_enabled": bool(settings_payload.get("onboarding_enabled", True)),
        "onboarding_completed": onboarding_completed,
        "has_sites": site_count > 0,
        "site_count": int(site_count),
        "has_external_idp": bool(enabled_providers or settings_payload.get("keycloak_jwks_url")),
        "theme_count": int(theme_count),
        "gateway_enabled": bool(settings_payload.get("gateway_enabled")),
        "checklist": {
            "site_created": site_count > 0,
            "idp_connected": bool(enabled_providers or settings_payload.get("keycloak_jwks_url")),
            "theme_ready": theme_count > 0,
            "gateway_ready": bool(settings_payload.get("gateway_enabled") and settings_payload.get("gateway_target_origin")),
        },
    }
