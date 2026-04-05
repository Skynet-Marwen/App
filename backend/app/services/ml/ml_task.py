"""
Periodic ML retraining background task.
Follows the exact asyncio.Task pattern used in stie_runtime.py.

Every ML_RETRAIN_INTERVAL_HOURS:
  1. Query Device WHERE status='active' AND risk_score < 30
     AND last_seen > NOW() - TRAINING_LOOKBACK_DAYS
  2. Extract feature vectors
  3. Call train_model() → IsolationForest fit + save to disk
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from ...core.database import AsyncSessionLocal
from ...models.device import Device
from ...services.runtime_config import runtime_settings
from .anomaly_detector import train_model
from .feature_extractor import extract_device_features

log = logging.getLogger("skynet.ml")

ML_RETRAIN_INTERVAL_HOURS = 24
TRAINING_LOOKBACK_DAYS = 7


async def _run_training_cycle() -> None:
    cutoff = datetime.now(timezone.utc) - timedelta(days=TRAINING_LOOKBACK_DAYS)
    async with AsyncSessionLocal() as db:
        rows = await db.execute(
            select(Device).where(
                Device.status == "active",
                Device.risk_score < 30,
                Device.last_seen > cutoff,
            )
        )
        devices = rows.scalars().all()

    if not devices:
        log.info("ML training skipped: no qualifying devices found")
        return

    feature_matrix: list[list[float]] = []
    for device in devices:
        vec = extract_device_features(device)
        if vec is not None:
            feature_matrix.append(vec)

    log.info("ML training: %d feature vectors from %d devices", len(feature_matrix), len(devices))
    train_model(feature_matrix)


async def _ml_training_loop() -> None:
    while True:
        try:
            flags = runtime_settings().get("feature_flags") or {}
            if flags.get("ml_anomaly_detection"):
                await _run_training_cycle()
        except asyncio.CancelledError:
            raise
        except Exception:
            log.exception("ML training loop failed")
        await asyncio.sleep(ML_RETRAIN_INTERVAL_HOURS * 3600)


def start_ml_runtime() -> asyncio.Task:
    return asyncio.create_task(_ml_training_loop(), name="skynet-ml-runtime")
