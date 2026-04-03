from __future__ import annotations

import json
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from ..models.notification_delivery import NotificationDelivery


def _payload_excerpt(payload: dict | list | None) -> str | None:
    if payload is None:
        return None
    rendered = json.dumps(payload, default=str, separators=(",", ":"))
    return rendered[:1200]


async def create_delivery(
    db: AsyncSession,
    *,
    channel: str,
    event_type: str,
    target: str,
    subject: str | None = None,
    payload: dict | list | None = None,
    incident_id: str | None = None,
    escalation_level: int = 0,
    attempt_count: int = 1,
) -> NotificationDelivery:
    delivery = NotificationDelivery(
        channel=channel,
        event_type=event_type,
        status="queued",
        target=target,
        subject=subject,
        payload_excerpt=_payload_excerpt(payload),
        incident_id=incident_id,
        escalation_level=escalation_level,
        attempt_count=attempt_count,
    )
    db.add(delivery)
    await db.flush()
    return delivery


async def mark_delivery_sent(
    db: AsyncSession,
    delivery: NotificationDelivery,
    *,
    response_status: int | None = None,
) -> NotificationDelivery:
    delivery.status = "sent"
    delivery.response_status = response_status
    delivery.error_message = None
    delivery.delivered_at = datetime.now(timezone.utc)
    await db.flush()
    return delivery


async def mark_delivery_failed(
    db: AsyncSession,
    delivery: NotificationDelivery,
    *,
    error_message: str,
    response_status: int | None = None,
) -> NotificationDelivery:
    delivery.status = "failed"
    delivery.response_status = response_status
    delivery.error_message = error_message[:1000]
    delivery.delivered_at = None
    await db.flush()
    return delivery
