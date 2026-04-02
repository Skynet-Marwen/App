import asyncio
import json
import time
import uuid
from datetime import datetime, timedelta, timezone
from sqlalchemy import func, select
from ..core.database import AsyncSessionLocal
from ..core.redis import get_redis
from ..models.anomaly_flag import AnomalyFlag
from ..models.device import Device
from ..models.incident import Incident
from ..models.visitor import Visitor
from .anti_evasion_config import get_anti_evasion_config
from .bot_detection import detect_click_farm, detect_crawler_signature, detect_headless_signals
from .dnsbl import lookup_ip as dnsbl_lookup_ip
from .form_spam import assess_form_submission
from .incident_notifications import dispatch_incident_notifications

RISK_POINTS = {
    "bot": 30,
    "crawler_signature": 35,
    "headless_browser": 35,
    "canvas_missing": 10,
    "webgl_missing": 15,
    "ip_rotation": 25,
    "cookie_evasion": 10,
    "spam_detected": 25,
    "behavior_entropy": 20,
    "click_farm": 35,
    "dnsbl": 40,
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
    incidents = []
    async with AsyncSessionLocal() as db:
        device = await _get_device(db, context.get("device_id"))
        risk = 0
        if config.get("bot_detection") and _looks_like_bot(context.get("user_agent")):
            risk += RISK_POINTS["bot"]
            incident = await _emit_incident(db, redis, "BOT_DETECTED", "Bot-like user-agent detected", context, "high")
            if incident:
                incidents.append(incident)
        if config.get("crawler_signature_detection"):
            crawler_signal = detect_crawler_signature(context.get("user_agent"))
            if crawler_signal:
                risk += RISK_POINTS["crawler_signature"]
                incident = await _emit_incident(
                    db,
                    redis,
                    "CRAWLER_SIGNATURE",
                    f"Crawler signature matched: {crawler_signal['matched_token']}",
                    {**context, "details": crawler_signal},
                    crawler_signal["severity"],
                )
                if incident:
                    incidents.append(incident)
        if config.get("headless_browser_detection"):
            headless_signal = detect_headless_signals(context.get("user_agent"), context.get("fingerprint_traits"))
            if headless_signal:
                risk += RISK_POINTS["headless_browser"]
                incident = await _emit_incident(
                    db,
                    redis,
                    "HEADLESS_BROWSER",
                    "Headless browser signals detected",
                    {**context, "details": headless_signal},
                    headless_signal["severity"],
                )
                if incident:
                    incidents.append(incident)
        if config.get("canvas_fingerprint") and not context.get("canvas_hash"):
            risk += RISK_POINTS["canvas_missing"]
            incident = await _emit_incident(db, redis, "CANVAS_FINGERPRINT_MISSING", "Canvas fingerprint missing", context, "medium")
            if incident:
                incidents.append(incident)
        if config.get("webgl_fingerprint") and not context.get("webgl_hash"):
            risk += RISK_POINTS["webgl_missing"]
            incident = await _emit_incident(db, redis, "WEBGL_FINGERPRINT_MISSING", "WebGL fingerprint missing", context, "medium")
            if incident:
                incidents.append(incident)
        if config.get("ip_rotation_detection") and context.get("fingerprint"):
            if await _record_ip_rotation(redis, context["fingerprint"], context.get("ip")):
                risk += RISK_POINTS["ip_rotation"]
                incident = await _emit_incident(db, redis, "IP_ROTATION", "Rapid IP rotation detected", context, "high")
                if incident:
                    incidents.append(incident)
        if config.get("cookie_evasion") and context.get("fingerprint") and context.get("session_id"):
            if await _record_session_rotation(redis, context["fingerprint"], context["session_id"]):
                risk += RISK_POINTS["cookie_evasion"]
                incident = await _emit_incident(db, redis, "COOKIE_EVASION", "Session continuity changed for existing device", context, "medium")
                if incident:
                    incidents.append(incident)
        if config.get("dnsbl_enabled"):
            dnsbl = await dnsbl_lookup_ip(
                context.get("ip"),
                config.get("dnsbl_providers"),
                ttl_sec=int(config.get("dnsbl_cache_ttl_sec", 900) or 900),
            )
            if dnsbl.get("listed"):
                risk += RISK_POINTS["dnsbl"]
                incident = await _emit_incident(
                    db,
                    redis,
                    "DNSBL_LISTED",
                    "Source IP is listed by a public DNS blocklist provider",
                    {**context, "details": dnsbl},
                    "critical" if str(config.get("dnsbl_action") or "challenge") == "block" else "high",
                )
                if incident:
                    incidents.append(incident)
        risk += await _apply_multi_account_risk(db, redis, context, config, incidents)
        if device:
            device.risk_score = min(100, max(device.risk_score or 0, risk))
        await db.commit()
    _dispatch_notifications(incidents)


async def _run_event_checks(context: dict) -> None:
    config = get_anti_evasion_config()
    redis = get_redis()
    spam_assessment = await _record_spam_window(redis, context, config)
    behavior_assessment = _assess_behavior_entropy(context.get("behavior"))
    click_farm_assessment = detect_click_farm(context.get("behavior")) if config.get("click_farm_detection") else None
    form_findings = await assess_form_submission(redis, context, config)
    if not spam_assessment and not behavior_assessment and not click_farm_assessment and not form_findings:
        return
    async with AsyncSessionLocal() as db:
        incidents = []
        device = await _get_device(db, context.get("device_id"))
        if spam_assessment:
            incident = await _emit_incident(
                db,
                redis,
                "SPAM_DETECTED",
                f"Custom event burst exceeded anti-spam threshold ({spam_assessment['count']}/{spam_assessment['threshold']} in {spam_assessment['window_seconds']}s)",
                {**context, "details": spam_assessment},
                spam_assessment["severity"],
            )
            if incident:
                incidents.append(incident)
            if device:
                device.risk_score = min(100, max(device.risk_score or 0, spam_assessment["risk_score"]))
        created_flag = None
        if behavior_assessment:
            incident = await _emit_incident(
                db,
                redis,
                "LOW_BEHAVIOR_ENTROPY",
                "Interaction timing appears overly regular for a human session",
                {**context, "details": behavior_assessment},
                behavior_assessment["severity"],
            )
            if incident:
                incidents.append(incident)
            if device:
                device.risk_score = min(100, max(device.risk_score or 0, behavior_assessment["risk_score"]))
            if context.get("user_id"):
                created_flag = await _emit_behavior_flag(db, context["user_id"], context.get("device_id"), behavior_assessment)
        if click_farm_assessment:
            incident = await _emit_incident(
                db,
                redis,
                "CLICK_FARM_PATTERN",
                "Click cadence and session context look more like a click farm than a human session",
                {**context, "details": click_farm_assessment},
                click_farm_assessment["severity"],
            )
            if incident:
                incidents.append(incident)
            if device:
                device.risk_score = min(100, max(device.risk_score or 0, click_farm_assessment["risk_score"]))
        for finding in form_findings:
            incident = await _emit_incident(
                db,
                redis,
                finding["incident_type"],
                finding["description"],
                {**context, "details": finding["details"]},
                finding["severity"],
            )
            if incident:
                incidents.append(incident)
            if device:
                device.risk_score = min(100, max(device.risk_score or 0, finding["risk_score"]))
        if context.get("user_id") and (spam_assessment or created_flag):
            from .risk_engine import recompute
            await recompute(
                db,
                context["user_id"],
                trigger_type="behavior_drift" if created_flag else "spam_detected",
                trigger_detail=behavior_assessment if created_flag else spam_assessment,
            )
        elif context.get("user_id") and (click_farm_assessment or form_findings):
            from .risk_engine import recompute
            await recompute(
                db,
                context["user_id"],
                trigger_type="spam_detected",
                trigger_detail={
                    "click_farm": click_farm_assessment,
                    "form_findings": form_findings,
                },
            )
        await db.commit()
    _dispatch_notifications(incidents)


async def _run_identify_checks(context: dict) -> None:
    config = get_anti_evasion_config()
    redis = get_redis()
    incidents = []
    async with AsyncSessionLocal() as db:
        device = await _get_device(db, context.get("device_id"))
        if not device:
            return
        risk = await _apply_multi_account_risk(db, redis, context, config, incidents)
        device.risk_score = min(100, max(device.risk_score or 0, risk))
        await db.commit()
    _dispatch_notifications(incidents)


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


async def _record_spam_window(redis, context: dict, config: dict) -> dict | None:
    window_seconds = 60
    threshold = int(config.get("spam_rate_threshold", 10))
    bucket = context.get("device_id") or context.get("fingerprint") or context.get("ip") or "unknown"
    key = f"ae:spam:{context.get('site_id')}:{bucket}"
    now_ms = int(time.time() * 1000)
    member = f"{now_ms}:{uuid.uuid4().hex[:8]}"
    await redis.zadd(key, {member: now_ms})
    await redis.zremrangebyscore(key, 0, now_ms - (window_seconds * 1000))
    count = await redis.zcard(key)
    await redis.expire(key, window_seconds + 5)
    if count <= threshold:
        return None
    severity = "critical" if count >= threshold * 2 else "high"
    return {
        "count": count,
        "threshold": threshold,
        "window_seconds": window_seconds,
        "severity": severity,
        "risk_score": 95 if severity == "critical" else 80,
    }


def _assess_behavior_entropy(metrics: dict | None) -> dict | None:
    if not isinstance(metrics, dict):
        return None
    interval_values = []
    for key in ("click_intervals_ms", "scroll_intervals_ms", "pointer_intervals_ms", "keydown_intervals_ms"):
        values = metrics.get(key) or []
        interval_values.extend([int(value) for value in values if isinstance(value, (int, float)) and value > 0])
    total_interactions = int(metrics.get("total_interactions") or 0)
    if total_interactions < 8 or len(interval_values) < 4:
        return None
    buckets = {max(1, int(value // 250)) for value in interval_values}
    entropy = round(len(buckets) / max(len(interval_values), 1), 3)
    if entropy >= 0.35:
        return None
    severity = "critical" if entropy < 0.18 else "high" if entropy < 0.28 else "medium"
    return {
        "entropy_score": entropy,
        "total_interactions": total_interactions,
        "bucket_count": len(buckets),
        "risk_score": 90 if severity == "critical" else 75 if severity == "high" else 60,
        "severity": severity,
    }


async def _apply_multi_account_risk(db, redis, context: dict, config: dict, incidents: list | None = None) -> int:
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
            incident = await _emit_incident(db, redis, "MULTI_ACCOUNT_DEVICE", "Device linked to multiple users", context, "high")
            if incident and incidents is not None:
                incidents.append(incident)
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
            incident = await _emit_incident(db, redis, "MULTI_ACCOUNT_IP", "IP linked to multiple users", context, "high")
            if incident and incidents is not None:
                incidents.append(incident)
    return risk


async def _emit_behavior_flag(db, external_user_id: str, device_id: str | None, assessment: dict) -> AnomalyFlag | None:
    cutoff = datetime.now(timezone.utc) - timedelta(hours=12)
    existing = await db.scalar(
        select(AnomalyFlag).where(
            AnomalyFlag.external_user_id == external_user_id,
            AnomalyFlag.flag_type == "behavior_drift",
            AnomalyFlag.status == "open",
            AnomalyFlag.detected_at >= cutoff,
        )
    )
    if existing:
        return None
    flag = AnomalyFlag(
        id=str(uuid.uuid4()),
        external_user_id=external_user_id,
        flag_type="behavior_drift",
        severity=assessment["severity"],
        status="open",
        related_device_id=device_id,
        evidence=json.dumps(assessment),
        detected_at=datetime.now(timezone.utc),
    )
    db.add(flag)
    await db.flush()
    return flag


async def _emit_incident(db, redis, incident_type: str, description: str, context: dict, severity: str) -> Incident | None:
    fingerprint = context.get("fingerprint") or context.get("device_id") or context.get("ip") or "unknown"
    dedupe_key = f"ae:incident:{incident_type}:{fingerprint}"
    if await redis.get(dedupe_key):
        return None
    await redis.set(dedupe_key, "1", ex=3600)
    incident = Incident(
        id=str(uuid.uuid4()),
        type=incident_type,
        description=description,
        ip=context.get("ip"),
        device_id=context.get("device_id"),
        user_id=context.get("user_id"),
        severity=severity,
        status="open",
        extra_data=json.dumps(context.get("details")) if context.get("details") is not None else None,
    )
    db.add(incident)
    return incident


def _serialize_incident(incident: Incident) -> dict:
    return {
        "id": incident.id,
        "type": incident.type,
        "description": incident.description,
        "severity": incident.severity,
        "status": incident.status,
        "ip": incident.ip,
        "device_id": incident.device_id,
        "user_id": incident.user_id,
        "target": incident.user_id or incident.device_id or incident.ip or "system",
        "detected_at": incident.detected_at.isoformat() if incident.detected_at else datetime.now(timezone.utc).isoformat(),
    }


def _dispatch_notifications(incidents: list[Incident]) -> None:
    if incidents:
        dispatch_incident_notifications([_serialize_incident(incident) for incident in incidents])


def _looks_like_bot(user_agent: str | None) -> bool:
    ua = (user_agent or "").lower()
    return any(token in ua for token in ("bot", "crawler", "spider", "headless"))
