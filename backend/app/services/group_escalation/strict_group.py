from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...models.device import Device
from .common import density_ratio, group_settings, group_windows


def compute_strict_group_modifier(
    *,
    recent_risky_siblings: int,
    recent_active_siblings: int,
    history_risky_siblings: int,
    similarity_ratio: float,
    weights: dict[str, float],
    similarity_threshold: float,
) -> dict:
    modifier = 0.0
    if recent_risky_siblings > 0:
        modifier += weights["strict_group_risky_siblings"] * min(recent_risky_siblings / 3.0, 1.0)

    coordinated = recent_risky_siblings >= 2 and recent_active_siblings >= 2
    if coordinated:
        modifier += weights["coordinated_behavior"]

    repeated_spike = recent_risky_siblings > 0 and (
        history_risky_siblings > 0 or similarity_ratio >= similarity_threshold
    )
    if repeated_spike:
        modifier += weights["repeated_group_spike"]

    modifier = min(modifier, 1.0)
    return {
        "modifier": round(modifier, 4),
        "coordinated": coordinated,
        "repeated_spike": repeated_spike,
    }


async def summarize_strict_group(
    db: AsyncSession,
    *,
    device: Device,
) -> dict:
    if not device.match_key or not str(device.match_key).startswith("strict:v"):
        return {
            "modifier": 0.0,
            "coordinated": False,
            "repeated_spike": False,
            "evidence": {
                "device_id": device.id,
                "match_key": device.match_key,
                "recent_risky_siblings": 0,
                "recent_active_siblings": 0,
                "history_risky_siblings": 0,
                "similarity_ratio": 0.0,
            },
        }

    windows = group_windows()
    settings = group_settings()
    siblings = (
        await db.execute(
            select(Device).where(
                Device.match_key == device.match_key,
                Device.id != device.id,
                Device.last_seen >= windows["history_cutoff"],
            )
        )
    ).scalars().all()

    recent_siblings = [row for row in siblings if row.last_seen and row.last_seen >= windows["recent_cutoff"]]
    recent_risky = [row for row in recent_siblings if row.status == "blocked" or (row.risk_score or 0) >= 55]
    history_risky = [
        row for row in siblings if row.status == "blocked" or (row.risk_score or 0) >= 55
    ]
    history_risky_count = max(len(history_risky) - len(recent_risky), 0)
    similarity_ratio = density_ratio(
        len(recent_risky),
        history_risky_count,
        recent_hours=settings["recent_window_hours"],
        history_days=settings["history_window_days"],
    )
    result = compute_strict_group_modifier(
        recent_risky_siblings=len(recent_risky),
        recent_active_siblings=len(recent_siblings),
        history_risky_siblings=history_risky_count,
        similarity_ratio=similarity_ratio,
        weights=settings["weights"],
        similarity_threshold=settings["similarity_threshold"],
    )
    result["evidence"] = {
        "device_id": device.id,
        "match_key": device.match_key,
        "recent_risky_siblings": len(recent_risky),
        "recent_active_siblings": len(recent_siblings),
        "history_risky_siblings": history_risky_count,
        "sibling_ids": [row.id for row in siblings],
        "similarity_ratio": round(similarity_ratio, 4),
    }
    return result
