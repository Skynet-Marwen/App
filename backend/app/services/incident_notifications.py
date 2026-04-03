from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
from datetime import datetime, timezone
from typing import Any

import httpx
from sqlalchemy import select

from ..core.database import AsyncSessionLocal
from ..models.incident import Incident
from ..models.user import User
from .email import send_incident_alert_email, send_operational_alert_email
from .integration_delivery import dispatch_connector_event
from .notification_delivery import create_delivery, mark_delivery_failed, mark_delivery_sent
from .runtime_config import runtime_settings


HIGH_SEVERITIES = {"high", "critical"}
SEVERITY_RANK = {"low": 0, "medium": 1, "high": 2, "critical": 3}
DEFAULT_NOTIFICATION_EVENT_MATRIX = {
    "high_severity_incident": {"label": "High Severity Incident", "webhook": True, "smtp": True, "escalate": True},
    "evasion_detected": {"label": "Evasion Detected", "webhook": True, "smtp": False, "escalate": False},
    "spam_detected": {"label": "Spam Detected", "webhook": True, "smtp": False, "escalate": False},
    "block_triggered": {"label": "Block Triggered", "webhook": True, "smtp": False, "escalate": False},
    "new_user": {"label": "New User", "webhook": True, "smtp": False, "escalate": False},
}
_scheduled_escalations: set[tuple[str, int]] = set()


def dispatch_incident_notifications(incidents: list[dict] | dict | None) -> None:
    if not incidents:
        return
    items = incidents if isinstance(incidents, list) else [incidents]
    items = [item for item in items if item and item.get("severity") in HIGH_SEVERITIES]
    if not items:
        return
    asyncio.create_task(_safe_dispatch(items))


def dispatch_notification_event(
    event_key: str,
    payload: dict[str, Any],
    *,
    subject: str | None = None,
    severity: str = "medium",
    incident_id: str | None = None,
    allow_escalation: bool = False,
) -> None:
    if not event_key:
        return
    asyncio.create_task(
        _safe_dispatch_event(
            event_key,
            payload,
            subject=subject,
            severity=severity,
            incident_id=incident_id,
            allow_escalation=allow_escalation,
        )
    )


async def _safe_dispatch(incidents: list[dict]) -> None:
    try:
        await _dispatch(incidents, escalation_level=0)
    except Exception:
        return


async def _safe_dispatch_event(
    event_key: str,
    payload: dict[str, Any],
    *,
    subject: str | None,
    severity: str,
    incident_id: str | None,
    allow_escalation: bool,
) -> None:
    try:
        await _dispatch_event(
            event_key,
            payload,
            subject=subject,
            severity=severity,
            incident_id=incident_id,
            allow_escalation=allow_escalation,
        )
    except Exception:
        return


async def _dispatch(incidents: list[dict], escalation_level: int = 0) -> None:
    settings = runtime_settings()
    if settings.get("smtp_enabled") and _event_channel_enabled(settings, "high_severity_incident", "smtp") and _channel_enabled(settings, "smtp", escalation_level):
        await _send_email_notifications(incidents, settings, escalation_level=escalation_level)
    if settings.get("webhook_url") and _event_channel_enabled(settings, "high_severity_incident", "webhook") and _channel_enabled(settings, "webhook", escalation_level):
        await _send_webhook_notifications(incidents, settings, escalation_level=escalation_level)
    for incident in incidents:
        subject = _incident_subject(settings.get("instance_name", "SkyNet"), incident)
        payload = _incident_webhook_payload(incident, escalation_level=escalation_level)
        await dispatch_connector_event(
            "siem",
            "high_severity_incident",
            payload,
            subject=subject,
            severity=str(incident.get("severity") or "high"),
            incident_id=incident.get("id"),
        )
        await dispatch_connector_event(
            "monitoring",
            "high_severity_incident",
            payload,
            subject=subject,
            severity=str(incident.get("severity") or "high"),
            incident_id=incident.get("id"),
        )
    if escalation_level == 0:
        _schedule_escalations(incidents, settings)


