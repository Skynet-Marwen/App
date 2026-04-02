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


async def link_device(
    db: AsyncSession,
    external_user_id: str,
    fingerprint_id: Optional[str],
    visitor_id: Optional[str],
    platform: str,
    ip: Optional[str],
    id_provider: str = "keycloak",
) -> tuple[IdentityLink, bool]:
    """Upsert an IdentityLink and return (link, is_new).

    Also updates Device.owner_user_id and Device.shared_user_count.
    """
    now = datetime.now(timezone.utc)
    is_new = False

    if fingerprint_id:
        link = await db.scalar(
            select(IdentityLink).where(
                IdentityLink.external_user_id == external_user_id,
                IdentityLink.fingerprint_id == fingerprint_id,
            )
        )
        if not link:
            link = IdentityLink(
                id=str(uuid.uuid4()),
                external_user_id=external_user_id,
                id_provider=id_provider,
                fingerprint_id=fingerprint_id,
                visitor_id=visitor_id,
                platform=platform,
                ip=ip,
                linked_at=now,
                last_seen_at=now,
            )
            db.add(link)
            is_new = True
            await _update_device_ownership(db, external_user_id, fingerprint_id, platform)
        else:
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
