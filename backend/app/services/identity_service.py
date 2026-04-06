"""Identity linking service.

Resolves and persists the mapping between an external user (Keycloak sub)
and SKYNET entities (device fingerprint, visitor session).
"""
import uuid
import json
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.identity_link import IdentityLink
from ..models.user_profile import UserProfile
from ..models.device import Device
from ..models.anomaly_flag import AnomalyFlag
from ..models.visitor import Visitor


async def upsert_profile(
    db: AsyncSession,
    external_user_id: str,
    email: Optional[str] = None,
    display_name: Optional[str] = None,
    ip: Optional[str] = None,
    country: Optional[str] = None,
) -> UserProfile:
    """Create or refresh a UserProfile for an external user."""
    profile = await db.scalar(
        select(UserProfile).where(UserProfile.external_user_id == external_user_id)
    )
    now = datetime.now(timezone.utc)
    if not profile:
        profile = UserProfile(
            id=str(uuid.uuid4()),
            external_user_id=external_user_id,
            email=email,
            display_name=display_name,
            first_seen=now,
            last_seen=now,
            last_ip=ip,
            last_country=country,
        )
        db.add(profile)
        if email:
            await _detect_email_reregistration(db, external_user_id, email, profile, now)
    else:
        profile.last_seen = now
        if email:
            profile.email = email
        if display_name:
            profile.display_name = display_name
        if ip:
            profile.last_ip = ip
        if country:
            profile.last_country = country
    await db.flush()
    return profile


async def _detect_email_reregistration(
    db: AsyncSession,
    external_user_id: str,
    email: str,
    new_profile: UserProfile,
    now: datetime,
) -> None:
    """Detect when a deleted account re-registers with the same email.

    Inherits the prior risk score, sets trust to suspicious, and raises a
    high-severity anomaly flag so analysts are alerted immediately.
    """
    deleted = await db.scalar(
        select(UserProfile).where(
            UserProfile.email == email,
            UserProfile.status == "deleted",
            UserProfile.external_user_id != external_user_id,
        )
    )
    if not deleted:
        return

    inherited_score = deleted.current_risk_score or 0.0
    if inherited_score > 0:
        new_profile.current_risk_score = inherited_score
    new_profile.trust_level = "suspicious"

    db.add(
        AnomalyFlag(
            id=str(uuid.uuid4()),
            external_user_id=external_user_id,
            flag_type="email_reregistration",
            severity="high",
            status="open",
            related_device_id=None,
            evidence=json.dumps({
                "deleted_user_id": deleted.external_user_id,
                "email": email,
                "inherited_risk_score": inherited_score,
            }),
            detected_at=now,
        )
    )


