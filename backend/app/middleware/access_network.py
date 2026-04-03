from __future__ import annotations

import ipaddress
import time
from urllib.parse import urlsplit

from fastapi.responses import JSONResponse, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from ..core.deployment import request_host
from ..core.database import AsyncSessionLocal
from ..core.ip_utils import get_client_ip
from ..core.redis import get_redis
from ..models.site import Site
from ..services.runtime_config import runtime_settings
from sqlalchemy import select

_DEFAULT_ALLOW_METHODS = "GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD"


def _string_list(value) -> list[str]:
    if isinstance(value, list):
        items = value
    elif isinstance(value, str):
        items = value.replace("\r", "\n").replace(",", "\n").split("\n")
    else:
        items = []
    return [str(item).strip() for item in items if str(item).strip()]


def _match_host_pattern(host: str, pattern: str) -> bool:
    normalized = pattern.lower().strip()
    if not normalized:
        return False
    if normalized == "*":
        return True
    if normalized.startswith("*."):
        suffix = normalized[1:]
        return host.endswith(suffix) and host != suffix[1:]
    return host == normalized


def _host_allowed(host: str, patterns: list[str]) -> bool:
    if not patterns or not host:
        return True
    return any(_match_host_pattern(host, pattern) for pattern in patterns)


def _origin_allowed(origin: str, allowed_origins: list[str]) -> bool:
    if not origin:
        return False
    if not allowed_origins or "*" in allowed_origins:
        return True
    parsed = urlsplit(origin)
    if not parsed.scheme or not parsed.netloc or not parsed.hostname:
        return False
    normalized_origin = f"{parsed.scheme.lower()}://{parsed.netloc.lower()}"
    host = parsed.hostname.lower()
    for allowed in allowed_origins:
        candidate = allowed.strip()
        if not candidate:
            continue
        if candidate == normalized_origin:
            return True
        if "://" in candidate:
            allowed_parts = urlsplit(candidate)
            wildcard_host = (allowed_parts.hostname or "").lower()
            if wildcard_host.startswith("*.") and parsed.scheme.lower() == allowed_parts.scheme.lower():
                if _match_host_pattern(host, wildcard_host):
                    return True
        elif _match_host_pattern(host, candidate):
            return True
    return False


def _access_control_allow_origin(origin: str, allowed_origins: list[str], allow_credentials: bool) -> str | None:
    if not origin or not _origin_allowed(origin, allowed_origins):
        return None
    if "*" in allowed_origins and not allow_credentials:
        return "*"
    return origin


def _cors_headers(request: Request, settings: dict) -> dict[str, str]:
    origin = (request.headers.get("origin") or "").strip()
    allowed_origins = _string_list(settings.get("cors_allowed_origins") or ["*"])
    allow_credentials = bool(settings.get("cors_allow_credentials", True))
    allow_origin = _access_control_allow_origin(origin, allowed_origins, allow_credentials)
    if not allow_origin:
        return {}

    methods = _string_list(settings.get("cors_allowed_methods") or ["*"])
    headers = _string_list(settings.get("cors_allowed_headers") or ["*"])
    request_method = (request.headers.get("access-control-request-method") or "").upper().strip()
    request_headers = (request.headers.get("access-control-request-headers") or "").strip()

    allow_methods = request_method if "*" in methods and request_method else (_DEFAULT_ALLOW_METHODS if "*" in methods else ", ".join(methods))
    allow_headers = request_headers if "*" in headers and request_headers else ("*" if "*" in headers else ", ".join(headers))

    response_headers = {
        "Access-Control-Allow-Origin": allow_origin,
        "Access-Control-Allow-Methods": allow_methods,
        "Access-Control-Allow-Headers": allow_headers,
        "Access-Control-Max-Age": "600",
        "Vary": "Origin, Access-Control-Request-Method, Access-Control-Request-Headers",
    }
    if allow_credentials:
        response_headers["Access-Control-Allow-Credentials"] = "true"
    return response_headers


def _tracker_site_key(request: Request) -> str:
    for candidate in (
        request.query_params.get("key"),
        request.query_params.get("site_key"),
        request.headers.get("x-skynet-key"),
        request.headers.get("x-site-key"),
    ):
        if candidate and str(candidate).strip():
            return str(candidate).strip()
    return ""


def _origin_from_url(url: str | None) -> str | None:
    if not url:
        return None
    parsed = urlsplit(str(url).strip())
    if not parsed.scheme or not parsed.netloc:
        return None
    return f"{parsed.scheme.lower()}://{parsed.netloc.lower()}"


