from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, text
from ...core.database import get_db
from ...core.security import get_current_user
from ...models.user import User
from ...models.device import Device
from ...models.visitor import Visitor
from ...schemas.device import DeviceGroupListResponse, DeviceListResponse, DeviceOut, LinkRequest
from ...services.audit import log_action, request_ip
from ...services.incident_notifications import dispatch_notification_event
from ...services.device_identity import (
    RECENT_IP_WINDOW_DAYS,
    group_devices,
    infer_device_descriptor,
    isoformat,
)
from ...services.intelligence_cleanup import delete_device_graph, reconcile_external_profiles
from ...services.tracking_visibility import get_device_tracking_summary, get_visitors_tracking_summary_map
from ...services import identity_service

router = APIRouter(prefix="/devices", tags=["devices"])


def _device_filter(search: str):
    if not search:
        return None
    q = f"%{search}%"
    return or_(
        Device.fingerprint.ilike(q),
        Device.browser.ilike(q),
        Device.os.ilike(q),
        Device.match_key.ilike(q),
    )


def _visitor_count_sq():
    return (
        select(func.count(Visitor.id))
        .where(Visitor.device_id == Device.id)
        .correlate(Device)
        .scalar_subquery()
    )


async def _visitors_by_device(db: AsyncSession, device_ids: list[str]) -> dict[str, list[Visitor]]:
    if not device_ids:
        return {}
    result = await db.execute(
        select(Visitor)
        .where(Visitor.device_id.in_(device_ids))
        .order_by(Visitor.last_seen.desc())
    )
    visitors_by_device: dict[str, list[Visitor]] = {}
    for visitor in result.scalars().all():
        if visitor.device_id:
            visitors_by_device.setdefault(visitor.device_id, []).append(visitor)
    return visitors_by_device


@router.get("", response_model=DeviceListResponse)
async def list_devices(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, le=100),
    search: str = Query(""),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    vc_sq = _visitor_count_sq()

    cq = select(func.count()).select_from(Device)
    q = select(Device, vc_sq.label("vc"))
    flt = _device_filter(search)
    if flt is not None:
        q = q.where(flt)
        cq = cq.where(flt)

    total = await db.scalar(cq) or 0
    result = await db.execute(
        q.order_by(Device.last_seen.desc()).offset((page - 1) * page_size).limit(page_size)
    )
    rows = result.all()
    visitors_by_device = await _visitors_by_device(db, [device.id for device, _vc in rows])

    return {
        "total": total,
        "items": [
            {
                "id": d.id,
                "fingerprint": d.fingerprint,
                **infer_device_descriptor(d, visitors_by_device.get(d.id, [])),
                "match_key": d.match_key,
                "match_version": d.match_version,
                "type": d.type,
                "browser": d.browser,
                "os": d.os,
                "screen_resolution": d.screen_resolution,
                "language": d.language,
                "timezone": d.timezone,
                "canvas_hash": d.canvas_hash,
                "webgl_hash": d.webgl_hash,
                "fingerprint_confidence": d.fingerprint_confidence,
                "stability_score": d.stability_score,
                "composite_fingerprint": d.composite_fingerprint,
                "composite_score": d.composite_score,
                "timezone_offset_minutes": d.timezone_offset_minutes,
                "clock_skew_minutes": d.clock_skew_minutes,
                "risk_score": d.risk_score,
                "status": d.status,
                "linked_user": d.linked_user,
                "visitor_count": vc or 0,
                "first_seen": isoformat(d.first_seen),
                "last_seen": isoformat(d.last_seen),
            }
            for d, vc in rows
        ],
    }


@router.get("/groups", response_model=DeviceGroupListResponse)
async def list_device_groups(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, le=100),
    search: str = Query(""),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = select(Device, _visitor_count_sq().label("vc"))
    flt = _device_filter(search)
    if flt is not None:
        q = q.where(flt)
    result = await db.execute(q.order_by(Device.last_seen.desc()))
    rows = result.all()
    device_ids = [device.id for device, _visitor_count in rows]
    visitors_by_device = await _visitors_by_device(db, device_ids)
    group_visitors_by_device: dict[str, list[dict[str, object]]] = {
        device_id: [
            {
                "ip": visitor.ip,
                "last_seen": visitor.last_seen,
                "os": visitor.os,
                "user_agent": visitor.user_agent,
                "browser": visitor.browser,
                "device_type": visitor.device_type,
            }
            for visitor in visitors
        ]
        for device_id, visitors in visitors_by_device.items()
    }
    groups = group_devices(rows, group_visitors_by_device)
    start = (page - 1) * page_size
    end = start + page_size
    return {
        "total": len(groups),
        "items": groups[start:end],
    }


