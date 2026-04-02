from __future__ import annotations

import time
import uuid


def extract_form_context(properties: dict | None) -> dict | None:
    if not isinstance(properties, dict):
        return None
    form = properties.get("form")
    return form if isinstance(form, dict) else None


async def assess_form_submission(redis, context: dict, config: dict) -> list[dict]:
    event_type = str(context.get("event_type") or "")
    form = extract_form_context(context.get("properties"))
    if event_type not in {"form_submit", "form_submission"} and not form:
        return []

    form = form or {}
    findings: list[dict] = []

    if config.get("form_honeypot_detection") and bool(form.get("honeypot_triggered")):
        findings.append(
            {
                "incident_type": "FORM_HONEYPOT_TRIGGERED",
                "description": "Hidden or honeypot form field was filled before submission",
                "severity": "critical",
                "risk_score": 100,
                "details": {"field_name": form.get("honeypot_field"), "signature": form.get("content_signature")},
            }
        )

    velocity = await _record_submission_velocity(redis, context, config)
    if velocity:
        findings.append(
            {
                "incident_type": "FORM_SUBMISSION_VELOCITY",
                "description": "Form submission velocity exceeded the configured threshold",
                "severity": velocity["severity"],
                "risk_score": velocity["risk_score"],
                "details": velocity,
            }
        )

    dedupe = await _record_content_dedupe(redis, context, config, form)
    if dedupe:
        findings.append(
            {
                "incident_type": "FORM_CONTENT_DUPLICATED",
                "description": "Repeated form content hash detected in a short time window",
                "severity": dedupe["severity"],
                "risk_score": dedupe["risk_score"],
                "details": dedupe,
            }
        )

    return findings


async def _record_submission_velocity(redis, context: dict, config: dict) -> dict | None:
    threshold = int(config.get("form_submission_velocity_threshold", 3) or 3)
    window_seconds = int(config.get("form_submission_velocity_window_sec", 300) or 300)
    bucket = context.get("device_id") or context.get("fingerprint") or context.get("ip") or "unknown"
    key = f"ae:form:velocity:{context.get('site_id')}:{bucket}"
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
        "risk_score": 98 if severity == "critical" else 85,
    }


async def _record_content_dedupe(redis, context: dict, config: dict, form: dict) -> dict | None:
    signature = str(form.get("content_signature") or "").strip()
    if not signature:
        return None
    threshold = int(config.get("form_content_dedupe_threshold", 3) or 3)
    ttl = int(config.get("form_content_dedupe_window_sec", 1800) or 1800)
    key = f"ae:form:dedupe:{context.get('site_id')}:{signature}"
    count = await redis.incr(key)
    if count == 1:
        await redis.expire(key, ttl)
    if count <= threshold:
        return None
    severity = "critical" if count >= threshold * 2 else "high"
    return {
        "count": count,
        "threshold": threshold,
        "window_seconds": ttl,
        "severity": severity,
        "risk_score": 96 if severity == "critical" else 80,
        "signature": signature,
    }
