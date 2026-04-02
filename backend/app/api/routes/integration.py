from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ...core.database import get_db
from ...core.security import get_current_user
from ...models.user import User
from ...models.site import Site
from ...schemas.site import CreateSiteRequest
from ...services.audit import log_action, request_ip
from ...core.deployment import public_base_url
import uuid, secrets

router = APIRouter(prefix="/integration", tags=["integration"])


@router.get("/sites")
async def list_sites(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(select(Site).order_by(Site.created_at.desc()))
    sites = result.scalars().all()
    return [
        {
            "id": s.id,
            "name": s.name,
            "url": s.url,
            "description": s.description,
            "api_key": s.api_key,
            "active": s.active,
            "stats": {"visitors": 0, "events": 0, "blocked": 0},
            "created_at": s.created_at.strftime("%Y-%m-%d"),
        }
        for s in sites
    ]


@router.post("/sites")
async def create_site(body: CreateSiteRequest, request: Request, db: AsyncSession = Depends(get_db), current: User = Depends(get_current_user)):
    site = Site(id=str(uuid.uuid4()), **body.model_dump())
    db.add(site)
    log_action(db, action="CREATE_SITE", actor_id=current.id, target_type="site", target_id=site.id, ip=request_ip(request))
    await db.commit()
    return {"id": site.id, "api_key": site.api_key, "message": "Site created"}


@router.delete("/sites/{site_id}")
async def delete_site(site_id: str, request: Request, db: AsyncSession = Depends(get_db), current: User = Depends(get_current_user)):
    s = await db.get(Site, site_id)
    if not s:
        raise HTTPException(404, "Not found")
    log_action(db, action="DELETE_SITE", actor_id=current.id, target_type="site", target_id=s.id, ip=request_ip(request))
    await db.delete(s)
    await db.commit()
    return {"message": "Deleted"}


@router.post("/sites/{site_id}/regenerate-key")
async def regenerate_key(site_id: str, request: Request, db: AsyncSession = Depends(get_db), current: User = Depends(get_current_user)):
    s = await db.get(Site, site_id)
    if not s:
        raise HTTPException(404, "Not found")
    s.api_key = secrets.token_hex(32)
    log_action(db, action="REGEN_KEY", actor_id=current.id, target_type="site", target_id=s.id, ip=request_ip(request))
    await db.commit()
    return {"api_key": s.api_key}


@router.get("/tracker-script")
async def tracker_script(site_id: str = Query(...), db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    s = await db.get(Site, site_id)
    if not s:
        raise HTTPException(404, "Site not found")
    origin = public_base_url()
    script = f"""<!-- SkyNet Tracker (SkyNet.getDeviceId() available after load) -->
<script>
  (function(s,k,y,n,e,t){{
    s._skynet=s._skynet||{{}};
    s._skynet.key='{s.api_key}';
    var a=y.createElement('script');
    a.async=1;
    a.src=n+'/tracker/skynet.js';
    var b=y.getElementsByTagName('script')[0];
    b.parentNode.insertBefore(a,b);
  }})(window,document,document,'{origin}');
</script>"""
    return {"script": script}
