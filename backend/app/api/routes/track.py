import json
import uuid
from fastapi import APIRouter, Request, Header, HTTPException, Query
from app.middleware.rate_limit import limiter
from sqlalchemy import select, text
from ...core.database import AsyncSessionLocal
from ...models.site import Site
from ...models.visitor import Visitor
from ...models.device import Device
from ...models.event import Event
from ...models.blocking import BlockedIP
from ...models.block_page_config import BlockPageConfig
from ...schemas.track import PageviewPayload, EventPayload, IdentifyPayload
from ...core.geoip import lookup as geoip_lookup
from ...services.anti_evasion import dispatch_event_checks, dispatch_identify_checks, dispatch_pageview_checks
from ...services.device_identity import update_device_metadata
from datetime import datetime, timezone
from typing import Optional
router = APIRouter(prefix="/track", tags=["tracker"])

async def resolve_api_key(header_key: Optional[str], query_key: Optional[str]) -> str:
    """Accept key from X-SkyNet-Key header (XHR) or ?key= param (sendBeacon)."""
    key = header_key or query_key
    if not key:
        raise HTTPException(403, "API key required")
    return key

async def validate_site_key(api_key: str) -> Site:
    async with AsyncSessionLocal() as db:
        s = await db.scalar(select(Site).where(Site.api_key == api_key, Site.active == True))
        if not s:
            raise HTTPException(403, "Invalid API key")
        return s

_DEFAULT_BLOCK_CONFIG = {
    "title": "ACCESS RESTRICTED",
    "subtitle": "Your access to this site has been blocked.",
    "message": "This action was taken automatically for security reasons.",
    "bg_color": "#050505",
    "accent_color": "#ef4444",
    "logo_url": None,
    "contact_email": None,
    "show_request_id": True,
    "show_contact": True,
}

@router.get("/check-access")
@limiter.limit("200/minute")
async def check_access(
    request: Request,
    key: Optional[str] = Query(None),
    x_skynet_key: Optional[str] = Header(None),
    fp: Optional[str] = Query(None),
):
    try:
        await validate_site_key(await resolve_api_key(x_skynet_key, key))
    except HTTPException:
        return {"blocked": False}
    ip = request.client.host
    async with AsyncSessionLocal() as db:
        blocked_ip = await db.get(BlockedIP, ip)
        blocked_device = False
        blocked_visitor = False
        if not blocked_ip:
            blocked_visitor = await db.scalar(
                select(Visitor.id).where(Visitor.ip == ip, Visitor.status == "blocked")
            ) is not None
        if not blocked_ip and not blocked_visitor and fp:
            device = await db.scalar(select(Device).where(Device.fingerprint == fp))
            blocked_device = device is not None and device.status == "blocked"
        if not blocked_ip and not blocked_visitor and not blocked_device:
            return {"blocked": False}
        cfg = await db.get(BlockPageConfig, 1)
        config = {
            "title":           cfg.title          if cfg else _DEFAULT_BLOCK_CONFIG["title"],
            "subtitle":        cfg.subtitle        if cfg else _DEFAULT_BLOCK_CONFIG["subtitle"],
            "message":         cfg.message         if cfg else _DEFAULT_BLOCK_CONFIG["message"],
            "bg_color":        cfg.bg_color        if cfg else _DEFAULT_BLOCK_CONFIG["bg_color"],
            "accent_color":    cfg.accent_color    if cfg else _DEFAULT_BLOCK_CONFIG["accent_color"],
            "logo_url":        cfg.logo_url        if cfg else None,
            "contact_email":   cfg.contact_email   if cfg else None,
            "show_request_id": cfg.show_request_id if cfg else True,
            "show_contact":    cfg.show_contact    if cfg else True,
        }
    return {
        "blocked": True,
        "reason": "ip" if blocked_ip else "visitor" if blocked_visitor else "device",
        "request_id": str(uuid.uuid4())[:8].upper(),
        "config": config,
    }

