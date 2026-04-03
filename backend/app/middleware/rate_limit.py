"""
Legacy slowapi limiter wiring.

The active request limits now live in Access & Network runtime settings and are
enforced centrally by AccessNetworkMiddleware. This module is retained for the
typed 429 handler and compatibility with any future decorator-based limits.
"""
from fastapi import Request
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from app.core.config import settings
from app.core.ip_utils import get_client_ip


def _real_client_ip(request: Request) -> str:
    return get_client_ip(request)


limiter = Limiter(
    key_func=_real_client_ip,
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
