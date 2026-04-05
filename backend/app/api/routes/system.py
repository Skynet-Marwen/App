"""System info endpoint — returns component versions and diagnostics for operators."""
import sys
import fastapi
import sqlalchemy
import alembic as alembic_pkg
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Request
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.config import settings
from ...core.database import get_db
from ...core.redis import get_redis
from ...core.security import get_current_user, require_superadmin_user
from ...models.audit_log import AuditLog
from ...models.site import Site
from ...models.theme import Theme
from ...models.user import User
from ...services.audit import log_action, request_ip
from ...services.backup_store import list_backup_archives
from ...services.runtime_config import load_runtime_config, runtime_settings, update_runtime_settings

router = APIRouter(prefix="/system", tags=["system"])


@router.get("/info")
async def system_info(_: User = Depends(get_current_user)):
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


@router.get("/diagnostics")
async def diagnostics(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    settings_payload = runtime_settings()
    now = datetime.now(timezone.utc)
    db_status = "ok"
    redis_status = "ok"
    try:
        await db.execute(text("SELECT 1"))
    except Exception:
        db_status = "error"
    try:
        await get_redis().ping()
    except Exception:
        redis_status = "error"

    site_count = await db.scalar(select(func.count()).select_from(Site)) or 0
    theme_count = await db.scalar(select(func.count()).select_from(Theme)) or 0
    user_count = await db.scalar(select(func.count()).select_from(User)) or 0
    latest_backup = list_backup_archives()[:1]
    recent_audit_rows = (
        await db.execute(
            select(AuditLog)
            .order_by(AuditLog.created_at.desc())
            .limit(8)
        )
    ).scalars().all()

    return {
        "timestamp": now.isoformat(),
        "health": {
            "api": "ok",
            "database": db_status,
            "redis": redis_status,
        },
        "runtime": {
            "instance_name": settings_payload.get("instance_name"),
            "timezone": settings_payload.get("timezone"),
            "realtime_enabled": bool(settings_payload.get("realtime_enabled")),
            "developer_mode_enabled": bool(settings_payload.get("developer_mode_enabled")),
            "feature_flags": settings_payload.get("feature_flags") or {},
            "ui_visibility": settings_payload.get("ui_visibility") or {},
            "gateway_enabled": bool(settings_payload.get("gateway_enabled")),
            "onboarding_completed": bool(settings_payload.get("onboarding_completed")),
        },
        "inventory": {
            "sites": int(site_count),
            "themes": int(theme_count),
            "operators": int(user_count),
            "backups": len(list_backup_archives()),
            "latest_backup": latest_backup[0].model_dump(mode="json") if latest_backup else None,
        },
        "recent_audit": [
            {
                "id": log.id,
                "action": log.action,
                "target_type": log.target_type,
                "target_id": log.target_id,
                "created_at": log.created_at.isoformat(),
            }
            for log in recent_audit_rows
        ],
    }


@router.post("/maintenance/reload-runtime")
async def reload_runtime(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(require_superadmin_user),
):
    await load_runtime_config(db)
    log_action(
        db,
        action="SYSTEM_RELOAD_RUNTIME",
        actor_id=current.id,
        target_type="system",
        target_id="runtime_config",
        ip=request_ip(request),
    )
    await db.commit()
    return {"ok": True, "message": "Runtime configuration reloaded from storage."}


@router.post("/maintenance/reset-onboarding")
async def reset_onboarding(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(require_superadmin_user),
):
    await update_runtime_settings(
        db,
        {
            "onboarding_enabled": True,
            "onboarding_completed": False,
            "onboarding_last_completed_at": "",
        },
    )
    log_action(
        db,
        action="SYSTEM_RESET_ONBOARDING",
        actor_id=current.id,
        target_type="system",
        target_id="onboarding",
        ip=request_ip(request),
    )
    await db.commit()
    return {"ok": True, "message": "Onboarding wizard reset and re-enabled."}
