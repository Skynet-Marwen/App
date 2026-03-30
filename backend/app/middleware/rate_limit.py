"""
Rate limiting — Redis-backed sliding window via slowapi + limits.

Limits (per CLAUDE.md §8):
  /api/v1/track/*       200 req / minute / IP
  /api/v1/auth/login     10 req / minute / IP
  /api/v1/auth/*         30 req / minute / IP
  All other routes      300 req / minute / IP (default)
"""
from fastapi import Request
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from app.core.config import settings

limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["300/minute"],
    storage_uri=settings.REDIS_URL,
)


def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    return JSONResponse(
        status_code=429,
        content={
            "detail": f"Rate limit exceeded: {exc.detail}. Try again later.",
            "code": "RATE_LIMITED",
        },
    )
