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
from ...models.activity_event import ActivityEvent
from ...schemas.track import DeviceContextPayload, PageviewPayload, EventPayload, IdentifyPayload
from ...schemas.activity import ActivityPayload
from ...core.geoip import lookup as geoip_lookup
from ...services.anti_evasion import dispatch_event_checks, dispatch_identify_checks, dispatch_pageview_checks
from ...services.anti_evasion_config import get_anti_evasion_config
from ...services.activity_intelligence import detect_impossible_travel
from ...services.challenge_service import create_challenge_token, verify_bypass_cookie
from ...services.device_fingerprint import (
    build_assessment,
    ensure_cookie_id,
    issue_device_cookie,
    verify_device_cookie,
)
from ...services.device_identity import update_device_metadata
from ...services.dnsbl import lookup_ip as dnsbl_lookup_ip
from ...services.jwks_validator import validate_external_token, extract_bearer
from ...services.identity_service import upsert_profile
from ...services.risk_engine import enforcement_action, recompute as recompute_risk
from ...services.runtime_config import runtime_settings
from datetime import datetime, timezone
from typing import Optional
from ...core.ip_utils import get_client_ip
router = APIRouter(prefix="/track", tags=["tracker"])


def parse_user_agent(ua_string: str) -> tuple[Optional[str], Optional[str], Optional[str]]:
    browser = None
    os_name = None
    device_type = None
    try:
        import user_agents
        ua = user_agents.parse(ua_string)
        browser = f"{ua.browser.family} {ua.browser.version_string}".strip()
        os_name = f"{ua.os.family} {ua.os.version_string}".strip()
        device_type = "mobile" if ua.is_mobile else "tablet" if ua.is_tablet else "desktop"
    except Exception:
        pass
    return browser, os_name, device_type


async def resolve_device_record(
    db,
    fingerprint: Optional[str],
    *,
    device_cookie: Optional[str],
    browser: Optional[str],
    os_name: Optional[str],
    device_type: Optional[str],
    screen: Optional[str],
    language: Optional[str],
    timezone_name: Optional[str],
    canvas_hash: Optional[str],
    webgl_hash: Optional[str],
    fingerprint_traits: Optional[dict],
    geo_timezone: Optional[str],
):
    device = None
    cookie_id = verify_device_cookie(device_cookie)
    if cookie_id:
        device = await db.scalar(select(Device).where(Device.device_cookie_id == cookie_id))
    if fingerprint:
        fingerprint_device = await db.scalar(select(Device).where(Device.fingerprint == fingerprint))
        if fingerprint_device:
            device = fingerprint_device
        if not device:
            device = Device(
                id=str(uuid.uuid4()),
                fingerprint=fingerprint,
            )
            db.add(device)
        elif device.fingerprint != fingerprint:
            device.fingerprint = fingerprint
        update_device_metadata(
            device,
            browser=browser,
            os_name=os_name,
            device_type=device_type,
            screen_resolution=screen,
            language=language,
            timezone_name=timezone_name,
            canvas_hash=canvas_hash,
            webgl_hash=webgl_hash,
        )
        assessment = build_assessment(
            previous_snapshot_raw=device.fingerprint_snapshot,
            screen=screen,
            language=language,
            timezone_name=timezone_name,
            canvas_hash=canvas_hash,
            webgl_hash=webgl_hash,
            fingerprint_traits=fingerprint_traits,
            geo_timezone=geo_timezone,
            clock_skew_tolerance_minutes=int(runtime_settings().get("fingerprint_clock_skew_tolerance_minutes", 90) or 90),
        )
        ensure_cookie_id(device)
        device.fingerprint_version = assessment["version"]
        device.fingerprint_confidence = assessment["confidence"]
        device.stability_score = assessment["stability"]
        device.composite_fingerprint = assessment["composite_hash"]
        device.composite_score = assessment["composite_score"]
        device.timezone_offset_minutes = assessment["snapshot"].get("timezone_offset_minutes")
        device.clock_skew_minutes = assessment["clock_skew_minutes"]
        device.fingerprint_snapshot = json.dumps(assessment["snapshot"], separators=(",", ":"), sort_keys=True)
        device.risk_score = min(100, max(device.risk_score or 0, _assessment_risk_score(assessment)))
        if bool(runtime_settings().get("risk_auto_block_enforced", True)) and device.risk_score >= 95:
            device.status = "blocked"
        await db.flush()
        return device, assessment
    return device, None


