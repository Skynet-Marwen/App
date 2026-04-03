from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.database import get_db
from ...core.security import get_current_user
from ...models.notification_delivery import NotificationDelivery
from ...models.site import Site
from ...models.threat_intel import ThreatIntel
from ...models.user import User
from ...services.audit import log_action, request_ip
from ...services.email import decrypt_password
from ...services.integration_delivery import send_test_connector
from ...services.runtime_config import runtime_settings
from ...services.sanitize import clean_text, clean_url
from ...services.security_center import refresh_threat_intel


router = APIRouter(prefix="/settings/integrations", tags=["settings-integrations"])
_MASKED = "••••••••"


async def _delivery_count(db: AsyncSession, channel: str) -> int:
    return int(
        await db.scalar(
            select(func.count()).select_from(NotificationDelivery).where(
                NotificationDelivery.channel == channel,
                NotificationDelivery.status == "sent",
            )
        )
        or 0
    )


@router.get("/status")
async def integrations_status(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    settings = runtime_settings()
    total_sites = int(await db.scalar(select(func.count()).select_from(Site)) or 0)
    active_sites = int(await db.scalar(select(func.count()).select_from(Site).where(Site.active.is_(True))) or 0)
    latest_intel = await db.scalar(select(func.max(ThreatIntel.updated_at)))
    threat_count = int(await db.scalar(select(func.count()).select_from(ThreatIntel)) or 0)

    return {
        "api_access": {
            "enabled": bool(settings.get("integration_api_access_enabled", True)),
            "site_count": total_sites,
            "active_site_count": active_sites,
            "api_key_prefix": settings.get("integration_api_key_prefix", ""),
            "rate_limit_per_minute": int(settings.get("rate_limit_integration_per_minute", 120) or 120),
        },
        "threat_intel": {
            "entry_count": threat_count,
            "latest_updated_at": latest_intel.isoformat() if latest_intel else None,
            "refresh_interval_hours": int(settings.get("intel_refresh_interval_hours", 24) or 24),
        },
        "connectors": {
            "siem": {
                "enabled": bool(settings.get("integration_siem_enabled")),
                "url": settings.get("integration_siem_url", ""),
                "events": settings.get("integration_siem_events") or [],
                "deliveries_sent": await _delivery_count(db, "siem"),
            },
            "monitoring": {
                "enabled": bool(settings.get("integration_monitoring_enabled")),
                "url": settings.get("integration_monitoring_url", ""),
                "events": settings.get("integration_monitoring_events") or [],
                "deliveries_sent": await _delivery_count(db, "monitoring"),
            },
        },
    }


@router.post("/test")
async def test_connector(
    data: dict,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    connector = clean_text(str(data.get("connector", ""))).lower()
    if connector not in {"siem", "monitoring"}:
        raise HTTPException(422, "Connector must be siem or monitoring")
    try:
        url = clean_url(data.get("url"))
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    if not url:
        raise HTTPException(422, "Connector URL is required")
    provided_secret = str(data.get("secret", ""))
    if provided_secret == _MASKED:
        secret = decrypt_password(str(runtime_settings().get(f"integration_{connector}_secret_enc") or ""))
    else:
        secret = clean_text(provided_secret)
    event_type = clean_text(str(data.get("event", f"{connector}_test"))) or f"{connector}_test"
    try:
        result = await send_test_connector(
            connector=connector,
            url=url,
            secret=secret,
            event_type=event_type,
            subject=f"{connector.title()} Connector Test",
        )
    except Exception as exc:
        log_action(
            db,
            action="TEST_INTEGRATION_CONNECTOR_FAILED",
            actor_id=current.id,
            target_type="settings",
            target_id=connector,
            ip=request_ip(request),
            extra={"connector": connector, "url": url, "error": str(exc)},
        )
        await db.commit()
        raise HTTPException(400, str(exc)) from exc

    log_action(
        db,
        action="TEST_INTEGRATION_CONNECTOR",
        actor_id=current.id,
        target_type="settings",
        target_id=connector,
        ip=request_ip(request),
        extra={"connector": connector, "url": url, "event": event_type},
    )
    await db.commit()
    return result


@router.post("/threat-intel/refresh")
async def refresh_integrations_threat_intel(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    updated = await refresh_threat_intel(db, force=True)
    log_action(
        db,
        action="REFRESH_THREAT_INTEL",
        actor_id=current.id,
        target_type="settings",
        target_id="integrations",
        ip=request_ip(request),
        extra={
            "updated": updated,
            "refreshed_at": datetime.now(timezone.utc).isoformat(),
        },
    )
    await db.commit()
    return {"ok": True, "updated": updated}
