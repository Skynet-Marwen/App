from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from ...core.database import get_db
from ...core.security import get_current_user
from ...models.user import User
from ...models.device import Device
from ...schemas.device import LinkRequest

router = APIRouter(prefix="/devices", tags=["devices"])


@router.get("")
async def list_devices(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, le=100),
    search: str = Query(""),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = select(Device)
    cq = select(func.count()).select_from(Device)
    if search:
        s = f"%{search}%"
        q = q.where(or_(Device.fingerprint.ilike(s), Device.browser.ilike(s), Device.os.ilike(s)))
        cq = cq.where(or_(Device.fingerprint.ilike(s), Device.browser.ilike(s), Device.os.ilike(s)))

    total = await db.scalar(cq) or 0
    result = await db.execute(q.order_by(Device.last_seen.desc()).offset((page - 1) * page_size).limit(page_size))
    devices = result.scalars().all()

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
                "first_seen": d.first_seen.strftime("%Y-%m-%d %H:%M"),
                "last_seen": d.last_seen.strftime("%Y-%m-%d %H:%M"),
            }
            for d in devices
        ],
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
    await db.commit()
    return {"message": "Blocked"}


@router.delete("/{device_id}/block")
async def unblock_device(device_id: str, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    d = await db.get(Device, device_id)
    if not d:
        raise HTTPException(404, "Not found")
    d.status = "active"
    await db.commit()
    return {"message": "Unblocked"}