@router.post("/pageview")
@limiter.limit("200/minute")
async def track_pageview(
    payload: PageviewPayload,
    request: Request,
    key: Optional[str] = Query(None),
    x_skynet_key: Optional[str] = Header(None),
):
    site = await validate_site_key(await resolve_api_key(x_skynet_key, key))
    ip = request.client.host
    browser = None
    os_name = None
    device_type = None
    ua_string = request.headers.get("user-agent", "")
    try:
        import user_agents
        ua = user_agents.parse(ua_string)
        browser = f"{ua.browser.family} {ua.browser.version_string}".strip()
        os_name = f"{ua.os.family} {ua.os.version_string}".strip()
        device_type = "mobile" if ua.is_mobile else "tablet" if ua.is_tablet else "desktop"
    except Exception:
        pass
    async with AsyncSessionLocal() as db:
        blocked = await db.get(BlockedIP, ip)
        if blocked:
            blocked.hits += 1
            await db.commit()
            return {"blocked": True}
        device = None
        if payload.fingerprint:
            device = await db.scalar(select(Device).where(Device.fingerprint == payload.fingerprint))
            if not device:
                device = Device(
                    id=str(uuid.uuid4()),
                    fingerprint=payload.fingerprint,
                )
                db.add(device)
            update_device_metadata(
                device,
                browser=browser,
                os_name=os_name,
                device_type=device_type,
                screen_resolution=payload.screen,
                language=payload.language,
                timezone_name=payload.timezone,
                canvas_hash=payload.canvas_hash,
                webgl_hash=payload.webgl_hash,
            )
            await db.flush()
        visitor_query = select(Visitor).where(Visitor.ip == ip, Visitor.site_id == site.id)
        if device:
            visitor_query = visitor_query.where(Visitor.device_id == device.id)
        visitor = await db.scalar(visitor_query)
        if not visitor:
            geo = geoip_lookup(ip)
            visitor = Visitor(
                id=str(uuid.uuid4()),
                ip=ip,
                site_id=site.id,
                country=geo.get("country") or None,
                country_code=geo.get("country_code") or None,
                country_flag=geo.get("country_flag") or None,
                city=geo.get("city") or None,
                device_id=device.id if device else None,
                linked_user=device.linked_user if device else None,
            )
            db.add(visitor)
        visitor.browser = browser or visitor.browser
        visitor.os = os_name or visitor.os
        visitor.device_type = device_type or visitor.device_type
        visitor.user_agent = ua_string
        visitor.page_views = (visitor.page_views or 0) + 1
        visitor.last_seen = datetime.now(timezone.utc)
        if device:
            visitor.device_id = device.id
            visitor.linked_user = device.linked_user
        event = Event(
            id=str(uuid.uuid4()),
            site_id=site.id,
            visitor_id=visitor.id,
            device_id=device.id if device else None,
            user_id=visitor.linked_user,
            event_type="pageview",
            page_url=payload.page_url,
            referrer=payload.referrer,
            ip=ip,
        )
        db.add(event)
        await db.commit()
    dispatch_pageview_checks(
        {
            "site_id": site.id,
            "visitor_id": visitor.id,
            "device_id": visitor.device_id,
            "user_id": visitor.linked_user,
            "fingerprint": payload.fingerprint,
            "canvas_hash": payload.canvas_hash,
            "webgl_hash": payload.webgl_hash,
            "session_id": payload.session_id,
            "ip": ip,
            "user_agent": ua_string,
        }
    )
    return {"ok": True}

@router.post("/event")
@limiter.limit("200/minute")
async def track_event(
    payload: EventPayload,
    request: Request,
    key: Optional[str] = Query(None),
    x_skynet_key: Optional[str] = Header(None),
):
    site = await validate_site_key(await resolve_api_key(x_skynet_key, key))
    ip = request.client.host
    async with AsyncSessionLocal() as db:
        device_id = None
        linked_user = None
        if payload.fingerprint:
            device = await db.scalar(select(Device).where(Device.fingerprint == payload.fingerprint))
            if device:
                device_id = device.id
                linked_user = device.linked_user
        event = Event(
            id=str(uuid.uuid4()),
            site_id=site.id,
            device_id=device_id,
            user_id=linked_user,
            event_type=payload.event_type,
            page_url=payload.page_url,
            properties=json.dumps(payload.properties, default=str) if payload.properties else None,
            ip=ip,
        )
        db.add(event)
        await db.commit()
    dispatch_event_checks(
        {
            "site_id": site.id,
            "device_id": device_id,
            "fingerprint": payload.fingerprint,
            "event_type": payload.event_type,
            "session_id": payload.session_id,
            "ip": ip,
            "user_id": linked_user,
        }
    )
    return {"ok": True}

@router.post("/identify")
@limiter.limit("200/minute")
async def identify_user(
    payload: IdentifyPayload,
    request: Request,
    key: Optional[str] = Query(None),
    x_skynet_key: Optional[str] = Header(None),
):
    await validate_site_key(await resolve_api_key(x_skynet_key, key))
    async with AsyncSessionLocal() as db:
        device_id = None
        if payload.fingerprint:
            device = await db.scalar(select(Device).where(Device.fingerprint == payload.fingerprint))
            if device:
                device_id = device.id
                device.linked_user = payload.user_id
                await db.execute(
                    text("UPDATE visitors SET linked_user = :user_id WHERE device_id = :device_id"),
                    {"user_id": payload.user_id, "device_id": device.id},
                )
                await db.commit()
    dispatch_identify_checks(
        {
            "device_id": device_id,
            "fingerprint": payload.fingerprint,
            "ip": request.client.host,
            "user_id": payload.user_id,
        }
    )
    return {"ok": True}

@router.get("/check/ip")
async def check_ip(ip: str, x_skynet_key: str = Header(...)):
    await validate_site_key(x_skynet_key)
    async with AsyncSessionLocal() as db:
        blocked = await db.get(BlockedIP, ip)
        return {"ip": ip, "blocked": blocked is not None}

@router.get("/check/device")
async def check_device(fingerprint: str, x_skynet_key: str = Header(...)):
    await validate_site_key(x_skynet_key)
    async with AsyncSessionLocal() as db:
        device = await db.scalar(select(Device).where(Device.fingerprint == fingerprint))
        if not device:
            return {"fingerprint": fingerprint, "found": False, "blocked": False}
        return {
            "fingerprint": fingerprint,
            "found": True,
            "blocked": device.status == "blocked",
            "risk_score": device.risk_score,
            "linked_user": device.linked_user,
        }
