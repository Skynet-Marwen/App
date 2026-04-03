from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.database import get_db
from ...core.security import get_current_user, is_superadmin, require_admin_user, require_superadmin_user
from ...models.tenant import Tenant
from ...models.theme import Theme
from ...models.user import User
from ...schemas.tenant import CreateTenantRequest, TenantOut, UpdateTenantRequest
from ...services.audit import log_action, request_ip


router = APIRouter(prefix="/tenants", tags=["tenants"])


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.strip().lower()).strip("-")
    return slug


def _normalize_host(value: str | None) -> str | None:
    if not value:
        return None
    host = value.strip().lower()
    host = host.replace("http://", "").replace("https://", "").split("/", 1)[0]
    return host or None


async def _serialize_tenants(db: AsyncSession, tenants: list[Tenant]) -> list[dict]:
    if not tenants:
        return []

    tenant_ids = [tenant.id for tenant in tenants]
    theme_ids = [tenant.default_theme_id for tenant in tenants if tenant.default_theme_id]
    theme_names = {}
    if theme_ids:
        theme_rows = await db.execute(select(Theme.id, Theme.name).where(Theme.id.in_(theme_ids)))
        theme_names = {theme_id: name for theme_id, name in theme_rows.all()}

    user_counts = {}
    count_rows = await db.execute(
        select(User.tenant_id, func.count(User.id))
        .where(User.tenant_id.in_(tenant_ids))
        .group_by(User.tenant_id)
    )
    user_counts = {tenant_id: count for tenant_id, count in count_rows.all()}

    return [
        {
            "id": tenant.id,
            "name": tenant.name,
            "slug": tenant.slug,
            "primary_host": tenant.primary_host,
            "description": tenant.description,
            "default_theme_id": tenant.default_theme_id,
            "default_theme_name": theme_names.get(tenant.default_theme_id or ""),
            "is_active": bool(tenant.is_active),
            "user_count": int(user_counts.get(tenant.id, 0)),
            "created_at": tenant.created_at.strftime("%Y-%m-%d %H:%M"),
            "updated_at": tenant.updated_at.strftime("%Y-%m-%d %H:%M"),
        }
        for tenant in tenants
    ]


async def _get_visible_tenants(db: AsyncSession, current: User, search: str = "") -> list[Tenant]:
    query = select(Tenant)
    if not is_superadmin(current) and current.tenant_id:
        query = query.where(Tenant.id == current.tenant_id)
    if search:
        needle = f"%{search}%"
        query = query.where(
            or_(
                Tenant.name.ilike(needle),
                Tenant.slug.ilike(needle),
                Tenant.primary_host.ilike(needle),
            )
        )
    result = await db.execute(query.order_by(Tenant.name.asc()))
    return list(result.scalars().all())


async def _require_theme_if_present(db: AsyncSession, theme_id: str | None) -> None:
    if not theme_id:
        return
    theme = await db.get(Theme, theme_id)
    if not theme:
        raise HTTPException(status_code=404, detail="Default theme not found")


@router.get("", response_model=list[TenantOut])
async def list_tenants(
    search: str = Query(""),
    db: AsyncSession = Depends(get_db),
    current: User = Depends(require_admin_user),
):
    tenants = await _get_visible_tenants(db, current, search=search)
    return await _serialize_tenants(db, tenants)


@router.post("", response_model=TenantOut, status_code=status.HTTP_201_CREATED)
async def create_tenant(
    body: CreateTenantRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(require_superadmin_user),
):
    slug = _slugify(body.slug or body.name)
    if not slug:
        raise HTTPException(status_code=422, detail="Tenant slug is required")
    await _require_theme_if_present(db, body.default_theme_id)

    name_conflict = await db.scalar(select(Tenant.id).where(Tenant.name == body.name))
    slug_conflict = await db.scalar(select(Tenant.id).where(Tenant.slug == slug))
    host = _normalize_host(body.primary_host)
    host_conflict = None
    if host:
        host_conflict = await db.scalar(select(Tenant.id).where(Tenant.primary_host == host))
    if name_conflict or slug_conflict or host_conflict:
        raise HTTPException(status_code=409, detail="Tenant name, slug, or primary host already exists")

    tenant = Tenant(
        id=str(uuid.uuid4()),
        name=body.name,
        slug=slug,
        primary_host=host,
        description=body.description,
        default_theme_id=body.default_theme_id,
        is_active=body.is_active,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(tenant)
    await db.flush()
    log_action(
        db,
        action="CREATE_TENANT",
        actor_id=current.id,
        target_type="tenant",
        target_id=tenant.id,
        ip=request_ip(request),
        extra={"slug": tenant.slug, "primary_host": tenant.primary_host or ""},
    )
    await db.commit()
    return (await _serialize_tenants(db, [tenant]))[0]


@router.put("/{tenant_id}", response_model=TenantOut)
async def update_tenant(
    tenant_id: str,
    body: UpdateTenantRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(require_superadmin_user),
):
    tenant = await db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    updates = body.model_dump(exclude_unset=True)
    if "default_theme_id" in updates:
        await _require_theme_if_present(db, updates.get("default_theme_id"))
    if "name" in updates and updates["name"]:
        conflict = await db.scalar(select(Tenant.id).where(Tenant.name == updates["name"], Tenant.id != tenant_id))
        if conflict:
            raise HTTPException(status_code=409, detail="Tenant name already exists")
    if "slug" in updates and updates["slug"]:
        slug = _slugify(updates["slug"])
        if not slug:
            raise HTTPException(status_code=422, detail="Tenant slug is required")
        conflict = await db.scalar(select(Tenant.id).where(Tenant.slug == slug, Tenant.id != tenant_id))
        if conflict:
            raise HTTPException(status_code=409, detail="Tenant slug already exists")
        updates["slug"] = slug
    if "primary_host" in updates:
        normalized_host = _normalize_host(updates["primary_host"])
        if normalized_host:
            conflict = await db.scalar(select(Tenant.id).where(Tenant.primary_host == normalized_host, Tenant.id != tenant_id))
            if conflict:
                raise HTTPException(status_code=409, detail="Tenant primary host already exists")
        updates["primary_host"] = normalized_host

    for field, value in updates.items():
        setattr(tenant, field, value)
    tenant.updated_at = datetime.now(timezone.utc)
    await db.flush()
    log_action(
        db,
        action="UPDATE_TENANT",
        actor_id=current.id,
        target_type="tenant",
        target_id=tenant.id,
        ip=request_ip(request),
        extra=updates or None,
    )
    await db.commit()
    return (await _serialize_tenants(db, [tenant]))[0]


@router.delete("/{tenant_id}")
async def delete_tenant(
    tenant_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(require_superadmin_user),
):
    tenant = await db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    assigned_users = await db.scalar(select(func.count()).select_from(User).where(User.tenant_id == tenant_id)) or 0
    if assigned_users:
        raise HTTPException(status_code=400, detail="Unassign tenant operators before deleting this tenant")

    log_action(
        db,
        action="DELETE_TENANT",
        actor_id=current.id,
        target_type="tenant",
        target_id=tenant.id,
        ip=request_ip(request),
        extra={"slug": tenant.slug},
    )
    await db.delete(tenant)
    await db.commit()
    return {"message": "Deleted"}
