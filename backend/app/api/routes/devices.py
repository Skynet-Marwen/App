from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from ...core.database import get_db
from ...core.security import get_current_user
from ...models.user import User
from ...models.device import Device
from ...models.visitor import Visitor
from ...schemas.device import LinkRequest

router = APIRouter(prefix="/devices", tags=["devices"])


def _iso(dt):
    return dt.isoformat() if dt else None


@router.get("")
async def list_devices(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, le=100),
    search: str = Query(""),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    # Correlated subquery: count visitors per device
    vc_sq = (
        select(func.count(Visitor.id))
        .where(Visitor.device_id == Device.id)
        .correlate(Device)
        .scalar_subquery()
    )

    cq = select(func.count()).select_from(Device)
    q = select(Device, vc_sq.label("vc"))
    if search:
        s = f"%{search}%"
        flt = or_(Device.fingerprint.ilike(s), Device.browser.ilike(s), Device.os.ilike(s))
        q = q.where(flt)
        cq = cq.where(flt)

    total = await db.scalar(cq) or 0
    result = await db.execute(q.order_by(Device.last_seen.desc()).offset((page - 1) * page_size).limit(page_size))
    rows = result.all()

    return {
        "total": total,
        "items": [
            {
                "id": d.id,
                "fingerprint": d.fingerprint,
                "type": d.type,
                "browser": d.browser,
                "os": d.os,
                "screen_resolution": d.screen_resolution,
                "language": d.language,
                "timezone": d.timezone,
                "canvas_hash": d.canvas_hash,
                "webgl_hash": d.webgl_hash,
                "risk_score": d.risk_score,
                "status": d.status,
                "linked_user": d.linked_user,
                "visitor_count": vc or 0,
                "first_seen": _iso(d.first_seen),
                "last_seen": _iso(d.last_seen),
            }
            for d, vc in rows
        ],
    }


@router.get("/{device_id}/visitors")
async def device_visitors(
    device_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    d = await db.get(Device, device_id)
    if not d:
        raise HTTPException(404, "Device not found")
    result = await db.execute(
        select(Visitor).where(Visitor.device_id == device_id).order_by(Visitor.last_seen.desc())
    )
    visitors = result.scalars().all()
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
                "last_seen": _iso(v.last_seen),
            }
            for v in visitors
        ]
    }


@router.post("/{device_id}/link")
async def link_device(device_id: str, body: LinkRequest, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    d = await db.get(Device, device_id)
    if not d:
        raise HTTPException(404, "Device not found")
    d.linked_user = body.user_id
    await db.commit()
    return {"message": "Linked"}


@router.delete("/{device_id}/link")
async def unlink_device(device_id: str, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    d = await db.get(Device, device_id)
    if not d:
        raise HTTPException(404, "Device not found")
    d.linked_user = None
    await db.commit()
    return {"message": "Unlinked"}


@router.post("/{device_id}/block")
async def block_device(device_id: str, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    d = await db.get(Device, device_id)
    if not d:
        raise HTTPException(404, "Not found")
    d.status = "blocked"
    # Cascade → block all visitors linked to this device
    result = await db.execute(select(Visitor).where(Visitor.device_id == device_id))
    for v in result.scalars().all():
        v.status = "blocked"
    await db.commit()
    return {"message": "Blocked"}


@router.delete("/{device_id}/block")
async def unblock_device(device_id: str, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    d = await db.get(Device, device_id)
    if not d:
        raise HTTPException(404, "Not found")
    d.status = "active"
    # Cascade → unblock all visitors linked to this device
    result = await db.execute(select(Visitor).where(Visitor.device_id == device_id))
    for v in result.scalars().all():
        v.status = "active"
    await db.commit()
    return {"message": "Unblocked"}
