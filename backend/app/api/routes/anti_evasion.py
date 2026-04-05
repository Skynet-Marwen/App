import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, or_, select

from ...core.database import get_db
from ...core.security import get_current_user, require_admin_user
from ...models.device import Device
from ...models.user import User
from ...models.incident import Incident
from ...models.user_profile import UserProfile
from ...models.visitor import Visitor
from ...services.anti_evasion_config import load_anti_evasion_config, update_anti_evasion_config
from ...services.audit import log_action

router = APIRouter(prefix="/anti-evasion", tags=["anti-evasion"])


def _fmt_dt(dt: datetime | None) -> str | None:
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ") if dt else None


def _parse_extra(raw: str | None):
    if not raw:
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return raw


def _serialize_profile(profile: UserProfile | None) -> dict | None:
    if not profile:
        return None
    return {
        "external_user_id": profile.external_user_id,
        "email": profile.email,
        "display_name": profile.display_name,
        "current_risk_score": profile.current_risk_score,
        "trust_level": profile.trust_level,
        "total_devices": profile.total_devices,
        "total_sessions": profile.total_sessions,
        "last_seen": _fmt_dt(profile.last_seen),
        "last_country": profile.last_country,
        "enhanced_audit": profile.enhanced_audit,
    }


def _serialize_device(device: Device | None) -> dict | None:
    if not device:
        return None
    return {
        "id": device.id,
        "fingerprint": device.fingerprint,
        "match_key": device.match_key,
        "browser": device.browser,
        "os": device.os,
        "type": device.type,
        "status": device.status,
        "risk_score": device.risk_score,
        "owner_user_id": device.owner_user_id,
        "shared_user_count": device.shared_user_count,
        "last_seen": _fmt_dt(device.last_seen),
    }


def _serialize_visitor(visitor: Visitor) -> dict:
    return {
        "id": visitor.id,
        "site_id": visitor.site_id,
        "device_id": visitor.device_id,
        "external_user_id": visitor.external_user_id,
        "ip": visitor.ip,
        "country": visitor.country,
        "country_flag": visitor.country_flag,
        "browser": visitor.browser,
        "os": visitor.os,
        "device_type": visitor.device_type,
        "status": visitor.status,
        "page_views": visitor.page_views,
        "first_seen": _fmt_dt(visitor.first_seen),
        "last_seen": _fmt_dt(visitor.last_seen),
    }


@router.get("/config")
async def get_config(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return await load_anti_evasion_config(db)


@router.put("/config")
async def update_config(data: dict, db: AsyncSession = Depends(get_db), current: User = Depends(require_admin_user)):
    config = await update_anti_evasion_config(db, data)
    log_action(db, action="CONFIG_CHANGE", actor_id=current.id, target_type="anti_evasion", target_id="config", extra={"updated_keys": sorted(data.keys())})
    await db.commit()
    return config


@router.get("/incidents")
async def list_incidents(
    page: int = Query(1, ge=1),
    page_size: int = Query(30, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    total = await db.scalar(select(func.count()).select_from(Incident)) or 0
    result = await db.execute(
        select(Incident).order_by(Incident.detected_at.desc()).offset((page - 1) * page_size).limit(page_size)
    )
    incidents = result.scalars().all()
    return {
        "total": total,
        "items": [
            {
                "id": i.id,
                "type": i.type,
                "description": i.description,
                "ip": i.ip,
                "severity": i.severity,
                "status": i.status,
                "detected_at": i.detected_at.strftime("%Y-%m-%d %H:%M"),
            }
            for i in incidents
        ],
    }


@router.get("/incidents/{incident_id}")
async def get_incident_detail(
    incident_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    incident = await db.get(Incident, incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    related_device = await db.get(Device, incident.device_id) if incident.device_id else None
    related_user_id = incident.user_id or (related_device.owner_user_id if related_device else None)

    visitor_filters = []
    if incident.device_id:
        visitor_filters.append(Visitor.device_id == incident.device_id)
    if incident.ip:
        visitor_filters.append(Visitor.ip == incident.ip)
    if related_user_id:
        visitor_filters.append(Visitor.external_user_id == related_user_id)

    related_visitors: list[Visitor] = []
    if visitor_filters:
        related_visitors = (
            await db.execute(
                select(Visitor)
                .where(or_(*visitor_filters))
                .order_by(Visitor.last_seen.desc())
                .limit(6)
            )
        ).scalars().all()

    if not related_device:
        fallback_device_id = next((visitor.device_id for visitor in related_visitors if visitor.device_id), None)
        if fallback_device_id:
            related_device = await db.get(Device, fallback_device_id)

    if not related_user_id:
        related_user_id = next(
            (
                user_id
                for user_id in [*(visitor.external_user_id for visitor in related_visitors), getattr(related_device, "owner_user_id", None)]
                if user_id
            ),
            None,
        )

    related_user = None
    if related_user_id:
        related_user = await db.scalar(
            select(UserProfile).where(UserProfile.external_user_id == related_user_id)
        )

    target_type = "system"
    target_label = incident.type
    if incident.user_id:
        target_type = "user"
        target_label = incident.user_id[:12]
    elif incident.device_id:
        target_type = "device"
        target_label = incident.device_id[:12]
    elif incident.ip:
        target_type = "ip"
        target_label = incident.ip

    return {
        "id": incident.id,
        "type": incident.type,
        "description": incident.description,
        "severity": incident.severity,
        "status": incident.status,
        "ip": incident.ip,
        "device_id": incident.device_id,
        "user_id": incident.user_id,
        "detected_at": _fmt_dt(incident.detected_at),
        "resolved_at": _fmt_dt(incident.resolved_at),
        "extra_data": _parse_extra(incident.extra_data),
        "target": {
            "type": target_type,
            "label": target_label,
        },
        "related_user": _serialize_profile(related_user),
        "related_device": _serialize_device(related_device),
        "related_visitors": [_serialize_visitor(visitor) for visitor in related_visitors],
    }


@router.post("/incidents/{incident_id}/resolve")
async def resolve_incident(incident_id: str, db: AsyncSession = Depends(get_db), current: User = Depends(get_current_user)):
    inc = await db.get(Incident, incident_id)
    if inc:
        inc.status = "resolved"
        inc.resolved_at = datetime.now(timezone.utc)
        log_action(db, action="RESOLVE_INCIDENT", actor_id=current.id, target_type="incident", target_id=incident_id)
        await db.commit()
    return {"message": "Resolved"}
