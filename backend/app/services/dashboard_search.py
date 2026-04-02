from __future__ import annotations

from urllib.parse import quote_plus

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.device import Device
from ..models.user_profile import UserProfile
from ..models.visitor import Visitor
from ..schemas.search import SearchItem, SearchResponse, SearchSection, SearchTotals


def _like_query(query: str) -> str:
    return f"%{query.strip()}%"


async def search_dashboard(db: AsyncSession, query: str, *, limit: int = 4) -> SearchResponse:
    term = query.strip()
    if not term:
        return SearchResponse(query="", totals=SearchTotals(), sections=[])

    visitors = await _search_visitors(db, term, limit=limit)
    devices = await _search_devices(db, term, limit=limit)
    portal_users = await _search_portal_users(db, term, limit=limit)
    totals = SearchTotals(
        visitors=visitors.total,
        devices=devices.total,
        portal_users=portal_users.total,
    )
    totals.overall = totals.visitors + totals.devices + totals.portal_users
    return SearchResponse(query=term, totals=totals, sections=[visitors, devices, portal_users])


async def _search_visitors(db: AsyncSession, query: str, *, limit: int) -> SearchSection:
    like = _like_query(query)
    filters = or_(
        Visitor.ip.ilike(like),
        Visitor.country.ilike(like),
        Visitor.browser.ilike(like),
        Visitor.city.ilike(like),
        Visitor.os.ilike(like),
    )
    total = await db.scalar(select(func.count()).select_from(Visitor).where(filters)) or 0
    result = await db.execute(
        select(
            Visitor.id,
            Visitor.ip,
            Visitor.country,
            Visitor.country_flag,
            Visitor.browser,
            Visitor.os,
            Visitor.status,
        )
        .where(filters)
        .order_by(Visitor.last_seen.desc())
        .limit(limit)
    )
    rows = result.all()
    items = [
        SearchItem(
            id=row.id,
            entity_type="visitor",
            title=row.ip,
            subtitle=" ".join(part for part in [row.country_flag or "", row.country or "Unknown country"] if part).strip(),
            meta=" / ".join(part for part in [row.browser or "Unknown browser", row.os or "Unknown OS"] if part),
            status=row.status,
            route=f"/visitors?search={quote_plus(row.ip)}",
        )
        for row in rows
    ]
    return SearchSection(key="visitors", label="Visitors", total=int(total), items=items)


async def _search_devices(db: AsyncSession, query: str, *, limit: int) -> SearchSection:
    like = _like_query(query)
    filters = or_(
        Device.fingerprint.ilike(like),
        Device.browser.ilike(like),
        Device.os.ilike(like),
        Device.match_key.ilike(like),
        Device.owner_user_id.ilike(like),
    )
    total = await db.scalar(select(func.count()).select_from(Device).where(filters)) or 0
    result = await db.execute(
        select(
            Device.id,
            Device.fingerprint,
            Device.browser,
            Device.os,
            Device.status,
        )
        .where(filters)
        .order_by(Device.last_seen.desc())
        .limit(limit)
    )
    rows = result.all()
    items = [
        SearchItem(
            id=row.id,
            entity_type="device",
            title=row.fingerprint[:18],
            subtitle=" / ".join(part for part in [row.browser or "Unknown browser", row.os or "Unknown OS"] if part),
            meta=f"status: {row.status}",
            status=row.status,
            route=f"/devices?search={quote_plus(row.fingerprint)}",
        )
        for row in rows
    ]
    return SearchSection(key="devices", label="Devices", total=int(total), items=items)


async def _search_portal_users(db: AsyncSession, query: str, *, limit: int) -> SearchSection:
    like = _like_query(query)
    filters = or_(
        UserProfile.external_user_id.ilike(like),
        UserProfile.email.ilike(like),
        UserProfile.display_name.ilike(like),
    )
    total = await db.scalar(select(func.count()).select_from(UserProfile).where(filters)) or 0
    result = await db.execute(
        select(
            UserProfile.external_user_id,
            UserProfile.email,
            UserProfile.display_name,
            UserProfile.trust_level,
            UserProfile.current_risk_score,
        )
        .where(filters)
        .order_by(UserProfile.current_risk_score.desc(), UserProfile.last_seen.desc())
        .limit(limit)
    )
    rows = result.all()
    items = [
        SearchItem(
            id=row.external_user_id,
            entity_type="portal_user",
            title=row.display_name or row.email or row.external_user_id,
            subtitle=row.email or row.external_user_id,
            meta=f"risk {round(float(row.current_risk_score or 0) * 100)}%",
            status=row.trust_level,
            route=f"/users?search={quote_plus(row.external_user_id)}",
        )
        for row in rows
    ]
    return SearchSection(key="portal_users", label="Portal Users", total=int(total), items=items)