async def _dispatch_event(
    event_key: str,
    payload: dict[str, Any],
    *,
    subject: str | None,
    severity: str,
    incident_id: str | None,
    allow_escalation: bool,
    escalation_level: int = 0,
) -> None:
    settings = runtime_settings()
    event_label = _event_label(event_key, settings)
    final_subject = subject or f"{settings.get('instance_name', 'SkyNet')} Notification — {event_label}"
    if settings.get("smtp_enabled") and _event_channel_enabled(settings, event_key, "smtp") and _channel_enabled(settings, "smtp", escalation_level):
        await _send_generic_email_notifications(
            event_key,
            payload,
            settings,
            subject=final_subject,
            severity=severity,
            escalation_level=escalation_level,
            incident_id=incident_id,
        )
    if settings.get("webhook_url") and _event_channel_enabled(settings, event_key, "webhook") and _channel_enabled(settings, "webhook", escalation_level):
        await _send_generic_webhook_notification(
            event_key,
            payload,
            settings,
            subject=final_subject,
            severity=severity,
            escalation_level=escalation_level,
            incident_id=incident_id,
        )
    await dispatch_connector_event(
        "siem",
        event_key,
        payload,
        subject=final_subject,
        severity=severity,
        incident_id=incident_id,
    )
    await dispatch_connector_event(
        "monitoring",
        event_key,
        payload,
        subject=final_subject,
        severity=severity,
        incident_id=incident_id,
    )
    if escalation_level == 0 and allow_escalation:
        _schedule_generic_event_escalation(
            event_key,
            payload,
            severity=severity,
            incident_id=incident_id,
            subject=final_subject,
            settings=settings,
        )


async def _send_email_notifications(incidents: list[dict], settings: dict, *, escalation_level: int) -> None:
    async with AsyncSessionLocal() as db:
        recipients = await _load_operator_recipients(db)
        if not recipients:
            return
        instance_name = settings.get("instance_name", "SkyNet")
        for incident in incidents:
            subject = _incident_subject(instance_name, incident)
            for recipient in recipients:
                delivery = await create_delivery(
                    db,
                    channel="smtp",
                    event_type="high_severity_incident",
                    target=recipient,
                    subject=subject,
                    payload={"incident": incident},
                    incident_id=incident.get("id"),
                    escalation_level=escalation_level,
                    attempt_count=escalation_level + 1,
                )
                try:
                    await send_incident_alert_email(recipient, incident, instance_name)
                    await mark_delivery_sent(db, delivery)
                except Exception as exc:
                    await mark_delivery_failed(db, delivery, error_message=str(exc))
            await db.commit()


async def _send_webhook_notifications(incidents: list[dict], settings: dict, *, escalation_level: int) -> None:
    url = settings.get("webhook_url", "")
    secret = settings.get("webhook_secret", "")
    async with AsyncSessionLocal() as db:
        for incident in incidents:
            payload = _incident_webhook_payload(incident, escalation_level=escalation_level)
            delivery = await create_delivery(
                db,
                channel="webhook",
                event_type="high_severity_incident",
                target=url,
                subject=_incident_subject(settings.get("instance_name", "SkyNet"), incident),
                payload=payload,
                incident_id=incident.get("id"),
                escalation_level=escalation_level,
                attempt_count=escalation_level + 1,
            )
            try:
                response = await _post_webhook(
                    url=url,
                    secret=secret,
                    event_type="high_severity_incident",
                    payload=payload,
                )
                await mark_delivery_sent(db, delivery, response_status=response.status_code)
            except Exception as exc:
                status_code = getattr(getattr(exc, "response", None), "status_code", None)
                await mark_delivery_failed(db, delivery, error_message=str(exc), response_status=status_code)
        await db.commit()


