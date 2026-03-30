import asyncio
from sqlalchemy import func, select
from ..core.database import AsyncSessionLocal
from ..core.redis import get_redis
from ..models.device import Device
from ..models.incident import Incident
from ..models.visitor import Visitor
from .anti_evasion_config import get_anti_evasion_config

RISK_POINTS = {
    "bot": 30,
    "canvas_missing": 10,
    "webgl_missing": 15,
    "ip_rotation": 25,
    "cookie_evasion": 10,
}


def dispatch_pageview_checks(context: dict) -> None:
    asyncio.create_task(_safe_run(_run_pageview_checks(context)))


def dispatch_event_checks(context: dict) -> None:
    asyncio.create_task(_safe_run(_run_event_checks(context)))


def dispatch_identify_checks(context: dict) -> None:
    asyncio.create_task(_safe_run(_run_identify_checks(context)))


async def _safe_run(coro) -> None:
    try:
        await coro
    except Exception:
        return


async def _run_pageview_checks(context: dict) -> None:
    config = get_anti_evasion_config()
    redis = get_redis()
    async with AsyncSessionLocal() as db:
        device = await _get_device(db, context.get("device_id"))
        risk = 0
        if config.get("bot_detection") and _looks_like_bot(context.get("user_agent")):
            risk += RISK_POINTS["bot"]
            await _emit_incident(db, redis, "BOT_DETECTED", "Bot-like user-agent detected", context, "high")
        if config.get("canvas_fingerprint") and not context.get("canvas_hash"):
            risk += RISK_POINTS["canvas_missing"]
            await _emit_incident(db, redis, "CANVAS_FINGERPRINT_MISSING", "Canvas fingerprint missing", context, "medium")
        if config.get("webgl_fingerprint") and not context.get("webgl_hash"):
            risk += RISK_POINTS["webgl_missing"]
            await _emit_incident(db, redis, "WEBGL_FINGERPRINT_MISSING", "WebGL fingerprint missing", context, "medium")
        if config.get("ip_rotation_detection") and context.get("fingerprint"):
            if await _record_ip_rotation(redis, context["fingerprint"], context.get("ip")):
                risk += RISK_POINTS["ip_rotation"]
                await _emit_incident(db, redis, "IP_ROTATION", "Rapid IP rotation detected", context, "high")
        if config.get("cookie_evasion") and context.get("fingerprint") and context.get("session_id"):
            if await _record_session_rotation(redis, context["fingerprint"], context["session_id"]):
                risk += RISK_POINTS["cookie_evasion"]
                await _emit_incident(db, redis, "COOKIE_EVASION", "Session continuity changed for existing device", context, "medium")
        risk += await _apply_multi_account_risk(db, redis, context, config)
        if device:
            device.risk_score = min(100, risk)
        await db.commit()


async def _run_event_checks(context: dict) -> None:
    config = get_anti_evasion_config()
    redis = get_redis()
    bucket = context.get("fingerprint") or context.get("ip") or "unknown"
    key = f"spam:{context.get('site_id')}:{bucket}"
    count = await redis.incr(key)
    if count == 1:
        await redis.expire(key, 60)
    if count <= int(config.get("spam_rate_threshold", 10)):
        return
    async with AsyncSessionLocal() as db:
        await _emit_incident(db, redis, "SPAM_DETECTED", "Custom event burst exceeded anti-spam threshold", context, "high")
        await db.commit()


async def _run_identify_checks(context: dict) -> None:
    config = get_anti_evasion_config()
    redis = get_redis()
    async with AsyncSessionLocal() as db:
        device = await _get_device(db, context.get("device_id"))
        if not device:
            return
        risk = await _apply_multi_account_risk(db, redis, context, config)
        device.risk_score = min(100, max(device.risk_score or 0, risk))
        await db.commit()


async def _get_device(db, device_id: str | None) -> Device | None:
    if not device_id:
        return None
    return await db.get(Device, device_id)


async def _record_ip_rotation(redis, fingerprint: str, ip: str | None) -> bool:
    if not ip:
        return False
    key = f"ae:ips:{fingerprint}"
    await redis.sadd(key, ip)
    await redis.expire(key, 600)
    return (await redis.scard(key)) > 3


async def _record_session_rotation(redis, fingerprint: str, session_id: str) -> bool:
    key = f"ae:sessions:{fingerprint}"
    await redis.sadd(key, session_id)
    await redis.expire(key, 1800)
    return (await redis.scard(key)) > 1


async def _apply_multi_account_risk(db, redis, context: dict, config: dict) -> int:
    if not context.get("device_id") and not context.get("ip"):
        return 0
    risk = 0
    if context.get("device_id"):
        device_users = await db.scalar(
            select(func.count(func.distinct(Visitor.linked_user))).where(
                Visitor.device_id == context["device_id"],
                Visitor.linked_user.is_not(None),
            )
        ) or 0
        extra = max(device_users - int(config.get("max_accounts_per_device", 3)), 0)
        if extra:
            risk += extra * 20
            await _emit_incident(db, redis, "MULTI_ACCOUNT_DEVICE", "Device linked to multiple users", context, "high")
    if context.get("ip"):
        ip_users = await db.scalar(
            select(func.count(func.distinct(Visitor.linked_user))).where(
                Visitor.ip == context["ip"],
                Visitor.linked_user.is_not(None),
            )
        ) or 0
        extra = max(ip_users - int(config.get("max_accounts_per_ip", 5)), 0)
        if extra:
            risk += extra * 20
            await _emit_incident(db, redis, "MULTI_ACCOUNT_IP", "IP linked to multiple users", context, "high")
    return risk


async def _emit_incident(db, redis, incident_type: str, description: str, context: dict, severity: str) -> None:
    fingerprint = context.get("fingerprint") or context.get("device_id") or context.get("ip") or "unknown"
    dedupe_key = f"ae:incident:{incident_type}:{fingerprint}"
    if await redis.get(dedupe_key):
        return
    await redis.set(dedupe_key, "1", ex=3600)
    db.add(
        Incident(
            type=incident_type,
            description=description,
            ip=context.get("ip"),
            device_id=context.get("device_id"),
            user_id=context.get("user_id"),
            severity=severity,
            status="open",
        )
    )


def _looks_like_bot(user_agent: str | None) -> bool:
    ua = (user_agent or "").lower()
    return any(token in ua for token in ("bot", "crawler", "spider", "headless"))
