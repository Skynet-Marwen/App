import ipaddress
from urllib.parse import urlsplit

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from ...core.database import get_db
from ...core.security import get_current_user, require_superadmin_user
from ...models.user import User
from ...models.block_page_config import BlockPageConfig
from ...services.audit import log_action, request_ip
from ...services.sanitize import clean_optional_text, clean_text, clean_url
from ...services.runtime_config import (
    load_runtime_settings,
    runtime_settings,
    update_runtime_settings,
)

router = APIRouter(prefix="/settings", tags=["settings"])

_settings = runtime_settings()

_MASKED = "••••••••"


def _coerce_list(raw) -> list[str]:
    if isinstance(raw, list):
        values = raw
    elif isinstance(raw, str):
        values = raw.replace("\r", "\n").replace(",", "\n").split("\n")
    else:
        values = []
    return [clean_text(str(item)) for item in values if clean_text(str(item))]


def _clean_domain_list(raw) -> list[str]:
    cleaned: list[str] = []
    for value in _coerce_list(raw):
        candidate = value.lower()
        if candidate.startswith(("http://", "https://")):
            parsed = urlsplit(candidate)
            candidate = (parsed.hostname or "").lower()
        if candidate.startswith("*."):
            base = candidate[2:]
            if not base or "." not in base:
                continue
            cleaned.append(f"*.{base}")
            continue
        if "." in candidate or candidate == "localhost":
            cleaned.append(candidate)
    return list(dict.fromkeys(cleaned))


def _clean_cors_origins(raw) -> list[str]:
    cleaned: list[str] = []
    for value in _coerce_list(raw):
        if value == "*":
            cleaned.append("*")
            continue
        try:
            origin = clean_url(value)
        except ValueError:
            continue
        parsed = urlsplit(origin)
        normalized = f"{parsed.scheme.lower()}://{parsed.netloc.lower()}"
        cleaned.append(normalized)
    return list(dict.fromkeys(cleaned or ["*"]))


def _clean_cors_tokens(raw, *, uppercase: bool = False) -> list[str]:
    cleaned: list[str] = []
    for value in _coerce_list(raw):
        token = value.upper() if uppercase else value
        cleaned.append(token)
    return list(dict.fromkeys(cleaned or ["*"]))


def _clean_ip_networks(raw) -> list[str]:
    cleaned: list[str] = []
    for value in _coerce_list(raw):
        try:
            network = ipaddress.ip_network(value, strict=False)
        except ValueError:
            try:
                network = ipaddress.ip_network(f"{ipaddress.ip_address(value)}/{32 if ':' not in value else 128}", strict=False)
            except ValueError:
                continue
        if network.prefixlen in {32, 128}:
            cleaned.append(str(network.network_address))
        else:
            cleaned.append(str(network))
    return list(dict.fromkeys(cleaned))


def _clean_idp_provider(raw: dict) -> dict | None:
    if not isinstance(raw, dict):
        return None
    name = clean_text(str(raw.get("name", "")))
    if not name:
        return None
    return {
        "name": name,
        "enabled": bool(raw.get("enabled", True)),
        "jwks_url": clean_url(raw.get("jwks_url")) or "",
        "issuer": clean_url(raw.get("issuer")) or "",
        "audience": clean_optional_text(raw.get("audience")) or "",
        "cache_ttl_sec": int(raw.get("cache_ttl_sec") or raw.get("cache_ttl") or 300),
    }


def _clean_notification_event_matrix(raw: dict) -> dict:
    if not isinstance(raw, dict):
        return {}
    cleaned: dict = {}
    for key, value in raw.items():
        if not isinstance(value, dict):
            continue
        event_key = clean_text(str(key)).lower().replace(" ", "_")
        if not event_key:
            continue
        cleaned[event_key] = {
            "label": clean_text(str(value.get("label", event_key.replace("_", " ").title()))),
            "webhook": bool(value.get("webhook")),
            "smtp": bool(value.get("smtp")),
            "escalate": bool(value.get("escalate")),
        }
    return cleaned


