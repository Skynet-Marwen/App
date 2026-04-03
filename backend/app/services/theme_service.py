from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.theme import Theme
from ..models.tenant import Tenant
from ..models.user import User
from ..models.user_profile import UserProfile
from .runtime_config import runtime_settings
from .theme_assets import find_theme_logo_path


DEFAULT_THEME_ID = "skynet-default"


DEFAULT_THEME_CONFIG = {
    "id": DEFAULT_THEME_ID,
    "name": "SkyNet Default",
    "colors": {
        "primary": "#22d3ee",
        "secondary": "#0f172a",
        "accent": "#06b6d4",
        "background": "#030712",
        "backgroundGradient": "radial-gradient(circle at top, rgba(34,211,238,0.10), transparent 42%), linear-gradient(180deg, #030712 0%, #020617 100%)",
        "surface": "#111827",
        "surfaceAlt": "rgba(15, 23, 42, 0.88)",
        "headerBackground": "rgba(2, 6, 23, 0.86)",
        "headerBorder": "rgba(34, 211, 238, 0.16)",
        "headerText": "#e5f6fb",
        "navBackground": "rgba(3, 7, 18, 0.94)",
        "navBorder": "rgba(34, 211, 238, 0.12)",
        "navText": "#94a3b8",
        "navTextActive": "#67e8f9",
        "footerBackground": "rgba(2, 6, 23, 0.78)",
        "footerBorder": "rgba(34, 211, 238, 0.12)",
        "footerText": "#94a3b8",
        "panelBackground": "rgba(15, 23, 42, 0.66)",
        "panelBorder": "rgba(34, 211, 238, 0.14)",
        "panelGlow": "rgba(6, 182, 212, 0.22)",
        "text": "#e5e7eb",
        "muted": "#94a3b8",
        "success": "#10b981",
        "warning": "#f59e0b",
        "danger": "#ef4444",
    },
    "layout": {
        "density": "comfortable",
        "sidebar": "expanded",
        "panel_style": "glass",
        "font_family": "'Segoe UI', system-ui, sans-serif",
        "nav_style": "stacked",
        "header_alignment": "left",
        "footer_enabled": True,
        "logo_size": "md",
    },
    "widgets": [],
    "branding": {
        "logo_text": "SkyNet",
        "company_name": "SkyNet",
        "title": "SkyNet Dashboard",
        "tagline": "Security Dashboard",
        "logo_url": "",
    },
    "is_default": True,
    "is_active": True,
}


def _theme_logo_api_url(theme: Theme) -> str:
    version = int((theme.updated_at or datetime.now(timezone.utc)).timestamp())
    return f"/api/v1/themes/{theme.id}/logo?v={version}"


def serialize_theme(theme: Theme) -> dict:
    branding = dict(theme.branding or {})
    stored_logo_url = str(branding.get("logo_url") or "").strip()
    uploaded_logo = find_theme_logo_path(theme.id)

    if uploaded_logo:
        branding["logo_url"] = _theme_logo_api_url(theme)
    elif stored_logo_url.startswith("/theme-assets/") or stored_logo_url.startswith(f"/api/v1/themes/{theme.id}/logo"):
        branding["logo_url"] = ""

    return {
        "id": theme.id,
        "name": theme.name,
        "colors": theme.colors or {},
        "layout": theme.layout or {},
        "widgets": theme.widgets or [],
        "branding": branding or None,
        "is_default": bool(theme.is_default),
        "is_active": bool(theme.is_active),
    }


def _is_valid_theme_payload(theme: Theme | None) -> bool:
    if not theme:
        return False
    return (
        isinstance(theme.colors, dict)
        and bool(theme.colors)
        and isinstance(theme.layout, dict)
        and isinstance(theme.widgets, list)
        and (theme.branding is None or isinstance(theme.branding, dict))
        and bool(theme.is_active)
    )


async def get_default_theme(db: AsyncSession) -> Theme | None:
    result = await db.execute(select(Theme).where(Theme.is_default.is_(True)))
    return result.scalar_one_or_none()


async def list_themes(db: AsyncSession, *, include_inactive: bool = False) -> list[Theme]:
    query = select(Theme)
    if not include_inactive:
        query = query.where(Theme.is_active.is_(True))
    result = await db.execute(query.order_by(Theme.name.asc()))
    return list(result.scalars().all())


async def ensure_default_theme(db: AsyncSession) -> Theme:
    default_theme = await get_default_theme(db)
    if default_theme and _is_valid_theme_payload(default_theme):
        return default_theme

    theme = await db.get(Theme, DEFAULT_THEME_ID)
    now = datetime.now(timezone.utc)
    if theme:
        theme.name = DEFAULT_THEME_CONFIG["name"]
        theme.colors = DEFAULT_THEME_CONFIG["colors"]
        theme.layout = DEFAULT_THEME_CONFIG["layout"]
        theme.widgets = DEFAULT_THEME_CONFIG["widgets"]
        theme.branding = DEFAULT_THEME_CONFIG["branding"]
        theme.is_default = True
        theme.is_active = True
        theme.updated_at = now
    else:
        theme = Theme(
            id=DEFAULT_THEME_CONFIG["id"],
            name=DEFAULT_THEME_CONFIG["name"],
            colors=DEFAULT_THEME_CONFIG["colors"],
            layout=DEFAULT_THEME_CONFIG["layout"],
            widgets=DEFAULT_THEME_CONFIG["widgets"],
            branding=DEFAULT_THEME_CONFIG["branding"],
            is_default=True,
            is_active=True,
            created_at=now,
            updated_at=now,
        )
        db.add(theme)

    await db.execute(update(Theme).where(Theme.id != theme.id).values(is_default=False))
    await db.flush()
    return theme


