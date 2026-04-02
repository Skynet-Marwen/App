from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.theme import Theme
from .theme_service import serialize_theme, set_default_theme


STARTER_PACKS = [
    {
        "id": "mouwaten-ops",
        "name": "Mouwaten Ops",
        "description": "Bright civic blues with a confident operations shell for public-service monitoring.",
        "themes": [
            {
                "id": "mouwaten-ops",
                "name": "Mouwaten Ops",
                "colors": {
                    "primary": "#0f766e",
                    "secondary": "#12344a",
                    "accent": "#f59e0b",
                    "background": "#f3fbfb",
                    "backgroundGradient": "radial-gradient(circle at top left, rgba(15,118,110,0.16), transparent 34%), linear-gradient(180deg, #f3fbfb 0%, #deeff2 100%)",
                    "surface": "#ffffff",
                    "surfaceAlt": "rgba(255,255,255,0.82)",
                    "headerBackground": "rgba(7,54,66,0.92)",
                    "headerBorder": "rgba(15,118,110,0.22)",
                    "headerText": "#f0fdfa",
                    "navBackground": "rgba(18,52,74,0.96)",
                    "navBorder": "rgba(15,118,110,0.18)",
                    "navText": "#d5e8ef",
                    "navTextActive": "#fbbf24",
                    "footerBackground": "rgba(7,54,66,0.84)",
                    "footerBorder": "rgba(15,118,110,0.18)",
                    "footerText": "#cbd5e1",
                    "panelBackground": "rgba(255,255,255,0.88)",
                    "panelBorder": "rgba(15,118,110,0.16)",
                    "panelGlow": "rgba(15,118,110,0.12)",
                    "text": "#0f172a",
                    "muted": "#475569",
                    "success": "#059669",
                    "warning": "#d97706",
                    "danger": "#dc2626",
                },
                "layout": {
                    "density": "comfortable",
                    "sidebar": "expanded",
                    "panel_style": "elevated",
                    "font_family": "'IBM Plex Sans', 'Segoe UI', sans-serif",
                    "nav_style": "stacked",
                    "header_alignment": "left",
                    "footer_enabled": True,
                    "logo_size": "md",
                },
                "widgets": [],
                "branding": {
                    "logo_text": "Mouwaten",
                    "company_name": "Mouwaten",
                    "title": "Mouwaten Security Center",
                    "tagline": "Citizen-facing trust operations",
                    "logo_url": "",
                },
            }
        ],
    },
    {
        "id": "sandstorm-heat",
        "name": "Sandstorm Heat",
        "description": "Warm sand tones with sharp warning accents for incident-heavy SOC shifts.",
        "themes": [
            {
                "id": "sandstorm-heat",
                "name": "Sandstorm Heat",
                "colors": {
                    "primary": "#b45309",
                    "secondary": "#2d1b12",
                    "accent": "#dc2626",
                    "background": "#1c120d",
                    "backgroundGradient": "radial-gradient(circle at top right, rgba(245,158,11,0.16), transparent 36%), linear-gradient(180deg, #1c120d 0%, #100807 100%)",
                    "surface": "#271913",
                    "surfaceAlt": "rgba(53,31,20,0.82)",
                    "headerBackground": "rgba(20,10,8,0.92)",
                    "headerBorder": "rgba(245,158,11,0.18)",
                    "headerText": "#fff7ed",
                    "navBackground": "rgba(18,9,7,0.96)",
                    "navBorder": "rgba(245,158,11,0.12)",
                    "navText": "#fdba74",
                    "navTextActive": "#fef08a",
                    "footerBackground": "rgba(20,10,8,0.82)",
                    "footerBorder": "rgba(245,158,11,0.16)",
                    "footerText": "#fed7aa",
                    "panelBackground": "rgba(39,25,19,0.88)",
                    "panelBorder": "rgba(245,158,11,0.14)",
                    "panelGlow": "rgba(220,38,38,0.18)",
                    "text": "#fff7ed",
                    "muted": "#fdba74",
                    "success": "#22c55e",
                    "warning": "#f59e0b",
                    "danger": "#ef4444",
                },
                "layout": {
                    "density": "compact",
                    "sidebar": "expanded",
                    "panel_style": "glass",
                    "font_family": "'Space Grotesk', 'Segoe UI', sans-serif",
                    "nav_style": "stacked",
                    "header_alignment": "left",
                    "footer_enabled": True,
                    "logo_size": "md",
                },
                "widgets": [],
                "branding": {
                    "logo_text": "SkyNet Ember",
                    "company_name": "SkyNet",
                    "title": "Response Deck",
                    "tagline": "High-severity command posture",
                    "logo_url": "",
                },
            }
        ],
    },
    {
        "id": "aurora-clear",
        "name": "Aurora Clear",
        "description": "Low-friction daylight theme for calmer analyst workflows and executive review.",
        "themes": [
            {
                "id": "aurora-clear",
                "name": "Aurora Clear",
                "colors": {
                    "primary": "#2563eb",
                    "secondary": "#dbeafe",
                    "accent": "#0891b2",
                    "background": "#eef6ff",
                    "backgroundGradient": "radial-gradient(circle at top, rgba(37,99,235,0.12), transparent 36%), linear-gradient(180deg, #eef6ff 0%, #f8fafc 100%)",
                    "surface": "#ffffff",
                    "surfaceAlt": "rgba(255,255,255,0.9)",
                    "headerBackground": "rgba(255,255,255,0.92)",
                    "headerBorder": "rgba(37,99,235,0.12)",
                    "headerText": "#0f172a",
                    "navBackground": "rgba(248,250,252,0.96)",
                    "navBorder": "rgba(37,99,235,0.08)",
                    "navText": "#475569",
                    "navTextActive": "#2563eb",
                    "footerBackground": "rgba(255,255,255,0.9)",
                    "footerBorder": "rgba(37,99,235,0.1)",
                    "footerText": "#64748b",
                    "panelBackground": "rgba(255,255,255,0.92)",
                    "panelBorder": "rgba(148,163,184,0.16)",
                    "panelGlow": "rgba(37,99,235,0.12)",
                    "text": "#0f172a",
                    "muted": "#64748b",
                    "success": "#16a34a",
                    "warning": "#d97706",
                    "danger": "#dc2626",
                },
                "layout": {
                    "density": "comfortable",
                    "sidebar": "expanded",
                    "panel_style": "elevated",
                    "font_family": "'Sora', 'Segoe UI', sans-serif",
                    "nav_style": "segmented",
                    "header_alignment": "center",
                    "footer_enabled": True,
                    "logo_size": "sm",
                },
                "widgets": [],
                "branding": {
                    "logo_text": "SkyNet Clear",
                    "company_name": "SkyNet",
                    "title": "Executive Overview",
                    "tagline": "Clean posture for broad visibility",
                    "logo_url": "",
                },
            }
        ],
    },
]


