from fastapi import APIRouter, Depends, Query, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from ...core.database import get_db
from ...core.security import get_current_user
from ...models.user import User
from ...models.visitor import Visitor
from ...schemas.visitor import BlockRequest
from ...services.audit import log_action, request_ip
from ...services.incident_notifications import dispatch_notification_event
from ...services.intelligence_cleanup import delete_visitor_graph, reconcile_external_profiles
from ...services.tracking_visibility import get_visitor_tracking_summary

router = APIRouter(prefix="/visitors", tags=["visitors"])


@router.get("")
async def list_visitors(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, le=100),
    search: str = Query(""),
    country: str = Query(""),
    status: str = Query(""),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    query = select(Visitor)
    count_query = select(func.count()).select_from(Visitor)

    if search:
        q = f"%{search}%"
        filters = or_(Visitor.ip.ilike(q), Visitor.country.ilike(q), Visitor.browser.ilike(q), Visitor.os.ilike(q))
        query = query.where(filters)
        count_query = count_query.where(filters)

    if country:
        query = query.where(Visitor.country == country)
        count_query = count_query.where(Visitor.country == country)

    if status:
        query = query.where(Visitor.status == status)
        count_query = count_query.where(Visitor.status == status)

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
                "external_user_id": v.external_user_id,
            }
            for v in visitors
        ],
    }


@router.get("/{visitor_id}")
async def get_visitor(visitor_id: str, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    v = await db.get(Visitor, visitor_id)
    if not v:
        raise HTTPException(404, "Visitor not found")
    return {
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
        "site_id": v.site_id,
        "device_id": v.device_id,
        "linked_user": v.linked_user,
        "external_user_id": v.external_user_id,
        "first_seen": v.first_seen.strftime("%Y-%m-%d %H:%M"),
        "last_seen": v.last_seen.strftime("%Y-%m-%d %H:%M"),
        "tracking_signals": await get_visitor_tracking_summary(db, v),
    }


@router.post("/{visitor_id}/block")
async def block_visitor(
    visitor_id: str,
    body: BlockRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    v = await db.get(Visitor, visitor_id)
    if not v:
        raise HTTPException(404, "Not found")
    v.status = "blocked"
    log_action(db, action="BLOCK_VISITOR", actor_id=current.id, target_type="visitor", target_id=v.id, ip=request_ip(request), extra={"reason": body.reason})
    await db.commit()
    dispatch_notification_event(
        "block_triggered",
        {
            "target_type": "visitor",
            "target_id": v.id,
            "target": v.ip or v.id,
            "reason": body.reason,
            "actor": current.username,
        },
        subject="SkyNet Notification — Visitor Blocked",
        severity="medium",
    )
    return {"message": "Blocked"}


@router.delete("/{visitor_id}/block")
async def unblock_visitor(visitor_id: str, request: Request, db: AsyncSession = Depends(get_db), current: User = Depends(get_current_user)):
    v = await db.get(Visitor, visitor_id)
    if not v:
        raise HTTPException(404, "Not found")
    v.status = "active"
    log_action(db, action="UNBLOCK_VISITOR", actor_id=current.id, target_type="visitor", target_id=v.id, ip=request_ip(request))
    await db.commit()
    return {"message": "Unblocked"}


@router.delete("/{visitor_id}")
async def delete_visitor(visitor_id: str, request: Request, db: AsyncSession = Depends(get_db), current: User = Depends(get_current_user)):
    v = await db.get(Visitor, visitor_id)
    if not v:
        raise HTTPException(404, "Visitor not found")
    affected_external_user_ids, deleted_orphan_device = await delete_visitor_graph(db, visitor_id)
    await reconcile_external_profiles(
        db,
        affected_external_user_ids,
        trigger_type="delete_visitor",
        source="visitors.delete",
        target_id=visitor_id,
    )
    log_action(db, action="DELETE_VISITOR", actor_id=current.id, target_type="visitor", target_id=visitor_id, ip=request_ip(request))
    await db.commit()
    return {
        "message": "Deleted",
        "deleted_orphan_device": deleted_orphan_device,
        "affected_external_user_ids": sorted(affected_external_user_ids),
    }
