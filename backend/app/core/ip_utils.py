"""
Real client IP extraction for deployments behind Cloudflare tunnel / reverse proxies.

Priority:
  1. CF-Connecting-IP  — set by Cloudflare, cannot be forged by end users
  2. X-Real-IP         — set by nginx/caddy upstream configs
  3. X-Forwarded-For   — first (leftmost) IP, set by generic proxies
  4. request.client.host — raw TCP peer (Docker internal IP when behind tunnel)
"""
from fastapi import Request


def get_client_ip(request: Request) -> str:
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
