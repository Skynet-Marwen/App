from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text
from ...core.database import get_db
from ...core.security import get_current_user
from ...models.user import User
from ...models.visitor import Visitor
from ...models.blocking import BlockedIP, BlockingRule
from ...models.incident import Incident
from datetime import datetime, timedelta, timezone

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

    total_visitors = await db.scalar(select(func.count()).where(Visitor.first_seen >= since)) or 0
    total_blocked = await db.scalar(select(func.count(BlockedIP.ip))) or 0
    unique_users_result = await db.scalar(
        select(func.count(func.distinct(Visitor.linked_user))).where(
            Visitor.first_seen >= since, Visitor.linked_user.isnot(None)
        )
    ) or 0
    evasion_count = await db.scalar(
        select(func.count()).select_from(Incident).where(Incident.detected_at >= since)
    ) or 0

    # Mock traffic chart (replace with real aggregation)
    traffic_chart = []
    incidents_result = await db.execute(
        select(Incident).order_by(Incident.detected_at.desc()).limit(5)
    )
    incidents = incidents_result.scalars().all()
    recent_incidents = [
        {
            "id": i.id,
            "title": i.type,
            "severity": i.severity,
            "time": i.detected_at.strftime("%Y-%m-%d %H:%M"),
        }
        for i in incidents
    ]

    return {
        "total_visitors": total_visitors,
        "unique_users": unique_users_result,
        "total_devices": 0,
        "total_blocked": total_blocked,
        "evasion_attempts": evasion_count,
        "spam_detected": 0,
        "visitors_change": 0,
        "users_change": 0,
        "blocked_change": 0,
        "traffic_chart": traffic_chart,
        "top_countries": [],
        "blocking_chart": [],
        "recent_incidents": recent_incidents,
    }


@router.get("/realtime")
async def realtime(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    since = datetime.now(timezone.utc) - timedelta(minutes=5)
    active = await db.scalar(select(func.count()).where(Visitor.last_seen >= since)) or 0
    return {
        "active_visitors": active,
        "blocked_attempts_last_minute": 0,
        "suspicious_sessions": 0,
    }
