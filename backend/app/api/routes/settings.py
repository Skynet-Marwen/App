from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from ...core.database import get_db
from ...core.security import get_current_user
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
    }
    result = {k: v for k, v in _settings.items() if k not in _enc}
    result["smtp_password"] = _MASKED if _settings.get("smtp_password_enc") else ""
    result["https_letsencrypt_dns_api_token"] = _MASKED if _settings.get("https_letsencrypt_dns_api_token_enc") else ""
    result["keycloak_sync_client_secret"] = _MASKED if _settings.get("keycloak_sync_client_secret_enc") else ""
    result["keycloak_sync_password"] = _MASKED if _settings.get("keycloak_sync_password_enc") else ""
    return result


@router.put("")
async def update_settings(data: dict, request: Request, db: AsyncSession = Depends(get_db), current: User = Depends(get_current_user)):
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
            if key == "idp_providers" and isinstance(value, list):
                cleaned[key] = [provider for provider in (_clean_idp_provider(item) for item in value) if provider]
                continue
            if isinstance(value, str):
                if key in {
                    "base_url",
                    "webhook_url",
                    "keycloak_jwks_url",
                    "keycloak_issuer",
                    "keycloak_sync_base_url",
                    "gateway_target_origin",
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
async def update_block_page(data: dict, request: Request, db: AsyncSession = Depends(get_db), current: User = Depends(get_current_user)):
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
