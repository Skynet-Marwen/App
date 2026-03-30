from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from ...core.database import get_db
from ...core.security import get_current_user
from ...models.user import User
from ...models.incident import Incident
from ...services.anti_evasion_config import get_anti_evasion_config, update_anti_evasion_config
from ...services.audit import log_action
from datetime import datetime, timezone

router = APIRouter(prefix="/anti-evasion", tags=["anti-evasion"])


@router.get("/config")
async def get_config(_: User = Depends(get_current_user)):
    return get_anti_evasion_config()


@router.put("/config")
async def update_config(data: dict, db: AsyncSession = Depends(get_db), current: User = Depends(get_current_user)):
    config = update_anti_evasion_config(data)
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


@router.post("/incidents/{incident_id}/resolve")
async def resolve_incident(incident_id: str, db: AsyncSession = Depends(get_db), current: User = Depends(get_current_user)):
    inc = await db.get(Incident, incident_id)
    if inc:
        inc.status = "resolved"
        inc.resolved_at = datetime.now(timezone.utc)
        log_action(db, action="RESOLVE_INCIDENT", actor_id=current.id, target_type="incident", target_id=incident_id)
        await db.commit()
    return {"message": "Resolved"}
