from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import WebSocket, WebSocketException, status
from jose import JWTError
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.database import AsyncSessionLocal
from ..core.security import decode_token
from ..models.blocking import BlockedIP
from ..models.event import Event
from ..models.incident import Incident
from ..models.user import User
from ..models.visitor import Visitor
from .sessions import require_session, touch_session


async def get_realtime_snapshot(db: AsyncSession) -> dict[str, int]:
    since_5m = datetime.now(timezone.utc) - timedelta(minutes=5)
    active = await db.scalar(
        select(func.count(func.distinct(Visitor.id))).where(Visitor.last_seen >= since_5m)
    ) or 0

    since_1m = datetime.now(timezone.utc) - timedelta(minutes=1)
    blocked_last_min = await db.scalar(
        select(func.count()).select_from(Event).where(
            Event.created_at >= since_1m,
            Event.ip.in_(select(BlockedIP.ip)),
        )
    ) or 0

    since_1h = datetime.now(timezone.utc) - timedelta(hours=1)
    suspicious_sessions = await db.scalar(
        select(func.count()).select_from(Incident).where(Incident.detected_at >= since_1h)
    ) or 0

    return {
        "active_visitors": int(active),
        "blocked_attempts_last_minute": int(blocked_last_min),
        "suspicious_sessions": int(suspicious_sessions),
    }


async def authenticate_realtime_socket(websocket: WebSocket) -> User:
    token = (websocket.query_params.get("token") or "").strip()
    if not token:
        await websocket.close(code=4401)
        raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION)

    try:
        payload = decode_token(token)
        user_id = payload.get("sub")
        session_id = payload.get("sid")
        if not user_id or not session_id:
            raise ValueError("missing auth claims")
    except (JWTError, ValueError):
        await websocket.close(code=4401)
        raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION)

    await require_session(user_id, session_id)
    async with AsyncSessionLocal() as db:
        user = await db.get(User, user_id)
        if not user or user.status == "blocked":
            await websocket.close(code=4403)
            raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION)
    await touch_session(user_id, session_id)
    return user
