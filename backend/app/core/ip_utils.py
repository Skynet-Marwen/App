"""
Real client IP extraction for deployments behind Cloudflare tunnel / reverse proxies.

Priority:
  1. CF-Connecting-IP  — set by Cloudflare, cannot be forged by end users
  2. X-Real-IP         — set by nginx/caddy upstream configs
  3. X-Forwarded-For   — first (leftmost) IP, set by generic proxies
  4. request.client.host — raw TCP peer (Docker internal IP when behind tunnel)
"""
import ipaddress

from fastapi import Request

from .deployment import trust_proxy_headers


def _peer_is_internal_proxy(request: Request) -> bool:
    host = request.client.host if request.client else ""
    if not host:
        return False
    try:
        candidate = ipaddress.ip_address(host)
    except ValueError:
        return False
    return candidate.is_private or candidate.is_loopback or candidate.is_link_local


def get_client_ip(request: Request) -> str:
    if trust_proxy_headers() or _peer_is_internal_proxy(request):
        cf_ip = request.headers.get("cf-connecting-ip", "").strip()
        if cf_ip:
            return cf_ip

        real_ip = request.headers.get("x-real-ip", "").strip()
        if real_ip:
            return real_ip

        forwarded = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        if forwarded:
            return forwarded

    return request.client.host if request.client else "unknown"
