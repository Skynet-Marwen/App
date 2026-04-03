from __future__ import annotations

import hashlib
import hmac
import json
import os
import uuid
from datetime import datetime, timezone
from typing import Any
from zoneinfo import ZoneInfo

from .runtime_config import runtime_settings


FINGERPRINT_VERSION = 1
COOKIE_VERSION = "v1"

_WEIGHTS = {
    "canvas_hash": 0.16,
    "webgl_hash": 0.18,
    "screen": 0.12,
    "language": 0.07,
    "timezone": 0.07,
    "hardware_concurrency": 0.10,
    "device_memory": 0.08,
    "platform": 0.08,
    "connection_type": 0.04,
    "plugin_count": 0.04,
    "touch_points": 0.04,
    "timezone_offset_minutes": 0.06,
    "clock_resolution_ms": 0.05,
    "raf_jitter_score": 0.05,
}


def _weights() -> dict[str, float]:
    configured = runtime_settings().get("fingerprint_signal_weights") or {}
    merged = dict(_WEIGHTS)
    if isinstance(configured, dict):
        for key, default in _WEIGHTS.items():
            try:
                merged[key] = max(float(configured.get(key, default)), 0.0)
            except (TypeError, ValueError):
                merged[key] = default
    return merged


def _secret() -> str:
    return os.environ.get("DEVICE_COOKIE_SECRET") or os.environ.get("APP_SECRET_KEY") or "dev_secret_change_me"


def _coerce_int(value: Any) -> int | None:
    if not isinstance(value, (int, float)):
        return None
    numeric = int(value)
    return numeric if numeric >= 0 else None


def _coerce_float(value: Any) -> float | None:
    if not isinstance(value, (int, float)):
        return None
    numeric = float(value)
    return round(numeric, 4) if numeric >= 0 else None


def _normalize_traits(traits: dict[str, Any] | None) -> dict[str, Any]:
    traits = traits or {}
    return {
        "hardware_concurrency": _coerce_int(traits.get("hardware_concurrency")),
        "device_memory": _coerce_float(traits.get("device_memory")),
        "platform": traits.get("platform") or None,
        "connection_type": traits.get("connection_type") or None,
        "plugin_count": _coerce_int(traits.get("plugin_count")),
        "touch_points": _coerce_int(traits.get("touch_points")),
        "timezone_offset_minutes": _coerce_int(traits.get("timezone_offset_minutes")),
        "clock_resolution_ms": _coerce_float(traits.get("clock_resolution_ms")),
        "raf_jitter_score": _coerce_float(traits.get("raf_jitter_score")),
        "raf_mean_ms": _coerce_float(traits.get("raf_mean_ms")),
    }


def build_snapshot(
    *,
    screen: str | None,
    language: str | None,
    timezone_name: str | None,
    canvas_hash: str | None,
    webgl_hash: str | None,
    fingerprint_traits: dict[str, Any] | None,
) -> dict[str, Any]:
    traits = _normalize_traits(fingerprint_traits)
    return {
        "version": FINGERPRINT_VERSION,
        "screen": screen or None,
        "language": language or None,
        "timezone": timezone_name or None,
        "canvas_hash": canvas_hash or None,
        "webgl_hash": webgl_hash or None,
        **traits,
    }


def compute_confidence(snapshot: dict[str, Any]) -> float:
    weights = _weights()
    total = sum(weights.values())
    observed = sum(weight for key, weight in weights.items() if snapshot.get(key) not in (None, "", []))
    return round(observed / total, 4) if total else 0.0


def compute_composite_hash(snapshot: dict[str, Any]) -> str:
    weights = _weights()
    weighted_parts: list[str] = []
    for key in sorted(weights.keys()):
        value = snapshot.get(key)
        if value in (None, "", []):
            continue
        weight = int(round(weights[key] * 1000))
        weighted_parts.append(f"{key}={json.dumps(value, sort_keys=True, separators=(',', ':'))}@{weight}")
    raw = "||".join(weighted_parts)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def compute_stability(previous: dict[str, Any] | None, current: dict[str, Any]) -> tuple[float, list[str]]:
    if not previous:
        return 1.0, []

    changed: list[str] = []
    retained = 0.0
    comparable = 0.0

    for key, weight in _weights().items():
        old_value = previous.get(key)
        new_value = current.get(key)
        if old_value in (None, "", []) or new_value in (None, "", []):
            continue
        comparable += weight
        if _values_match(old_value, new_value):
            retained += weight
        else:
            changed.append(key)

    if comparable == 0:
        return 1.0, []
    return round(retained / comparable, 4), changed


