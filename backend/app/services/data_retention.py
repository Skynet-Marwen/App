from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.activity_event import ActivityEvent


def activity_retention_cutoff(retention_days: int, *, now: datetime | None = None) -> datetime:
    safe_retention_days = max(int(retention_days or 0), 1)
    reference_time = now or datetime.now(timezone.utc)
    return reference_time - timedelta(days=safe_retention_days)


async def prune_activity_events(
    db: AsyncSession,
    *,
    retention_days: int,
    now: datetime | None = None,
) -> int:
    cutoff = activity_retention_cutoff(retention_days, now=now)
    result = await db.execute(delete(ActivityEvent).where(ActivityEvent.created_at < cutoff))
    return int(result.rowcount or 0)