def _assessment_risk_score(assessment: Optional[dict]) -> int:
    if not assessment:
        return 0
    score = 0
    composite = float(assessment.get("composite_score") or 0.0)
    drift = float(assessment.get("drift_score") or 0.0)
    if composite < 0.35:
        score = max(score, 90)
    elif composite < 0.5:
        score = max(score, 70)
    elif composite < 0.65:
        score = max(score, 55)
    if drift > 0.45:
        score = max(score, 85)
    elif drift > 0.25:
        score = max(score, 60)
    if assessment.get("clock_skew_detected"):
        score = max(score, 65)
    return score

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


def _challenge_cookie_valid(request: Request, subject: str) -> bool:
    return verify_bypass_cookie(request.cookies.get("_skynet_challenge"), subject)

@router.get("/check-access")
@limiter.limit("200/minute")
async def check_access(
    request: Request,
    key: Optional[str] = Query(None),
    x_skynet_key: Optional[str] = Header(None),
    fp: Optional[str] = Query(None),
    dc: Optional[str] = Query(None),
    ct: Optional[str] = Query(None),
):
    try:
        await validate_site_key(await resolve_api_key(x_skynet_key, key))
    except HTTPException:
        return {"blocked": False}
    ip = get_client_ip(request)
    challenge_cfg = get_anti_evasion_config()
    async with AsyncSessionLocal() as db:
        blocked_ip = await db.get(BlockedIP, ip)
        blocked_device = False
        blocked_visitor = False
        challenge_device = None
        if not blocked_ip:
            blocked_visitor = await db.scalar(
                select(Visitor.id).where(Visitor.ip == ip, Visitor.status == "blocked")
            ) is not None
        if not blocked_ip and not blocked_visitor and fp:
            device = await db.scalar(select(Device).where(Device.fingerprint == fp))
            blocked_device = device is not None and device.status == "blocked"
            challenge_device = device
        if not blocked_ip and not blocked_visitor and not blocked_device and dc:
            cookie_id = verify_device_cookie(dc)
            if cookie_id:
                device = await db.scalar(select(Device).where(Device.device_cookie_id == cookie_id))
                blocked_device = device is not None and device.status == "blocked"
                challenge_device = device or challenge_device
        if not blocked_ip and not blocked_visitor and not blocked_device:
            if _challenge_cookie_valid(request, ip) or verify_bypass_cookie(ct, ip):
                return {"blocked": False}

            dnsbl_decision = None
            if challenge_cfg.get("dnsbl_enabled"):
                dnsbl = await dnsbl_lookup_ip(
                    ip,
                    challenge_cfg.get("dnsbl_providers"),
                    ttl_sec=int(challenge_cfg.get("dnsbl_cache_ttl_sec", 900) or 900),
                )
                if dnsbl.get("listed"):
                    dnsbl_decision = {
                        "action": str(challenge_cfg.get("dnsbl_action") or "challenge"),
                        "details": dnsbl,
                    }

            device_action = None
            if challenge_device:
                device_action = enforcement_action(min(float(challenge_device.risk_score or 0) / 100.0, 1.0))

            if dnsbl_decision and dnsbl_decision["action"] == "block":
                return {"blocked": True, "reason": "dnsbl"}
            if challenge_cfg.get("challenge_enabled") and (
                (dnsbl_decision and dnsbl_decision["action"] == "challenge")
                or device_action == "challenge"
            ):
                challenge = await create_challenge_token(
                    subject=ip,
                    request_id=str(uuid.uuid4())[:8].upper(),
                    next_url=request.headers.get("referer") or "/",
                    reason="dnsbl" if dnsbl_decision else "device_risk",
                )
                return {
                    "blocked": False,
                    "challenge": True,
                    "challenge_type": challenge["type"],
                    "challenge_url": f"/api/v1/gateway/challenge/{challenge['token']}",
                    "difficulty": challenge["difficulty"],
                    "honeypot_field": challenge["honeypot_field"],
                }
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


