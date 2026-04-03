from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.database import get_db
from ...core.security import get_current_user
from ...models.user import User
from ...services.audit import log_action, request_ip
from ...services.storage_ops import build_retention_archive, get_storage_status, run_storage_purge


router = APIRouter(prefix="/settings/storage", tags=["settings-storage"])


@router.get("/status")
async def storage_status(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return await get_storage_status(db)


@router.post("/purge")
async def purge_storage(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    summary = await run_storage_purge(db)
    log_action(
        db,
        action="STORAGE_PURGE",
        actor_id=current.id,
        target_type="settings",
        target_id="storage",
        ip=request_ip(request),
        extra=summary,
    )
    await db.commit()
    return {"ok": True, "summary": summary}


@router.post("/archive")
async def archive_expired_data(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    try:
        filename, body, counts = await build_retention_archive(db)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    log_action(
        db,
        action="STORAGE_ARCHIVE_EXPORT",
        actor_id=current.id,
        target_type="settings",
        target_id="storage",
        ip=request_ip(request),
        extra={"filename": filename, "counts": counts},
    )
    await db.commit()
    return Response(
        content=body,
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
