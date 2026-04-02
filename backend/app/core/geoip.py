"""
GeoIP lookup dispatcher.
Routes to the active provider stored in runtime settings:
  "ip-api"  — ip-api.com, free, Redis-cached 24 h (default)
  "local"   — local .mmdb file (offline, no rate limit)
  "none"    — disabled
"""

from ..services.runtime_config import runtime_settings


def _provider() -> str:
    _settings = runtime_settings()
    return _settings.get("geoip_provider", "ip-api")


async def lookup(ip: str) -> dict:
    """Return geo fields for an IP. Never raises — returns {} on any failure."""
    p = _provider()
    if p == "none":
        return {}
    if p == "local":
        from ..services.geoip_providers import lookup_local
        return lookup_local(ip)
    from ..services.geoip_providers import lookup_ipapi
    return await lookup_ipapi(ip)
