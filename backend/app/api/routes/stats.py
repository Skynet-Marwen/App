from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text
from ...core.database import get_db
from ...core.security import get_current_user
from ...models.user import User
from ...models.visitor import Visitor
from ...models.device import Device
from ...models.blocking import BlockedIP, BlockingRule
from ...models.incident import Incident
from ...models.event import Event
from datetime import datetime, timedelta, timezone
import json

router = APIRouter(prefix="/stats", tags=["stats"])

RANGE_MAP = {"1h": 1/24, "24h": 1, "7d": 7, "30d": 30}


@router.get("/overview")
async def overview(
    time_range: str = Query("24h", alias="range"),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    days = RANGE_MAP.get(time_range, 1)
    since = datetime.now(timezone.utc) - timedelta(days=days)
    
    # Current period metrics
    total_visitors = await db.scalar(select(func.count(func.distinct(Visitor.id))).where(Visitor.first_seen >= since)) or 0
    total_blocked_entities = await db.scalar(select(func.count(BlockingRule.id))) or 0
    total_blocked_entities += await db.scalar(select(func.count(BlockedIP.ip))) or 0
    total_detected = await db.scalar(
        select(func.count()).select_from(Incident).where(Incident.detected_at >= since)
    ) or 0
    blocked_attempts = await db.scalar(
        select(func.sum(BlockedIP.hits)).select_from(BlockedIP)
    ) or 0
    unique_users = await db.scalar(
        select(func.count(func.distinct(Visitor.linked_user))).where(
            Visitor.first_seen >= since, Visitor.linked_user.isnot(None)
        )
    ) or 0
    
    # Count devices
    total_devices = await db.scalar(
        select(func.count(func.distinct(Visitor.device_id))).where(Visitor.first_seen >= since, Visitor.device_id.isnot(None))
    ) or 0

    # Blocked count: blocked IPs + blocked visitors + blocked devices
    blocked_ips_count = await db.scalar(select(func.count(BlockedIP.ip))) or 0
    blocked_visitors_count = await db.scalar(
        select(func.count(Visitor.id)).where(Visitor.status == "blocked")
    ) or 0
    blocked_devices_count = await db.scalar(
        select(func.count(Device.id)).where(Device.status == "blocked")
    ) or 0
    total_blocked = blocked_ips_count + blocked_visitors_count + blocked_devices_count
    
    # Evasion attempts from incidents
    evasion_attempts = await db.scalar(
        select(func.count()).select_from(Incident).where(Incident.detected_at >= since)
    ) or 0
    
    # Count spam/suspicious events
    spam_events = await db.scalar(
        select(func.count()).select_from(Event).where(
            Event.created_at >= since, 
            Event.event_type.in_(["spam", "suspicious"])
        )
    ) or 0
    
    # Previous period for comparison (7 days ago)
    prev_since = since - timedelta(days=days)
    prev_visitors = await db.scalar(
        select(func.count(func.distinct(Visitor.id))).where(
            Visitor.first_seen >= prev_since, Visitor.first_seen < since
        )
    ) or 1
    prev_detected = await db.scalar(
        select(func.count()).select_from(Incident).where(
            Incident.detected_at >= prev_since, Incident.detected_at < since
        )
    ) or 0
    prev_detected = prev_detected or 1
    
    # Calculate percentage changes
    visitors_change = round(((total_visitors - prev_visitors) / prev_visitors * 100)) if prev_visitors else 0
    blocked_change = round(((total_detected - prev_detected) / prev_detected * 100)) if prev_detected else 0
    
    # Traffic heatmap — dynamic bucketing by range
    _bucket_cfg = {
        '1h':  ("DATE_TRUNC('minute', created_at)",  60,  timedelta(minutes=1)),
        '24h': (
            "DATE_TRUNC('hour', created_at) + "
            "FLOOR(EXTRACT(MINUTE FROM created_at) / 15)::int * INTERVAL '15 minutes'",
            96, timedelta(minutes=15),
        ),
        '7d':  ("DATE_TRUNC('hour', created_at)", 168, timedelta(hours=1)),
        '30d': ("DATE_TRUNC('day',  created_at)",  30,  timedelta(days=1)),
    }
    bucket_expr, expected_count, bucket_delta = _bucket_cfg.get(
        time_range, ("DATE_TRUNC('hour', created_at)", 24, timedelta(hours=1))
    )

    # Align since to bucket boundary so fill-loop keys match SQL results
    if time_range == '1h':
        since_aligned = since.replace(second=0, microsecond=0)
    elif time_range == '24h':
        m = (since.minute // 15) * 15
        since_aligned = since.replace(minute=m, second=0, microsecond=0)
    elif time_range == '7d':
        since_aligned = since.replace(minute=0, second=0, microsecond=0)
    else:
        since_aligned = since.replace(hour=0, minute=0, second=0, microsecond=0)

    try:
        heatmap_sql = f"""
        SELECT {bucket_expr} AS bucket, COUNT(*) AS count
        FROM events
        WHERE created_at >= :since AND event_type = 'pageview'
        GROUP BY 1 ORDER BY 1
        """
        result = await db.execute(text(heatmap_sql), {"since": since_aligned})
        rows = result.fetchall()

        def _utc(dt):
            return dt.replace(tzinfo=timezone.utc) if dt and dt.tzinfo is None else dt

        buckets = {_utc(row[0]): row[1] for row in rows}
        traffic_heatmap, current = [], since_aligned
        for _ in range(expected_count):
            traffic_heatmap.append({
                'timestamp': current.strftime('%Y-%m-%d %H:%M:%S'),
                'count': buckets.get(current, 0),
            })
            current += bucket_delta
    except Exception:
        traffic_heatmap = []

    # Blocking chart - by incident type
    blocking_query = """
    SELECT type, COUNT(*) as count
    FROM incidents
    GROUP BY type
    ORDER BY count DESC
    LIMIT 10
    """
    try:
        result = await db.execute(text(blocking_query))
        rows = result.fetchall()
        blocking_chart = [
            {"reason": row[0], "count": row[1]}
            for row in rows
        ]
    except Exception:
        blocking_chart = []
    
    # Top countries by visitor count
    countries_result = await db.execute(
        select(
            Visitor.country,
            Visitor.country_flag,
            func.count(Visitor.id).label("cnt"),
        )
        .where(Visitor.first_seen >= since, Visitor.country.isnot(None))
        .group_by(Visitor.country, Visitor.country_flag)
        .order_by(func.count(Visitor.id).desc())
        .limit(10)
    )
    country_rows = countries_result.fetchall()
    country_total = sum(r[2] for r in country_rows) or 1
    top_countries = [
        {
            "country": r[0],
            "flag": r[1] or "",
            "count": r[2],
            "percent": round(r[2] / country_total * 100, 1),
        }
        for r in country_rows
    ]

    # Recent incidents
    incidents_result = await db.execute(
        select(Incident).order_by(Incident.detected_at.desc()).limit(5)
    )
    incidents = incidents_result.scalars().all()
    recent_incidents = [
        {
            "id": i.id,
            "title": i.type,
            "severity": i.severity,
            "time": i.detected_at.strftime("%H:%M"),
        }
        for i in incidents
    ]

    return {
        "total_visitors": total_visitors,
        "unique_users": unique_users,
        "total_devices": total_devices,
        "total_blocked": total_blocked,
        "evasion_attempts": evasion_attempts,
        "spam_detected": spam_events,
        "visitors_change": visitors_change,
        "users_change": 0,
        "blocked_change": blocked_change,
        "traffic_heatmap": traffic_heatmap,
        "top_countries": top_countries,
        "blocking_chart": blocking_chart,
        "recent_incidents": recent_incidents,
    }


@router.get("/realtime")
async def realtime(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    # Active visitors in last 5 minutes
    since_5m = datetime.now(timezone.utc) - timedelta(minutes=5)
    active = await db.scalar(
        select(func.count(func.distinct(Visitor.id))).where(Visitor.last_seen >= since_5m)
    ) or 0
    
    # Blocked attempts in last minute
    since_1m = datetime.now(timezone.utc) - timedelta(minutes=1)
    blocked_last_min = await db.scalar(
        select(func.count()).select_from(Event).where(
            Event.created_at >= since_1m,
            Event.ip.in_(select(BlockedIP.ip))
        )
    ) or 0
    
    # Suspicious sessions from incidents in last hour
    since_1h = datetime.now(timezone.utc) - timedelta(hours=1)
    suspicious_sessions = await db.scalar(
        select(func.count()).select_from(Incident).where(
            Incident.detected_at >= since_1h
        )
    ) or 0
    
    return {
        "active_visitors": active,
        "blocked_attempts_last_minute": blocked_last_min,
        "suspicious_sessions": suspicious_sessions,
    }