@router.post("/device-context")
@limiter.limit("200/minute")
async def resolve_device_context(
    payload: DeviceContextPayload,
    request: Request,
    key: Optional[str] = Query(None),
    x_skynet_key: Optional[str] = Header(None),
):
    site = await validate_site_key(await resolve_api_key(x_skynet_key, key))
    ua_string = request.headers.get("user-agent", "")
    browser, os_name, device_type = parse_user_agent(ua_string)
    geo = await geoip_lookup(get_client_ip(request))

    async with AsyncSessionLocal() as db:
        device, _assessment = await resolve_device_record(
            db,
            payload.fingerprint,
            device_cookie=payload.device_cookie,
            browser=browser,
            os_name=os_name,
            device_type=device_type,
            screen=payload.screen,
            language=payload.language,
            timezone_name=payload.timezone,
            canvas_hash=payload.canvas_hash,
            webgl_hash=payload.webgl_hash,
            fingerprint_traits=payload.fingerprint_traits,
            geo_timezone=geo.get("timezone") or None,
        )
        response = {
            "ok": bool(device),
            "site_id": site.id,
            "device_id": device.id if device else None,
            "fingerprint": device.fingerprint if device else payload.fingerprint,
            "device_cookie": issue_device_cookie(device.device_cookie_id) if device and device.device_cookie_id else None,
            "linked_user": device.linked_user if device else None,
            "risk_score": device.risk_score if device else None,
            "status": device.status if device else None,
            "fingerprint_confidence": device.fingerprint_confidence if device else None,
            "stability_score": device.stability_score if device else None,
            "composite_fingerprint": device.composite_fingerprint if device else None,
            "composite_score": device.composite_score if device else None,
            "clock_skew_minutes": device.clock_skew_minutes if device else None,
        }
        await db.commit()
    return response

@router.post("/pageview")
@limiter.limit("200/minute")
async def track_pageview(
    payload: PageviewPayload,
    request: Request,
    key: Optional[str] = Query(None),
    x_skynet_key: Optional[str] = Header(None),
):
    site = await validate_site_key(await resolve_api_key(x_skynet_key, key))
    ip = get_client_ip(request)
    ua_string = request.headers.get("user-agent", "")
    browser, os_name, device_type = parse_user_agent(ua_string)
    geo = await geoip_lookup(ip)
    async with AsyncSessionLocal() as db:
        blocked = await db.get(BlockedIP, ip)
        if blocked:
            blocked.hits += 1
            await db.commit()
            return {"blocked": True}
        device, assessment = await resolve_device_record(
            db,
            payload.fingerprint,
            device_cookie=payload.device_cookie,
            browser=browser,
            os_name=os_name,
            device_type=device_type,
            screen=payload.screen,
            language=payload.language,
            timezone_name=payload.timezone,
            canvas_hash=payload.canvas_hash,
            webgl_hash=payload.webgl_hash,
            fingerprint_traits=payload.fingerprint_traits,
            geo_timezone=geo.get("timezone") or None,
        )
        visitor_query = select(Visitor).where(Visitor.ip == ip, Visitor.site_id == site.id)
        if device:
            visitor_query = visitor_query.where(Visitor.device_id == device.id)
        visitor = await db.scalar(visitor_query)
        if not visitor:
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
            "fingerprint_traits": payload.fingerprint_traits,
            "fingerprint_drift": assessment,
            "session_id": payload.session_id,
            "ip": ip,
            "user_agent": ua_string,
        }
    )
    return {
        "ok": True,
        "device_id": device.id if device else None,
        "device_cookie": issue_device_cookie(device.device_cookie_id) if device and device.device_cookie_id else None,
        "linked_user": visitor.linked_user,
        "status": device.status if device else None,
        "risk_score": device.risk_score if device else None,
        "composite_score": device.composite_score if device else None,
        "clock_skew_minutes": device.clock_skew_minutes if device else None,
    }

