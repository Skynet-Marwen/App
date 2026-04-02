from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.event import Event
from ..services.runtime_config import runtime_settings


_REQUEST_EVENT_TYPES = ("gateway_allow", "gateway_challenge", "gateway_block")


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

    latency_sql = text(
        """
        SELECT
          AVG(NULLIF((CAST(properties AS jsonb)->>'latency_ms', '')::numeric)) AS avg_latency,
          PERCENTILE_CONT(0.95) WITHIN GROUP (
            ORDER BY NULLIF((CAST(properties AS jsonb)->>'latency_ms', '')::numeric)
          ) AS p95_latency
        FROM events
        WHERE event_type = 'gateway_allow' AND created_at >= :since
        """
    )
    avg_latency = None
    p95_latency = None
    try:
        latency_row = (await db.execute(latency_sql, {"since": since})).first()
        if latency_row:
            avg_latency = round(float(latency_row[0]), 2) if latency_row[0] is not None else None
            p95_latency = round(float(latency_row[1]), 2) if latency_row[1] is not None else None
    except Exception:
        avg_latency = None
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

    upstream_errors = await db.scalar(
        select(func.count()).select_from(Event).where(
            Event.event_type == "gateway_allow",
            Event.created_at >= since,
            text("COALESCE(NULLIF((CAST(properties AS jsonb)->>'upstream_status', '')::int, 0), 0) >= 500"),
        )
    ) or 0

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
    if event_type:
        where = "event_type = :event_type"
        params: dict[str, object] = {"since": since, "event_type": event_type, "limit": limit}
    elif event_types:
        quoted = ",".join(f"'{value}'" for value in event_types)
        where = f"event_type IN ({quoted})"
        params = {"since": since, "limit": limit}
    else:
        return []
    sql = text(
        f"""
        SELECT COALESCE(NULLIF(CAST(properties AS jsonb)->>'{json_key}', ''), 'unknown') AS label, COUNT(*) AS count
        FROM events
        WHERE {where} AND created_at >= :since
        GROUP BY 1
        ORDER BY count DESC, label ASC
        LIMIT :limit
        """
    )
    try:
        rows = (await db.execute(sql, params)).fetchall()
    except Exception:
        return []
    return [{"label": row[0], "count": int(row[1])} for row in rows]


def _safe_ratio(current: int, previous: int) -> int:
    if previous <= 0:
        return 100 if current > 0 else 0
    return round(((current - previous) / previous) * 100)