def _clean_feature_flags(raw: dict) -> dict:
    if not isinstance(raw, dict):
        return {}
    cleaned: dict[str, bool] = {}
    for key, value in raw.items():
        flag = clean_text(str(key)).lower().replace(" ", "_")
        if not flag:
            continue
        cleaned[flag] = bool(value)
    return cleaned


def _clean_ui_visibility(raw: dict) -> dict:
    if not isinstance(raw, dict):
        return {}
    cleaned: dict[str, dict[str, bool]] = {}
    for group, entries in raw.items():
        group_key = clean_text(str(group)).lower().replace(" ", "_")
        if not group_key or not isinstance(entries, dict):
            continue
        cleaned[group_key] = {}
        for key, value in entries.items():
            entry_key = clean_text(str(key)).lower().replace(" ", "_").replace("_-_", "-")
            if not entry_key:
                continue
            cleaned[group_key][entry_key] = bool(value)
    return cleaned

@router.get("")
async def get_settings(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    await load_runtime_settings(db)
    _enc = {
        "smtp_password_enc",
        "https_letsencrypt_dns_api_token_enc",
        "keycloak_sync_client_secret_enc",
        "keycloak_sync_password_enc",
        "integration_siem_secret_enc",
        "integration_monitoring_secret_enc",
        "webhook_secret_enc",
    }
    result = {k: v for k, v in _settings.items() if k not in _enc}
    result["smtp_password"] = _MASKED if _settings.get("smtp_password_enc") else ""
    result["https_letsencrypt_dns_api_token"] = _MASKED if _settings.get("https_letsencrypt_dns_api_token_enc") else ""
    result["keycloak_sync_client_secret"] = _MASKED if _settings.get("keycloak_sync_client_secret_enc") else ""
    result["keycloak_sync_password"] = _MASKED if _settings.get("keycloak_sync_password_enc") else ""
    result["integration_siem_secret"] = _MASKED if _settings.get("integration_siem_secret_enc") else ""
    result["integration_monitoring_secret"] = _MASKED if _settings.get("integration_monitoring_secret_enc") else ""
    result["webhook_secret"] = _MASKED if _settings.get("webhook_secret_enc") else ""
    return result


@router.put("")
async def update_settings(data: dict, request: Request, db: AsyncSession = Depends(get_db), current: User = Depends(require_superadmin_user)):
    from ...services.email import encrypt_password
    cleaned = {}
    try:
        for key, value in data.items():
            if key == "https_letsencrypt_dns_api_token":
                if value == _MASKED:
                    continue
                cleaned["https_letsencrypt_dns_api_token_enc"] = encrypt_password(value) if value else ""
                continue
            if key in {"keycloak_sync_client_secret", "keycloak_sync_password"}:
                if value == _MASKED:
                    continue
                cleaned[f"{key}_enc"] = encrypt_password(value) if value else ""
                continue
            if key in {"integration_siem_secret", "integration_monitoring_secret"}:
                if value == _MASKED:
                    continue
                cleaned[f"{key}_enc"] = encrypt_password(value) if value else ""
                continue
            if key == "webhook_secret":
                if value == _MASKED:
                    continue
                cleaned["webhook_secret_enc"] = encrypt_password(value) if value else ""
                continue
            if key == "idp_providers" and isinstance(value, list):
                cleaned[key] = [provider for provider in (_clean_idp_provider(item) for item in value) if provider]
                continue
            if key == "notification_event_matrix":
                cleaned[key] = _clean_notification_event_matrix(value)
                cleaned["webhook_events"] = {
                    f"on_{event_key}": bool(event_config.get("webhook"))
                    for event_key, event_config in cleaned[key].items()
                }
                continue
            if key == "feature_flags":
                cleaned[key] = _clean_feature_flags(value)
                continue
            if key == "ui_visibility":
                cleaned[key] = _clean_ui_visibility(value)
                continue
            if key == "allowed_domains":
                cleaned[key] = _clean_domain_list(value)
                continue
            if key == "cors_allowed_origins":
                cleaned[key] = _clean_cors_origins(value)
                continue
            if key == "cors_allowed_methods":
                cleaned[key] = _clean_cors_tokens(value, uppercase=True)
                continue
            if key == "cors_allowed_headers":
                cleaned[key] = _clean_cors_tokens(value)
                continue
            if key in {"network_ip_allowlist", "network_ip_denylist"}:
                cleaned[key] = _clean_ip_networks(value)
                continue
            if key in {
                "rate_limit_default_per_minute",
                "rate_limit_track_per_minute",
                "rate_limit_auth_per_minute",
                "rate_limit_auth_login_per_minute",
                "rate_limit_integration_per_minute",
                "response_slowdown_retry_after_sec",
            }:
                cleaned[key] = max(int(value or 1), 1)
                continue
            if key in {"integration_siem_events", "integration_monitoring_events"}:
                cleaned[key] = _coerce_list(value)
                continue
            if isinstance(value, str):
                if key in {
                    "base_url",
                    "webhook_url",
                    "keycloak_jwks_url",
                    "keycloak_issuer",
                    "keycloak_sync_base_url",
                    "gateway_target_origin",
                    "integration_siem_url",
                    "integration_monitoring_url",
                }:
                    cleaned[key] = clean_url(value) or ""
                else:
                    cleaned[key] = clean_text(value)
            else:
                cleaned[key] = value
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    await update_runtime_settings(db, cleaned)
    log_action(db, action="CONFIG_CHANGE", actor_id=current.id, target_type="settings", target_id="general", ip=request_ip(request), extra={"updated_keys": sorted(cleaned.keys())})
    await db.commit()
    return await get_settings(db, current)


@router.get("/block-page")
async def get_block_page(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    cfg = await db.get(BlockPageConfig, 1)
    if not cfg:
        return {
            "title": "ACCESS RESTRICTED", "subtitle": "Your access to this site has been blocked.",
            "message": "This action was taken automatically for security reasons.",
            "bg_color": "#050505", "accent_color": "#ef4444",
            "logo_url": None, "contact_email": None, "show_request_id": True, "show_contact": True,
        }
    return {
        "title": cfg.title, "subtitle": cfg.subtitle, "message": cfg.message,
        "bg_color": cfg.bg_color, "accent_color": cfg.accent_color,
        "logo_url": cfg.logo_url, "contact_email": cfg.contact_email,
        "show_request_id": cfg.show_request_id, "show_contact": cfg.show_contact,
    }


@router.put("/block-page")
async def update_block_page(data: dict, request: Request, db: AsyncSession = Depends(get_db), current: User = Depends(require_superadmin_user)):
    allowed = {"title", "subtitle", "message", "bg_color", "accent_color", "logo_url", "contact_email", "show_request_id", "show_contact"}
    data = {k: v for k, v in data.items() if k in allowed}
    cleaned = {}
    try:
        for key, value in data.items():
            if key == "logo_url":
                cleaned[key] = clean_url(value)
            elif key == "contact_email":
                cleaned[key] = clean_optional_text(value)
            elif isinstance(value, str):
                cleaned[key] = clean_text(value)
            else:
                cleaned[key] = value
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    cfg = await db.get(BlockPageConfig, 1)
    if not cfg:
        cfg = BlockPageConfig(id=1, **cleaned)
        db.add(cfg)
    else:
        for k, v in cleaned.items():
            setattr(cfg, k, v)
    log_action(db, action="CONFIG_CHANGE", actor_id=current.id, target_type="settings", target_id="block-page", ip=request_ip(request), extra={"updated_keys": sorted(cleaned.keys())})
    await db.commit()
    return {"ok": True}
