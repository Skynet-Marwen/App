from __future__ import annotations

import json
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...models.anomaly_flag import AnomalyFlag
from ..runtime_config import runtime_settings

GROUP_FLAG_TYPES = {
    "group_device_risk",
    "group_user_risk",
    "coordinated_group_behavior",
    "repeated_group_spike",
}

DEFAULT_GROUP_ESCALATION_WEIGHTS = {
    "same_device_risky_visitors": 0.22,
    "strict_group_risky_siblings": 0.18,
    "coordinated_behavior": 0.20,
    "repeated_group_spike": 0.12,
    "multi_device_suspicious_parent": 0.16,
}


def group_settings() -> dict[str, Any]:
    settings = runtime_settings()
    configured = settings.get("group_escalation_weights") or {}
    merged_weights = dict(DEFAULT_GROUP_ESCALATION_WEIGHTS)
    if isinstance(configured, dict):
        for key, default in DEFAULT_GROUP_ESCALATION_WEIGHTS.items():
            try:
                merged_weights[key] = max(float(configured.get(key, default)), 0.0)
            except (TypeError, ValueError):
                merged_weights[key] = default
    return {
        "enabled": bool(settings.get("group_escalation_enabled", False)),
        "recent_window_hours": max(int(settings.get("group_recent_window_hours", 24) or 24), 1),
        "history_window_days": max(int(settings.get("group_history_window_days", 30) or 30), 2),
        "burst_window_minutes": max(int(settings.get("group_behavior_burst_window_minutes", 30) or 30), 1),
        "similarity_threshold": max(float(settings.get("group_behavior_similarity_threshold", 1.75) or 1.75), 1.0),
        "weights": merged_weights,
    }


def group_windows(now: datetime | None = None) -> dict[str, datetime]:
    current = now or datetime.now(timezone.utc)
    settings = group_settings()
    recent_cutoff = current - timedelta(hours=settings["recent_window_hours"])
    history_cutoff = current - timedelta(days=settings["history_window_days"])
    burst_cutoff = current - timedelta(minutes=settings["burst_window_minutes"])
    return {
        "now": current,
        "recent_cutoff": recent_cutoff,
        "history_cutoff": history_cutoff,
        "burst_cutoff": burst_cutoff,
    }


def parse_json(payload: str | None) -> dict[str, Any]:
    if not payload:
        return {}
    try:
        decoded = json.loads(payload)
    except (TypeError, ValueError, json.JSONDecodeError):
        return {}
    return decoded if isinstance(decoded, dict) else {}


def clamp(value: float, minimum: float = 0.0, maximum: float = 1.0) -> float:
    return max(minimum, min(maximum, value))


def density_ratio(recent_count: int, history_count: int, *, recent_hours: int, history_days: int) -> float:
    if recent_count <= 0:
        return 0.0
    recent_window_days = max(recent_hours / 24.0, 0.0416)
    historical_window_days = max(float(history_days) - recent_window_days, 1.0)
    recent_density = recent_count / recent_window_days
    historical_density = history_count / historical_window_days
    if historical_density <= 0:
        return recent_density if recent_density > 0 else 0.0
    return recent_density / historical_density


def severity_for_modifier(modifier: float) -> str:
    if modifier >= 0.75:
        return "critical"
    if modifier >= 0.45:
        return "high"
    if modifier >= 0.20:
        return "medium"
    return "low"


async def sync_group_flag(
    db: AsyncSession,
    *,
    external_user_id: str,
    flag_type: str,
    should_open: bool,
    severity: str = "medium",
    related_device_id: str | None = None,
    related_visitor_id: str | None = None,
    evidence: dict[str, Any] | None = None,
    detected_at: datetime | None = None,
) -> AnomalyFlag | None:
    rows = (
        await db.execute(
            select(AnomalyFlag).where(
                AnomalyFlag.external_user_id == external_user_id,
                AnomalyFlag.flag_type == flag_type,
                AnomalyFlag.status == "open",
                AnomalyFlag.related_device_id.is_(related_device_id),
                AnomalyFlag.related_visitor_id.is_(related_visitor_id),
            )
        )
    ).scalars().all()

    if not should_open:
        for row in rows:
            row.status = "resolved"
            row.resolved_at = detected_at or datetime.now(timezone.utc)
        return None

    payload = json.dumps(evidence or {}, separators=(",", ":"), sort_keys=True)
    timestamp = detected_at or datetime.now(timezone.utc)
    if rows:
        primary = rows[0]
        primary.severity = severity
        primary.evidence = payload
        primary.detected_at = timestamp
        for duplicate in rows[1:]:
            duplicate.status = "resolved"
            duplicate.resolved_at = timestamp
        return primary

    flag = AnomalyFlag(
        id=str(uuid.uuid4()),
        external_user_id=external_user_id,
        flag_type=flag_type,
        severity=severity,
        status="open",
        related_device_id=related_device_id,
        related_visitor_id=related_visitor_id,
        evidence=payload,
        detected_at=timestamp,
    )
    db.add(flag)
    return flag
