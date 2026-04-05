"""
Feature extraction for ML anomaly detection.
Converts a Device ORM instance into a fixed-length float vector (27 features).
No DB writes — read-only.
"""
from __future__ import annotations

import json
import math
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ...models.device import Device

# Feature vector layout (27 elements):
# [0–3]   click_interval stats   (mean, std, min, max)
# [4–7]   scroll_interval stats
# [8–11]  pointer_interval stats
# [12–15] keydown_interval stats
# [16]    session_duration_ms     (log-scaled, capped at log(3_600_000))
# [17]    click_rate              (clicks/min, capped at 60)
# [18]    interaction_density     (total_interactions / session_duration_s)
# [19]    hardware_concurrency    (normalised 0–16)
# [20]    device_memory           (normalised 0–32 GB)
# [21]    plugin_count            (capped at 20)
# [22]    touch_points            (capped at 10)
# [23]    raf_jitter_score        (0–100, capped)
# [24]    composite_score         (0.0–1.0)
# [25]    stability_score         (0.0–1.0)
# [26]    fingerprint_confidence  (0.0–1.0)

FEATURE_DIM = 27
_LOG_CAP = math.log1p(3_600_000)  # ~15.1, used for session_duration normalisation


def extract_behavior_stats(intervals: list[int | float] | None) -> tuple[float, float, float, float]:
    """Return (mean, std, min, max) for a list of ms intervals.
    All zeros when the list is empty or None."""
    if not intervals:
        return 0.0, 0.0, 0.0, 0.0
    vals = [float(v) for v in intervals if v is not None]
    if not vals:
        return 0.0, 0.0, 0.0, 0.0
    n = len(vals)
    mean = sum(vals) / n
    variance = sum((v - mean) ** 2 for v in vals) / n
    std = math.sqrt(variance)
    return mean, std, min(vals), max(vals)


def _safe_float(value: object, cap: float | None = None) -> float:
    try:
        v = float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return 0.0
    if math.isnan(v) or math.isinf(v):
        return 0.0
    if cap is not None:
        v = min(v, cap)
    return max(v, 0.0)


def extract_device_features(device: "Device") -> list[float] | None:
    """Return a 27-element float vector or None if device is None.

    Missing values are imputed as 0.0.  All fields are read from columns
    already present in the Device model — no new DB columns required.
    """
    if device is None:
        return None

    # --- Behaviour metrics (from fingerprint_snapshot JSON) ---
    snapshot: dict = {}
    if device.fingerprint_snapshot:
        try:
            snapshot = json.loads(device.fingerprint_snapshot)
        except (ValueError, TypeError):
            snapshot = {}

    behavior: dict = snapshot.get("behavior") or {}

    click_stats = extract_behavior_stats(behavior.get("click_intervals_ms"))
    scroll_stats = extract_behavior_stats(behavior.get("scroll_intervals_ms"))
    pointer_stats = extract_behavior_stats(behavior.get("pointer_intervals_ms"))
    keydown_stats = extract_behavior_stats(behavior.get("keydown_intervals_ms"))

    session_ms = _safe_float(behavior.get("session_duration_ms"))
    session_s = session_ms / 1000.0 if session_ms > 0 else 1.0
    click_count = _safe_float(behavior.get("click_count"))
    total_interactions = _safe_float(behavior.get("total_interactions"))

    session_log = min(math.log1p(session_ms), _LOG_CAP) / _LOG_CAP if session_ms > 0 else 0.0
    click_rate = min(click_count / (session_ms / 60_000.0), 60.0) if session_ms > 0 else 0.0
    interaction_density = min(total_interactions / session_s, 60.0) if session_s > 0 else 0.0

    # --- Fingerprint traits (from snapshot) ---
    traits: dict = snapshot.get("traits") or snapshot  # older snapshots store traits at root
    hw = _safe_float(traits.get("hardware_concurrency"), cap=16.0) / 16.0
    mem = _safe_float(traits.get("device_memory"), cap=32.0) / 32.0
    plugins = _safe_float(traits.get("plugin_count"), cap=20.0) / 20.0
    touch = _safe_float(traits.get("touch_points"), cap=10.0) / 10.0
    jitter = _safe_float(traits.get("raf_jitter_score"), cap=100.0) / 100.0

    # --- Device-level scores ---
    composite = _safe_float(getattr(device, "composite_score", None))
    stability = _safe_float(getattr(device, "stability_score", None))
    confidence = _safe_float(getattr(device, "fingerprint_confidence", None))

    vec = [
        *click_stats,     # 0–3
        *scroll_stats,    # 4–7
        *pointer_stats,   # 8–11
        *keydown_stats,   # 12–15
        session_log,      # 16
        click_rate / 60.0,        # 17 — normalised 0–1
        interaction_density / 60.0,  # 18 — normalised 0–1
        hw,               # 19
        mem,              # 20
        plugins,          # 21
        touch,            # 22
        jitter,           # 23
        composite,        # 24
        stability,        # 25
        confidence,       # 26
    ]

    assert len(vec) == FEATURE_DIM, f"BUG: expected {FEATURE_DIM} features, got {len(vec)}"
    return vec
