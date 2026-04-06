import json
import logging
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

_log = logging.getLogger("skynet.track")
from fastapi import APIRouter, Request, Header, HTTPException, Query
from fastapi.responses import Response
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
from ...services.dnsbl import lookup_ip as dnsbl_lookup_ip, should_soft_fail_dnsbl
from ...services.jwks_validator import validate_external_token, extract_bearer
from ...services.network_intel import filter_detection_matches, highest_priority_action, network_detection_matches
from ...services.response_policy import evaluate_response_rules, strongest_action
from ...services import identity_service
from ...services.identity_service import upsert_profile
from ...services.risk_engine import enforcement_action
from ...services.group_escalation import recompute_device_parent_posture, recompute_user_parent_posture
from ...services.runtime_config import runtime_settings
from typing import Optional
from ...core.ip_utils import get_client_ip
router = APIRouter(prefix="/track", tags=["tracker"])
edge_router = APIRouter(tags=["tracker-edge"])

VISITOR_IP_FALLBACK_WINDOW_MINUTES = 30
EDGE_ROUTE_PREFIX = "/w"


def _edge_paths(site_key: str) -> dict[str, str]:
    return {
        "pageview": f"{EDGE_ROUTE_PREFIX}/{site_key}/p",
        "event": f"{EDGE_ROUTE_PREFIX}/{site_key}/e",
        "device_context": f"{EDGE_ROUTE_PREFIX}/{site_key}/d",
        "identify": f"{EDGE_ROUTE_PREFIX}/{site_key}/i",
        "check_access": f"{EDGE_ROUTE_PREFIX}/{site_key}/a",
    }


def _tracker_asset_path() -> Path:
    return Path(__file__).resolve().parents[3] / "tracker" / "skynet.js"


def _parse_screen_resolution(screen: Optional[str]) -> tuple[int, int] | None:
    if not screen or "x" not in str(screen).lower():
        return None
    raw_width, raw_height = str(screen).lower().split("x", 1)
    try:
        width = int(raw_width.strip())
        height = int(raw_height.strip())
    except ValueError:
        return None
    if width <= 0 or height <= 0:
        return None
    return width, height


def _infer_device_type(
    ua_string: str,
    *,
    parsed_device_type: Optional[str],
    screen: Optional[str],
    fingerprint_traits: Optional[dict],
) -> Optional[str]:
    traits = fingerprint_traits or {}
    platform = str(traits.get("platform") or "").lower()
    ua_lower = str(ua_string or "").lower()
    parsed_screen = _parse_screen_resolution(screen)
    touch_points = traits.get("touch_points")
    try:
        touch_points = int(touch_points) if touch_points is not None else None
    except (TypeError, ValueError):
        touch_points = None

    is_android_mobile_ua = any(token in ua_lower for token in ("android", " mobile ", "; mobile", " mobile;", "mobile safari", "; wv", " fbav/", "fb_iab"))
    is_desktop_platform = any(token in platform for token in ("win", "mac", "x11", "cros"))
    is_linux_desktop = (
        "linux" in platform
        and "android" not in platform
        and "arm" not in platform
        and "aarch64" not in platform
        and "arm64" not in platform
    )
    if is_android_mobile_ua:
        return "mobile"
    if is_desktop_platform or is_linux_desktop:
        return "desktop"
    if "ipad" in ua_lower or "ipad" in platform:
        return "tablet"
    if "iphone" in ua_lower or "android" in ua_lower or "mobile" in ua_lower:
        return "mobile"
    if "tablet" in ua_lower:
        return "tablet"
    if parsed_screen:
        width, height = parsed_screen
        shorter = min(width, height)
        longer = max(width, height)
        if shorter >= 900 or longer >= 1600:
            return "desktop"
        if shorter >= 700:
            return "tablet"
        if touch_points and touch_points > 0 and shorter <= 500:
            return "mobile"
    return parsed_device_type or "desktop"