async def _send_generic_email_notifications(
    event_key: str,
    payload: dict[str, Any],
    settings: dict,
    *,
    subject: str,
    severity: str,
    escalation_level: int,
    incident_id: str | None,
) -> None:
    async with AsyncSessionLocal() as db:
        recipients = await _load_operator_recipients(db)
        if not recipients:
            return
        instance_name = settings.get("instance_name", "SkyNet")
        event_label = _event_label(event_key, settings)
        summary = _event_email_summary(event_key, payload)
        details = _event_email_details(payload)
        target = _event_target(payload)
        for recipient in recipients:
            delivery = await create_delivery(
                db,
                channel="smtp",
                event_type=event_key,
                target=recipient,
                subject=subject,
                payload=payload,
                incident_id=incident_id,
                escalation_level=escalation_level,
                attempt_count=escalation_level + 1,
            )
            try:
                await send_operational_alert_email(
                    recipient,
                    subject=subject,
                    event_name=event_label,
                    summary=summary,
                    details=details,
                    severity=str(severity).upper(),
                    target=target,
                    instance_name=instance_name,
                )
                await mark_delivery_sent(db, delivery)
            except Exception as exc:
                await mark_delivery_failed(db, delivery, error_message=str(exc))
        await db.commit()


async def _send_generic_webhook_notification(
    event_key: str,
    payload: dict[str, Any],
    settings: dict,
    *,
    subject: str,
    severity: str,
    escalation_level: int,
    incident_id: str | None,
) -> None:
    url = settings.get("webhook_url", "")
    secret = settings.get("webhook_secret", "")
    final_payload = {
        "event": event_key,
        "sent_at": datetime.now(timezone.utc).isoformat(),
        "severity": severity,
        "subject": subject,
        **payload,
    }
    async with AsyncSessionLocal() as db:
        delivery = await create_delivery(
            db,
            channel="webhook",
            event_type=event_key,
            target=url,
            subject=subject,
            payload=final_payload,
            incident_id=incident_id,
            escalation_level=escalation_level,
            attempt_count=escalation_level + 1,
        )
        try:
            response = await _post_webhook(url=url, secret=secret, event_type=event_key, payload=final_payload)
            await mark_delivery_sent(db, delivery, response_status=response.status_code)
        except Exception as exc:
            status_code = getattr(getattr(exc, "response", None), "status_code", None)
            await mark_delivery_failed(db, delivery, error_message=str(exc), response_status=status_code)
        await db.commit()


async def send_test_webhook(
    *,
    db,
    url: str,
    secret: str,
    event_type: str = "webhook_test",
    payload: dict | None = None,
) -> dict:
    final_payload = payload or {
        "event": event_type,
        "sent_at": datetime.now(timezone.utc).isoformat(),
        "message": "SkyNet webhook test delivery",
    }
    delivery = await create_delivery(
        db,
        channel="webhook",
        event_type=event_type,
        target=url,
        subject=f"Webhook Test — {event_type}",
        payload=final_payload,
        attempt_count=1,
    )
    try:
        response = await _post_webhook(url=url, secret=secret, event_type=event_type, payload=final_payload)
        await mark_delivery_sent(db, delivery, response_status=response.status_code)
        return {"ok": True, "status_code": response.status_code}
    except Exception as exc:
        status_code = getattr(getattr(exc, "response", None), "status_code", None)
        await mark_delivery_failed(db, delivery, error_message=str(exc), response_status=status_code)
        raise


def _channel_enabled(settings: dict, channel: str, escalation_level: int) -> bool:
    if escalation_level == 0:
        return True
    configured = settings.get("notification_escalation_channels") or {}
    return bool(configured.get(channel))


def _event_channel_enabled(settings: dict, event_key: str, channel: str) -> bool:
    event_matrix = notification_event_matrix(settings)
    event_config = event_matrix.get(event_key) or {}
    if channel == "webhook" and channel not in event_config:
        legacy = settings.get("webhook_events") or {}
        return bool(legacy.get(f"on_{event_key}"))
    return bool(event_config.get(channel))


def _schedule_escalations(incidents: list[dict], settings: dict) -> None:
    repeat_limit = max(0, int(settings.get("notification_escalation_repeat_limit", 0) or 0))
    if repeat_limit <= 0:
        return
    for incident in incidents:
        if not _should_schedule_escalation(settings, incident):
            continue
        _schedule_incident_escalation(incident["id"], escalation_level=1)


def _schedule_incident_escalation(incident_id: str, *, escalation_level: int) -> None:
    key = (incident_id, escalation_level)
    if key in _scheduled_escalations:
        return
    _scheduled_escalations.add(key)
    asyncio.create_task(_run_escalation_task(incident_id, escalation_level))