async def link_device(
    db: AsyncSession,
    external_user_id: str,
    fingerprint_id: Optional[str],
    visitor_id: Optional[str],
    platform: str,
    ip: Optional[str],
    site_id: Optional[str] = None,
    id_provider: str = "keycloak",
) -> tuple[IdentityLink, bool]:
    """Upsert an IdentityLink and return (link, is_new).

    Also updates Device.owner_user_id and Device.shared_user_count.
    """
    now = datetime.now(timezone.utc)
    is_new = False

    if fingerprint_id:
        visitor = await _resolve_identity_visitor(
            db,
            fingerprint_id=fingerprint_id,
            visitor_id=visitor_id,
            site_id=site_id,
            ip=ip,
        )
        link = await db.scalar(
            select(IdentityLink).where(
                IdentityLink.external_user_id == external_user_id,
                IdentityLink.fingerprint_id == fingerprint_id,
            )
        )
        if not link:
            # Guard against FK violation: only set fingerprint_id if device exists.
            device_exists = bool(await db.get(Device, fingerprint_id))
            resolved_fp = fingerprint_id if device_exists else None

            # If we can now attach a real device, clean up any orphan null-fingerprint
            # link that was created during a prior fallback (device didn't exist yet).
            if device_exists:
                orphan = await db.scalar(
                    select(IdentityLink).where(
                        IdentityLink.external_user_id == external_user_id,
                        IdentityLink.fingerprint_id.is_(None),
                    )
                )
                if orphan:
                    await db.delete(orphan)

            link = IdentityLink(
                id=str(uuid.uuid4()),
                external_user_id=external_user_id,
                id_provider=id_provider,
                fingerprint_id=resolved_fp,
                visitor_id=visitor.id if visitor else visitor_id,
                platform=platform,
                ip=ip,
                linked_at=now,
                last_seen_at=now,
            )
            db.add(link)
            is_new = True
            if device_exists:
                await _update_device_ownership(db, external_user_id, fingerprint_id, platform)
        else:
            link.last_seen_at = now
            link.id_provider = id_provider
            link.platform = platform
            if visitor and link.visitor_id != visitor.id:
                link.visitor_id = visitor.id
            if ip:
                link.ip = ip
        await _sync_external_user_visitors(
            db,
            external_user_id=external_user_id,
            fingerprint_id=fingerprint_id,
            visitor=visitor,
            site_id=site_id,
            ip=ip,
            linked_at=now,
        )
        await _propagate_strict_match_group(
            db,
            external_user_id=external_user_id,
            fingerprint_id=fingerprint_id,
            platform=platform,
            ip=ip,
            site_id=site_id,
            id_provider=id_provider,
            linked_at=now,
        )
        await _reconcile_existing_link_groups(
            db,
            external_user_id=external_user_id,
            platform=platform,
            ip=ip,
            site_id=site_id,
            id_provider=id_provider,
            linked_at=now,
            exclude_fingerprint_id=fingerprint_id,
        )
    else:
        # No fingerprint: upsert the sentinel null-fingerprint link for this user.
        # This records that the identity was asserted without device context.
        link = await db.scalar(
            select(IdentityLink).where(
                IdentityLink.external_user_id == external_user_id,
                IdentityLink.fingerprint_id.is_(None),
            )
        )
        if link:
            link.last_seen_at = now
            link.id_provider = id_provider
            link.platform = platform
            if ip:
                link.ip = ip
        else:
            link = IdentityLink(
                id=str(uuid.uuid4()),
                external_user_id=external_user_id,
                id_provider=id_provider,
                fingerprint_id=None,
                visitor_id=visitor_id,
                platform=platform,
                ip=ip,
                linked_at=now,
                last_seen_at=now,
            )
            db.add(link)
            is_new = True

    await db.flush()
    return link, is_new


async def _resolve_identity_visitor(
    db: AsyncSession,
    *,
    fingerprint_id: str,
    visitor_id: Optional[str],
    site_id: Optional[str],
    ip: Optional[str],
) -> Visitor | None:
    if visitor_id:
        return await db.get(Visitor, visitor_id)

    candidate_sets = [
        (site_id, ip),
        (site_id, None),
        (None, ip),
        (None, None),
    ]
    for candidate_site_id, candidate_ip in candidate_sets:
        query = select(Visitor).where(Visitor.device_id == fingerprint_id)
        if candidate_site_id:
            query = query.where(Visitor.site_id == candidate_site_id)
        if candidate_ip:
            query = query.where(Visitor.ip == candidate_ip)
        visitor = await db.scalar(query.order_by(Visitor.last_seen.desc()))
        if visitor:
            return visitor
    return None


async def _sync_external_user_visitors(
    db: AsyncSession,
    *,
    external_user_id: str,
    fingerprint_id: str,
    visitor: Visitor | None,
    site_id: Optional[str],
    ip: Optional[str],
    linked_at: datetime,
) -> None:
    device = await db.get(Device, fingerprint_id)
    if visitor:
        visitor.external_user_id = external_user_id

    result = await db.execute(
        select(Visitor)
        .where(Visitor.device_id == fingerprint_id)
        .order_by(Visitor.last_seen.desc())
    )
    visitors = result.scalars().all()
    if not visitors:
        return

    # Sole-owner fast-path: only claim visitors that started at or after the link
    # moment, preventing historical anonymous sessions from being retroactively
    # attributed to the newly linking user.
    should_claim_all = bool(device and device.owner_user_id == external_user_id and (device.shared_user_count or 0) == 0)
    for row in visitors:
        if should_claim_all and row.first_seen >= linked_at:
            row.external_user_id = external_user_id
            continue

        matches_current_context = False
        if site_id and row.site_id == site_id:
            matches_current_context = True
        if ip and row.ip == ip:
            matches_current_context = True
        if visitor and row.id == visitor.id:
            matches_current_context = True

        if matches_current_context and (not row.external_user_id or row.external_user_id == external_user_id):
            row.external_user_id = external_user_id


