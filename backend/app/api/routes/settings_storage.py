from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.database import get_db
from ...core.security import get_current_user, require_admin_user, require_superadmin_user
from ...models.user import User
from ...services.audit import log_action, request_ip
from ...services.storage_ops import (
    build_retention_archive,
    get_storage_status,
    purge_tracker_data,
    reset_for_fresh_install,
    run_storage_purge,
)


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
    current: User = Depends(require_superadmin_user),
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
    current: User = Depends(require_superadmin_user),
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


@router.post("/tracker-purge")
async def purge_tracker_scope(
    body: dict,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(require_admin_user),
):
    site_id = str(body.get("site_id") or "").strip()
    if not site_id:
        raise HTTPException(status_code=400, detail="site_id is required")
    try:
        site, summary = await purge_tracker_data(db, site_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    log_action(
        db,
        action="STORAGE_TRACKER_PURGE",
        actor_id=current.id,
        target_type="site",
        target_id=site.id,
        ip=request_ip(request),
        extra={"site_name": site.name, "summary": summary},
    )
    await db.commit()
    return {"ok": True, "site": {"id": site.id, "name": site.name}, "summary": summary}


@router.post("/reset-install")
async def reset_install_storage(
    body: dict,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(require_superadmin_user),
):
    confirmation = str(body.get("confirmation") or "").strip().upper()
    if confirmation != "RESET SKYNET":
        raise HTTPException(status_code=400, detail='Type "RESET SKYNET" to confirm')

    summary = await reset_for_fresh_install(db)
    log_action(
        db,
        action="STORAGE_RESET_INSTALL",
        actor_id=current.id,
        target_type="settings",
        target_id="storage",
        ip=request_ip(request),
        extra=summary,
    )
    await db.commit()
    return {"ok": True, "summary": summary}
