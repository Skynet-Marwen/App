from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from ...core.database import get_db
from ...core.security import get_current_user
from ...models.user import User
from ...models.visitor import Visitor
from ...models.device import Device
from ...schemas.visitor import BlockRequest

router = APIRouter(prefix="/visitors", tags=["visitors"])


@router.get("")
async def list_visitors(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, le=100),
    search: str = Query(""),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    query = select(Visitor)
    count_query = select(func.count()).select_from(Visitor)

    if search:
        q = f"%{search}%"
        query = query.where(or_(Visitor.ip.ilike(q), Visitor.country.ilike(q), Visitor.browser.ilike(q)))
        count_query = count_query.where(or_(Visitor.ip.ilike(q), Visitor.country.ilike(q), Visitor.browser.ilike(q)))

    total = await db.scalar(count_query) or 0
    result = await db.execute(query.order_by(Visitor.last_seen.desc()).offset((page - 1) * page_size).limit(page_size))
    visitors = result.scalars().all()

    return {
        "total": total,
        "items": [
            {
                "id": v.id,
                "ip": v.ip,
                "country": v.country,
                "country_flag": v.country_flag or "",
                "city": v.city,
                "isp": v.isp,
                "device_type": v.device_type,
                "browser": v.browser,
                "os": v.os,
                "user_agent": v.user_agent,
                "status": v.status,
                "page_views": v.page_views,
                "first_seen": v.first_seen.strftime("%Y-%m-%d %H:%M"),
                "last_seen": v.last_seen.strftime("%Y-%m-%d %H:%M"),
                "linked_user": v.linked_user,
            }
            for v in visitors
        ],
    }


@router.get("/{visitor_id}")
async def get_visitor(visitor_id: str, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    v = await db.get(Visitor, visitor_id)
    if not v:
        raise HTTPException(404, "Visitor not found")
    return v


@router.post("/{visitor_id}/block")
async def block_visitor(visitor_id: str, body: BlockRequest, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    v = await db.get(Visitor, visitor_id)
    if not v:
        raise HTTPException(404, "Not found")
    v.status = "blocked"
    # Cascade → block linked device
    if v.device_id:
        device = await db.get(Device, v.device_id)
        if device:
            device.status = "blocked"
    await db.commit()
    return {"message": "Blocked"}


@router.delete("/{visitor_id}/block")
async def unblock_visitor(visitor_id: str, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    v = await db.get(Visitor, visitor_id)
    if not v:
        raise HTTPException(404, "Not found")
    v.status = "active"
    # Cascade → unblock linked device
    if v.device_id:
        device = await db.get(Device, v.device_id)
        if device:
            device.status = "active"
    await db.commit()
    return {"message": "Unblocked"}