async def list_available_themes(db: AsyncSession) -> list[Theme]:
    return await list_themes(db, include_inactive=False)


async def ensure_user_theme_assignment(db: AsyncSession, user: User) -> Theme:
    default_theme = await ensure_default_theme(db)
    if user.theme_source not in {"default", "user"} or not user.theme_id:
        user.theme_id = default_theme.id
        user.theme_source = "default"
        await db.flush()
    return default_theme


async def set_default_theme(db: AsyncSession, theme: Theme) -> Theme:
    if not theme.is_active:
        raise HTTPException(status_code=400, detail="Cannot set an inactive theme as default")
    await db.execute(update(Theme).values(is_default=False))
    theme.is_default = True
    theme.updated_at = datetime.now(timezone.utc)
    await db.flush()
    return theme


def _risk_band(score: float) -> str:
    if score >= 0.95:
        return "critical"
    if score >= 0.80:
        return "high"
    if score >= 0.60:
        return "elevated"
    return "normal"


def _normalize_tenant_hint(value: str | None) -> str | None:
    if not value:
        return None
    return value.split(":", 1)[0].strip().lower() or None


async def _resolve_dynamic_theme(db: AsyncSession, tenant_hint: str | None = None) -> tuple[Theme | None, str | None]:
    settings = runtime_settings()
    if not bool(settings.get("theme_dynamic_enabled")):
        return None, None

    strategy = str(settings.get("theme_dynamic_strategy") or "risk")
    if strategy != "risk":
        tenant_map = settings.get("theme_dynamic_tenant_map") or {}
        tenant_key = _normalize_tenant_hint(tenant_hint)
        theme_id = tenant_map.get(tenant_key) if tenant_key else None
        if theme_id:
            theme = await db.get(Theme, theme_id)
            if _is_valid_theme_payload(theme):
                return theme, f"dynamic_tenant:{tenant_key}"
        theme_id = tenant_map.get("default")
        if not theme_id:
            return None, None
        theme = await db.get(Theme, theme_id)
        return (theme, "dynamic_tenant_default") if _is_valid_theme_payload(theme) else (None, None)

    highest_score = await db.scalar(select(UserProfile.current_risk_score).order_by(UserProfile.current_risk_score.desc()).limit(1))
    band = _risk_band(float(highest_score or 0.0))
    theme_map = settings.get("theme_dynamic_risk_map") or {}
    theme_id = theme_map.get(band)
    if not theme_id:
        return None, None
    theme = await db.get(Theme, theme_id)
    if not _is_valid_theme_payload(theme):
        return None, None
    return theme, f"dynamic_risk:{band}"


async def resolve_user_theme(db: AsyncSession, user: User, tenant_hint: str | None = None) -> dict:
    default_theme = await ensure_user_theme_assignment(db, user)
    available_themes = await list_available_themes(db)
    fallback_applied = False
    fallback_reason = None
    selected_theme = await db.get(Theme, user.theme_id) if user.theme_id else None
    resolved_theme = selected_theme
    resolved_source = user.theme_source or "default"

    if not _is_valid_theme_payload(resolved_theme):
        resolved_theme = default_theme
        fallback_applied = True
        fallback_reason = "selected_theme_unavailable"
        user.theme_id = default_theme.id
        user.theme_source = "default"
        await db.flush()
        resolved_source = "default"

    if resolved_source == "default":
        tenant_context = None
        tenant = await db.get(Tenant, user.tenant_id) if getattr(user, "tenant_id", None) else None
        if tenant:
            tenant_context = tenant.primary_host or tenant.slug
            if str(runtime_settings().get("theme_dynamic_strategy") or "risk") == "tenant" and tenant.default_theme_id:
                tenant_theme = await db.get(Theme, tenant.default_theme_id)
                if _is_valid_theme_payload(tenant_theme):
                    resolved_theme = tenant_theme
                    resolved_source = "dynamic"
                    fallback_reason = f"dynamic_tenant_account:{tenant.slug}"

        dynamic_theme, dynamic_reason = await _resolve_dynamic_theme(db, tenant_hint=tenant_hint or tenant_context)
        if dynamic_theme:
            resolved_theme = dynamic_theme
            resolved_source = "dynamic"
            fallback_reason = dynamic_reason

    return {
        "selected_theme_id": user.theme_id,
        "theme_source": resolved_source,
        "resolved_theme": serialize_theme(resolved_theme),
        "default_theme_id": default_theme.id,
        "available_themes": [serialize_theme(theme) for theme in available_themes],
        "fallback_applied": fallback_applied,
        "fallback_reason": fallback_reason,
    }


async def assign_default_theme_to_user(db: AsyncSession, user: User) -> None:
    default_theme = await ensure_default_theme(db)
    user.theme_id = default_theme.id
    user.theme_source = "default"


async def apply_user_theme_selection(db: AsyncSession, user: User, theme_id: str | None, theme_source: str | None) -> dict:
    requested_source = theme_source or ("default" if not theme_id else "user")

    if requested_source == "default" or not theme_id:
        default_theme = await ensure_default_theme(db)
        user.theme_id = default_theme.id
        user.theme_source = "default"
        await db.flush()
        return await resolve_user_theme(db, user)

    theme = await db.get(Theme, theme_id)
    if not _is_valid_theme_payload(theme):
        raise HTTPException(status_code=404, detail="Theme not found or inactive")

    user.theme_id = theme.id
    user.theme_source = "user"
    await db.flush()
    return await resolve_user_theme(db, user)
