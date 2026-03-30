from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from ...core.database import get_db
from ...core.security import get_current_user
from ...models.user import User
from ...models.block_page_config import BlockPageConfig

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
async def update_settings(data: dict, _: User = Depends(get_current_user)):
    _settings.update(data)
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
async def update_block_page(data: dict, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    allowed = {"title", "subtitle", "message", "bg_color", "accent_color", "logo_url", "contact_email", "show_request_id", "show_contact"}
    data = {k: v for k, v in data.items() if k in allowed}
    cfg = await db.get(BlockPageConfig, 1)
    if not cfg:
        cfg = BlockPageConfig(id=1, **data)
        db.add(cfg)
    else:
        for k, v in data.items():
            setattr(cfg, k, v)
    await db.commit()
    return {"ok": True}
