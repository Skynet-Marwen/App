"""
Password reset token service — Redis-backed, 24-hour single-use tokens.

Flow:
  1. generate_reset_token(user_id) → opaque token stored in Redis with 24h TTL
  2. consume_reset_token(token)    → returns user_id and deletes the key atomically
                                     returns None if token is invalid or expired
"""
import secrets
from ..core.redis import get_redis

_TTL = 86_400  # 24 hours in seconds


def _key(token: str) -> str:
    return f"pwreset:{token}"


async def generate_reset_token(user_id: str) -> str:
    """Generate a cryptographically secure single-use reset token."""
    token = secrets.token_urlsafe(32)
    await get_redis().set(_key(token), user_id, ex=_TTL)
    return token


async def consume_reset_token(token: str) -> str | None:
    """
    Validate and atomically consume a reset token.
    Returns user_id string if valid, None if expired or not found.
    Uses a pipeline so the token cannot be used twice even under concurrency.
    """
    redis = get_redis()
    key = _key(token)
    pipe = redis.pipeline()
    pipe.get(key)
    pipe.delete(key)
    results = await pipe.execute()
    return results[0]  # bytes or None; caller decodes
