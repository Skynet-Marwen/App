from __future__ import annotations

import base64
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.theme import Theme
from ..schemas.theme import ThemeImportResponse, ThemePackageDocument, ThemePackageLogo
from .theme_assets import delete_theme_logo, find_theme_logo_path, save_theme_logo
from .theme_service import serialize_theme, set_default_theme


PACKAGE_SCHEMA_VERSION = "theme-package.v1"


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _theme_package_filename(theme: Theme) -> str:
    stamp = int((theme.updated_at or datetime.now(timezone.utc)).timestamp())
    return f"{theme.id}-{stamp}.theme.json"


def _build_logo_payload(theme: Theme) -> ThemePackageLogo | None:
    logo_path = find_theme_logo_path(theme.id)
    if not logo_path:
        return None

    payload = logo_path.read_bytes()
    extension = logo_path.suffix.lower()
    content_type = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".gif": "image/gif",
    }.get(extension)
    if not content_type:
        return None

    return ThemePackageLogo(
        filename=logo_path.name,
        content_type=content_type,
        data_base64=base64.b64encode(payload).decode("ascii"),
        size_bytes=len(payload),
    )


def export_theme_package(theme: Theme) -> tuple[ThemePackageDocument, str]:
    document = ThemePackageDocument(
        schema_version=PACKAGE_SCHEMA_VERSION,
        exported_at=_iso_now(),
        theme=serialize_theme(theme),
        logo=_build_logo_payload(theme),
        metadata={
            "packaged_by": "SkyNet",
            "packaging_format": "json",
            "theme_id": theme.id,
        },
    )
    return document, _theme_package_filename(theme)


def parse_theme_package_document(payload: bytes) -> ThemePackageDocument:
    if not payload:
        raise HTTPException(status_code=400, detail="Theme package file is empty")
    try:
        return ThemePackageDocument.model_validate_json(payload)
    except Exception as exc:
        raise HTTPException(status_code=422, detail="Invalid theme package document") from exc


async def import_theme_package(
    db: AsyncSession,
    package: ThemePackageDocument,
    *,
    replace_existing: bool = False,
) -> ThemeImportResponse:
    theme_payload = package.theme.model_dump()
    theme_id = theme_payload["id"]
    theme_name = theme_payload["name"]
    existing = await db.get(Theme, theme_id)
    existing_is_default = bool(existing and existing.is_default)

    name_conflict = await db.scalar(select(Theme).where(Theme.name == theme_name, Theme.id != theme_id))
    if name_conflict:
        raise HTTPException(status_code=409, detail="Theme name already exists")
    if existing and not replace_existing:
        raise HTTPException(status_code=409, detail="Theme id already exists")

    now = datetime.now(timezone.utc)
    imported_is_default = bool(theme_payload.get("is_default") or existing_is_default)
    imported_is_active = bool(theme_payload.get("is_active", True) or imported_is_default or existing_is_default)

    if existing:
        existing.name = theme_name
        existing.colors = theme_payload["colors"]
        existing.layout = theme_payload.get("layout") or {}
        existing.widgets = theme_payload.get("widgets") or []
        existing.branding = theme_payload.get("branding")
        existing.is_active = imported_is_active
        existing.is_default = imported_is_default
        existing.updated_at = now
        theme = existing
    else:
        theme = Theme(
            id=theme_id,
            name=theme_name,
            colors=theme_payload["colors"],
            layout=theme_payload.get("layout") or {},
            widgets=theme_payload.get("widgets") or [],
            branding=theme_payload.get("branding"),
            is_default=imported_is_default,
            is_active=imported_is_active,
            created_at=now,
            updated_at=now,
        )
        db.add(theme)

    await db.flush()
    imported_logo = await _import_theme_logo(theme.id, package.logo)
    if imported_logo:
        theme.branding = {**(theme.branding or {}), "logo_url": f"/api/v1/themes/{theme.id}/logo"}
        theme.updated_at = datetime.now(timezone.utc)
        await db.flush()

    if package.logo is None:
        delete_theme_logo(theme.id)
        if theme.branding:
            theme.branding = {**theme.branding, "logo_url": ""}
            theme.updated_at = datetime.now(timezone.utc)
            await db.flush()

    if imported_is_default:
        await set_default_theme(db, theme)

    return ThemeImportResponse(
        theme=serialize_theme(theme),
        replaced_existing=bool(existing),
        imported_logo=imported_logo,
    )


async def _import_theme_logo(theme_id: str, logo: ThemePackageLogo | None) -> bool:
    if not logo:
        return False
    try:
        payload = base64.b64decode(logo.data_base64.encode("ascii"), validate=True)
    except Exception as exc:
        raise HTTPException(status_code=422, detail="Theme package logo is not valid base64 data") from exc

    try:
        save_theme_logo(theme_id, logo.content_type, payload)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return True
