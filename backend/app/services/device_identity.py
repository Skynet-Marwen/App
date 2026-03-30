from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from typing import Any


MATCH_VERSION = 1


def isoformat(dt: datetime | None) -> str | None:
    return dt.isoformat() if dt else None


def normalize_language(language: str | None) -> str | None:
    if not language:
        return None
    head = language.split(",")[0].strip()
    if not head:
        return None
    primary = head.replace("_", "-").split("-")[0].strip().lower()
    return primary or None


def build_match_key(
    webgl_hash: str | None,
    screen_resolution: str | None,
    timezone_name: str | None,
    language: str | None,
) -> str | None:
    normalized_language = normalize_language(language)
    if not all([webgl_hash, screen_resolution, timezone_name, normalized_language]):
        return None
    raw = "||".join([webgl_hash, screen_resolution, timezone_name, normalized_language])
    digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()[:24]
    return f"strict:v{MATCH_VERSION}:{digest}"


def apply_device_match(device: Any) -> None:
    match_key = build_match_key(
        device.webgl_hash,
        device.screen_resolution,
        device.timezone,
        device.language,
    )
    device.match_key = match_key
    device.match_version = MATCH_VERSION if match_key else None


def update_device_metadata(
    device: Any,
    *,
    browser: str | None,
    os_name: str | None,
    device_type: str | None,
    screen_resolution: str | None,
    language: str | None,
    timezone_name: str | None,
    canvas_hash: str | None,
    webgl_hash: str | None,
) -> None:
    device.browser = browser or device.browser
    device.os = os_name or device.os
    device.type = device_type or device.type
    device.screen_resolution = screen_resolution or device.screen_resolution
    device.language = language or device.language
    device.timezone = timezone_name or device.timezone
    device.canvas_hash = canvas_hash or device.canvas_hash
    device.webgl_hash = webgl_hash or device.webgl_hash
    device.last_seen = datetime.now(timezone.utc)
    apply_device_match(device)


def group_devices(rows: list[tuple[Any, int]]) -> list[dict[str, Any]]:
    grouped: dict[str, dict[str, Any]] = {}
    ordered = sorted(rows, key=lambda item: item[0].last_seen or item[0].first_seen, reverse=True)
    for device, visitor_count in ordered:
        group_id = device.match_key or f"device:{device.id}"
        match_strength = "strict" if device.match_key else "exact"
        entry = grouped.get(group_id)
        if not entry:
            entry = {
                "group_id": group_id,
                "match_key": device.match_key,
                "match_strength": match_strength,
                "fingerprint_count": 0,
                "visitor_count": 0,
                "statuses": set(),
                "linked_users": set(),
                "first_seen_raw": device.first_seen,
                "last_seen_raw": device.last_seen,
                "devices": [],
            }
            grouped[group_id] = entry
        entry["fingerprint_count"] += 1
        entry["visitor_count"] += visitor_count or 0
        entry["statuses"].add(device.status)
        if device.linked_user:
            entry["linked_users"].add(device.linked_user)
        if device.first_seen and (entry["first_seen_raw"] is None or device.first_seen < entry["first_seen_raw"]):
            entry["first_seen_raw"] = device.first_seen
        if device.last_seen and (entry["last_seen_raw"] is None or device.last_seen > entry["last_seen_raw"]):
            entry["last_seen_raw"] = device.last_seen
        entry["devices"].append(
            {
                "id": device.id,
                "fingerprint": device.fingerprint,
                "browser": device.browser,
                "os": device.os,
                "risk_score": device.risk_score,
                "status": device.status,
                "linked_user": device.linked_user,
                "visitor_count": visitor_count or 0,
                "first_seen": isoformat(device.first_seen),
                "last_seen": isoformat(device.last_seen),
            }
        )

    payload: list[dict[str, Any]] = []
    for entry in grouped.values():
        linked_users = entry.pop("linked_users")
        statuses = entry.pop("statuses")
        if len(statuses) == 1:
            status = next(iter(statuses))
        else:
            status = "mixed"
        if not linked_users:
            linked_user_state = "none"
            linked_user = None
        elif len(linked_users) == 1:
            linked_user_state = "single"
            linked_user = next(iter(linked_users))
        else:
            linked_user_state = "mixed"
            linked_user = None
        entry["status"] = status
        entry["linked_user_state"] = linked_user_state
        entry["linked_user"] = linked_user
        entry["first_seen"] = isoformat(entry.pop("first_seen_raw"))
        entry["last_seen"] = isoformat(entry.pop("last_seen_raw"))
        entry["devices"].sort(key=lambda item: item["last_seen"] or "", reverse=True)
        payload.append(entry)
    payload.sort(key=lambda item: item["last_seen"] or "", reverse=True)
    return payload
