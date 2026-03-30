from redis.asyncio import Redis, from_url
from .config import settings

_redis: Redis | None = None


def get_redis() -> Redis:
    global _redis
    if _redis is None:
        _redis = from_url(settings.REDIS_URL, decode_responses=True)
    return _redis


async def init_redis() -> None:
    try:
        await get_redis().ping()
    except Exception:
        # Fail lazy so startup still works in environments where Redis is not
        # immediately reachable; auth/session paths will surface real errors.
        pass


async def close_redis() -> None:
    global _redis
    if _redis is None:
        return
    await _redis.aclose()
    _redis = None