@router.post("/event")
@limiter.limit("200/minute")
async def track_event(
    payload: EventPayload,
    request: Request,
    key: Optional[str] = Query(None),
    x_skynet_key: Optional[str] = Header(None),
):
    site = await validate_site_key(await resolve_api_key(x_skynet_key, key))
    ip = get_client_ip(request)
    async with AsyncSessionLocal() as db:
        device_id = None
        linked_user = None
        device = None
        cookie_id = verify_device_cookie(payload.device_cookie)
        if cookie_id:
            device = await db.scalar(select(Device).where(Device.device_cookie_id == cookie_id))
        if payload.fingerprint and not device:
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
            "properties": payload.properties if isinstance(payload.properties, dict) else None,
            "behavior": payload.properties.get("behavior") if isinstance(payload.properties, dict) else None,
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
        device = None
        cookie_id = verify_device_cookie(payload.device_cookie)
        if cookie_id:
            device = await db.scalar(select(Device).where(Device.device_cookie_id == cookie_id))
        if payload.fingerprint and not device:
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
            "ip": get_client_ip(request),
            "user_id": payload.user_id,
        }
    )
    return {"ok": True}

@router.post("/activity")
@limiter.limit("200/minute")
async def track_activity(
    payload: ActivityPayload,
    request: Request,
    authorization: str = Header(..., alias="Authorization"),
):
    """Track an authenticated user activity event using an external IdP JWT."""
    claims = await validate_external_token(extract_bearer(authorization))
    external_user_id: str = claims.get("sub", "")
    if not external_user_id:
        raise HTTPException(status_code=401, detail={"code": "TOKEN_INVALID", "message": "Missing sub claim"})

    ip = get_client_ip(request)
    geo = await geoip_lookup(ip)
    country = geo.get("country_code") or None

    async with AsyncSessionLocal() as db:
        # Check if user is blocked at profile level
        from ...models.user_profile import UserProfile
        from sqlalchemy import select as sa_select
        profile = await db.scalar(
            sa_select(UserProfile).where(UserProfile.external_user_id == external_user_id)
        )
        if profile and profile.trust_level == "blocked":
            return {"blocked": True}

        profile = await upsert_profile(
            db,
            external_user_id=external_user_id,
            email=claims.get("email"),
            display_name=claims.get("name") or claims.get("preferred_username"),
            ip=ip,
            country=country,
        )

        created_at = datetime.now(timezone.utc)
        travel_flag = await detect_impossible_travel(
            db,
            external_user_id=external_user_id,
            current_country=country,
            current_ip=ip,
            current_created_at=created_at,
            related_device_id=payload.fingerprint_id,
        )

        event = ActivityEvent(
            id=str(uuid.uuid4()),
            external_user_id=external_user_id,
            event_type=payload.event_type,
            platform=payload.platform,
            site_id=payload.site_id,
            fingerprint_id=payload.fingerprint_id,
            ip=ip,
            country=country,
            page_url=payload.page_url,
            properties=json.dumps(payload.properties, default=str) if payload.properties else None,
            session_id=payload.session_id or claims.get("session_state"),
            created_at=created_at,
        )
        db.add(event)

        # Enhanced audit: store full snapshot in properties
        if profile and profile.enhanced_audit and not event.properties:
            event.properties = json.dumps({
                "user_agent": request.headers.get("user-agent"),
                "referer": request.headers.get("referer"),
                "enhanced": True,
            })

        trust_level = None
        score = profile.current_risk_score if profile else 0.0
        if travel_flag:
            _, score, trust_level = await recompute_risk(
                db,
                external_user_id,
                trigger_type="impossible_travel",
                trigger_detail={
                    "ip": ip,
                    "country": country,
                    "fingerprint_id": payload.fingerprint_id,
                },
            )
        await db.commit()
    action = enforcement_action(float(score or 0.0))
    response = {"ok": True, "risk_action": action}
    if action == "block":
        response = {"blocked": True, "risk_action": action}
    elif action == "challenge":
        response["challenge"] = True
    if travel_flag:
        response["flags"] = [travel_flag.flag_type]
        response["trust_level"] = trust_level
    return response


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