def _ip_fallback_cutoff() -> datetime:
    return datetime.now(timezone.utc) - timedelta(minutes=VISITOR_IP_FALLBACK_WINDOW_MINUTES)


async def _resolve_visitor_record(
    db,
    *,
    site_id: str,
    device: Device | None,
    external_user_id: str | None,
    ip: str,
    user_agent: str,
) -> Visitor | None:
    if device:
        return await db.scalar(
            select(Visitor)
            .where(Visitor.site_id == site_id, Visitor.device_id == device.id)
            .order_by(Visitor.last_seen.desc())
        )
    if external_user_id:
        return await db.scalar(
            select(Visitor)
            .where(
                Visitor.site_id == site_id,
                Visitor.external_user_id == external_user_id,
            )
            .order_by(Visitor.last_seen.desc())
        )
    return await db.scalar(
        select(Visitor)
        .where(
            Visitor.site_id == site_id,
            Visitor.device_id.is_(None),
            Visitor.external_user_id.is_(None),
            Visitor.ip == ip,
            Visitor.user_agent == (user_agent or None),
            Visitor.last_seen >= _ip_fallback_cutoff(),
        )
        .order_by(Visitor.last_seen.desc())
    )


async def _upsert_activity_visitor(
    db,
    *,
    site_id: str | None,
    device: Device | None,
    external_user_id: str | None,
    ip: str,
    geo: dict,
    user_agent: str,
    event_type: str,
    screen: str | None = None,
    fingerprint_traits: dict | None = None,
) -> Visitor | None:
    if not site_id:
        return None
    site = await db.get(Site, site_id)
    if not site or not site.active:
        return None

    browser, os_name, device_type = parse_user_agent(
        user_agent,
        screen=screen,
        fingerprint_traits=fingerprint_traits,
    )
    visitor = await _resolve_visitor_record(
        db,
        site_id=site_id,
        device=device,
        external_user_id=external_user_id,
        ip=ip,
        user_agent=user_agent,
    )
    if not visitor:
        visitor = Visitor(
            id=str(uuid.uuid4()),
            ip=ip,
            site_id=site_id,
            country=geo.get("country") or None,
            country_code=geo.get("country_code") or None,
            country_flag=geo.get("country_flag") or None,
            city=geo.get("city") or None,
            isp=geo.get("isp") or geo.get("org") or geo.get("as") or None,
            device_id=device.id if device else None,
            external_user_id=external_user_id or (device.owner_user_id if device and (device.shared_user_count or 0) == 0 else None),
            browser=browser or None,
            os=os_name or None,
            device_type=device_type or None,
            user_agent=user_agent or None,
        )
        db.add(visitor)

    visitor.last_seen = datetime.now(timezone.utc)
    visitor.browser = browser or visitor.browser
    visitor.os = os_name or visitor.os
    visitor.device_type = device_type or visitor.device_type
    if device:
        visitor.device_id = device.id
        if external_user_id:
            visitor.external_user_id = external_user_id
        elif device.owner_user_id and (device.shared_user_count or 0) == 0 and not visitor.external_user_id:
            visitor.external_user_id = device.owner_user_id
    visitor.user_agent = user_agent or visitor.user_agent
    if event_type == "pageview":
        visitor.page_views = (visitor.page_views or 0) + 1
    return visitor


def parse_user_agent(
    ua_string: str,
    *,
    screen: Optional[str] = None,
    fingerprint_traits: Optional[dict] = None,
) -> tuple[Optional[str], Optional[str], Optional[str]]:
    browser = None
    os_name = None
    parsed_device_type = None
    try:
        import user_agents
        ua = user_agents.parse(ua_string)
        browser = f"{ua.browser.family} {ua.browser.version_string}".strip()
        os_name = f"{ua.os.family} {ua.os.version_string}".strip()
        parsed_device_type = "mobile" if ua.is_mobile else "tablet" if ua.is_tablet else "desktop"
    except Exception:
        _log.debug("UA parse failed for %r", ua_string[:200] if ua_string else "")
    device_type = _infer_device_type(
        ua_string,
        parsed_device_type=parsed_device_type,
        screen=screen,
        fingerprint_traits=fingerprint_traits,
    )
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
        _raw_score = _assessment_risk_score(assessment)
        device.risk_score = min(100, max(0, round((device.risk_score or 0) * 0.30 + _raw_score * 0.70)))
        if bool(runtime_settings().get("risk_auto_block_enforced", True)) and device.risk_score >= 95:
            device.status = "blocked"
        await db.flush()
        return device, assessment
    return device, None


