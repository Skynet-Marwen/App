from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.database import get_db
from ...core.security import get_current_user
from ...models.theme import Theme
from ...models.user import User
from ...schemas.theme import ThemeImportResponse, ThemePackageDocument
from ...services.audit import log_action, request_ip
from ...services.theme_packages import export_theme_package, import_theme_package, parse_theme_package_document


router = APIRouter(tags=["themes"])


def require_theme_admin(current: User = Depends(get_current_user)) -> User:
    if current.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin privileges required")
    return current


@router.get("/themes/{theme_id}/export", response_model=ThemePackageDocument)
async def export_theme(
    theme_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_theme_admin),
):
    theme = await db.get(Theme, theme_id)
    if not theme:
        raise HTTPException(status_code=404, detail="Theme not found")

    document, filename = export_theme_package(theme)
    return JSONResponse(
        content=jsonable_encoder(document),
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/themes/import", response_model=ThemeImportResponse)
async def import_theme(
    request: Request,
    file: UploadFile = File(...),
    replace_existing: bool = Form(False),
    db: AsyncSession = Depends(get_db),
    current: User = Depends(require_theme_admin),
):
    document = parse_theme_package_document(await file.read())
    result = await import_theme_package(db, document, replace_existing=replace_existing)
    log_action(
        db,
        action="IMPORT_THEME",
        actor_id=current.id,
        target_type="theme",
        target_id=result.theme.id,
        ip=request_ip(request),
        extra={
            "replaced_existing": result.replaced_existing,
            "imported_logo": result.imported_logo,
            "package_file": file.filename or "",
        },
    )
    await db.commit()
    return result
