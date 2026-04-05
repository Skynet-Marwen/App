from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select
from ...core.database import get_db
from ...core.security import get_current_user, require_admin_user
from ...models.event import Event
from ...models.user import User
from ...models.site import Site
from ...models.visitor import Visitor
from ...schemas.site import CreateSiteRequest
from ...services.audit import log_action, request_ip
from ...services.runtime_config import runtime_settings
from ...core.deployment import public_base_url
import uuid, secrets

router = APIRouter(prefix="/integration", tags=["integration"])


def _generate_site_api_key() -> str:
    prefix = str(runtime_settings().get("integration_api_key_prefix") or "").strip()
    available = max(8, 64 - len(prefix))
    token = secrets.token_hex(max(available // 2, 4))[:available]
    return f"{prefix}{token}"


@router.get("/sites")
async def list_sites(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(select(Site).order_by(Site.created_at.desc()))
    sites = result.scalars().all()
    site_ids = [site.id for site in sites]

    visitor_counts: dict[str, int] = {}
    event_counts: dict[str, int] = {}
    blocked_counts: dict[str, int] = {}
    if site_ids:
        visitor_rows = (
            await db.execute(
                select(Visitor.site_id, func.count(Visitor.id))
                .where(Visitor.site_id.in_(site_ids))
                .group_by(Visitor.site_id)
            )
        ).all()
        visitor_counts = {site_id: int(count or 0) for site_id, count in visitor_rows if site_id}

        event_rows = (
            await db.execute(
                select(Event.site_id, func.count(Event.id))
                .where(Event.site_id.in_(site_ids))
                .group_by(Event.site_id)
            )
        ).all()
        event_counts = {site_id: int(count or 0) for site_id, count in event_rows if site_id}

        blocked_rows = (
            await db.execute(
                select(Visitor.site_id, func.count(Visitor.id))
                .where(Visitor.site_id.in_(site_ids), Visitor.status == "blocked")
                .group_by(Visitor.site_id)
            )
        ).all()
        blocked_counts = {site_id: int(count or 0) for site_id, count in blocked_rows if site_id}

    return [
        {
            "id": s.id,
            "name": s.name,
            "url": s.url,
            "description": s.description,
            "api_key": s.api_key,
            "active": s.active,
            "stats": {
                "visitors": visitor_counts.get(s.id, 0),
                "events": event_counts.get(s.id, 0),
                "blocked": blocked_counts.get(s.id, 0),
            },
            "created_at": s.created_at.strftime("%Y-%m-%d"),
        }
        for s in sites
    ]


@router.post("/sites")
async def create_site(body: CreateSiteRequest, request: Request, db: AsyncSession = Depends(get_db), current: User = Depends(require_admin_user)):
    site = Site(id=str(uuid.uuid4()), **body.model_dump())
    site.api_key = _generate_site_api_key()
    db.add(site)
    log_action(db, action="CREATE_SITE", actor_id=current.id, target_type="site", target_id=site.id, ip=request_ip(request))
    await db.commit()
    return {"id": site.id, "api_key": site.api_key, "message": "Site created"}


@router.delete("/sites/{site_id}")
async def delete_site(site_id: str, request: Request, db: AsyncSession = Depends(get_db), current: User = Depends(require_admin_user)):
    s = await db.get(Site, site_id)
    if not s:
        raise HTTPException(404, "Not found")
    log_action(db, action="DELETE_SITE", actor_id=current.id, target_type="site", target_id=s.id, ip=request_ip(request))
    await db.delete(s)
    await db.commit()
    return {"message": "Deleted"}


@router.post("/sites/{site_id}/regenerate-key")
async def regenerate_key(site_id: str, request: Request, db: AsyncSession = Depends(get_db), current: User = Depends(require_admin_user)):
    s = await db.get(Site, site_id)
    if not s:
        raise HTTPException(404, "Not found")
    s.api_key = _generate_site_api_key()
    log_action(db, action="REGEN_KEY", actor_id=current.id, target_type="site", target_id=s.id, ip=request_ip(request))
    await db.commit()
    return {"api_key": s.api_key}


@router.get("/tracker-script")
async def tracker_script(site_id: str = Query(...), db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    s = await db.get(Site, site_id)
    if not s:
        raise HTTPException(404, "Site not found")
    origin = public_base_url()
    script = f"""<!-- SkyNet Tracker (blocker-resistant path; SkyNet.getDeviceId() available after load) -->
<script async src="{origin}/s/{s.api_key}.js"></script>"""
    return {"script": script}