def _assessment_risk_score(assessment: Optional[dict]) -> int:
    """Compute a risk score (0-100) from a fingerprint assessment.

    Design intent:
    - drift_score: signals actively changing between visits → primary evasion indicator
    - clock_skew_detected: timezone spoofing → strong signal
    - confidence: signal coverage quality → very mild modifier only; low coverage is
      common for privacy-focused users and should not inflate risk meaningfully
    """
    if not assessment:
        return 0
    score = 0
    drift = float(assessment.get("drift_score") or 0.0)
    confidence = float(assessment.get("confidence") or 0.0)
    # Fingerprint drift between visits (first visit drift == 0.0 by definition)
    if drift > 0.45:
        score = max(score, 80)
    elif drift > 0.25:
        score = max(score, 55)
    elif drift > 0.12:
        score = max(score, 30)
    # Clock/timezone mismatch → active spoofing attempt
    if assessment.get("clock_skew_detected"):
        score = max(score, 60)
    # Near-zero signal coverage (headless / stripped UA) — weak secondary signal
    if confidence < 0.15:
        score = max(score, 20)
    return score

async def resolve_api_key(header_key: Optional[str], query_key: Optional[str]) -> str:
    """Accept key from X-SkyNet-Key header (XHR) or ?key= param (sendBeacon)."""
    key = header_key or query_key
    if not key:
        raise HTTPException(403, "API key required")
    return key

async def validate_site_key(api_key: str) -> Site:
    if not runtime_settings().get("integration_api_access_enabled", True):
        raise HTTPException(403, "Integration API access is disabled")
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

@router.get("/ads.js")
async def adblock_bait_probe(skynet_probe: Optional[str] = Query(None)):
    """
    Same-origin adblock bait probe.
    Returns a tiny executable JS payload with ad-network-style headers so
    ad-blocking extensions that match on URL/resource type can block it.
    The tracker loads this as a <script> and expects the probe token to be
    marked on window. Missing execution is treated as browser-side blocking.
    No auth required — this endpoint is intentionally public.
    """
    content = "/* ad */"
    if skynet_probe:
        content = (
            "(function(){"
            "window.__skynetAdProbeHits=window.__skynetAdProbeHits||{};"
            f"window.__skynetAdProbeHits[{json.dumps(str(skynet_probe))}]=true;"
            "})();"
        )
    return Response(
        content=content,
        media_type="application/javascript",
        headers={"Cache-Control": "no-store", "X-Robots-Tag": "noindex"},
    )


