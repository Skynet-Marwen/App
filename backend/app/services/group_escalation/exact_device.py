from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...models.device import Device
from ...models.event import Event
from ...models.visitor import Visitor
from .common import density_ratio, group_settings, group_windows, parse_json

RISK_EVENT_TYPES = {"behavior_snapshot", "form_submit", "form_submission", "spam_detected"}


def compute_device_group_modifier(
    *,
    recent_visitors: int,
    recent_risky_visitors: int,
    burst_events: int,
    burst_distinct_visitors: int,
    recent_risky_events: int,
    history_risky_events: int,
    similarity_ratio: float,
    weights: dict[str, float],
    similarity_threshold: float,
) -> dict:
    modifier = 0.0
    if recent_visitors > 1 or recent_risky_visitors > 0:
        visitor_pressure = max(recent_visitors - 1, recent_risky_visitors)
        modifier += weights["same_device_risky_visitors"] * min(visitor_pressure / 3.0, 1.0)

    coordinated = burst_events >= 3 and (burst_distinct_visitors >= 2 or recent_risky_events >= 2)
    if coordinated:
        modifier += weights["coordinated_behavior"]

    repeated_spike = recent_risky_events >= 2 and (
        history_risky_events >= 2 or similarity_ratio >= similarity_threshold
    )
    if repeated_spike:
        modifier += weights["repeated_group_spike"]

    modifier = min(modifier, 1.0)
    return {
        "modifier": round(modifier, 4),
        "coordinated": coordinated,
        "repeated_spike": repeated_spike,
    }


async def summarize_exact_device(
    db: AsyncSession,
    *,
    device: Device,
    site_id: str | None,
) -> dict:
    windows = group_windows()
    settings = group_settings()

    visitor_query = select(Visitor).where(
        Visitor.device_id == device.id,
        Visitor.last_seen >= windows["history_cutoff"],
    )
    if site_id:
        visitor_query = visitor_query.where(Visitor.site_id == site_id)
    visitors = (await db.execute(visitor_query)).scalars().all()

    event_query = select(Event).where(
        Event.device_id == device.id,
        Event.created_at >= windows["history_cutoff"],
    )
    if site_id:
        event_query = event_query.where(Event.site_id == site_id)
    events = (await db.execute(event_query)).scalars().all()

    recent_visitors = [row for row in visitors if row.last_seen and row.last_seen >= windows["recent_cutoff"]]
    recent_risky_visitors = [
        row for row in recent_visitors if row.status == "blocked" or (row.page_views or 0) >= 5
    ]
    burst_events = [row for row in events if row.created_at and row.created_at >= windows["burst_cutoff"]]

    recent_risky_events = 0
    history_risky_events = 0
    for row in events:
        properties = parse_json(row.properties)
        is_risky = row.event_type in RISK_EVENT_TYPES or bool(properties.get("behavior")) or bool(properties.get("snapshot"))
        if not is_risky:
            continue
        if row.created_at and row.created_at >= windows["recent_cutoff"]:
            recent_risky_events += 1
        else:
            history_risky_events += 1

    similarity_ratio = density_ratio(
        recent_risky_events,
        history_risky_events,
        recent_hours=settings["recent_window_hours"],
        history_days=settings["history_window_days"],
    )
    result = compute_device_group_modifier(
        recent_visitors=len(recent_visitors),
        recent_risky_visitors=len(recent_risky_visitors),
        burst_events=len(burst_events),
        burst_distinct_visitors=len({row.visitor_id for row in burst_events if row.visitor_id}),
        recent_risky_events=recent_risky_events,
        history_risky_events=history_risky_events,
        similarity_ratio=similarity_ratio,
        weights=settings["weights"],
        similarity_threshold=settings["similarity_threshold"],
    )
    result["evidence"] = {
        "device_id": device.id,
        "site_id": site_id,
        "recent_visitors": len(recent_visitors),
        "recent_risky_visitors": len(recent_risky_visitors),
        "burst_events": len(burst_events),
        "burst_distinct_visitors": len({row.visitor_id for row in burst_events if row.visitor_id}),
        "recent_risky_events": recent_risky_events,
        "history_risky_events": history_risky_events,
        "similarity_ratio": round(similarity_ratio, 4),
    }
    return result
