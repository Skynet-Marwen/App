from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...models.activity_event import ActivityEvent
from ...models.device import Device
from ...models.identity_link import IdentityLink
from .common import density_ratio, group_settings, group_windows


def compute_user_group_modifiers(
    *,
    risky_devices: int,
    blocked_devices: int,
    risky_match_keys: int,
    recent_activity_count: int,
    history_activity_count: int,
    recent_distinct_devices: int,
    burst_activity_count: int,
    burst_distinct_devices: int,
    similarity_ratio: float,
    weights: dict[str, float],
    similarity_threshold: float,
) -> dict:
    extra_modifiers: dict[str, float] = {}

    if risky_devices > 1 or blocked_devices > 0:
        device_pressure = min(max(risky_devices, blocked_devices + 1) / 3.0, 1.0)
        extra_modifiers["group_user_risk"] = round(
            weights["multi_device_suspicious_parent"] * device_pressure,
            4,
        )

    if risky_match_keys > 0:
        extra_modifiers["strict_group_risky_siblings"] = round(
            weights["strict_group_risky_siblings"] * min(risky_match_keys / 2.0, 1.0),
            4,
        )

    coordinated = (
        burst_activity_count >= 3
        and burst_distinct_devices >= 2
        and recent_distinct_devices >= 2
    )
    if coordinated:
        extra_modifiers["coordinated_group_behavior"] = round(weights["coordinated_behavior"], 4)

    repeated_spike = recent_activity_count >= 3 and (
        history_activity_count >= 3 or similarity_ratio >= similarity_threshold
    )
    if repeated_spike:
        extra_modifiers["repeated_group_spike"] = round(weights["repeated_group_spike"], 4)

    return {
        "extra_modifiers": extra_modifiers,
        "coordinated": coordinated,
        "repeated_spike": repeated_spike,
    }


async def summarize_user_parent(
    db: AsyncSession,
    *,
    external_user_id: str,
) -> dict:
    windows = group_windows()
    settings = group_settings()

    links = (
        await db.execute(
            select(IdentityLink).where(
                IdentityLink.external_user_id == external_user_id,
                IdentityLink.fingerprint_id.isnot(None),
            )
        )
    ).scalars().all()
    device_ids = [row.fingerprint_id for row in links if row.fingerprint_id]
    devices = []
    if device_ids:
        devices = (
            await db.execute(select(Device).where(Device.id.in_(device_ids)))
        ).scalars().all()

    activities = (
        await db.execute(
            select(ActivityEvent).where(
                ActivityEvent.external_user_id == external_user_id,
                ActivityEvent.created_at >= windows["history_cutoff"],
            )
        )
    ).scalars().all()

    recent_activity = [row for row in activities if row.created_at and row.created_at >= windows["recent_cutoff"]]
    burst_activity = [row for row in activities if row.created_at and row.created_at >= windows["burst_cutoff"]]
    risky_devices = [row for row in devices if row.status == "blocked" or (row.risk_score or 0) >= 55]
    blocked_devices = [row for row in devices if row.status == "blocked"]
    risky_match_keys = {
        row.match_key for row in risky_devices if row.match_key and str(row.match_key).startswith("strict:v")
    }
    history_activity_count = max(len(activities) - len(recent_activity), 0)
    similarity_ratio = density_ratio(
        len(recent_activity),
        history_activity_count,
        recent_hours=settings["recent_window_hours"],
        history_days=settings["history_window_days"],
    )
    result = compute_user_group_modifiers(
        risky_devices=len(risky_devices),
        blocked_devices=len(blocked_devices),
        risky_match_keys=len(risky_match_keys),
        recent_activity_count=len(recent_activity),
        history_activity_count=history_activity_count,
        recent_distinct_devices=len({row.fingerprint_id for row in recent_activity if row.fingerprint_id}),
        burst_activity_count=len(burst_activity),
        burst_distinct_devices=len({row.fingerprint_id for row in burst_activity if row.fingerprint_id}),
        similarity_ratio=similarity_ratio,
        weights=settings["weights"],
        similarity_threshold=settings["similarity_threshold"],
    )
    result["evidence"] = {
        "external_user_id": external_user_id,
        "linked_device_count": len(devices),
        "risky_devices": len(risky_devices),
        "blocked_devices": len(blocked_devices),
        "risky_match_keys": sorted(risky_match_keys),
        "recent_activity_count": len(recent_activity),
        "history_activity_count": history_activity_count,
        "recent_distinct_devices": len({row.fingerprint_id for row in recent_activity if row.fingerprint_id}),
        "burst_activity_count": len(burst_activity),
        "burst_distinct_devices": len({row.fingerprint_id for row in burst_activity if row.fingerprint_id}),
        "similarity_ratio": round(similarity_ratio, 4),
    }
    return result
