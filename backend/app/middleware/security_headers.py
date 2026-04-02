"""
HTTP security headers middleware.
Applied to every response. Values are conservative defaults for a
self-hosted dashboard + embeddable tracker combo.
"""
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.core.deployment import should_send_hsts


# Content-Security-Policy
# - dashboard: React SPA served by nginx (same origin)
# - tracker:   /tracker/* static files served by FastAPI StaticFiles
# - inline styles/scripts: Vite dev mode and Tailwind require 'unsafe-inline'
#   for styles; kept scoped to style-src only.
_CSP = (
    "default-src 'self'; "
    "script-src 'self' 'unsafe-inline'; "       # Vite/React bundles need this
    "style-src 'self' 'unsafe-inline'; "        # Tailwind inline styles
    "img-src 'self' data: blob:; "
    "font-src 'self' data:; "
    "connect-src 'self'; "
    "frame-ancestors 'none'; "
    "base-uri 'self'; "
    "form-action 'self'"
)

_HEADERS: dict[str, str] = {
    "X-Content-Type-Options":    "nosniff",
    "X-Frame-Options":           "DENY",
    "X-XSS-Protection":          "1; mode=block",
    "Referrer-Policy":           "strict-origin-when-cross-origin",
    "Permissions-Policy":        "geolocation=(), microphone=(), camera=()",
    "Content-Security-Policy":   _CSP,
}

_HSTS = "max-age=31536000; includeSubDomains"


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        for header, value in _HEADERS.items():
            response.headers[header] = value
        if should_send_hsts(request):
            response.headers["Strict-Transport-Security"] = _HSTS
        elif "strict-transport-security" in response.headers:
            del response.headers["Strict-Transport-Security"]
        return response