def _values_match(old_value: Any, new_value: Any) -> bool:
    if isinstance(old_value, (int, float)) and isinstance(new_value, (int, float)):
        baseline = max(abs(float(old_value)), 1.0)
        return abs(float(old_value) - float(new_value)) / baseline <= 0.12
    return old_value == new_value


def compute_composite_score(confidence: float, stability: float) -> float:
    return round((confidence * 0.7) + (stability * 0.3), 4)


def expected_timezone_offset_minutes(timezone_name: str | None, now: datetime | None = None) -> int | None:
    if not timezone_name:
        return None
    reference = now or datetime.now(timezone.utc)
    try:
        offset = reference.astimezone(ZoneInfo(timezone_name)).utcoffset()
    except Exception:
        return None
    if offset is None:
        return None
    return int(offset.total_seconds() // 60)


def detect_clock_skew(
    snapshot: dict[str, Any],
    *,
    geo_timezone: str | None,
    tolerance_minutes: int = 90,
    now: datetime | None = None,
) -> tuple[int | None, bool]:
    client_offset = snapshot.get("timezone_offset_minutes")
    if client_offset is None:
        return None, False
    expected_offset = expected_timezone_offset_minutes(geo_timezone, now=now)
    if expected_offset is None:
        return None, False
    skew = int(client_offset) - int(expected_offset)
    return skew, abs(skew) > max(int(tolerance_minutes or 0), 0)


def build_assessment(
    *,
    previous_snapshot_raw: str | None,
    screen: str | None,
    language: str | None,
    timezone_name: str | None,
    canvas_hash: str | None,
    webgl_hash: str | None,
    fingerprint_traits: dict[str, Any] | None,
    geo_timezone: str | None = None,
    clock_skew_tolerance_minutes: int = 90,
) -> dict[str, Any]:
    previous_snapshot = parse_snapshot(previous_snapshot_raw)
    current_snapshot = build_snapshot(
        screen=screen,
        language=language,
        timezone_name=timezone_name,
        canvas_hash=canvas_hash,
        webgl_hash=webgl_hash,
        fingerprint_traits=fingerprint_traits,
    )
    confidence = compute_confidence(current_snapshot)
    stability, changed_fields = compute_stability(previous_snapshot, current_snapshot)
    drift_score = round(1.0 - stability, 4)
    composite_hash = compute_composite_hash(current_snapshot)
    composite_score = compute_composite_score(confidence, stability)
    clock_skew_minutes, clock_skew_detected = detect_clock_skew(
        current_snapshot,
        geo_timezone=geo_timezone,
        tolerance_minutes=clock_skew_tolerance_minutes,
    )
    return {
        "version": FINGERPRINT_VERSION,
        "snapshot": current_snapshot,
        "confidence": confidence,
        "stability": stability,
        "drift_score": drift_score,
        "composite_hash": composite_hash,
        "composite_score": composite_score,
        "clock_skew_minutes": clock_skew_minutes,
        "clock_skew_detected": clock_skew_detected,
        "changed_fields": changed_fields,
    }


def parse_snapshot(raw: str | None) -> dict[str, Any] | None:
    if not raw:
        return None
    try:
        value = json.loads(raw)
    except (TypeError, ValueError):
        return None
    return value if isinstance(value, dict) else None


def serialize_snapshot(snapshot: dict[str, Any]) -> str:
    return json.dumps(snapshot, separators=(",", ":"), sort_keys=True)


def ensure_cookie_id(device: Any) -> str:
    if getattr(device, "device_cookie_id", None):
        return device.device_cookie_id
    device.device_cookie_id = uuid.uuid4().hex
    return device.device_cookie_id


def issue_device_cookie(cookie_id: str) -> str:
    payload = f"{COOKIE_VERSION}.{cookie_id}"
    signature = hmac.new(_secret().encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).hexdigest()
    return f"{payload}.{signature}"


def verify_device_cookie(token: str | None) -> str | None:
    if not token:
        return None
    parts = token.split(".")
    if len(parts) != 3:
        return None
    version, cookie_id, signature = parts
    if version != COOKIE_VERSION or not cookie_id:
        return None
    payload = f"{version}.{cookie_id}"
    expected = hmac.new(_secret().encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature):
        return None
    return cookie_id