async def _run_escalation_task(incident_id: str, escalation_level: int) -> None:
    key = (incident_id, escalation_level)
    try:
        settings = runtime_settings()
        delay_minutes = max(1, int(settings.get("notification_escalation_delay_minutes", 15) or 15))
        await asyncio.sleep(delay_minutes * 60)
        async with AsyncSessionLocal() as db:
            incident = await db.get(Incident, incident_id)
            if incident is None or incident.status != "open":
                return
            payload = _serialize_incident_record(incident)
        await _dispatch([payload], escalation_level=escalation_level)
        refreshed_settings = runtime_settings()
        repeat_limit = max(0, int(refreshed_settings.get("notification_escalation_repeat_limit", 0) or 0))
        if escalation_level < repeat_limit:
            _schedule_incident_escalation(incident_id, escalation_level=escalation_level + 1)
    except Exception:
        return
    finally:
        _scheduled_escalations.discard(key)


def _schedule_generic_event_escalation(
    event_key: str,
    payload: dict[str, Any],
    *,
    severity: str,
    incident_id: str | None,
    subject: str,
    settings: dict,
) -> None:
    if not incident_id or not _should_schedule_event_escalation(settings, event_key):
        return
    _schedule_event_escalation(event_key, incident_id, payload, severity=severity, subject=subject, escalation_level=1)


def _schedule_event_escalation(
    event_key: str,
    incident_id: str,
    payload: dict[str, Any],
    *,
    severity: str,
    subject: str,
    escalation_level: int,
) -> None:
    key = (f"{event_key}:{incident_id}", escalation_level)
    if key in _scheduled_escalations:
        return
    _scheduled_escalations.add(key)
    asyncio.create_task(
        _run_generic_escalation_task(
            event_key,
            incident_id,
            payload,
            severity=severity,
            subject=subject,
            escalation_level=escalation_level,
        )
    )


async def _run_generic_escalation_task(
    event_key: str,
    incident_id: str,
    payload: dict[str, Any],
    *,
    severity: str,
    subject: str,
    escalation_level: int,
) -> None:
    key = (f"{event_key}:{incident_id}", escalation_level)
    try:
        settings = runtime_settings()
        delay_minutes = max(1, int(settings.get("notification_escalation_delay_minutes", 15) or 15))
        await asyncio.sleep(delay_minutes * 60)
        async with AsyncSessionLocal() as db:
            incident = await db.get(Incident, incident_id)
            if incident is None or incident.status != "open":
                return
        await _dispatch_event(
            event_key,
            payload,
            subject=subject,
            severity=severity,
            incident_id=incident_id,
            allow_escalation=False,
            escalation_level=escalation_level,
        )
        refreshed_settings = runtime_settings()
        repeat_limit = max(0, int(refreshed_settings.get("notification_escalation_repeat_limit", 0) or 0))
        if escalation_level < repeat_limit:
            _schedule_event_escalation(
                event_key,
                incident_id,
                payload,
                severity=severity,
                subject=subject,
                escalation_level=escalation_level + 1,
            )
    except Exception:
        return
    finally:
        _scheduled_escalations.discard(key)


def _should_schedule_escalation(settings: dict, incident: dict) -> bool:
    if not settings.get("notification_escalation_enabled") or not _should_schedule_event_escalation(settings, "high_severity_incident"):
        return False
    incident_id = incident.get("id")
    if not incident_id:
        return False
    min_severity = str(settings.get("notification_escalation_min_severity", "critical")).lower()
    severity = str(incident.get("severity", "medium")).lower()
    return SEVERITY_RANK.get(severity, -1) >= SEVERITY_RANK.get(min_severity, SEVERITY_RANK["critical"])


def _should_schedule_event_escalation(settings: dict, event_key: str) -> bool:
    if not settings.get("notification_escalation_enabled"):
        return False
    event_matrix = notification_event_matrix(settings)
    event_config = event_matrix.get(event_key) or {}
    return bool(event_config.get("escalate"))


def _incident_subject(instance_name: str, incident: dict) -> str:
    return f"{instance_name} Incident Alert — {incident.get('type', 'incident')}"


