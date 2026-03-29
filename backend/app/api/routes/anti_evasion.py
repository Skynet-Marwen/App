from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from ...core.database import get_db
from ...core.security import get_current_user
from ...models.user import User
from ...models.incident import Incident
from datetime import datetime, timezone

router = APIRouter(prefix="/anti-evasion", tags=["anti-evasion"])

# In-memory config (replace with DB-backed settings table in production)
_config = {
    "vpn_detection": True,
    "tor_detection": True,
    "proxy_detection": True,
    "datacenter_detection": True,
    "headless_browser_detection": True,
    "bot_detection": True,
    "canvas_fingerprint": True,
    "webgl_fingerprint": True,
    "font_fingerprint": True,
    "audio_fingerprint": True,
    "timezone_mismatch": True,
    "language_mismatch": True,
    "cookie_evasion": True,
    "ip_rotation_detection": True,
    "spam_rate_threshold": 10,
    "max_accounts_per_device": 3,
    "max_accounts_per_ip": 5,
}


@router.get("/config")
async def get_config(_: User = Depends(get_current_user)):
    return _config


@router.put("/config")
async def update_config(data: dict, _: User = Depends(get_current_user)):
    _config.update(data)
    return _config


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
async def resolve_incident(incident_id: str, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    inc = await db.get(Incident, incident_id)
    if inc:
        inc.status = "resolved"
        inc.resolved_at = datetime.now(timezone.utc)
        await db.commit()
    return {"message": "Resolved"}
