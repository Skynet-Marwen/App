"""
GeoIP provider implementations.
  A: ip-api.com  — free, no token, HTTP, Redis-cached 24 h per IP
  B: local .mmdb — geoip2 reader, fully offline, no rate limit
"""
import json
import httpx
import geoip2.database
import geoip2.errors
from ..core.config import settings as cfg
from ..core.redis import get_redis

_IPAPI_URL = "http://ip-api.com/json/{ip}?fields=status,country,countryCode,city,timezone,isp,org,as,hosting,proxy"
_CACHE_TTL = 86400  # 24 h

# --- local reader state (reset after mmdb upload) ---
_reader: geoip2.database.Reader | None = None
_reader_loaded: bool = False


def _flag(code: str) -> str:
    if not code or len(code) != 2:
        return ""
    code = code.upper()
    return chr(0x1F1E6 + ord(code[0]) - 65) + chr(0x1F1E6 + ord(code[1]) - 65)


def reset_local_reader() -> None:
    """Call after a new .mmdb file is uploaded."""
    global _reader, _reader_loaded
    _reader = None
    _reader_loaded = False


def _get_local_reader() -> geoip2.database.Reader | None:
    global _reader, _reader_loaded
    if _reader_loaded:
        return _reader
    _reader_loaded = True
    try:
        _reader = geoip2.database.Reader(cfg.GEOIP_DB_PATH)
    except Exception:
        _reader = None
    return _reader


async def lookup_ipapi(ip: str) -> dict:
    """ip-api.com lookup — Redis cache hit avoids the HTTP call."""
    redis = get_redis()
    cache_key = f"geoip:{ip}"
    try:
        cached = await redis.get(cache_key)
        if cached:
            return json.loads(cached)
    except Exception:
        pass

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(_IPAPI_URL.format(ip=ip))
            data = r.json()
    except Exception:
        return {}

    if data.get("status") != "success":
        return {}

    code = data.get("countryCode", "")
    result = {
        "country": data.get("country", ""),
        "country_code": code,
        "country_flag": _flag(code),
        "city": data.get("city", ""),
        "timezone": data.get("timezone", "") or "",
        "isp": data.get("isp", "") or "",
        "org": data.get("org", "") or "",
        "as": data.get("as", "") or "",
        "hosting": bool(data.get("hosting")),
        "proxy": bool(data.get("proxy")),
    }
    try:
        await redis.setex(cache_key, _CACHE_TTL, json.dumps(result))
    except Exception:
        pass
    return result


def lookup_local(ip: str) -> dict:
    """Local .mmdb lookup — synchronous, fast (disk read)."""
    reader = _get_local_reader()
    if reader is None:
        return {}
    try:
        record = reader.city(ip)
        code = record.country.iso_code or ""
        return {
            "country": record.country.name or "",
            "country_code": code,
            "country_flag": _flag(code),
            "city": record.city.name or "",
            "timezone": record.location.time_zone or "",
            "isp": "",
            "org": "",
            "as": "",
            "hosting": False,
            "proxy": False,
        }
    except Exception:
        return {}