async def _propagate_strict_match_group(
    db: AsyncSession,
    *,
    external_user_id: str,
    fingerprint_id: str,
    platform: str,
    ip: Optional[str],
    site_id: Optional[str],
    id_provider: str,
    linked_at: datetime,
) -> None:
    device = await db.get(Device, fingerprint_id)
    if not device or not device.match_key or not str(device.match_key).startswith("strict:v"):
        return

    siblings = (
        await db.execute(
            select(Device).where(
                Device.match_key == device.match_key,
                Device.id != fingerprint_id,
            )
        )
    ).scalars().all()

    for sibling in siblings:
        if sibling.owner_user_id and sibling.owner_user_id != external_user_id:
            continue

        sibling_visitor = await _resolve_identity_visitor(
            db,
            fingerprint_id=sibling.id,
            visitor_id=None,
            site_id=site_id,
            ip=ip,
        )
        existing = await db.scalar(
            select(IdentityLink).where(
                IdentityLink.external_user_id == external_user_id,
                IdentityLink.fingerprint_id == sibling.id,
            )
        )

        if not sibling.owner_user_id:
            sibling.owner_user_id = external_user_id
        sibling.last_known_platform = sibling.last_known_platform or platform

        if not existing:
            db.add(
                IdentityLink(
                    id=str(uuid.uuid4()),
                    external_user_id=external_user_id,
                    id_provider=id_provider,
                    fingerprint_id=sibling.id,
                    visitor_id=sibling_visitor.id if sibling_visitor else None,
                    platform=sibling.last_known_platform or platform,
                    ip=ip,
                    linked_at=linked_at,
                    last_seen_at=linked_at,
                )
            )
        else:
            existing.last_seen_at = linked_at
            existing.id_provider = id_provider
            existing.platform = sibling.last_known_platform or platform
            if sibling_visitor and existing.visitor_id != sibling_visitor.id:
                existing.visitor_id = sibling_visitor.id
            if ip:
                existing.ip = ip

        await _sync_external_user_visitors(
            db,
            external_user_id=external_user_id,
            fingerprint_id=sibling.id,
            visitor=sibling_visitor,
            site_id=site_id,
            ip=ip,
            linked_at=linked_at,
        )


async def _reconcile_existing_link_groups(
    db: AsyncSession,
    *,
    external_user_id: str,
    platform: str,
    ip: Optional[str],
    site_id: Optional[str],
    id_provider: str,
    linked_at: datetime,
    exclude_fingerprint_id: Optional[str] = None,
) -> None:
    result = await db.execute(
        select(IdentityLink.fingerprint_id).where(
            IdentityLink.external_user_id == external_user_id,
            IdentityLink.fingerprint_id.isnot(None),
        )
    )
    fingerprint_ids = {
        fingerprint_id
        for fingerprint_id in result.scalars().all()
        if fingerprint_id and fingerprint_id != exclude_fingerprint_id
    }
    for linked_fingerprint_id in fingerprint_ids:
        await _propagate_strict_match_group(
            db,
            external_user_id=external_user_id,
            fingerprint_id=linked_fingerprint_id,
            platform=platform,
            ip=ip,
            site_id=site_id,
            id_provider=id_provider,
            linked_at=linked_at,
        )


async def _update_device_ownership(
    db: AsyncSession,
    external_user_id: str,
    fingerprint_id: str,
    platform: str,
) -> None:
    """Set Device.owner_user_id on first link; increment shared_user_count if different user."""
    device = await db.get(Device, fingerprint_id)
    if not device:
        return
    if not device.owner_user_id:
        device.owner_user_id = external_user_id
    elif device.owner_user_id != external_user_id:
        device.shared_user_count = (device.shared_user_count or 0) + 1
    device.last_known_platform = platform


async def detect_multi_account(
    db: AsyncSession,
    external_user_id: str,
    fingerprint_id: Optional[str],
) -> Optional[AnomalyFlag]:
    """Flag if a device is already linked to a different user."""
    if not fingerprint_id:
        return None
    existing = await db.scalar(
        select(IdentityLink).where(
            IdentityLink.fingerprint_id == fingerprint_id,
            IdentityLink.external_user_id != external_user_id,
        )
    )
    if not existing:
        return None

    flag = AnomalyFlag(
        id=str(uuid.uuid4()),
        external_user_id=external_user_id,
        flag_type="multi_account",
        severity="high",
        status="open",
        related_device_id=fingerprint_id,
        evidence=json.dumps({"other_user": existing.external_user_id}),
        detected_at=datetime.now(timezone.utc),
    )
    db.add(flag)
    await db.flush()
    return flag


async def count_user_devices(db: AsyncSession, external_user_id: str) -> int:
    from sqlalchemy import func
    return await db.scalar(
        select(func.count()).select_from(IdentityLink).where(
            IdentityLink.external_user_id == external_user_id,
            IdentityLink.fingerprint_id.isnot(None),
        )
    ) or 0