async def _tracker_allowed_origin(request: Request) -> str | None:
    path = request.url.path or ""
    if not (path.startswith("/api/v1/track/") or path == "/api/v1/identity/link"):
        return None

    site_key = _tracker_site_key(request)
    if not site_key:
        return None

    async with AsyncSessionLocal() as db:
        site = await db.scalar(select(Site).where(Site.api_key == site_key, Site.active == True))
        if not site:
            return None
        return _origin_from_url(site.url)


async def _resolved_cors_headers(request: Request, settings: dict) -> dict[str, str]:
    origin = (request.headers.get("origin") or "").strip()
    if not origin:
        return {}

    headers = _cors_headers(request, settings)
    if headers:
        return headers

    tracker_origin = await _tracker_allowed_origin(request)
    if not tracker_origin:
        return {}

    if origin.lower() != tracker_origin:
        return {}

    merged_settings = dict(settings)
    allowed = _string_list(merged_settings.get("cors_allowed_origins") or [])
    allowed.append(tracker_origin)
    merged_settings["cors_allowed_origins"] = allowed
    return _cors_headers(request, merged_settings)


def _network_list_match(ip: str, entries: list[str]) -> bool:
    try:
        candidate = ipaddress.ip_address(ip)
    except ValueError:
        return False
    for entry in entries:
        try:
            if "/" in entry:
                if candidate in ipaddress.ip_network(entry, strict=False):
                    return True
            elif candidate == ipaddress.ip_address(entry):
                return True
        except ValueError:
            continue
    return False


def _scope_limit(path: str, settings: dict) -> tuple[str, int]:
    if path == "/api/v1/auth/login":
        return "auth_login", max(int(settings.get("rate_limit_auth_login_per_minute") or 10), 1)
    if path.startswith("/api/v1/auth/"):
        return "auth", max(int(settings.get("rate_limit_auth_per_minute") or 30), 1)
    if path.startswith("/api/v1/integration/") or path.startswith("/api/v1/settings/integrations"):
        return "integration", max(int(settings.get("rate_limit_integration_per_minute") or 120), 1)
    if path.startswith("/api/v1/track/"):
        return "track", max(int(settings.get("rate_limit_track_per_minute") or 200), 1)
    return "default", max(int(settings.get("rate_limit_default_per_minute") or 300), 1)


class AccessNetworkMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        settings = runtime_settings()
        host = request_host(request)
        allowed_domains = _string_list(settings.get("allowed_domains") or [])
        if not _host_allowed(host, allowed_domains):
            return JSONResponse(status_code=400, content={"detail": "Host is not allowed", "code": "HOST_NOT_ALLOWED"})

        client_ip = get_client_ip(request)
        allowlist = _string_list(settings.get("network_ip_allowlist") or [])
        denylist = _string_list(settings.get("network_ip_denylist") or [])
        if _network_list_match(client_ip, denylist):
            return JSONResponse(status_code=403, content={"detail": "Your IP is denied by access policy", "code": "IP_DENIED"})
        if allowlist and not _network_list_match(client_ip, allowlist):
            return JSONResponse(status_code=403, content={"detail": "Your IP is not allowed by access policy", "code": "IP_NOT_ALLOWED"})

        if request.method.upper() != "OPTIONS":
            limited = await self._enforce_rate_limit(request, settings, client_ip)
            if limited is not None:
                return limited

        origin = (request.headers.get("origin") or "").strip()
        preflight = request.method.upper() == "OPTIONS" and origin and request.headers.get("access-control-request-method")
        if preflight:
            headers = await _resolved_cors_headers(request, settings)
            if not headers:
                return JSONResponse(status_code=403, content={"detail": "Origin is not allowed", "code": "CORS_DENIED"})
            return Response(status_code=204, headers=headers)

        response = await call_next(request)
        headers = await _resolved_cors_headers(request, settings)
        for key, value in headers.items():
            response.headers[key] = value
        return response

    async def _enforce_rate_limit(self, request: Request, settings: dict, client_ip: str) -> JSONResponse | None:
        redis = get_redis()
        scope, limit = _scope_limit(request.url.path, settings)
        bucket = int(time.time() // 60)
        cache_key = f"rate-limit:{scope}:{client_ip}:{bucket}"
        try:
            current = await redis.incr(cache_key)
            if current == 1:
                await redis.expire(cache_key, 65)
        except Exception:
            return None
        if current <= limit:
            return None
        retry_after = max(1, 60 - (int(time.time()) % 60))
        return JSONResponse(
            status_code=429,
            headers={"Retry-After": str(retry_after)},
            content={
                "detail": f"Rate limit exceeded for {scope}. Try again later.",
                "code": "RATE_LIMITED",
            },
        )
