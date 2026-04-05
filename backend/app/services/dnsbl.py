from __future__ import annotations

import asyncio
import ipaddress
import socket

from ..core.redis import get_redis


def _normalize_providers(value) -> list[str]:
    if isinstance(value, str):
        return [item.strip() for item in value.split(",") if item.strip()]
    if isinstance(value, (list, tuple, set)):
        return [str(item).strip() for item in value if str(item).strip()]
    return []


def _normalize_country_codes(value) -> set[str]:
    if isinstance(value, str):
        items = value.split(",")
    elif isinstance(value, (list, tuple, set)):
        items = value
    else:
        return set()
    normalized = set()
    for item in items:
        code = str(item or "").strip().upper()
        if code:
            normalized.add(code)
    return normalized


def _reverse_ipv4(ip: str) -> str | None:
    try:
        parsed = ipaddress.ip_address(ip)
    except ValueError:
        return None
    if parsed.version != 4 or parsed.is_private or parsed.is_loopback or parsed.is_reserved:
        return None
    return ".".join(reversed(ip.split(".")))


async def lookup_ip(ip: str | None, providers, ttl_sec: int = 900) -> dict:
    reverse_ip = _reverse_ipv4(str(ip or "").strip())
    provider_list = _normalize_providers(providers)
    if not reverse_ip or not provider_list:
        return {"listed": False, "providers": []}

    redis = get_redis()
    cache_key = f"dnsbl:{reverse_ip}:{','.join(provider_list)}"
    cached = await redis.get(cache_key)
    if cached == "0":
        return {"listed": False, "providers": []}
    if cached:
        listed = [item for item in cached.split(",") if item]
        return {"listed": bool(listed), "providers": listed}

    hits: list[str] = []
    for provider in provider_list:
        if await _is_listed(reverse_ip, provider):
            hits.append(provider)

    await redis.set(cache_key, ",".join(hits) if hits else "0", ex=max(int(ttl_sec or 900), 60))
    return {"listed": bool(hits), "providers": hits}


def should_soft_fail_dnsbl(country_code: str | None, config: dict | None = None) -> bool:
    code = str(country_code or "").strip().upper()
    if not code:
        return False
    config = config or {}
    return code in _normalize_country_codes(config.get("dnsbl_soft_fail_country_codes"))


async def _is_listed(reverse_ip: str, provider: str) -> bool:
    hostname = f"{reverse_ip}.{provider}"
    try:
        await asyncio.to_thread(socket.gethostbyname, hostname)
    except socket.gaierror:
        return False
    except Exception:
        return False
    return True