@router.get("/{device_id}", response_model=DeviceOut)
async def get_device(
    device_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    vc_sq = _visitor_count_sq()
    result = await db.execute(
        select(Device, vc_sq.label("vc")).where(Device.id == device_id)
    )
    row = result.first()
    if not row:
        raise HTTPException(404, "Device not found")
    device, visitor_count = row
    visitors_by_device = await _visitors_by_device(db, [device.id])
    return {
        "id": device.id,
        "fingerprint": device.fingerprint,
        **infer_device_descriptor(device, visitors_by_device.get(device.id, [])),
        "match_key": device.match_key,
        "match_version": device.match_version,
        "type": device.type,
        "browser": device.browser,
        "os": device.os,
        "screen_resolution": device.screen_resolution,
        "language": device.language,
        "timezone": device.timezone,
        "canvas_hash": device.canvas_hash,
        "webgl_hash": device.webgl_hash,
        "fingerprint_confidence": device.fingerprint_confidence,
        "stability_score": device.stability_score,
        "composite_fingerprint": device.composite_fingerprint,
        "composite_score": device.composite_score,
        "timezone_offset_minutes": device.timezone_offset_minutes,
        "clock_skew_minutes": device.clock_skew_minutes,
        "risk_score": device.risk_score,
        "status": device.status,
        "linked_user": device.linked_user,
        "visitor_count": visitor_count or 0,
        "first_seen": isoformat(device.first_seen),
        "last_seen": isoformat(device.last_seen),
        "tracking_signals": await get_device_tracking_summary(db, device.id),
    }


@router.get("/{device_id}/visitors")
async def device_visitors(
    device_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """All visitors that share this device fingerprint.

    Same physical machine → multiple browsers / OSes / IPs all resolve
    to one fingerprint. This endpoint exposes every visitor row tied to it.
    """
    d = await db.get(Device, device_id)
    if not d:
        raise HTTPException(404, "Device not found")

    result = await db.execute(
        select(Visitor)
        .where(Visitor.device_id == device_id)
        .order_by(Visitor.last_seen.desc())
    )
    visitors = result.scalars().all()
    visitor_tracking = await get_visitors_tracking_summary_map(db, visitors)

    return {
        "items": [
            {
                "id": v.id,
                "ip": v.ip,
                "browser": v.browser,
                "os": v.os,
                "device_type": v.device_type,
                "country": v.country,
                "country_flag": v.country_flag,
                "page_views": v.page_views,
                "status": v.status,
                "last_seen": isoformat(v.last_seen),
                "tracking_signals": visitor_tracking.get(v.id),
            }
            for v in visitors
        ]
    }


@router.post("/{device_id}/link")
async def link_device(
    device_id: str,
    body: LinkRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    d = await db.get(Device, device_id)
    if not d:
        raise HTTPException(404, "Device not found")
    d.linked_user = body.user_id
    await db.execute(
        text("UPDATE visitors SET linked_user = :user_id WHERE device_id = :device_id"),
        {"user_id": body.user_id, "device_id": device_id},
    )
    if body.external_user_id:
        await identity_service.link_device(
            db,
            external_user_id=body.external_user_id,
            fingerprint_id=device_id,
            visitor_id=None,
            platform="web",
            ip=request_ip(request),
        )
    log_action(db, action="LINK_DEVICE", actor_id=current.id, target_type="device", target_id=d.id, ip=request_ip(request), extra={"user_id": body.user_id, "external_user_id": body.external_user_id})
    await db.commit()
    return {"message": "Linked"}


@router.delete("/{device_id}/link")
async def unlink_device(
    device_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    d = await db.get(Device, device_id)
    if not d:
        raise HTTPException(404, "Device not found")
    d.linked_user = None
    await db.execute(text("UPDATE visitors SET linked_user = NULL WHERE device_id = :device_id"), {"device_id": device_id})
    log_action(db, action="UNLINK_DEVICE", actor_id=current.id, target_type="device", target_id=d.id, ip=request_ip(request))
    await db.commit()
    return {"message": "Unlinked"}


@router.post("/{device_id}/block")
async def block_device(
    device_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    d = await db.get(Device, device_id)
    if not d:
        raise HTTPException(404, "Not found")
    d.status = "blocked"
    # Cascade → block all visitors linked to this device
    result = await db.execute(select(Visitor).where(Visitor.device_id == device_id))
    for v in result.scalars().all():
        v.status = "blocked"
    log_action(db, action="BLOCK_DEVICE", actor_id=current.id, target_type="device", target_id=d.id, ip=request_ip(request))
    await db.commit()
    dispatch_notification_event(
        "block_triggered",
        {
            "target_type": "device",
            "target_id": d.id,
            "target": d.fingerprint or d.id,
            "actor": current.username,
        },
        subject="SkyNet Notification — Device Blocked",
        severity="medium",
    )
    return {"message": "Blocked"}


@router.delete("/{device_id}/block")
async def unblock_device(
    device_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    d = await db.get(Device, device_id)
    if not d:
        raise HTTPException(404, "Not found")
    d.status = "active"
    # Cascade → unblock all visitors linked to this device
    result = await db.execute(select(Visitor).where(Visitor.device_id == device_id))
    for v in result.scalars().all():
        v.status = "active"
    log_action(db, action="UNBLOCK_DEVICE", actor_id=current.id, target_type="device", target_id=d.id, ip=request_ip(request))
    await db.commit()
    return {"message": "Unblocked"}


@router.delete("/{device_id}")
async def delete_device(
    device_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    d = await db.get(Device, device_id)
    if not d:
        raise HTTPException(404, "Device not found")
    affected_external_user_ids = await delete_device_graph(db, device_id)
    await reconcile_external_profiles(
        db,
        affected_external_user_ids,
        trigger_type="delete_device",
        source="devices.delete",
        target_id=device_id,
    )
    log_action(db, action="DELETE_DEVICE", actor_id=current.id, target_type="device", target_id=d.id, ip=request_ip(request))
    await db.commit()
    return {
        "message": "Deleted",
        "deleted_visitors": True,
        "affected_external_user_ids": sorted(affected_external_user_ids),
    }
