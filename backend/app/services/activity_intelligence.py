from __future__ import annotations

import json
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.activity_event import ActivityEvent
from ..models.anomaly_flag import AnomalyFlag


IMPOSSIBLE_TRAVEL_MAX_HOURS = 6
RECENT_FLAG_WINDOW_HOURS = 12


def evaluate_impossible_travel(
    *,
    previous_country: str | None,
    current_country: str | None,
    previous_ip: str | None,
    current_ip: str | None,
    previous_created_at: datetime | None,
    current_created_at: datetime,
) -> dict | None:
    if not previous_country or not current_country:
        return None
    if previous_country == current_country:
        return None
    if previous_ip and current_ip and previous_ip == current_ip:
        return None
    if not previous_created_at:
        return None

    delta = current_created_at - previous_created_at
    if delta <= timedelta(0) or delta > timedelta(hours=IMPOSSIBLE_TRAVEL_MAX_HOURS):
        return None

    hours_apart = round(delta.total_seconds() / 3600, 2)
    severity = "critical" if hours_apart <= 1 else "high" if hours_apart <= 3 else "medium"
    return {
        "from_country": previous_country,
        "to_country": current_country,
        "from_ip": previous_ip,
        "to_ip": current_ip,
        "hours_apart": hours_apart,
        "heuristic": "country_change_under_6h",
        "severity": severity,
    }


async def detect_impossible_travel(
    db: AsyncSession,
    *,
    external_user_id: str,
    current_country: str | None,
    current_ip: str | None,
    current_created_at: datetime,
    related_device_id: str | None,
) -> AnomalyFlag | None:
    previous = await db.scalar(
        select(ActivityEvent)
        .where(ActivityEvent.external_user_id == external_user_id)
        .order_by(ActivityEvent.created_at.desc())
        .limit(1)
    )
    evidence = evaluate_impossible_travel(
        previous_country=getattr(previous, "country", None),
        current_country=current_country,
        previous_ip=getattr(previous, "ip", None),
        current_ip=current_ip,
        previous_created_at=getattr(previous, "created_at", None),
        current_created_at=current_created_at,
    )
    if not evidence:
        return None

    recent_open_flag = await db.scalar(
        select(AnomalyFlag)
        .where(
            AnomalyFlag.external_user_id == external_user_id,
            AnomalyFlag.flag_type == "impossible_travel",
            AnomalyFlag.status == "open",
            AnomalyFlag.detected_at >= current_created_at - timedelta(hours=RECENT_FLAG_WINDOW_HOURS),
        )
        .order_by(AnomalyFlag.detected_at.desc())
        .limit(1)
    )
    if recent_open_flag:
        return None

    flag = AnomalyFlag(
        id=str(uuid.uuid4()),
        external_user_id=external_user_id,
        flag_type="impossible_travel",
        severity=evidence.pop("severity"),
        status="open",
        related_device_id=related_device_id,
        evidence=json.dumps(evidence),
        detected_at=current_created_at,
    )
    db.add(flag)
    await db.flush()
    return flag
