from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select

from ..core.database import AsyncSessionLocal
from ..models.activity_event import ActivityEvent
from ..models.target_profile import TargetProfile
from ..models.threat_intel import ThreatIntel
from .data_retention import prune_activity_events
from .runtime_config import runtime_settings
from .security_center import refresh_threat_intel, run_security_scan
from .security_center_ops import security_settings


security_logger = logging.getLogger("skynet.security")
app_logger = logging.getLogger("skynet.app")


async def _maintenance_loop() -> None:
    while True:
        try:
            cfg = security_settings()
            retention_cfg = runtime_settings()
            async with AsyncSessionLocal() as db:
                latest_intel = await db.scalar(select(func.max(ThreatIntel.updated_at)))
                latest_scan = await db.scalar(select(func.max(TargetProfile.last_scanned_at)))
                now = datetime.now(timezone.utc)

                if not latest_intel or latest_intel + timedelta(hours=cfg["intel_refresh_interval_hours"]) <= now:
                    updated = await refresh_threat_intel(db)
                    if updated:
                        security_logger.info("STIE threat intel refreshed: %s entries", updated)
                        app_logger.info("STIE intel refresh completed for %s records", updated)

                if not latest_scan or latest_scan + timedelta(hours=cfg["scan_interval_hours"]) <= now:
                    summary = await run_security_scan(db, refresh_intel_first=False)
                    if summary["scanned_targets"]:
                        security_logger.info("STIE scan complete: %s targets, %s findings", summary["scanned_targets"], summary["findings_created"])
                        app_logger.info("STIE scan complete: %s targets", summary["scanned_targets"])

                if await db.scalar(select(func.count(ActivityEvent.id))):
                    pruned = await prune_activity_events(
                        db,
                        retention_days=retention_cfg.get("event_retention_days", 90),
                        now=now,
                    )
                    if pruned:
                        security_logger.info("Activity retention pruned %s expired events", pruned)
                        app_logger.info("Activity retention pruned %s expired events", pruned)
                await db.commit()
        except asyncio.CancelledError:
            raise
        except Exception:
            security_logger.exception("STIE maintenance loop failed")
        await asyncio.sleep(300)


def start_security_runtime() -> asyncio.Task:
    return asyncio.create_task(_maintenance_loop(), name="skynet-stie-runtime")
