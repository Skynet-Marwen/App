from urllib.parse import urlparse

from starlette.requests import Request

from .config import settings
from ..services.runtime_config import runtime_settings


def _runtime_settings() -> dict:
    return runtime_settings()


def public_base_url() -> str:
    base_url = (_runtime_settings().get("base_url") or settings.APP_BASE_URL or "").strip()
    return base_url.rstrip("/")


def https_mode() -> str:
    return (_runtime_settings().get("https_mode") or settings.APP_HTTPS_MODE or "off").strip().lower()


def trust_proxy_headers() -> bool:
    return bool(_runtime_settings().get("trust_proxy_headers", settings.APP_TRUST_PROXY_HEADERS))


def hsts_enabled() -> bool:
    return bool(_runtime_settings().get("hsts_enabled", settings.APP_HSTS_ENABLED))


def configured_public_host() -> str:
    parsed = urlparse(public_base_url())
    return (parsed.hostname or "").lower()


def request_host(request: Request) -> str:
    if trust_proxy_headers():
        forwarded = request.headers.get("x-forwarded-host", "").split(",")[0].strip()
        if forwarded:
            return forwarded.split(":")[0].lower()
    return (request.url.hostname or "").lower()


def request_scheme(request: Request) -> str:
    if trust_proxy_headers():
        forwarded = request.headers.get("x-forwarded-proto", "").split(",")[0].strip()
        if forwarded:
            return forwarded.lower()
    return request.url.scheme.lower()


def should_send_hsts(request: Request) -> bool:
    public_url = public_base_url()
    if not public_url or not hsts_enabled():
        return False
    if urlparse(public_url).scheme.lower() != "https":
        return False
    public_host = configured_public_host()
    if not public_host:
        return False
    return request_host(request) == public_host and request_scheme(request) == "https"