def _incident_webhook_payload(incident: dict, *, escalation_level: int) -> dict:
    return {
        "event": "high_severity_incident",
        "sent_at": datetime.now(timezone.utc).isoformat(),
        "escalation_level": escalation_level,
        "incident": incident,
    }


def _serialize_incident_record(incident: Incident) -> dict:
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


def notification_event_matrix(settings: dict | None = None) -> dict[str, dict[str, Any]]:
    runtime = settings or runtime_settings()
    raw_matrix = runtime.get("notification_event_matrix") or {}
    merged: dict[str, dict[str, Any]] = {}
    legacy = runtime.get("webhook_events") or {}
    for event_key, defaults in DEFAULT_NOTIFICATION_EVENT_MATRIX.items():
        raw = raw_matrix.get(event_key) if isinstance(raw_matrix, dict) else None
        raw = raw if isinstance(raw, dict) else {}
        merged[event_key] = {
            "label": str(raw.get("label") or defaults["label"]),
            "webhook": bool(raw["webhook"]) if "webhook" in raw else bool(legacy.get(f"on_{event_key}", defaults["webhook"])),
            "smtp": bool(raw["smtp"]) if "smtp" in raw else bool(defaults["smtp"]),
            "escalate": bool(raw["escalate"]) if "escalate" in raw else bool(defaults["escalate"]),
        }
    for event_key, raw in raw_matrix.items() if isinstance(raw_matrix, dict) else []:
        if event_key in merged or not isinstance(raw, dict):
            continue
        merged[event_key] = {
            "label": str(raw.get("label") or event_key.replace("_", " ").title()),
            "webhook": bool(raw.get("webhook")),
            "smtp": bool(raw.get("smtp")),
            "escalate": bool(raw.get("escalate")),
        }
    return merged


def _event_label(event_key: str, settings: dict) -> str:
    return notification_event_matrix(settings).get(event_key, {}).get("label") or event_key.replace("_", " ").title()


async def _load_operator_recipients(db) -> list[str]:
    result = await db.execute(
        select(User.email).where(
            User.status == "active",
            User.role.in_(("superadmin", "admin", "moderator")),
        )
    )
    return sorted({email for email in result.scalars().all() if email})


def _event_target(payload: dict[str, Any]) -> str:
    for key in ("target", "user_id", "device_id", "visitor_id", "ip"):
        value = payload.get(key)
        if value:
            return str(value)
    incident = payload.get("incident")
    if isinstance(incident, dict):
        return str(incident.get("target") or incident.get("user_id") or incident.get("device_id") or incident.get("ip") or "system")
    return "system"


def _event_email_summary(event_key: str, payload: dict[str, Any]) -> str:
    incident = payload.get("incident")
    if isinstance(incident, dict):
        return str(incident.get("description") or incident.get("type") or event_key.replace("_", " ").title())
    if event_key == "new_user":
        return f"Operator account {payload.get('username') or payload.get('email') or payload.get('user_id') or 'unknown'} was created."
    if event_key == "block_triggered":
        return f"{payload.get('target_type', 'target').title()} {payload.get('target') or payload.get('target_id') or ''} was blocked."
    return str(payload.get("message") or payload.get("summary") or event_key.replace("_", " ").title())


def _event_email_details(payload: dict[str, Any]) -> str:
    incident = payload.get("incident")
    if isinstance(incident, dict):
        return f"Incident type: {incident.get('type', 'incident')} · Detected at: {incident.get('detected_at', 'unknown')}"
    details = {key: value for key, value in payload.items() if key not in {"message", "summary"}}
    return json.dumps(details, default=str)[:500]


async def _post_webhook(*, url: str, secret: str, event_type: str, payload: dict) -> httpx.Response:
    body = json.dumps(payload, separators=(",", ":"), default=str)
    headers = {
        "Content-Type": "application/json",
        "X-SkyNet-Event": event_type,
    }
    if secret:
        digest = hmac.new(secret.encode(), body.encode(), hashlib.sha256).hexdigest()
        headers["X-SkyNet-Signature"] = f"sha256={digest}"
    async with httpx.AsyncClient(timeout=5.0) as client:
        response = await client.post(url, content=body, headers=headers)
        response.raise_for_status()
        return response
