from sqlalchemy import delete, distinct, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.activity_event import ActivityEvent
from ..models.anomaly_flag import AnomalyFlag
from ..models.device import Device
from ..models.event import Event
from ..models.identity_link import IdentityLink
from ..models.incident import Incident
from ..models.risk_event import RiskEvent
from ..models.user_profile import UserProfile
from ..models.visitor import Visitor
from . import identity_service
from .group_escalation import recompute_user_parent_posture
from .intelligence_filters import orphan_anomaly_flag_clause, orphan_incident_clause


async def prune_orphan_identity_links(
    db: AsyncSession,
    *,
    external_user_ids: set[str] | None = None,
) -> None:
    query = select(IdentityLink).where(
        IdentityLink.fingerprint_id.is_(None),
        IdentityLink.visitor_id.is_(None),
    )
    if external_user_ids:
        query = query.where(IdentityLink.external_user_id.in_(sorted(external_user_ids)))
    rows = (await db.execute(query)).scalars().all()
    for row in rows:
        await db.delete(row)


async def purge_orphan_intelligence_records(db: AsyncSession) -> None:
    await db.execute(
        delete(AnomalyFlag)
        .where(orphan_anomaly_flag_clause())
        .execution_options(synchronize_session=False)
    )
    await db.execute(
        delete(Incident)
        .where(orphan_incident_clause())
        .execution_options(synchronize_session=False)
    )


async def reconcile_external_profiles(
    db: AsyncSession,
    external_user_ids: set[str],
    *,
    trigger_type: str,
    source: str,
    target_id: str | None = None,
) -> None:
    if not external_user_ids:
        await purge_orphan_intelligence_records(db)
        return

    await prune_orphan_identity_links(db, external_user_ids=external_user_ids)
    await purge_orphan_intelligence_records(db)

    for external_user_id in sorted(user_id for user_id in external_user_ids if user_id):
        profile = await db.scalar(
            select(UserProfile).where(UserProfile.external_user_id == external_user_id)
        )
        if not profile:
            continue
        profile.total_devices = await identity_service.count_user_devices(db, external_user_id)
        await recompute_user_parent_posture(
            db,
            external_user_id,
            trigger_context={
                "trigger_type": trigger_type,
                "source": source,
                "target_id": target_id,
            },
        )


async def _related_flag_external_user_ids(
    db: AsyncSession,
    *,
    device_id: str | None = None,
    visitor_ids: list[str] | None = None,
) -> set[str]:
    conditions = []
    if device_id:
        conditions.append(AnomalyFlag.related_device_id == device_id)
    if visitor_ids:
        conditions.append(AnomalyFlag.related_visitor_id.in_(visitor_ids))
    if not conditions:
        return set()

    rows = (
        await db.execute(
            select(distinct(AnomalyFlag.external_user_id)).where(or_(*conditions))
        )
    ).scalars().all()
    return {row for row in rows if row}


async def _delete_related_entity_markers(
    db: AsyncSession,
    *,
    device_id: str | None = None,
    visitor_ids: list[str] | None = None,
) -> set[str]:
    visitor_ids = [visitor_id for visitor_id in (visitor_ids or []) if visitor_id]
    affected_external_user_ids = await _related_flag_external_user_ids(
        db,
        device_id=device_id,
        visitor_ids=visitor_ids,
    )

    if device_id:
        await db.execute(delete(AnomalyFlag).where(AnomalyFlag.related_device_id == device_id))
        await db.execute(delete(Incident).where(Incident.device_id == device_id))
        await db.execute(update(ActivityEvent).where(ActivityEvent.fingerprint_id == device_id).values(fingerprint_id=None))

    if visitor_ids:
        await db.execute(delete(AnomalyFlag).where(AnomalyFlag.related_visitor_id.in_(visitor_ids)))

    return affected_external_user_ids


async def _reassign_device_ownership(db: AsyncSession, device_id: str) -> set[str]:
    device = await db.get(Device, device_id)
    if not device:
        return set()

    remaining_user_ids = {
        user_id
        for user_id in (
            await db.execute(
                select(distinct(IdentityLink.external_user_id)).where(
                    IdentityLink.fingerprint_id == device_id,
                    IdentityLink.external_user_id.isnot(None),
                )
            )
        ).scalars().all()
        if user_id
    }

    if not remaining_user_ids:
        device.owner_user_id = None
        device.shared_user_count = 0
        return set()

    if device.owner_user_id not in remaining_user_ids:
        device.owner_user_id = sorted(remaining_user_ids)[0]
    device.shared_user_count = max(len(remaining_user_ids) - 1, 0)
    return remaining_user_ids


