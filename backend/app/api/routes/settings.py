from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from ...core.database import get_db
from ...core.security import get_current_user
from ...models.user import User
from ...models.block_page_config import BlockPageConfig
from ...services.audit import log_action, request_ip
from ...services.sanitize import clean_optional_text, clean_text, clean_url

router = APIRouter(prefix="/settings", tags=["settings"])

# In-memory settings (persist to DB/file in production)
_settings = {
    "instance_name": "SkyNet",
    "base_url": "http://localhost:8000",
    "timezone": "UTC",
    "realtime_enabled": True,
    "auto_block_tor_vpn": False,
    "require_auth": False,
    "visitor_retention_days": 90,
    "event_retention_days": 90,
    "incident_retention_days": 365,
    "anonymize_ips": False,
    "webhook_url": "",
    "webhook_secret": "",
    "webhook_events": {},
}

@router.get("")
async def get_settings(_: User = Depends(get_current_user)):
    return _settings


@router.put("")
async def update_settings(data: dict, request: Request, db: AsyncSession = Depends(get_db), current: User = Depends(get_current_user)):
    cleaned = {}
    try:
        for key, value in data.items():
            if isinstance(value, str):
                if key in {"base_url", "webhook_url"}:
                    cleaned[key] = clean_url(value) or ""
                else:
                    cleaned[key] = clean_text(value)
            else:
                cleaned[key] = value
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    _settings.update(cleaned)
    log_action(db, action="CONFIG_CHANGE", actor_id=current.id, target_type="settings", target_id="general", ip=request_ip(request), extra={"updated_keys": sorted(cleaned.keys())})
    await db.commit()
    return _settings


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
