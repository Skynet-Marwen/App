"""JWKS-based JWT validation for external identity provider tokens.

SKYNET uses this to validate tokens issued by an external identity provider.
This module is completely independent of SKYNET's own auth (JWT_SECRET / HS256).

Caching strategy:
- Public keys are cached in-process for KEYCLOAK_JWKS_CACHE_TTL_SEC seconds.
- If the IdP is unreachable and a cached key still exists, a grace period of
  JWKS_GRACE_PERIOD_SEC is used before returning 503.
- SKYNET admin routes are never affected by this validator.
"""
import logging
import time
from typing import Optional
from fastapi import HTTPException
import httpx
from jose import jwt, JWTError, ExpiredSignatureError
from .runtime_config import runtime_settings

_log = logging.getLogger("skynet.jwks")


_cache: dict = {
    "providers": {},
}

JWKS_GRACE_PERIOD_SEC = 600  # 10 min grace if IdP unreachable
def _settings_keycloak() -> dict:
    _settings = runtime_settings()
    return {
        "name": "keycloak",
        "enabled": _settings.get("keycloak_enabled", False),
        "jwks_url": _settings.get("keycloak_jwks_url", ""),
        "issuer": _settings.get("keycloak_issuer", ""),
        "audience": _settings.get("keycloak_audience", ""),
        "cache_ttl": int(_settings.get("keycloak_cache_ttl_sec", 300)),
    }


def _settings_idp_providers() -> list[dict]:
    _settings = runtime_settings()
    providers = []
    for raw in _settings.get("idp_providers", []):
        if not isinstance(raw, dict):
            continue
        providers.append(
            {
                "name": raw.get("name") or "provider",
                "enabled": bool(raw.get("enabled", True)),
                "jwks_url": raw.get("jwks_url", ""),
                "issuer": raw.get("issuer", ""),
                "audience": raw.get("audience", ""),
                "cache_ttl": int(raw.get("cache_ttl_sec") or raw.get("cache_ttl") or 300),
            }
        )
    legacy = _settings_keycloak()
    if legacy.get("jwks_url") and not any(item["name"] == legacy["name"] for item in providers):
        providers.append(legacy)
    return providers


async def _fetch_jwks(jwks_url: str) -> list:
    async with httpx.AsyncClient(timeout=5.0) as client:
        resp = await client.get(jwks_url)
        resp.raise_for_status()
        return resp.json().get("keys", [])


async def _get_keys(cfg: dict) -> list:
    now = time.time()
    ttl = cfg["cache_ttl"]
    cache = _cache["providers"].setdefault(cfg["jwks_url"], {"keys": None, "fetched_at": 0.0})
    if cache["keys"] and (now - cache["fetched_at"]) < ttl:
        return cache["keys"]
    try:
        keys = await _fetch_jwks(cfg["jwks_url"])
        cache["keys"] = keys
        cache["fetched_at"] = now
        return keys
    except Exception:
        if cache["keys"] and (now - cache["fetched_at"]) < ttl + JWKS_GRACE_PERIOD_SEC:
            return cache["keys"]
        raise HTTPException(
            status_code=503,
            detail={"code": "IDP_UNAVAILABLE", "message": "Identity provider unreachable"},
        )


def _provider_candidates(token: str, provider_hint: str | None = None) -> list[dict]:
    providers = [
        cfg for cfg in _settings_idp_providers()
        if cfg.get("enabled") and cfg.get("jwks_url")
    ]
    if not providers:
        raise HTTPException(
            status_code=400,
            detail={"code": "IDP_NOT_CONFIGURED", "message": "No external identity provider is configured"},
        )
    if provider_hint:
        matched = [cfg for cfg in providers if cfg["name"] == provider_hint]
        if not matched:
            raise HTTPException(
                status_code=400,
                detail={"code": "IDP_NOT_CONFIGURED", "message": f"Unknown identity provider '{provider_hint}'"},
            )
        return matched
    try:
        issuer = jwt.get_unverified_claims(token).get("iss")
    except Exception:
        issuer = None
    if issuer:
        matched = [cfg for cfg in providers if cfg.get("issuer") == issuer]
        if matched:
            return matched
    default_provider = runtime_settings().get("idp_default_provider", "")
    if default_provider:
        matched = [cfg for cfg in providers if cfg["name"] == default_provider]
        if matched:
            return matched
    return providers


async def validate_external_token(token: str, provider_hint: str | None = None) -> dict:
    """Validate an external JWT and return claims augmented with provider name."""
    providers = _provider_candidates(token, provider_hint=provider_hint)
    last_exc: Exception = Exception("No valid key found")

    # Extract unverified claims once for diagnostic logging
    try:
        unverified = jwt.get_unverified_claims(token)
        token_iss = unverified.get("iss", "<missing>")
        token_aud = unverified.get("aud", "<missing>")
        token_alg = jwt.get_unverified_header(token).get("alg", "<missing>")
    except Exception:
        token_iss = token_aud = token_alg = "<unparseable>"

    for cfg in providers:
        keys = await _get_keys(cfg)
        options = {"verify_aud": bool(cfg["audience"])}
        audience: Optional[str] = cfg["audience"] or None
        issuer: Optional[str] = cfg["issuer"] or None

        for key_data in keys:
            try:
                claims = jwt.decode(
                    token,
                    key_data,
                    algorithms=["RS256", "RS384", "RS512", "ES256", "ES384", "ES512"],
                    audience=audience,
                    issuer=issuer,
                    options=options,
                )
                claims["__skynet_id_provider"] = cfg["name"]
                return claims
            except ExpiredSignatureError:
                raise HTTPException(
                    status_code=401,
                    detail={"code": "TOKEN_EXPIRED", "message": "Token has expired"},
                )
            except JWTError as exc:
                last_exc = exc
                continue
            except Exception as exc:
                # Non-JWTError from key material processing (e.g. unsupported key type)
                _log.debug("Key processing error for provider %s kid=%s: %s", cfg["name"], key_data.get("kid"), exc)
                last_exc = exc
                continue

    _log.warning(
        "TOKEN_INVALID — provider(s) tried: %s | token iss=%r aud=%r alg=%r | last_error: %s",
        [c["name"] for c in providers],
        token_iss,
        token_aud,
        token_alg,
        last_exc,
    )
    raise HTTPException(
        status_code=401,
        detail={"code": "TOKEN_INVALID", "message": "Token signature is invalid"},
    )


def extract_bearer(authorization: Optional[str]) -> str:
    """Extract token string from 'Bearer <token>' header."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail={"code": "MISSING_TOKEN", "message": "Bearer token required"},
        )
    return authorization[7:]
