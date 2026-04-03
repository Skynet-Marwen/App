from __future__ import annotations

import hashlib
import hmac
import json
from datetime import datetime, timezone
from typing import Any

import httpx

from ..core.database import AsyncSessionLocal
from .email import decrypt_password
from .notification_delivery import create_delivery, mark_delivery_failed, mark_delivery_sent
from .runtime_config import runtime_settings


def _connector_enabled(settings: dict, connector: str) -> bool:
    return bool(settings.get(f"integration_{connector}_enabled")) and bool(settings.get(f"integration_{connector}_url"))


def _connector_events(settings: dict, connector: str) -> set[str]:
    raw = settings.get(f"integration_{connector}_events") or []
    if isinstance(raw, list):
        return {str(item).strip() for item in raw if str(item).strip()}
    return set()


async def dispatch_connector_event(
    connector: str,
    event_key: str,
    payload: dict[str, Any],
    *,
    subject: str,
    severity: str,
    incident_id: str | None = None,
    source: str = "notifications",
) -> None:
    settings = runtime_settings()
    if not _connector_enabled(settings, connector) or event_key not in _connector_events(settings, connector):
        return

    url = str(settings.get(f"integration_{connector}_url") or "")
    secret = decrypt_password(str(settings.get(f"integration_{connector}_secret_enc") or ""))
    final_payload = {
        "event": event_key,
        "connector": connector,
        "severity": severity,
        "subject": subject,
        "source": source,
        "sent_at": datetime.now(timezone.utc).isoformat(),
        **payload,
    }

    async with AsyncSessionLocal() as db:
        delivery = await create_delivery(
            db,
            channel=connector,
            event_type=event_key,
            target=url,
            subject=subject,
            payload=final_payload,
            incident_id=incident_id,
            attempt_count=1,
        )
        try:
            response = await post_connector_webhook(
                url=url,
                secret=secret,
                event_type=event_key,
                connector=connector,
                payload=final_payload,
            )
            await mark_delivery_sent(db, delivery, response_status=response.status_code)
        except Exception as exc:
            status_code = getattr(getattr(exc, "response", None), "status_code", None)
            await mark_delivery_failed(db, delivery, error_message=str(exc), response_status=status_code)
        await db.commit()


async def send_test_connector(
    *,
    connector: str,
    url: str,
    secret: str,
    event_type: str = "connector_test",
    subject: str | None = None,
) -> dict[str, Any]:
    payload = {
        "event": event_type,
        "connector": connector,
        "source": "settings.integrations.test",
        "message": "SkyNet integration connector test delivery",
        "sent_at": datetime.now(timezone.utc).isoformat(),
    }
    async with AsyncSessionLocal() as db:
        delivery = await create_delivery(
            db,
            channel=connector,
            event_type=event_type,
            target=url,
            subject=subject or f"{connector.title()} Connector Test",
            payload=payload,
            attempt_count=1,
        )
        try:
            response = await post_connector_webhook(
                url=url,
                secret=secret,
                event_type=event_type,
                connector=connector,
                payload=payload,
            )
            await mark_delivery_sent(db, delivery, response_status=response.status_code)
            await db.commit()
            return {"ok": True, "status_code": response.status_code}
        except Exception as exc:
            status_code = getattr(getattr(exc, "response", None), "status_code", None)
            await mark_delivery_failed(db, delivery, error_message=str(exc), response_status=status_code)
            await db.commit()
            raise


async def post_connector_webhook(
    *,
    url: str,
    secret: str,
    event_type: str,
    connector: str,
    payload: dict[str, Any],
) -> httpx.Response:
    body = json.dumps(payload, separators=(",", ":"), default=str)
    headers = {
        "Content-Type": "application/json",
        "X-SkyNet-Event": event_type,
        "X-SkyNet-Connector": connector,
    }
    if secret:
        digest = hmac.new(secret.encode(), body.encode(), hashlib.sha256).hexdigest()
        headers["X-SkyNet-Signature"] = f"sha256={digest}"
    async with httpx.AsyncClient(timeout=5.0) as client:
        response = await client.post(url, content=body, headers=headers)
        response.raise_for_status()
        return response
