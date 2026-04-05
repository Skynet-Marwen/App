from __future__ import annotations

import time
import uuid
from urllib.parse import parse_qsl, urlencode, urljoin, urlsplit, urlunsplit

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.database import AsyncSessionLocal, get_db
from ...core.ip_utils import get_client_ip
from ...core.security import get_current_user
from ...models.blocking import BlockedIP
from ...models.device import Device
from ...models.user import User
from ...models.user_profile import UserProfile
from ...services.anti_evasion_config import get_anti_evasion_config
from ...services.challenge_service import (
    build_challenge_response,
    challenge_settings,
    create_challenge_token,
    issue_bypass_cookie,
    load_challenge_token,
    render_challenge_page,
    verify_bypass_cookie,
    verify_pow_solution,
)
from ...services.device_fingerprint import verify_device_cookie
from ...services.dnsbl import lookup_ip as dnsbl_lookup_ip, should_soft_fail_dnsbl
from ...services.gateway_analytics import record_gateway_challenge_result, record_gateway_event
from ...services.jwks_validator import extract_bearer, validate_external_token
from ...services.network_intel import filter_detection_matches, highest_priority_action, network_detection_matches
from ...services.response_policy import evaluate_response_rules, strongest_action
from ...services.risk_engine import enforcement_action
from ...services.runtime_config import runtime_settings
from ...core.geoip import lookup as geoip_lookup


router = APIRouter(prefix="/gateway", tags=["gateway"])


def _gateway_cfg() -> dict:
    settings = runtime_settings()
    return {
        "enabled": bool(settings.get("gateway_enabled")),
        "target_origin": str(settings.get("gateway_target_origin") or "").rstrip("/"),
        "site_id": str(settings.get("gateway_site_id") or "").strip() or None,
        "timeout_ms": int(settings.get("gateway_timeout_ms") or 10000),
        "forward_ip_headers": bool(settings.get("gateway_forward_ip_headers", True)),
    }


async def _device_for_request(db: AsyncSession, request: Request, fp: str | None, dc: str | None) -> Device | None:
    device = None
    cookie_token = dc or request.headers.get("X-SkyNet-Device-Cookie") or request.cookies.get("_skynet_did")
    cookie_id = verify_device_cookie(cookie_token)
    if cookie_id:
        device = await db.scalar(select(Device).where(Device.device_cookie_id == cookie_id))
    fingerprint = fp or request.headers.get("X-SkyNet-Fingerprint")
    if fingerprint and not device:
        device = await db.scalar(select(Device).where(Device.fingerprint == fingerprint))
    return device


async def _user_action(db: AsyncSession, request: Request) -> tuple[str, str | None]:
    authorization = request.headers.get("Authorization")
    if not authorization:
        return "allow", None
    try:
        claims = await validate_external_token(extract_bearer(authorization))
    except HTTPException:
        return "challenge", None
    external_user_id = claims.get("sub")
    if not external_user_id:
        return "challenge", None
    profile = await db.scalar(select(UserProfile).where(UserProfile.external_user_id == external_user_id))
    if not profile:
        return "allow", external_user_id
    return enforcement_action(float(profile.current_risk_score or 0.0)), external_user_id


async def _decision(db: AsyncSession, request: Request, fp: str | None, dc: str | None) -> dict:
    ip = get_client_ip(request)
    if await db.get(BlockedIP, ip):
        return {"action": "block", "reason": "blocked_ip", "ip": ip}

    if verify_bypass_cookie(request.cookies.get("_skynet_challenge"), ip):
        return {"action": "allow", "reason": "challenge_bypass", "ip": ip}

    cfg = get_anti_evasion_config()
    geo = await geoip_lookup(ip)
    device = await _device_for_request(db, request, fp, dc)
    auto_defense = bool(runtime_settings().get("enable_auto_defense"))
    rule_decision = await evaluate_response_rules(
        db,
        ip=ip,
        geo=geo,
        device=device,
        user_agent=request.headers.get("user-agent", ""),
    )
    rule_action = None
    if rule_decision:
        rule_action = str(rule_decision.get("action") or "block")
        if rule_action == "rate_limit" and not bool(runtime_settings().get("response_slowdown_enabled", True)):
            rule_action = "challenge"
        if not auto_defense and rule_action in {"block", "challenge", "rate_limit"}:
            return {
                "action": rule_action,
                "reason": "blocking_rule",
                "rule_id": rule_decision.get("rule_id"),
                "device_id": device.id if device else None,
                "ip": ip,
            }

    network_match = highest_priority_action(
        filter_detection_matches(
            network_detection_matches(runtime_settings(), geo),
            cfg,
        )
    )
    if network_match:
        action = str(network_match.get("action") or "observe")
        if action in {"challenge", "block"}:
            return {"action": action, "reason": str(network_match.get("kind") or "network_intel"), "ip": ip}

    if cfg.get("dnsbl_enabled"):
        dnsbl = await dnsbl_lookup_ip(
            ip,
            cfg.get("dnsbl_providers"),
            ttl_sec=int(cfg.get("dnsbl_cache_ttl_sec", 900) or 900),
        )
        if dnsbl.get("listed"):
            if should_soft_fail_dnsbl((geo or {}).get("country_code"), cfg):
                return {"action": "allow", "reason": "dnsbl_soft_fail", "ip": ip, "dnsbl": dnsbl}
            action = str(cfg.get("dnsbl_action") or "challenge")
            return {"action": action, "reason": "dnsbl", "ip": ip, "dnsbl": dnsbl}

    if device and device.status == "blocked":
        return {"action": "block", "reason": "blocked_device", "device_id": device.id}

    user_action, external_user_id = await _user_action(db, request)
    action = user_action
    reason = "user_risk"

    if action == "allow" and device:
        action = enforcement_action(min(float(device.risk_score or 0) / 100.0, 1.0))
        reason = "device_risk"
    elif auto_defense and device:
        action = strongest_action(action, enforcement_action(min(float(device.risk_score or 0) / 100.0, 1.0)))

    if auto_defense and rule_action:
        action = strongest_action(rule_action, action)
        if action != "allow":
            reason = "adaptive_defense"

    return {
        "action": action,
        "reason": reason,
        "device_id": device.id if device else None,
        "external_user_id": external_user_id,
        "ip": ip,
    }