def list_starter_packs() -> list[dict]:
    return [
        {
            "id": pack["id"],
            "name": pack["name"],
            "description": pack["description"],
            "theme_count": len(pack["themes"]),
            "themes": [
                {
                    "id": theme["id"],
                    "name": theme["name"],
                    "branding": theme.get("branding"),
                    "colors": theme.get("colors"),
                    "layout": theme.get("layout"),
                }
                for theme in pack["themes"]
            ],
        }
        for pack in STARTER_PACKS
    ]


async def install_starter_pack(
    db: AsyncSession,
    pack_id: str,
    *,
    set_default: bool = False,
) -> dict:
    pack = next((item for item in STARTER_PACKS if item["id"] == pack_id), None)
    if not pack:
        raise HTTPException(status_code=404, detail="Starter pack not found")

    installed: list[Theme] = []
    now = datetime.now(timezone.utc)
    for payload in pack["themes"]:
        theme = await db.get(Theme, payload["id"])
        if theme:
            theme.name = payload["name"]
            theme.colors = payload["colors"]
            theme.layout = payload["layout"]
            theme.widgets = payload.get("widgets") or []
            theme.branding = payload.get("branding")
            theme.is_active = True
            theme.updated_at = now
        else:
            theme = Theme(
                id=payload["id"],
                name=payload["name"],
                colors=payload["colors"],
                layout=payload["layout"],
                widgets=payload.get("widgets") or [],
                branding=payload.get("branding"),
                is_active=True,
                is_default=False,
                created_at=now,
                updated_at=now,
            )
            db.add(theme)
        installed.append(theme)

    await db.flush()
    if set_default and installed:
        await set_default_theme(db, installed[0])

    return {
        "pack_id": pack["id"],
        "name": pack["name"],
        "installed_themes": [serialize_theme(theme) for theme in installed],
        "default_theme_id": installed[0].id if set_default and installed else None,
    }
