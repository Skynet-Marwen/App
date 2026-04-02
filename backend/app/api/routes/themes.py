from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.database import get_db
from ...core.security import get_current_user
from ...models.theme import Theme
from ...models.user import User
from ...schemas.theme import (
    ThemeCreateRequest,
    ThemeDefaultRequest,
    ThemeOut,
    ThemeUpdateRequest,
    UserThemeResponse,
    UserThemeSelectionRequest,
)
from ...services.audit import log_action, request_ip
from ...services.theme_assets import delete_theme_logo, find_theme_logo_path, save_theme_logo
from ...services.theme_service import (
    apply_user_theme_selection,
    ensure_default_theme,
    list_themes,
    resolve_user_theme,
    serialize_theme,
    set_default_theme,
)
from ...services.theme_starter_packs import install_starter_pack, list_starter_packs


router = APIRouter(tags=["themes"])


def require_theme_admin(current: User = Depends(get_current_user)) -> User:
    if current.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin privileges required")
    return current


async def _get_persisted_user(db: AsyncSession, user_id: str) -> User:
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.get("/themes", response_model=list[ThemeOut])
async def get_themes(
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    await ensure_default_theme(db)
    themes = await list_themes(db, include_inactive=current.role == "admin")
    return [serialize_theme(theme) for theme in themes]


@router.post("/themes", response_model=ThemeOut, status_code=status.HTTP_201_CREATED)
async def create_theme(
    body: ThemeCreateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(require_theme_admin),
):
    id_conflict = await db.get(Theme, body.id)
    name_conflict = await db.scalar(select(Theme).where(Theme.name == body.name))
    if id_conflict or name_conflict:
        raise HTTPException(status_code=409, detail="Theme id or name already exists")

    now = datetime.now(timezone.utc)
    theme = Theme(
        id=body.id,
        name=body.name,
        colors=body.colors,
        layout=body.layout,
        widgets=body.widgets,
        branding=body.branding,
        is_default=False,
        is_active=body.is_active,
        created_at=now,
        updated_at=now,
    )
    db.add(theme)
    await db.flush()

    if body.is_default:
        await set_default_theme(db, theme)

    log_action(
        db,
        action="CREATE_THEME",
        actor_id=current.id,
        target_type="theme",
        target_id=theme.id,
        ip=request_ip(request),
        extra={"name": theme.name, "is_default": theme.is_default},
    )
    await db.commit()
    return serialize_theme(theme)


@router.put("/themes/{theme_id}", response_model=ThemeOut)
async def update_theme(
    theme_id: str,
    body: ThemeUpdateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(require_theme_admin),
):
    theme = await db.get(Theme, theme_id)
    if not theme:
        raise HTTPException(status_code=404, detail="Theme not found")
    if theme.is_default and body.is_active is False:
        raise HTTPException(status_code=400, detail="Default theme must remain active")
    if body.name and body.name != theme.name:
        conflict = await db.scalar(select(Theme).where(Theme.name == body.name, Theme.id != theme_id))
        if conflict:
            raise HTTPException(status_code=409, detail="Theme name already exists")

    changes = body.model_dump(exclude_unset=True)
    for field, value in changes.items():
        setattr(theme, field, value)
    theme.updated_at = datetime.now(timezone.utc)
    await db.flush()

    log_action(
        db,
        action="UPDATE_THEME",
        actor_id=current.id,
        target_type="theme",
        target_id=theme.id,
        ip=request_ip(request),
        extra=changes or None,
    )
    await db.commit()
    return serialize_theme(theme)


@router.get("/themes/{theme_id}/logo")
async def get_theme_logo(theme_id: str):
    logo_path = find_theme_logo_path(theme_id)
    if not logo_path:
        raise HTTPException(status_code=404, detail="Theme logo not found")
    return FileResponse(logo_path)


@router.post("/themes/{theme_id}/logo", response_model=ThemeOut)
async def upload_theme_logo(
    theme_id: str,
    request: Request,
    logo: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current: User = Depends(require_theme_admin),
):
    theme = await db.get(Theme, theme_id)
    if not theme:
        raise HTTPException(status_code=404, detail="Theme not found")
    try:
        uploaded = save_theme_logo(theme_id, logo.content_type, await logo.read())
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    theme.branding = {**(theme.branding or {}), "logo_url": f"/api/v1/themes/{theme_id}/logo"}
    theme.updated_at = datetime.now(timezone.utc)
    await db.flush()
    log_action(
        db,
        action="UPLOAD_THEME_LOGO",
        actor_id=current.id,
        target_type="theme",
        target_id=theme.id,
        ip=request_ip(request),
        extra={"logo_url": uploaded["logo_url"]},
    )
    await db.commit()
    return serialize_theme(theme)


@router.delete("/themes/{theme_id}/logo", response_model=ThemeOut)
async def remove_theme_logo(
    theme_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(require_theme_admin),
):
    theme = await db.get(Theme, theme_id)
    if not theme:
        raise HTTPException(status_code=404, detail="Theme not found")
    delete_theme_logo(theme_id)
    theme.branding = {**(theme.branding or {}), "logo_url": ""}
    theme.updated_at = datetime.now(timezone.utc)
    await db.flush()
    log_action(
        db,
        action="DELETE_THEME_LOGO",
        actor_id=current.id,
        target_type="theme",
        target_id=theme.id,
        ip=request_ip(request),
    )
    await db.commit()
    return serialize_theme(theme)


@router.delete("/themes/{theme_id}")
async def delete_theme(
    theme_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(require_theme_admin),
):
    theme = await db.get(Theme, theme_id)
    if not theme:
        raise HTTPException(status_code=404, detail="Theme not found")
    if theme.is_default:
        raise HTTPException(status_code=400, detail="Set another default theme before deleting this one")

    delete_theme_logo(theme_id)
    default_theme = await ensure_default_theme(db)
    await db.execute(
        update(User)
        .where(User.theme_id == theme_id)
        .values(theme_id=default_theme.id, theme_source="default")
    )
    log_action(
        db,
        action="DELETE_THEME",
        actor_id=current.id,
        target_type="theme",
        target_id=theme.id,
        ip=request_ip(request),
        extra={"fallback_theme_id": default_theme.id},
    )
    await db.delete(theme)
    await db.commit()
    return {"message": "Deleted", "fallback_theme_id": default_theme.id}


@router.post("/themes/set-default", response_model=ThemeOut)
async def promote_default_theme(
    body: ThemeDefaultRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(require_theme_admin),
):
    theme = await db.get(Theme, body.theme_id)
    if not theme:
        raise HTTPException(status_code=404, detail="Theme not found")
    await set_default_theme(db, theme)
    log_action(
        db,
        action="SET_DEFAULT_THEME",
        actor_id=current.id,
        target_type="theme",
        target_id=theme.id,
        ip=request_ip(request),
        extra={"name": theme.name},
    )
    await db.commit()
    return serialize_theme(theme)


@router.get("/themes/starter-packs")
async def get_theme_starter_packs(
    _: User = Depends(get_current_user),
):
    return list_starter_packs()


@router.post("/themes/starter-packs/{pack_id}/install")
async def install_theme_starter_pack(
    pack_id: str,
    request: Request,
    body: dict | None = None,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(require_theme_admin),
):
    payload = body or {}
    result = await install_starter_pack(db, pack_id, set_default=bool(payload.get("set_default", False)))
    log_action(
        db,
        action="INSTALL_THEME_STARTER_PACK",
        actor_id=current.id,
        target_type="theme_pack",
        target_id=pack_id,
        ip=request_ip(request),
        extra={"set_default": bool(payload.get("set_default", False)), "themes": [item["id"] for item in result["installed_themes"]]},
    )
    await db.commit()
    return result


@router.get("/user/theme", response_model=UserThemeResponse)
async def get_user_theme(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    user = await _get_persisted_user(db, current.id)
    tenant_hint = request.headers.get("X-SkyNet-Tenant") or request.headers.get("host")
    payload = await resolve_user_theme(db, user, tenant_hint=tenant_hint)
    await db.commit()
    return payload


@router.post("/user/theme", response_model=UserThemeResponse)
async def set_user_theme(
    body: UserThemeSelectionRequest,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    user = await _get_persisted_user(db, current.id)
    payload = await apply_user_theme_selection(db, user, body.theme_id, body.theme_source)
    await db.commit()
    return payload
