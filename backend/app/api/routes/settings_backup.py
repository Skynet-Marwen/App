from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.database import get_db
from ...core.security import get_current_user
from ...models.user import User
from ...schemas.backup import (
    BackupCreateRequest,
    BackupCreateResponse,
    BackupListResponse,
    BackupRestoreRequest,
    BackupRestoreResponse,
)
from ...services.audit import log_action, request_ip
from ...services.backup_store import (
    backup_archive_path,
    create_backup_archive,
    list_backup_archives,
    read_backup_metadata,
    restore_backup_archive,
)
from ...services.sanitize import clean_optional_text

router = APIRouter(prefix="/settings/backups", tags=["settings-backups"])


@router.get("", response_model=BackupListResponse)
async def list_backups(current: User = Depends(get_current_user)):
    _require_admin(current)
    return BackupListResponse(items=list_backup_archives())


@router.post("", response_model=BackupCreateResponse)
async def create_backup(
    body: BackupCreateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    _require_admin(current)
    try:
        backup = await create_backup_archive(
            db,
            services=body.services,
            password=body.password,
            note=clean_optional_text(body.note),
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    log_action(
        db,
        action="BACKUP_CREATE",
        actor_id=current.id,
        target_type="settings",
        target_id=backup.filename,
        ip=request_ip(request),
        extra={"services": backup.services, "encrypted": backup.encrypted},
    )
    await db.commit()
    return BackupCreateResponse(backup=backup)


@router.get("/{filename}/download")
async def download_backup(
    filename: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    _require_admin(current)
    try:
        path = backup_archive_path(filename)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    log_action(
        db,
        action="BACKUP_DOWNLOAD",
        actor_id=current.id,
        target_type="settings",
        target_id=filename,
        ip=request_ip(request),
    )
    await db.commit()
    return FileResponse(path=path, filename=path.name, media_type="application/octet-stream")


@router.post("/{filename}/restore", response_model=BackupRestoreResponse)
async def restore_backup_from_storage(
    filename: str,
    body: BackupRestoreRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    _require_admin(current)
    try:
        path = backup_archive_path(filename)
        archive, restored_services = await restore_backup_archive(
            db,
            raw_bytes=path.read_bytes(),
            filename=path.name,
            mode=body.mode,
            services=body.services,
            password=body.password,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    log_action(
        db,
        action="BACKUP_RESTORE",
        actor_id=current.id,
        target_type="settings",
        target_id=filename,
        ip=request_ip(request),
        extra={"mode": body.mode, "services": restored_services},
    )
    await db.commit()
    return BackupRestoreResponse(archive=archive, restored_services=restored_services, mode=body.mode)


@router.post("/restore-upload", response_model=BackupRestoreResponse)
async def restore_backup_upload(
    request: Request,
    mode: str = Form(...),
    services: str = Form(""),
    password: str = Form(""),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    _require_admin(current)
    selected = [item.strip() for item in services.split(",") if item.strip()]
    try:
        archive, restored_services = await restore_backup_archive(
            db,
            raw_bytes=await file.read(),
            filename=file.filename or "uploaded.skynetbak",
            mode=mode,
            services=selected,
            password=password or None,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    log_action(
        db,
        action="BACKUP_RESTORE_UPLOAD",
        actor_id=current.id,
        target_type="settings",
        target_id=archive.filename,
        ip=request_ip(request),
        extra={"mode": mode, "services": restored_services},
    )
    await db.commit()
    return BackupRestoreResponse(archive=archive, restored_services=restored_services, mode=mode)


@router.get("/{filename}")
async def get_backup_metadata(filename: str, current: User = Depends(get_current_user)):
    _require_admin(current)
    try:
        metadata = read_backup_metadata(backup_archive_path(filename))
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return metadata


def _require_admin(current: User) -> None:
    if current.role not in {"admin", "superadmin"}:
        raise HTTPException(status_code=403, detail="Insufficient privileges")
