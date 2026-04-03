from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.event import Event
from ..services.runtime_config import runtime_settings


_REQUEST_EVENT_TYPES = ("gateway_allow", "gateway_challenge", "gateway_block", "gateway_rate_limit")


def _parse_event_properties(raw: str | None) -> dict:
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
    except Exception:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _coerce_float(value: object) -> float | None:
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value.strip())
        except ValueError:
            return None
    return None


def _coerce_int(value: object) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value)
    if isinstance(value, str):
        try:
            return int(value.strip())
        except ValueError:
            return None
    return None


async def record_gateway_event(
    db: AsyncSession,
    *,
    decision: str,
    reason: str,
    request_id: str,
    latency_ms: float | int | None = None,
    request_path: str | None = None,
    method: str | None = None,
    upstream_status: int | None = None,
    site_id: str | None = None,
    challenge_type: str | None = None,
) -> None:
    event_type = f"gateway_{decision}"
    if event_type not in _REQUEST_EVENT_TYPES:
        return
    payload = {
        "decision": decision,
        "reason": reason,
        "request_id": request_id,
        "latency_ms": round(float(latency_ms), 2) if isinstance(latency_ms, (int, float)) else None,
        "request_path": request_path or None,
        "method": method or None,
        "upstream_status": upstream_status,
        "challenge_type": challenge_type or None,
    }
    db.add(
        Event(
            id=str(uuid.uuid4()),
            site_id=site_id,
            event_type=event_type,
            page_url=request_path[:2048] if request_path else None,
            properties=json.dumps(payload, separators=(",", ":"), sort_keys=True),
            created_at=datetime.now(timezone.utc),
        )
    )
    await db.flush()


async def record_gateway_challenge_result(
    db: AsyncSession,
    *,
    request_id: str | None,
    challenge_type: str,
    outcome: str,
    site_id: str | None = None,
) -> None:
    db.add(
        Event(
            id=str(uuid.uuid4()),
            site_id=site_id,
            event_type="gateway_challenge_result",
            properties=json.dumps(
                {
                    "request_id": request_id,
                    "challenge_type": challenge_type,
                    "outcome": outcome,
                },
                separators=(",", ":"),
                sort_keys=True,
            ),
            created_at=datetime.now(timezone.utc),
        )
    )
    await db.flush()


async def summarize_gateway_dashboard(
    db: AsyncSession,
    *,
    since: datetime,
    prev_since: datetime,
) -> dict:
    settings = runtime_settings()
    target_origin = str(settings.get("gateway_target_origin") or "").rstrip("/")
    configured = bool(settings.get("gateway_enabled")) and bool(target_origin)

    current_counts = await _count_events(db, since, None)
    previous_counts = await _count_events(db, prev_since, since)
    total_requests = sum(current_counts.values())
    previous_total = sum(previous_counts.values())

    gateway_allow_payloads = await _event_payloads(
        db,
        since=since,
        event_type="gateway_allow",
    )
    latencies = sorted(
        coerced
        for payload in gateway_allow_payloads
        for coerced in [_coerce_float(payload.get("latency_ms"))]
        if coerced is not None
    )
    avg_latency = round(sum(latencies) / len(latencies), 2) if latencies else None
    if latencies:
        p95_index = max(0, min(len(latencies) - 1, round((len(latencies) - 1) * 0.95)))
        p95_latency = round(float(latencies[p95_index]), 2)
    else:
        p95_latency = None

    challenge_breakdown = await _json_count(
        db,
        since=since,
        event_type="gateway_challenge_result",
        json_key="challenge_type",
    )
    challenge_outcomes = await _json_count(
        db,
        since=since,
        event_type="gateway_challenge_result",
        json_key="outcome",
    )
    top_reasons = await _json_count(
        db,
        since=since,
        event_type=None,
        json_key="reason",
        event_types=_REQUEST_EVENT_TYPES,
        limit=4,
    )

    upstream_errors = sum(
        1
        for payload in gateway_allow_payloads
        for status in [_coerce_int(payload.get("upstream_status"))]
        if status is not None and status >= 500
    )

    challenged = int(current_counts.get("gateway_challenge", 0))
    blocked = int(current_counts.get("gateway_block", 0))
    bot_percent = round(((challenged + blocked) / total_requests) * 100, 1) if total_requests else 0.0
    challenge_rate = round((challenged / total_requests) * 100, 1) if total_requests else 0.0
    upstream_error_rate = round((upstream_errors / total_requests) * 100, 1) if total_requests else 0.0

    return {
        "enabled": bool(settings.get("gateway_enabled")),
        "configured": configured,
        "target_origin": target_origin,
        "total_requests": total_requests,
        "request_change_pct": _safe_ratio(total_requests, previous_total),
        "bot_percent": bot_percent,
        "challenge_rate": challenge_rate,
        "avg_latency_ms": avg_latency,
        "p95_latency_ms": p95_latency,
        "upstream_error_rate": upstream_error_rate,
        "decision_totals": {
            "allow": int(current_counts.get("gateway_allow", 0)),
            "challenge": challenged,
            "block": blocked,
            "rate_limit": int(current_counts.get("gateway_rate_limit", 0)),
        },
        "challenge_outcomes": challenge_outcomes,
        "challenge_breakdown": challenge_breakdown,
        "top_reasons": top_reasons,
    }


async def _count_events(db: AsyncSession, start: datetime, end: datetime | None) -> dict[str, int]:
    query = select(Event.event_type, func.count()).where(
        Event.event_type.in_(_REQUEST_EVENT_TYPES),
        Event.created_at >= start,
    )
    if end is not None:
        query = query.where(Event.created_at < end)
    query = query.group_by(Event.event_type)
    result = await db.execute(query)
    return {row[0]: int(row[1]) for row in result.fetchall()}


async def _json_count(
    db: AsyncSession,
    *,
    since: datetime,
    event_type: str | None,
    json_key: str,
    event_types: tuple[str, ...] | None = None,
    limit: int = 8,
) -> list[dict]:
    payloads = await _event_payloads(
        db,
        since=since,
        event_type=event_type,
        event_types=event_types,
    )
    counts: dict[str, int] = {}
    for payload in payloads:
        value = payload.get(json_key)
        label = str(value).strip() if value not in (None, "") else "unknown"
        counts[label] = counts.get(label, 0) + 1
    ordered = sorted(counts.items(), key=lambda item: (-item[1], item[0]))
    return [{"label": label, "count": count} for label, count in ordered[:limit]]


async def _event_payloads(
    db: AsyncSession,
    *,
    since: datetime,
    event_type: str | None = None,
    event_types: tuple[str, ...] | None = None,
) -> list[dict]:
    query = select(Event.properties).where(Event.created_at >= since)
    if event_type:
        query = query.where(Event.event_type == event_type)
    elif event_types:
        query = query.where(Event.event_type.in_(event_types))
    else:
        return []
    rows = (await db.execute(query)).fetchall()
    return [_parse_event_properties(row[0]) for row in rows]


def _safe_ratio(current: int, previous: int) -> int:
    if previous <= 0:
        return 100 if current > 0 else 0
    return round(((current - previous) / previous) * 100)
