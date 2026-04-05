"""
GeoIP provider settings — upload + status endpoints.
Routes: POST /settings/geoip/upload
        GET  /settings/geoip/status
"""
import os
import shutil
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from ...core.config import settings as cfg
from ...core.database import get_db
from ...core.security import get_current_user, require_superadmin_user
from ...models.user import User
from ...services.audit import log_action, request_ip
from ...services.runtime_config import runtime_settings

router = APIRouter(prefix="/settings", tags=["settings"])

_settings = runtime_settings()


@router.post("/geoip/upload")
async def upload_mmdb(
    file: UploadFile = File(...),
    request: Request = None,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(require_superadmin_user),
):
    if not (file.filename or "").endswith(".mmdb"):
        raise HTTPException(422, "Only .mmdb files are accepted")
    dest = os.path.abspath(cfg.GEOIP_DB_PATH)
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    try:
        with open(dest, "wb") as f:
            shutil.copyfileobj(file.file, f)
    except Exception as exc:
        raise HTTPException(500, f"Write failed: {exc}") from exc
    from ...services.geoip_providers import reset_local_reader
    reset_local_reader()
    log_action(
        db, action="GEOIP_UPLOAD",
        actor_id=current.id, target_type="settings", target_id="geoip",
        ip=request_ip(request),
    )
    await db.commit()
    return {"ok": True}


@router.get("/geoip/status")
async def geoip_status(_: User = Depends(get_current_user)):
    """Probe active provider with a well-known public IP (8.8.8.8)."""
    from ...core.geoip import lookup
    provider = _settings.get("geoip_provider", "ip-api")
    try:
        result = await lookup("8.8.8.8")
        if result.get("country"):
            return {"ok": True, "provider": provider, "sample": result}
        return {"ok": False, "provider": provider, "error": "No data — DB missing or IP unresolvable"}
    except Exception as exc:
        return {"ok": False, "provider": provider, "error": str(exc)}
