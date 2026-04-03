from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.database import get_db
from ...core.security import get_current_user
from ...models.notification_delivery import NotificationDelivery
from ...models.user import User
from ...services.audit import log_action, request_ip
from ...services.incident_notifications import send_test_webhook
from ...services.runtime_config import runtime_settings
from ...services.sanitize import clean_text, clean_url


router = APIRouter(prefix="/settings", tags=["settings"])


@router.post("/webhooks/test")
async def test_webhook(
    data: dict,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    try:
        url = clean_url(data.get("url"))
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    if not url:
        raise HTTPException(422, "Webhook URL is required")
    secret = clean_text(str(data.get("secret", "")))
    event_type = clean_text(str(data.get("event", "webhook_test"))) or "webhook_test"
    payload = {
        "event": event_type,
        "sent_at": datetime.now(timezone.utc).isoformat(),
        "source": "settings.webhooks.test",
        "instance_name": runtime_settings().get("instance_name", "SkyNet"),
        "message": "SkyNet webhook test delivery",
    }
    try:
        result = await send_test_webhook(
            db=db,
            url=url,
            secret=secret,
            event_type=event_type,
            payload=payload,
        )
        log_action(
            db,
            action="TEST_WEBHOOK",
            actor_id=current.id,
            target_type="settings",
            target_id="webhooks",
            ip=request_ip(request),
            extra={"event": event_type, "url": url},
        )
        await db.commit()
        return result
    except Exception as exc:
        log_action(
            db,
            action="TEST_WEBHOOK_FAILED",
            actor_id=current.id,
            target_type="settings",
            target_id="webhooks",
            ip=request_ip(request),
            extra={"event": event_type, "url": url, "error": str(exc)},
        )
        await db.commit()
        raise HTTPException(400, str(exc)) from exc


@router.get("/notifications/deliveries")
async def list_notification_deliveries(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    channel: str = Query(""),
    status: str = Query(""),
    search: str = Query(""),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    filters = []
    if channel:
        filters.append(NotificationDelivery.channel == channel)
    if status:
        filters.append(NotificationDelivery.status == status)
    if search:
        term = f"%{search}%"
        filters.append(
            or_(
                NotificationDelivery.event_type.ilike(term),
                NotificationDelivery.target.ilike(term),
                NotificationDelivery.subject.ilike(term),
                NotificationDelivery.error_message.ilike(term),
            )
        )

    total_query = select(func.count()).select_from(NotificationDelivery)
    if filters:
        total_query = total_query.where(*filters)
    total = await db.scalar(total_query) or 0

    query = (
        select(NotificationDelivery)
        .order_by(NotificationDelivery.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    if filters:
        query = query.where(*filters)
    rows = (await db.execute(query)).scalars().all()

    return {
        "total": total,
        "items": [
            {
                "id": item.id,
                "channel": item.channel,
                "event_type": item.event_type,
                "status": item.status,
                "target": item.target,
                "subject": item.subject,
                "response_status": item.response_status,
                "error_message": item.error_message,
                "payload_excerpt": item.payload_excerpt,
                "incident_id": item.incident_id,
                "escalation_level": item.escalation_level,
                "attempt_count": item.attempt_count,
                "created_at": item.created_at.isoformat() if item.created_at else None,
                "updated_at": item.updated_at.isoformat() if item.updated_at else None,
                "delivered_at": item.delivered_at.isoformat() if item.delivered_at else None,
            }
            for item in rows
        ],
    }
