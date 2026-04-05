from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import delete, distinct, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.database import Base
from ..core.redis import get_redis
from ..models.activity_event import ActivityEvent
from ..models.anomaly_flag import AnomalyFlag
from ..models.audit_log import AuditLog
from ..models.blocking import BlockedIP
from ..models.device import Device
from ..models.event import Event
from ..models.identity_link import IdentityLink
from ..models.incident import Incident
from ..models.notification_delivery import NotificationDelivery
from ..models.risk_event import RiskEvent
from ..models.security_finding import SecurityFinding
from ..models.site import Site
from ..models.target_profile import TargetProfile
from ..models.user_profile import UserProfile
from ..models.visitor import Visitor
from .backup_sections import archive_storage_root, asset_root
from .data_retention import (
    anonymize_or_prune_visitors,
    prune_activity_events,
    prune_events,
    prune_incidents,
    retention_cutoff,
)
from .intelligence_cleanup import (
    delete_external_user_graph,
    delete_visitor_graph,
    purge_orphan_intelligence_records,
    reconcile_external_profiles,
)
from .runtime_config import runtime_settings


def _serialize_value(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.isoformat()
    return value


def _retention_archive_root() -> Path:
    root = asset_root() / "retention-archives"
    root.mkdir(parents=True, exist_ok=True)
    return root


async def _table_count(db: AsyncSession, model, clause=None) -> int:
    query = select(func.count()).select_from(model)
    if clause is not None:
        query = query.where(clause)
    return int(await db.scalar(query) or 0)


async def _database_size_bytes(db: AsyncSession) -> int | None:
    if db.bind is None or db.bind.dialect.name != "postgresql":
        return None
    try:
        return int(await db.scalar(text("SELECT pg_database_size(current_database())")) or 0)
    except Exception:
        return None


async def _table_sizes(db: AsyncSession) -> list[dict[str, Any]]:
    if db.bind is None or db.bind.dialect.name != "postgresql":
        return []
    query = text(
        """
        SELECT
          relname AS table_name,
          pg_total_relation_size(relid) AS total_bytes
        FROM pg_catalog.pg_statio_user_tables
        ORDER BY pg_total_relation_size(relid) DESC
        LIMIT 5
        """
    )
    try:
        rows = (await db.execute(query)).mappings().all()
    except Exception:
        return []
    return [
        {"table": str(row["table_name"]), "bytes": int(row["total_bytes"] or 0)}
        for row in rows
    ]


async def _redis_status() -> dict[str, Any]:
    redis = get_redis()
    try:
        info = await redis.info(section="memory")
        return {
            "ok": True,
            "used_memory": int(info.get("used_memory", 0) or 0),
            "used_memory_human": str(info.get("used_memory_human", "")),
        }
    except Exception as exc:
        return {
            "ok": False,
            "error": str(exc),
            "used_memory": 0,
            "used_memory_human": "",
        }


async def get_storage_status(db: AsyncSession) -> dict[str, Any]:
    settings = runtime_settings()
    now = datetime.now(timezone.utc)
    visitor_cutoff = retention_cutoff(int(settings.get("visitor_retention_days", 90) or 90), now=now)
    event_cutoff = retention_cutoff(int(settings.get("event_retention_days", 90) or 90), now=now)
    incident_cutoff = retention_cutoff(int(settings.get("incident_retention_days", 365) or 365), now=now)

    preview = {
        "visitors": await _table_count(db, Visitor, Visitor.last_seen < visitor_cutoff),
        "events": await _table_count(db, Event, Event.created_at < event_cutoff),
        "activity_events": await _table_count(db, ActivityEvent, ActivityEvent.created_at < event_cutoff),
        "incidents": await _table_count(
            db,
            Incident,
            (Incident.detected_at < incident_cutoff) & (Incident.status != "open"),
        ),
    }

    backup_root = archive_storage_root()
    archive_root = _retention_archive_root()
    backups = sorted(backup_root.glob("*.skynetbak"))
    archives = sorted(archive_root.glob("*.json"))

    return {
        "retention": {
            "visitor_retention_days": int(settings.get("visitor_retention_days", 90) or 90),
            "event_retention_days": int(settings.get("event_retention_days", 90) or 90),
            "incident_retention_days": int(settings.get("incident_retention_days", 365) or 365),
            "anonymize_ips": bool(settings.get("anonymize_ips")),
        },
        "preview": preview,
        "database": {
            "size_bytes": await _database_size_bytes(db),
            "tables": await _table_sizes(db),
            "index_count": sum(len(table.indexes) for table in Base.metadata.sorted_tables),
        },
        "cache": await _redis_status(),
        "backups": {
            "count": len(backups),
            "size_bytes": sum(path.stat().st_size for path in backups if path.exists()),
        },
        "archives": {
            "count": len(archives),
            "size_bytes": sum(path.stat().st_size for path in archives if path.exists()),
        },
        "deliveries": {
            "count": await _table_count(db, NotificationDelivery),
        },
    }


async def run_storage_purge(db: AsyncSession) -> dict[str, int]:
    settings = runtime_settings()
    now = datetime.now(timezone.utc)
    visitors = await anonymize_or_prune_visitors(
        db,
        retention_days=int(settings.get("visitor_retention_days", 90) or 90),
        anonymize_ips=bool(settings.get("anonymize_ips")),
        now=now,
    )
    return {
        "events": await prune_events(
            db,
            retention_days=int(settings.get("event_retention_days", 90) or 90),
            now=now,
        ),
        "activity_events": await prune_activity_events(
            db,
            retention_days=int(settings.get("event_retention_days", 90) or 90),
            now=now,
        ),
        "incidents": await prune_incidents(
            db,
            retention_days=int(settings.get("incident_retention_days", 365) or 365),
            now=now,
        ),
        "visitors_deleted": visitors["deleted"],
        "visitors_anonymized": visitors["anonymized"],
    }


async def build_retention_archive(db: AsyncSession) -> tuple[str, bytes, dict[str, int]]:
    settings = runtime_settings()
    now = datetime.now(timezone.utc)
    visitor_cutoff = retention_cutoff(int(settings.get("visitor_retention_days", 90) or 90), now=now)
    event_cutoff = retention_cutoff(int(settings.get("event_retention_days", 90) or 90), now=now)
    incident_cutoff = retention_cutoff(int(settings.get("incident_retention_days", 365) or 365), now=now)

    expired_visitors = (
        await db.execute(select(Visitor).where(Visitor.last_seen < visitor_cutoff).order_by(Visitor.last_seen.asc()).limit(5000))
    ).scalars().all()
    expired_events = (
        await db.execute(select(Event).where(Event.created_at < event_cutoff).order_by(Event.created_at.asc()).limit(5000))
    ).scalars().all()
    expired_activity = (
        await db.execute(select(ActivityEvent).where(ActivityEvent.created_at < event_cutoff).order_by(ActivityEvent.created_at.asc()).limit(5000))
    ).scalars().all()
    expired_incidents = (
        await db.execute(
            select(Incident)
            .where(Incident.detected_at < incident_cutoff, Incident.status != "open")
            .order_by(Incident.detected_at.asc())
            .limit(5000)
        )
    ).scalars().all()

    payload = {
        "generated_at": now.isoformat(),
        "instance_name": settings.get("instance_name", "SkyNet"),
        "retention": {
            "visitor_retention_days": int(settings.get("visitor_retention_days", 90) or 90),
            "event_retention_days": int(settings.get("event_retention_days", 90) or 90),
            "incident_retention_days": int(settings.get("incident_retention_days", 365) or 365),
            "anonymize_ips": bool(settings.get("anonymize_ips")),
        },
        "datasets": {
            "visitors": [_serialize_model(item) for item in expired_visitors],
            "events": [_serialize_model(item) for item in expired_events],
            "activity_events": [_serialize_model(item) for item in expired_activity],
            "incidents": [_serialize_model(item) for item in expired_incidents],
        },
    }

    archive_root = _retention_archive_root()
    filename = f"retention-archive-{now.strftime('%Y%m%d-%H%M%S')}.json"
    body = json.dumps(payload, default=_serialize_value, ensure_ascii=True, indent=2).encode("utf-8")
    (archive_root / filename).write_bytes(body)
    counts = {key: len(value) for key, value in payload["datasets"].items()}
    return filename, body, counts


def _serialize_model(instance) -> dict[str, Any]:
    return {
        column.name: _serialize_value(getattr(instance, column.name))
        for column in instance.__table__.columns
    }


async def _delete_rows(db: AsyncSession, statement) -> int:
    result = await db.execute(statement.execution_options(synchronize_session=False))
    return int(result.rowcount or 0)


async def _external_user_has_remaining_signal(db: AsyncSession, external_user_id: str) -> bool:
    if not external_user_id:
        return False
    if await db.scalar(
        select(func.count()).select_from(Visitor).where(Visitor.external_user_id == external_user_id)
    ):
        return True
    if await db.scalar(
        select(func.count()).select_from(ActivityEvent).where(ActivityEvent.external_user_id == external_user_id)
    ):
        return True
    if await db.scalar(
        select(func.count()).select_from(IdentityLink).where(IdentityLink.external_user_id == external_user_id)
    ):
        return True
    return False


async def purge_tracker_data(db: AsyncSession, site_id: str) -> tuple[Site, dict[str, int]]:
    site = await db.get(Site, site_id)
    if not site:
        raise ValueError("Site not found")

    summary = {
        "visitors_deleted": 0,
        "orphan_devices_deleted": 0,
        "events_deleted": 0,
        "activity_events_deleted": 0,
        "external_users_deleted": 0,
        "profiles_recomputed": 0,
        "security_findings_deleted": 0,
        "target_profiles_deleted": 0,
    }

    tracker_external_user_ids = {
        user_id
        for user_id in (
            await db.execute(
                select(distinct(Visitor.external_user_id)).where(
                    Visitor.site_id == site_id,
                    Visitor.external_user_id.isnot(None),
                )
            )
        ).scalars().all()
        if user_id
    }
    tracker_external_user_ids |= {
        user_id
        for user_id in (
            await db.execute(
                select(distinct(ActivityEvent.external_user_id)).where(
                    ActivityEvent.site_id == site_id,
                    ActivityEvent.external_user_id.isnot(None),
                )
            )
        ).scalars().all()
        if user_id
    }

    visitor_ids = (
        await db.execute(
            select(Visitor.id)
            .where(Visitor.site_id == site_id)
            .order_by(Visitor.last_seen.desc())
        )
    ).scalars().all()
    summary["events_deleted"] = await _table_count(db, Event, Event.site_id == site_id)

    summary["activity_events_deleted"] = await _delete_rows(
        db,
        delete(ActivityEvent).where(ActivityEvent.site_id == site_id),
    )
    summary["security_findings_deleted"] = await _delete_rows(
        db,
        delete(SecurityFinding).where(SecurityFinding.site_id == site_id),
    )
    summary["target_profiles_deleted"] = await _delete_rows(
        db,
        delete(TargetProfile).where(TargetProfile.site_id == site_id),
    )

    affected_external_user_ids: set[str] = set()
    for visitor_id in visitor_ids:
        affected_ids, deleted_orphan_device = await delete_visitor_graph(db, visitor_id)
        summary["visitors_deleted"] += 1
        if deleted_orphan_device:
            summary["orphan_devices_deleted"] += 1
        affected_external_user_ids |= affected_ids

    await _delete_rows(
        db,
        delete(Event).where(Event.site_id == site_id),
    )

    for external_user_id in sorted(tracker_external_user_ids | affected_external_user_ids):
        if await _external_user_has_remaining_signal(db, external_user_id):
            affected_external_user_ids.add(external_user_id)
            continue
        deleted, more_affected = await delete_external_user_graph(db, external_user_id)
        if deleted:
            summary["external_users_deleted"] += 1
            affected_external_user_ids |= more_affected

    await reconcile_external_profiles(
        db,
        affected_external_user_ids,
        trigger_type="purge_tracker_data",
        source="settings.storage.tracker-purge",
        target_id=site_id,
    )
    summary["profiles_recomputed"] = len(affected_external_user_ids)
    return site, summary


async def reset_for_fresh_install(db: AsyncSession) -> dict[str, int]:
    summary = {
        "events_deleted": await _delete_rows(db, delete(Event)),
        "activity_events_deleted": await _delete_rows(db, delete(ActivityEvent)),
        "anomaly_flags_deleted": await _delete_rows(db, delete(AnomalyFlag)),
        "risk_events_deleted": await _delete_rows(db, delete(RiskEvent)),
        "incidents_deleted": await _delete_rows(db, delete(Incident)),
        "security_findings_deleted": await _delete_rows(db, delete(SecurityFinding)),
        "target_profiles_deleted": await _delete_rows(db, delete(TargetProfile)),
        "identity_links_deleted": await _delete_rows(db, delete(IdentityLink)),
        "visitors_deleted": await _delete_rows(db, delete(Visitor)),
        "devices_deleted": await _delete_rows(db, delete(Device)),
        "external_users_deleted": await _delete_rows(db, delete(UserProfile)),
        "notification_deliveries_deleted": await _delete_rows(db, delete(NotificationDelivery)),
        "blocked_ips_deleted": await _delete_rows(db, delete(BlockedIP)),
        "audit_logs_deleted": await _delete_rows(db, delete(AuditLog)),
        "sites_deleted": await _delete_rows(db, delete(Site)),
    }
    await purge_orphan_intelligence_records(db)
    return summary
