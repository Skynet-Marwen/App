from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text
from ...core.database import get_db
from ...core.security import get_current_user
from ...models.user import User
from ...models.visitor import Visitor
from ...models.blocking import BlockedIP, BlockingRule
from ...models.incident import Incident
from ...models.event import Event
from datetime import datetime, timedelta, timezone
import json

router = APIRouter(prefix="/stats", tags=["stats"])

RANGE_MAP = {"1h": 1/24, "24h": 1, "7d": 7, "30d": 30}


@router.get("/overview")
async def overview(
    range: str = Query("24h"),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    days = RANGE_MAP.get(range, 1)
    since = datetime.now(timezone.utc) - timedelta(days=days)
    
    # Current period metrics
    total_visitors = await db.scalar(select(func.count(func.distinct(Visitor.id))).where(Visitor.first_seen >= since)) or 0
    total_blocked_entities = await db.scalar(select(func.count(BlockingRule.id))) or 0
    total_blocked_entities += await db.scalar(select(func.count(BlockedIP.ip))) or 0
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
    prev_blocked = await db.scalar(select(func.count(BlockingRule.id))) or 0
    prev_blocked += await db.scalar(select(func.count(BlockedIP.ip))) or 0
    prev_blocked = prev_blocked or 1
    
    # Calculate percentage changes
    visitors_change = round(((total_visitors - prev_visitors) / prev_visitors * 100)) if prev_visitors else 0
    blocked_change = round(((total_blocked_ips - prev_blocked) / prev_blocked * 100)) if prev_blocked else 0
    
    # Traffic chart - hourly aggregation
    from sqlalchemy import cast, String
    traffic_query = f"""
    SELECT 
        DATE_TRUNC('hour', created_at) as hour,
        COUNT(CASE WHEN event_type = 'pageview' THEN 1 END) as visitors,
        COALESCE(SUM(CASE WHEN ip IN (SELECT ip FROM blocked_ips) THEN 1 ELSE 0 END), 0) as blocked
    FROM events
    WHERE created_at >= '{since}'
    GROUP BY DATE_TRUNC('hour', created_at)
    ORDER BY hour
    """
    try:
        from sqlalchemy import text as sql_text
        result = await db.execute(sql_text(traffic_query))
        rows = result.fetchall()
        traffic_chart = [
            {
                "time": row[0].strftime("%H:%M") if row[0] else "",
                "visitors": row[1] or 0,
                "blocked": row[2] or 0,
            }
            for row in rows
        ]
    except:
        traffic_chart = []
    
    # Blocking chart - by incident type
    blocking_query = """
    SELECT type, COUNT(*) as count
    FROM incidents
    GROUP BY type
    ORDER BY count DESC
    LIMIT 10
    """
    try:
        result = await db.execute(sql_text(blocking_query))
        rows = result.fetchall()
        blocking_chart = [
            {"reason": row[0], "count": row[1]}
            for row in rows
        ]
    except:
        blocking_chart = []
    
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
        "total_blocked": total_blocked_entities,
        "evasion_attempts": evasion_attempts,
        "spam_detected": spam_events,
        "visitors_change": visitors_change,
        "users_change": 0,
        "blocked_change": blocked_change,
        "traffic_chart": traffic_chart,
        "top_countries": [],
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