def _forward_headers(request: Request, cfg: dict) -> dict:
    headers = {
        key: value
        for key, value in request.headers.items()
        if key.lower() not in {"host", "content-length"}
    }
    if cfg["forward_ip_headers"]:
        headers["X-Forwarded-For"] = get_client_ip(request)
        headers["X-Forwarded-Proto"] = request.url.scheme
        headers["X-Forwarded-Host"] = request.headers.get("host", "")
    return headers


def _prefers_html(request: Request) -> bool:
    accept = (request.headers.get("accept") or "").lower()
    return "text/html" in accept


def _append_bypass_token(next_url: str, bypass_token: str) -> str:
    parts = urlsplit(next_url or "/")
    query = dict(parse_qsl(parts.query, keep_blank_values=True))
    query["skynet_challenge"] = bypass_token
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


@router.get("/status")
async def gateway_status(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    cfg = _gateway_cfg()
    if not cfg["enabled"] or not cfg["target_origin"]:
        return {"enabled": cfg["enabled"], "configured": False, "target_origin": cfg["target_origin"]}
    async with httpx.AsyncClient(timeout=max(cfg["timeout_ms"] / 1000, 1)) as client:
        try:
            response = await client.get(cfg["target_origin"])
            upstream = {"reachable": response.status_code < 500, "status_code": response.status_code}
        except Exception:
            upstream = {"reachable": False, "status_code": None}
    return {"enabled": True, "configured": True, "target_origin": cfg["target_origin"], "upstream": upstream}


@router.get("/challenge/{token}")
async def challenge_page(token: str):
    challenge = await load_challenge_token(token)
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge expired")
    return render_challenge_page({"token": token, **challenge})


@router.get("/challenge/{token}/verify")
async def verify_challenge_pow(token: str, nonce: str, next: str = "/"):
    challenge = await load_challenge_token(token)
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge expired")
    if not verify_pow_solution({"token": token, **challenge}, nonce):
        raise HTTPException(status_code=400, detail="Invalid challenge solution")
    ttl_sec = int(challenge_settings().get("challenge_bypass_ttl_sec", 900) or 900)
    bypass_token = issue_bypass_cookie(challenge["subject"], ttl_sec)
    response = Response(status_code=302, headers={"Location": _append_bypass_token(next or challenge.get("next_url") or "/", bypass_token)})
    response.set_cookie("_skynet_challenge", bypass_token, max_age=ttl_sec, httponly=True, samesite="Lax")
    async with AsyncSessionLocal() as db:
        await record_gateway_challenge_result(
            db,
            request_id=challenge.get("request_id"),
            challenge_type=str(challenge.get("type") or "js_pow"),
            outcome="passed",
            site_id=_gateway_cfg().get("site_id"),
        )
        await db.commit()
    return response


@router.post("/challenge/{token}/verify-honeypot")
async def verify_challenge_honeypot(token: str, request: Request):
    challenge = await load_challenge_token(token)
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge expired")
    form = await request.form()
    next_url = str(form.get("next") or challenge.get("next_url") or "/")
    field_name = str(challenge.get("honeypot_field") or "website")
    field_value = str(form.get(field_name) or "")
    if field_value:
        raise HTTPException(status_code=400, detail="Honeypot triggered")
    ttl_sec = int(challenge_settings().get("challenge_bypass_ttl_sec", 900) or 900)
    bypass_token = issue_bypass_cookie(challenge["subject"], ttl_sec)
    response = Response(status_code=302, headers={"Location": _append_bypass_token(next_url, bypass_token)})
    response.set_cookie("_skynet_challenge", bypass_token, max_age=ttl_sec, httponly=True, samesite="Lax")
    async with AsyncSessionLocal() as db:
        await record_gateway_challenge_result(
            db,
            request_id=challenge.get("request_id"),
            challenge_type=str(challenge.get("type") or "honeypot"),
            outcome="passed",
            site_id=_gateway_cfg().get("site_id"),
        )
        await db.commit()
    return response


@router.api_route("/proxy", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"])
@router.api_route("/proxy/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"])
async def proxy_request(
    request: Request,
    path: str = "",
    fp: str | None = Query(None),
    dc: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    cfg = _gateway_cfg()
    if not cfg["enabled"] or not cfg["target_origin"]:
        raise HTTPException(status_code=503, detail="Gateway mode is not configured")

    started = time.perf_counter()
    decision = await _decision(db, request, fp, dc)
    request_id = uuid.uuid4().hex[:10]

    if decision["action"] == "block":
        await record_gateway_event(
            db,
            decision="block",
            reason=decision["reason"],
            request_id=request_id,
            latency_ms=(time.perf_counter() - started) * 1000,
            request_path=request.url.path,
            method=request.method,
            site_id=cfg["site_id"],
        )
        await db.commit()
        return Response(
            content='{"blocked":true,"request_id":"%s","reason":"%s"}' % (request_id, decision["reason"]),
            media_type="application/json",
            status_code=403,
            headers={"X-SkyNet-Decision": "block", "X-SkyNet-Request-Id": request_id},
        )
    if decision["action"] == "challenge":
        challenge = await create_challenge_token(
            subject=decision.get("ip") or get_client_ip(request),
            request_id=request_id,
            next_url=str(request.url),
            reason=decision["reason"],
        )
        await record_gateway_event(
            db,
            decision="challenge",
            reason=decision["reason"],
            request_id=request_id,
            latency_ms=(time.perf_counter() - started) * 1000,
            request_path=request.url.path,
            method=request.method,
            site_id=cfg["site_id"],
            challenge_type=str(challenge.get("type") or "js_pow"),
        )
        await db.commit()
        return build_challenge_response(challenge=challenge, request_id=request_id, accept_html=_prefers_html(request))
    if decision["action"] == "rate_limit":
        retry_after = int(runtime_settings().get("response_slowdown_retry_after_sec", 30) or 30)
        await record_gateway_event(
            db,
            decision="rate_limit",
            reason=decision["reason"],
            request_id=request_id,
            latency_ms=(time.perf_counter() - started) * 1000,
            request_path=request.url.path,
            method=request.method,
            site_id=cfg["site_id"],
        )
        await db.commit()
        return Response(
            content='{"rate_limited":true,"request_id":"%s","reason":"%s","retry_after":%s}' % (request_id, decision["reason"], retry_after),
            media_type="application/json",
            status_code=429,
            headers={"X-SkyNet-Decision": "rate_limit", "X-SkyNet-Request-Id": request_id, "Retry-After": str(retry_after)},
        )

    target_url = urljoin(f"{cfg['target_origin']}/", path)
    if request.url.query:
        passthrough = str(request.url.query)
        if passthrough:
            target_url = f"{target_url}?{passthrough}"

    body = await request.body()
    timeout = max(cfg["timeout_ms"] / 1000, 1)
    try:
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=False) as client:
            upstream = await client.request(
                request.method,
                target_url,
                headers=_forward_headers(request, cfg),
                content=body or None,
            )
    except Exception:
        await record_gateway_event(
            db,
            decision="allow",
            reason="upstream_error",
            request_id=request_id,
            latency_ms=(time.perf_counter() - started) * 1000,
            request_path=request.url.path,
            method=request.method,
            upstream_status=502,
            site_id=cfg["site_id"],
        )
        await db.commit()
        return Response(
            content='{"error":"upstream_unreachable","request_id":"%s"}' % request_id,
            media_type="application/json",
            status_code=502,
            headers={"X-SkyNet-Decision": "allow", "X-SkyNet-Request-Id": request_id},
        )

    await record_gateway_event(
        db,
        decision="allow",
        reason=decision["reason"],
        request_id=request_id,
        latency_ms=(time.perf_counter() - started) * 1000,
        request_path=request.url.path,
        method=request.method,
        upstream_status=upstream.status_code,
        site_id=cfg["site_id"],
    )
    await db.commit()

    response_headers = {
        key: value
        for key, value in upstream.headers.items()
        if key.lower() not in {"content-length", "transfer-encoding", "connection"}
    }
    response_headers["X-SkyNet-Decision"] = "allow"
    response_headers["X-SkyNet-Request-Id"] = request_id
    return Response(
        content=upstream.content,
        status_code=upstream.status_code,
        headers=response_headers,
        media_type=upstream.headers.get("content-type"),
    )