async def delete_device_graph(db: AsyncSession, device_id: str) -> set[str]:
    device = await db.get(Device, device_id)
    if not device:
        return set()

    visitors = (
        await db.execute(select(Visitor).where(Visitor.device_id == device_id))
    ).scalars().all()
    visitor_ids = [visitor.id for visitor in visitors]

    if visitor_ids:
        links_query = select(IdentityLink).where(
            or_(
                IdentityLink.fingerprint_id == device_id,
                IdentityLink.visitor_id.in_(visitor_ids),
            )
        )
    else:
        links_query = select(IdentityLink).where(IdentityLink.fingerprint_id == device_id)
    identity_links = (await db.execute(links_query)).scalars().all()

    affected_external_user_ids = {
        external_user_id
        for external_user_id in {
            device.owner_user_id,
            *(visitor.external_user_id for visitor in visitors),
            *(link.external_user_id for link in identity_links),
        }
        if external_user_id
    }
    affected_external_user_ids |= await _delete_related_entity_markers(
        db,
        device_id=device_id,
        visitor_ids=visitor_ids,
    )

    if visitor_ids:
        await db.execute(delete(Event).where(Event.visitor_id.in_(visitor_ids)))
        for link in identity_links:
            if link.fingerprint_id == device_id:
                await db.delete(link)
            elif link.visitor_id in visitor_ids:
                if link.fingerprint_id:
                    link.visitor_id = None
                else:
                    await db.delete(link)
    else:
        await db.execute(delete(IdentityLink).where(IdentityLink.fingerprint_id == device_id))

    await db.execute(update(Event).where(Event.device_id == device_id).values(device_id=None))
    await db.execute(delete(Visitor).where(Visitor.device_id == device_id))
    await db.delete(device)

    return affected_external_user_ids


async def delete_visitor_graph(db: AsyncSession, visitor_id: str) -> tuple[set[str], bool]:
    visitor = await db.get(Visitor, visitor_id)
    if not visitor:
        return set(), False

    device_id = visitor.device_id
    links = (
        await db.execute(select(IdentityLink).where(IdentityLink.visitor_id == visitor_id))
    ).scalars().all()

    affected_external_user_ids = {
        external_user_id
        for external_user_id in {
            visitor.external_user_id,
            *(link.external_user_id for link in links),
        }
        if external_user_id
    }
    affected_external_user_ids |= await _delete_related_entity_markers(
        db,
        visitor_ids=[visitor_id],
    )

    await db.execute(delete(Event).where(Event.visitor_id == visitor_id))

    for link in links:
        if link.fingerprint_id:
            link.visitor_id = None
        else:
            await db.delete(link)

    await db.delete(visitor)

    deleted_orphan_device = False
    if device_id:
        remaining_visitor_count = await db.scalar(
            select(func.count(Visitor.id)).where(Visitor.device_id == device_id)
        ) or 0
        remaining_link_count = await db.scalar(
            select(func.count(IdentityLink.id)).where(IdentityLink.fingerprint_id == device_id)
        ) or 0
        if remaining_visitor_count == 0 and remaining_link_count == 0:
            affected_external_user_ids |= await delete_device_graph(db, device_id)
            deleted_orphan_device = True

    return affected_external_user_ids, deleted_orphan_device


async def delete_external_user_graph(db: AsyncSession, external_user_id: str) -> tuple[bool, set[str]]:
    profile = await db.scalar(
        select(UserProfile).where(UserProfile.external_user_id == external_user_id)
    )
    if not profile:
        return False, set()

    linked_device_ids = [
        fingerprint_id
        for fingerprint_id in (
            await db.execute(
                select(distinct(IdentityLink.fingerprint_id)).where(
                    IdentityLink.external_user_id == external_user_id,
                    IdentityLink.fingerprint_id.isnot(None),
                )
            )
        ).scalars().all()
        if fingerprint_id
    ]

    await db.execute(delete(AnomalyFlag).where(AnomalyFlag.external_user_id == external_user_id))
    await db.execute(delete(RiskEvent).where(RiskEvent.external_user_id == external_user_id))
    await db.execute(delete(ActivityEvent).where(ActivityEvent.external_user_id == external_user_id))
    await db.execute(delete(Incident).where(Incident.user_id == external_user_id))
    await db.execute(update(Visitor).where(Visitor.external_user_id == external_user_id).values(external_user_id=None))
    await db.execute(delete(IdentityLink).where(IdentityLink.external_user_id == external_user_id))
    await db.delete(profile)

    affected_external_user_ids: set[str] = set()
    for device_id in linked_device_ids:
        affected_external_user_ids |= await _reassign_device_ownership(db, device_id)
        remaining_visitor_count = await db.scalar(
            select(func.count(Visitor.id)).where(Visitor.device_id == device_id)
        ) or 0
        remaining_link_count = await db.scalar(
            select(func.count(IdentityLink.id)).where(IdentityLink.fingerprint_id == device_id)
        ) or 0
        if remaining_visitor_count == 0 and remaining_link_count == 0:
            affected_external_user_ids |= await delete_device_graph(db, device_id)

    await prune_orphan_identity_links(db)
    await purge_orphan_intelligence_records(db)
    return True, affected_external_user_ids