@router.get("/check-access")
async def check_access(
    request: Request,
    key: Optional[str] = Query(None),
    x_skynet_key: Optional[str] = Header(None),
    fp: Optional[str] = Query(None),
    dc: Optional[str] = Query(None),
    ct: Optional[str] = Query(None),
):
    try:
        site = await validate_site_key(await resolve_api_key(x_skynet_key, key))
    except HTTPException:
        return {"blocked": False}
    ip = get_client_ip(request)
    challenge_cfg = get_anti_evasion_config()
    async with AsyncSessionLocal() as db:
        blocked_ip = await db.get(BlockedIP, ip)
        blocked_device = False
        blocked_visitor = False
        challenge_device = None
        geo = None
        if not blocked_ip and fp:
            device = await db.scalar(select(Device).where(Device.fingerprint == fp))
            blocked_device = device is not None and device.status == "blocked"
            challenge_device = device
        if not blocked_ip and not blocked_device and dc:
            cookie_id = verify_device_cookie(dc)
            if cookie_id:
                device = await db.scalar(select(Device).where(Device.device_cookie_id == cookie_id))
                blocked_device = device is not None and device.status == "blocked"
                challenge_device = device or challenge_device
        if not blocked_ip and not blocked_device:
            visitor_filters = [Visitor.site_id == site.id, Visitor.status == "blocked"]
            if challenge_device:
                visitor_filters.append(Visitor.device_id == challenge_device.id)
            else:
                visitor_filters.extend(
                    [
                        Visitor.device_id.is_(None),
                        Visitor.external_user_id.is_(None),
                        Visitor.ip == ip,
                        Visitor.user_agent == (request.headers.get("user-agent", "") or None),
                        Visitor.last_seen >= _ip_fallback_cutoff(),
                    ]
                )
            blocked_visitor = await db.scalar(select(Visitor.id).where(*visitor_filters)) is not None
        if not blocked_ip and not blocked_visitor and not blocked_device:
            if _challenge_cookie_valid(request, ip) or verify_bypass_cookie(ct, ip):
                return {"blocked": False}

            geo = await geoip_lookup(ip)
            rule_decision = await evaluate_response_rules(
                db,
                ip=ip,
                geo=geo,
                device=challenge_device,
                user_agent=request.headers.get("user-agent", ""),
            )
            rule_action = None
            if rule_decision:
                rule_action = str(rule_decision["action"] or "block")
                if rule_action == "block":
                    return {"blocked": True, "reason": "blocking_rule", "rule_id": rule_decision.get("rule_id")}
                if rule_action == "rate_limit" and not bool(runtime_settings().get("enable_auto_defense")):
                    return {
                        "blocked": False,
                        "rate_limited": True,
                        "retry_after": int(runtime_settings().get("response_slowdown_retry_after_sec", 30) or 30),
                        "reason": "blocking_rule",
                        "rule_id": rule_decision.get("rule_id"),
                    }
                if challenge_cfg.get("challenge_enabled") and rule_action == "challenge" and not bool(runtime_settings().get("enable_auto_defense")):
                    challenge = await create_challenge_token(
                        subject=ip,
                        request_id=str(uuid.uuid4())[:8].upper(),
                        next_url=request.headers.get("referer") or "/",
                        reason="blocking_rule",
                    )
                    return {
                        "blocked": False,
                        "challenge": True,
                        "challenge_type": challenge["type"],
                        "challenge_url": f"/api/v1/gateway/challenge/{challenge['token']}",
                        "difficulty": challenge["difficulty"],
                        "honeypot_field": challenge["honeypot_field"],
                        "rule_id": rule_decision.get("rule_id"),
                    }

            network_match = highest_priority_action(filter_detection_matches(network_detection_matches(runtime_settings(), geo), challenge_cfg))
            if network_match:
                action = str(network_match.get("action") or "observe")
                if action == "block":
                    return {"blocked": True, "reason": network_match.get("kind") or "network_intel"}
                if challenge_cfg.get("challenge_enabled") and action == "challenge":
                    challenge = await create_challenge_token(
                        subject=ip,
                        request_id=str(uuid.uuid4())[:8].upper(),
                        next_url=request.headers.get("referer") or "/",
                        reason=str(network_match.get("kind") or "network_intel"),
                    )
                    return {
                        "blocked": False,
                        "challenge": True,
                        "challenge_type": challenge["type"],
                        "challenge_url": f"/api/v1/gateway/challenge/{challenge['token']}",
                        "difficulty": challenge["difficulty"],
                        "honeypot_field": challenge["honeypot_field"],
                    }

            dnsbl_decision = None
            if challenge_cfg.get("dnsbl_enabled"):
                dnsbl = await dnsbl_lookup_ip(
                    ip,
                    challenge_cfg.get("dnsbl_providers"),
                    ttl_sec=int(challenge_cfg.get("dnsbl_cache_ttl_sec", 900) or 900),
                )
                if dnsbl.get("listed"):
                    soft_fail = should_soft_fail_dnsbl(geo.get("country_code"), challenge_cfg)
                    dnsbl_decision = {
                        "action": "observe" if soft_fail else str(challenge_cfg.get("dnsbl_action") or "challenge"),
                        "details": {
                            **dnsbl,
                            "soft_fail": soft_fail,
                            "country_code": geo.get("country_code"),
                        },
                    }

            device_action = None
            if challenge_device:
                device_action = enforcement_action(min(float(challenge_device.risk_score or 0) / 100.0, 1.0))
            dnsbl_action = dnsbl_decision["action"] if dnsbl_decision else None
            effective_action = strongest_action(
                rule_action,
                dnsbl_action,
                device_action,
            ) if bool(runtime_settings().get("enable_auto_defense")) else None

            if (effective_action if effective_action else dnsbl_action) == "block":
                return {"blocked": True, "reason": "adaptive_defense" if effective_action else "dnsbl"}
            if not effective_action and rule_action == "rate_limit":
                return {
                    "blocked": False,
                    "rate_limited": True,
                    "retry_after": int(runtime_settings().get("response_slowdown_retry_after_sec", 30) or 30),
                    "reason": "blocking_rule",
                    "rule_id": rule_decision.get("rule_id") if rule_decision else None,
                }
            challenge_source = effective_action if effective_action else ("challenge" if ((dnsbl_action == "challenge") or (device_action == "challenge") or (rule_action == "challenge")) else None)
            if challenge_cfg.get("challenge_enabled") and challenge_source == "challenge":
                challenge = await create_challenge_token(
                    subject=ip,
                    request_id=str(uuid.uuid4())[:8].upper(),
                    next_url=request.headers.get("referer") or "/",
                    reason="adaptive_defense" if effective_action else "dnsbl" if dnsbl_decision else "device_risk" if device_action == "challenge" else "blocking_rule",
                )
                return {
                    "blocked": False,
                    "challenge": True,
                    "challenge_type": challenge["type"],
                    "challenge_url": f"/api/v1/gateway/challenge/{challenge['token']}",
                    "difficulty": challenge["difficulty"],
                        "honeypot_field": challenge["honeypot_field"],
                }
            if effective_action == "rate_limit":
                return {
                    "blocked": False,
                    "rate_limited": True,
                    "retry_after": int(runtime_settings().get("response_slowdown_retry_after_sec", 30) or 30),
                    "reason": "adaptive_defense",
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
async def resolve_device_context(
    payload: DeviceContextPayload,
    request: Request,
    key: Optional[str] = Query(None),
    x_skynet_key: Optional[str] = Header(None),
):
    site = await validate_site_key(await resolve_api_key(x_skynet_key, key))
    ua_string = request.headers.get("user-agent", "")
    browser, os_name, device_type = parse_user_agent(
        ua_string,
        screen=payload.screen,
        fingerprint_traits=payload.fingerprint_traits,
    )
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
        if device:
            posture = await recompute_device_parent_posture(
                db,
                device.id,
                site_id=site.id,
                trigger_context={"trigger_type": "device_context", "source": "track.device_context"},
            )
            response["risk_score"] = posture["new_score"]
            response["status"] = posture["status"]
            if posture.get("external_user_id"):
                await recompute_user_parent_posture(
                    db,
                    posture["external_user_id"],
                    trigger_context={
                        "trigger_type": "device_context",
                        "source": "track.device_context",
                        "device_id": device.id,
                        "site_id": site.id,
                    },
                )
        await db.commit()
    return response

@router.post("/pageview")
async def track_pageview(
    payload: PageviewPayload,
    request: Request,
    key: Optional[str] = Query(None),
    x_skynet_key: Optional[str] = Header(None),
):
    site = await validate_site_key(await resolve_api_key(x_skynet_key, key))
    ip = get_client_ip(request)
    ua_string = request.headers.get("user-agent", "")
    browser, os_name, device_type = parse_user_agent(
        ua_string,
        screen=payload.screen,
        fingerprint_traits=payload.fingerprint_traits,
    )
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
        visitor = await _resolve_visitor_record(
            db,
            site_id=site.id,
            device=device,
            external_user_id=device.owner_user_id if device and (device.shared_user_count or 0) == 0 else None,
            ip=ip,
            user_agent=ua_string,
        )
        if not visitor:
            visitor = Visitor(
                id=str(uuid.uuid4()),
                ip=ip,
                site_id=site.id,
                country=geo.get("country") or None,
                country_code=geo.get("country_code") or None,
                country_flag=geo.get("country_flag") or None,
                city=geo.get("city") or None,
                isp=geo.get("isp") or geo.get("org") or geo.get("as") or None,
                device_id=device.id if device else None,
                linked_user=device.linked_user if device else None,
                external_user_id=device.owner_user_id if device and (device.shared_user_count or 0) == 0 else None,
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
            if device.owner_user_id and (device.shared_user_count or 0) == 0 and not visitor.external_user_id:
                visitor.external_user_id = device.owner_user_id
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
        owner_external_user_id = None
        if device:
            posture = await recompute_device_parent_posture(
                db,
                device.id,
                site_id=site.id,
                trigger_context={"trigger_type": "pageview", "source": "track.pageview"},
            )
            owner_external_user_id = posture.get("external_user_id")
        if owner_external_user_id:
            await recompute_user_parent_posture(
                db,
                owner_external_user_id,
                trigger_context={
                    "trigger_type": "pageview",
                    "source": "track.pageview",
                    "device_id": device.id if device else None,
                    "visitor_id": visitor.id,
                    "site_id": site.id,
                },
            )
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
            "language": payload.language,
            "timezone": payload.timezone,
            "geo": geo,
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
        owner_external_user_id = None
        if device:
            posture = await recompute_device_parent_posture(
                db,
                device.id,
                site_id=site.id,
                trigger_context={"trigger_type": payload.event_type, "source": "track.event"},
            )
            owner_external_user_id = posture.get("external_user_id")
        if owner_external_user_id:
            await recompute_user_parent_posture(
                db,
                owner_external_user_id,
                trigger_context={
                    "trigger_type": payload.event_type,
                    "source": "track.event",
                    "device_id": device.id if device else None,
                    "site_id": site.id,
                },
            )
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
    user_agent = request.headers.get("user-agent", "")

    async with AsyncSessionLocal() as db:
        resolved_site_id = payload.site_id
        if not resolved_site_id and payload.site_key:
            resolved_site = await db.scalar(
                select(Site).where(Site.api_key == payload.site_key, Site.active == True)
            )
            if resolved_site:
                resolved_site_id = resolved_site.id

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

        device = await db.get(Device, payload.fingerprint_id) if payload.fingerprint_id else None
        visitor = await _upsert_activity_visitor(
            db,
            site_id=resolved_site_id,
            device=device,
            external_user_id=external_user_id,
            ip=ip,
            geo=geo,
            user_agent=user_agent,
            event_type=payload.event_type,
            screen=device.screen_resolution if device else None,
            fingerprint_traits=None,
        )

        if device:
            await identity_service.link_device(
                db,
                external_user_id=external_user_id,
                fingerprint_id=device.id,
                visitor_id=visitor.id if visitor else None,
                platform=payload.platform or "web",
                ip=ip,
                site_id=resolved_site_id,
                id_provider=claims.get("__skynet_id_provider", "keycloak"),
            )
            profile.total_devices = await identity_service.count_user_devices(db, external_user_id)

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
            site_id=resolved_site_id,
            fingerprint_id=payload.fingerprint_id,
            ip=ip,
            country=country,
            page_url=payload.page_url,
            properties=json.dumps(payload.properties, default=str) if payload.properties else None,
            session_id=payload.session_id or claims.get("session_state"),
            created_at=created_at,
        )
        db.add(event)

        if payload.event_type == "pageview" and resolved_site_id:
            db.add(
                Event(
                    id=str(uuid.uuid4()),
                    site_id=resolved_site_id,
                    visitor_id=visitor.id if visitor else None,
                    device_id=device.id if device else None,
                    user_id=None,
                    event_type="pageview",
                    page_url=payload.page_url,
                    properties=json.dumps(
                        {
                            "source": "track_activity",
                            "external_user_id": external_user_id,
                            "session_id": payload.session_id or claims.get("session_state"),
                        },
                        separators=(",", ":"),
                        sort_keys=True,
                    ),
                    ip=ip,
                    created_at=created_at,
                )
            )

        # Enhanced audit: store full snapshot in properties
        if profile and profile.enhanced_audit and not event.properties:
            event.properties = json.dumps({
                "user_agent": request.headers.get("user-agent"),
                "referer": request.headers.get("referer"),
                "enhanced": True,
            })

        trust_level = None
        score = profile.current_risk_score if profile else 0.0
        if device:
            await recompute_device_parent_posture(
                db,
                device.id,
                site_id=resolved_site_id,
                trigger_context={
                    "trigger_type": payload.event_type,
                    "source": "track.activity",
                    "external_user_id": external_user_id,
                },
            )
        _, score, trust_level = await recompute_user_parent_posture(
            db,
            external_user_id,
            trigger_context={
                "trigger_type": "impossible_travel" if travel_flag else payload.event_type,
                "source": "track.activity",
                "ip": ip,
                "country": country,
                "fingerprint_id": payload.fingerprint_id,
                "site_id": resolved_site_id,
                "travel_flag": travel_flag.flag_type if travel_flag else None,
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


@edge_router.get("/s/{site_key}.js")
async def stealth_tracker_script(site_key: str):
    await validate_site_key(site_key)
    asset_path = _tracker_asset_path()
    tracker_source = asset_path.read_text(encoding="utf-8")
    prelude = (
        "(function(){"
        "var s=window._skynet=window._skynet||{};"
        "var current=document.currentScript;"
        "var origin='';"
        "try{origin=current&&current.src?new URL(current.src,window.location.href).origin:'';}catch(e){}"
        f"s.key={json.dumps(site_key)};"
        "s.api=s.api||origin;"
        f"s.paths={json.dumps(_edge_paths(site_key), separators=(',', ':'))};"
        "})();\n"
    )
    return Response(content=prelude + tracker_source, media_type="application/javascript")


@edge_router.get(f"{EDGE_ROUTE_PREFIX}" + "/{site_key}/a")
async def edge_check_access(
    site_key: str,
    request: Request,
    fp: Optional[str] = Query(None),
    dc: Optional[str] = Query(None),
    ct: Optional[str] = Query(None),
):
    return await check_access(request=request, key=site_key, x_skynet_key=None, fp=fp, dc=dc, ct=ct)


@edge_router.post(f"{EDGE_ROUTE_PREFIX}" + "/{site_key}/d")
async def edge_device_context(
    site_key: str,
    payload: DeviceContextPayload,
    request: Request,
):
    return await resolve_device_context(payload=payload, request=request, key=site_key, x_skynet_key=None)


@edge_router.post(f"{EDGE_ROUTE_PREFIX}" + "/{site_key}/p")
async def edge_pageview(
    site_key: str,
    payload: PageviewPayload,
    request: Request,
):
    return await track_pageview(payload=payload, request=request, key=site_key, x_skynet_key=None)


@edge_router.post(f"{EDGE_ROUTE_PREFIX}" + "/{site_key}/e")
async def edge_event(
    site_key: str,
    payload: EventPayload,
    request: Request,
):
    return await track_event(payload=payload, request=request, key=site_key, x_skynet_key=None)


@edge_router.post(f"{EDGE_ROUTE_PREFIX}" + "/{site_key}/i")
async def edge_identify(
    site_key: str,
    payload: IdentifyPayload,
    request: Request,
):
    return await identify_user(payload=payload, request=request, key=site_key, x_skynet_key=None)
