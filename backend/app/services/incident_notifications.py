from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
from datetime import datetime, timezone

import httpx
from sqlalchemy import select

from ..core.database import AsyncSessionLocal
from ..models.user import User
from .email import send_incident_alert_email
from .runtime_config import runtime_settings


HIGH_SEVERITIES = {"high", "critical"}


def dispatch_incident_notifications(incidents: list[dict] | dict | None) -> None:
    if not incidents:
        return
    items = incidents if isinstance(incidents, list) else [incidents]
    items = [item for item in items if item and item.get("severity") in HIGH_SEVERITIES]
    if not items:
        return
    asyncio.create_task(_safe_dispatch(items))


async def _safe_dispatch(incidents: list[dict]) -> None:
    try:
        await _dispatch(incidents)
    except Exception:
        return


async def _dispatch(incidents: list[dict]) -> None:
    settings = runtime_settings()
    if settings.get("smtp_enabled"):
        await _send_email_notifications(incidents, settings)
    if settings.get("webhook_url") and _webhook_enabled(settings):
        await _send_webhook_notifications(incidents, settings)


async def _send_email_notifications(incidents: list[dict], settings: dict) -> None:
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(User.email).where(
                User.status == "active",
                User.role.in_(("admin", "moderator")),
            )
        )
        recipients = sorted({email for email in result.scalars().all() if email})
    if not recipients:
        return
    instance_name = settings.get("instance_name", "SkyNet")
    for incident in incidents:
        for recipient in recipients:
            try:
                await send_incident_alert_email(recipient, incident, instance_name)
            except Exception:
                continue


def _webhook_enabled(settings: dict) -> bool:
    events = settings.get("webhook_events") or {}
    return bool(events.get("on_high_severity_incident") or events.get("on_evasion_detected"))


async def _send_webhook_notifications(incidents: list[dict], settings: dict) -> None:
    url = settings.get("webhook_url", "")
    secret = settings.get("webhook_secret", "")
    async with httpx.AsyncClient(timeout=5.0) as client:
        for incident in incidents:
            payload = {
                "event": "high_severity_incident",
                "sent_at": datetime.now(timezone.utc).isoformat(),
                "incident": incident,
            }
            body = json.dumps(payload, separators=(",", ":"), default=str)
            headers = {
                "Content-Type": "application/json",
                "X-SkyNet-Event": "high_severity_incident",
            }
            if secret:
                digest = hmac.new(secret.encode(), body.encode(), hashlib.sha256).hexdigest()
                headers["X-SkyNet-Signature"] = f"sha256={digest}"
            try:
                await client.post(url, content=body, headers=headers)
            except Exception:
                continue
