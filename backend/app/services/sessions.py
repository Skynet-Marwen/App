from datetime import datetime, timezone
from fastapi import HTTPException
from ..core.config import settings
from ..core.redis import get_redis


def _session_key(user_id: str, session_id: str) -> str:
    return f"session:{user_id}:{session_id}"


def _user_sessions_key(user_id: str) -> str:
    return f"user:{user_id}:sessions"


async def create_session(user_id: str, session_id: str, ip: str | None, user_agent: str | None) -> None:
    redis = get_redis()
    now = datetime.now(timezone.utc).isoformat()
    ttl = settings.JWT_EXPIRE_MINUTES * 60
    await redis.hset(
        _session_key(user_id, session_id),
        mapping={
            "id": session_id,
            "user_id": user_id,
            "ip": ip or "",
            "device": user_agent or "",
            "created_at": now,
            "last_active": now,
        },
    )
    await redis.expire(_session_key(user_id, session_id), ttl)
    await redis.sadd(_user_sessions_key(user_id), session_id)
    await redis.expire(_user_sessions_key(user_id), ttl)


async def require_session(user_id: str, session_id: str) -> dict:
    session = await get_redis().hgetall(_session_key(user_id, session_id))
    if not session:
        raise HTTPException(status_code=401, detail="Session expired or revoked")
    return session


async def touch_session(user_id: str, session_id: str) -> None:
    await get_redis().hset(
        _session_key(user_id, session_id),
        mapping={"last_active": datetime.now(timezone.utc).isoformat()},
    )


async def revoke_session(user_id: str, session_id: str) -> None:
    redis = get_redis()
    await redis.delete(_session_key(user_id, session_id))
    await redis.srem(_user_sessions_key(user_id), session_id)


async def revoke_all_sessions(user_id: str) -> None:
    redis = get_redis()
    session_ids = await redis.smembers(_user_sessions_key(user_id))
    if session_ids:
        await redis.delete(*[_session_key(user_id, session_id) for session_id in session_ids])
    await redis.delete(_user_sessions_key(user_id))


async def list_sessions(user_id: str) -> list[dict]:
    redis = get_redis()
    session_ids = sorted(await redis.smembers(_user_sessions_key(user_id)))
    items = []
    for session_id in session_ids:
        data = await redis.hgetall(_session_key(user_id, session_id))
        if not data:
            await redis.srem(_user_sessions_key(user_id), session_id)
            continue
        items.append(
            {
                "id": data.get("id", session_id),
                "ip": data.get("ip") or "—",
                "device": data.get("device") or "Unknown device",
                "created_at": data.get("created_at"),
                "last_active": data.get("last_active"),
            }
        )
    return sorted(items, key=lambda item: item.get("last_active") or "", reverse=True)
