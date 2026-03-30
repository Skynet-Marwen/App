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
    
    # Traffic heatmap - dynamic bucketing based on range
    bucket_map = {
        '1h': ("'minute'", 60, timedelta(minutes=1)),
        '24h': ("'minute'::interval * 15", 96, timedelta(minutes=15)),
        '7d': ("'hour'", 168, timedelta(hours=1)),
        '30d': ("'day'", 30, timedelta(days=1)),
    }
    bucket_expr, expected_count, bucket_delta = bucket_map.get(range, ("'hour'", 24 * days, timedelta(hours=1)))
    
    traffic_query = f"""
    SELECT 
        DATE_TRUNC({bucket_expr}, created_at) as bucket,
        COUNT(*) as count
    FROM events
    WHERE created_at >= '{since}' AND event_type = 'pageview'
    GROUP BY DATE_TRUNC({bucket_expr}, created_at)
    ORDER BY bucket
    """
    try:
        result = await db.execute(sql_text(traffic_query))
        rows = result.fetchall()
        
        # Fill missing buckets with 0
        buckets = {}
        for row in rows:
            buckets[row[0]] = row[1]
        
        traffic_heatmap = []
        current = since
        for i in range(expected_count):
            count = buckets.get(current, 0)
            traffic_heatmap.append({
                'timestamp': current.strftime('%Y-%m-%d %H:%M:%S'),
                'count': count,
            })
            current += bucket_delta
        
    except Exception as e:
        traffic_heatmap = []
    
    # Keep old traffic_chart for backward compatibility
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
        "total_blocked": total_blocked,
        "evasion_attempts": evasion_attempts,
        "spam_detected": spam_events,
        "visitors_change": visitors_change,
        "users_change": 0,
        "blocked_change": blocked_change,
        "traffic_chart": traffic_chart,        "traffic_heatmap": traffic_heatmap,        "top_countries": [],
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
