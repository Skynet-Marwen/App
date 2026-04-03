from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.activity_event import ActivityEvent
from ..models.event import Event
from ..models.incident import Incident
from ..models.visitor import Visitor


def retention_cutoff(retention_days: int, *, now: datetime | None = None) -> datetime:
    safe_retention_days = max(int(retention_days or 0), 1)
    reference_time = now or datetime.now(timezone.utc)
    return reference_time - timedelta(days=safe_retention_days)


def activity_retention_cutoff(retention_days: int, *, now: datetime | None = None) -> datetime:
    return retention_cutoff(retention_days, now=now)


async def prune_activity_events(
    db: AsyncSession,
    *,
    retention_days: int,
    now: datetime | None = None,
) -> int:
    cutoff = retention_cutoff(retention_days, now=now)
    result = await db.execute(delete(ActivityEvent).where(ActivityEvent.created_at < cutoff))
    return int(result.rowcount or 0)


async def prune_events(
    db: AsyncSession,
    *,
    retention_days: int,
    now: datetime | None = None,
) -> int:
    cutoff = retention_cutoff(retention_days, now=now)
    result = await db.execute(delete(Event).where(Event.created_at < cutoff))
    return int(result.rowcount or 0)


async def prune_incidents(
    db: AsyncSession,
    *,
    retention_days: int,
    now: datetime | None = None,
) -> int:
    cutoff = retention_cutoff(retention_days, now=now)
    result = await db.execute(
        delete(Incident).where(
            Incident.detected_at < cutoff,
            Incident.status != "open",
        )
    )
    return int(result.rowcount or 0)


async def anonymize_or_prune_visitors(
    db: AsyncSession,
    *,
    retention_days: int,
    anonymize_ips: bool,
    now: datetime | None = None,
) -> dict[str, int]:
    cutoff = retention_cutoff(retention_days, now=now)
    if anonymize_ips:
        result = await db.execute(
            update(Visitor)
            .where(
                Visitor.last_seen < cutoff,
                Visitor.ip != "0.0.0.0",
            )
            .values(
                ip="0.0.0.0",
                city=None,
                isp=None,
                user_agent=None,
            )
        )
        return {"anonymized": int(result.rowcount or 0), "deleted": 0}

    result = await db.execute(delete(Visitor).where(Visitor.last_seen < cutoff))
    return {"anonymized": 0, "deleted": int(result.rowcount or 0)}
