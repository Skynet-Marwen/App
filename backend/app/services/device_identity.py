from __future__ import annotations

import hashlib
import re
from collections import Counter
from datetime import datetime, timedelta, timezone
from itertools import combinations
from typing import Any


MATCH_VERSION = 3
RECENT_IP_WINDOW_DAYS = 30
PROBABLE_MOBILE_THRESHOLD = 0.70
MAX_PROBABLE_GROUP_SIZE = 4
STRICT_LABEL = "Same Device (Cross-Browser)"
PROBABLE_MOBILE_LABEL = "Same Phone (Probable)"
EXACT_LABEL = "Exact Only"
STRICT_EVIDENCE = ["matched device profile + timezone + language"]
EXACT_EVIDENCE = ["single exact fingerprint"]
_GENERIC_ANDROID_MODEL_TOKENS = {"", "k", "linux", "android", "mobile", "wv"}
_ANDROID_VENDOR_PREFIXES = [
    ("SM-", "Samsung"),
    ("GT-", "Samsung"),
    ("SGH-", "Samsung"),
    ("SCH-", "Samsung"),
    ("Pixel", "Google"),
    ("Redmi", "Xiaomi"),
    ("POCO", "Xiaomi"),
    ("Mi ", "Xiaomi"),
    ("MIX ", "Xiaomi"),
    ("CPH", "OPPO"),
    ("RMX", "realme"),
    ("VOG-", "Huawei"),
    ("LYA-", "Huawei"),
    ("ELS-", "Huawei"),
    ("ANA-", "Huawei"),
    ("MAR-", "Huawei"),
]
_KNOWN_MODEL_PREFIXES = [
    ("SM-G998", "Galaxy S21 Ultra"),
]


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


def normalize_os_family(os_name: str | None) -> str | None:
    if not os_name:
        return None
    lowered = os_name.strip().lower()
    if lowered.startswith("android"):
        return "Android"
    if lowered.startswith("ios"):
        return "iOS"
    return None


def parse_screen_resolution(screen_resolution: str | None) -> tuple[int, int] | None:
    if not screen_resolution or "x" not in screen_resolution.lower():
        return None
    raw_width, raw_height = screen_resolution.lower().split("x", 1)
    try:
        width = int(raw_width.strip())
        height = int(raw_height.strip())
    except ValueError:
        return None
    if width <= 0 or height <= 0:
        return None
    return width, height


def normalized_aspect_ratio(screen_resolution: str | None) -> float | None:
    parsed = parse_screen_resolution(screen_resolution)
    if not parsed:
        return None
    width, height = parsed
    shorter = min(width, height)
    longer = max(width, height)
    return round(longer / shorter, 4)


def screen_aspect_bucket(screen_resolution: str | None) -> float | None:
    ratio = normalized_aspect_ratio(screen_resolution)
    if ratio is None:
        return None
    return round(ratio, 1)


def screen_size_class(screen_resolution: str | None) -> str | None:
    parsed = parse_screen_resolution(screen_resolution)
    if not parsed:
        return None
    width, height = parsed
    shorter = min(width, height)
    longer = max(width, height)
    if shorter >= 700:
        return "tablet"
    if longer >= 900:
        return "phablet"
    return "phone"


def build_match_key(
    webgl_hash: str | None,
    screen_resolution: str | None,
    timezone_name: str | None,
    language: str | None,
    *,
    os_name: str | None = None,
    device_type: str | None = None,
) -> str | None:
    """
    Cross-browser device key: groups Chrome/Firefox/Edge/Safari on the same
    physical device into one group.

    Key signals:
    - mobile-class devices: normalized form factor + aspect bucket + mobile OS family + timezone + language
    - desktop-class devices: raw screen_resolution + timezone + language

    webgl_hash is intentionally excluded — Firefox blocks WEBGL_debug_renderer_info
    by default, which would break cross-browser grouping.

    Risk of false positive (two distinct machines in same tz/lang with same screen):
    acceptable for self-hosted deployment; individual fingerprints remain visible
    within the group.
    """
    normalized_language = normalize_language(language)
    if not all([screen_resolution, timezone_name, normalized_language]):
        return None

    os_family = normalize_os_family(os_name)
    size_class = screen_size_class(screen_resolution)
    aspect_bucket = screen_aspect_bucket(screen_resolution)
    is_mobile_profile = os_family in {"Android", "iOS"} or device_type == "mobile"

    if is_mobile_profile:
        if not all([os_family, size_class]) or aspect_bucket is None:
            return None
        raw = "||".join(
            [
                "mobile_profile",
                os_family,
                size_class,
                str(aspect_bucket),
                timezone_name,
                normalized_language,
            ]
        )
    else:
        raw = "||".join([screen_resolution, timezone_name, normalized_language])

    digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()[:24]
    return f"strict:v{MATCH_VERSION}:{digest}"


def apply_device_match(device: Any) -> None:
    match_key = build_match_key(
        device.webgl_hash,
        device.screen_resolution,
        device.timezone,
        device.language,
        os_name=device.os,
        device_type=device.type,
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


def _visitor_value(visitor: Any, key: str) -> Any:
    if isinstance(visitor, dict):
        return visitor.get(key)
    return getattr(visitor, key, None)


def _counter_choice(counter: Counter[str]) -> str | None:
    if not counter:
        return None
    return counter.most_common(1)[0][0]


def _clean_android_model_token(token: str | None) -> str | None:
    if not token:
        return None
    candidate = re.sub(r"\s+Build/.*$", "", str(token)).strip(" ;,()[]")
    if not candidate or candidate.lower() in _GENERIC_ANDROID_MODEL_TOKENS:
        return None
    return candidate


def extract_device_model_from_user_agent(user_agent: str | None) -> str | None:
    ua = str(user_agent or "").strip()
    if not ua:
        return None
    lowered = ua.lower()
    if "iphone" in lowered:
        return "iPhone"
    if "ipad" in lowered:
        return "iPad"
    android_match = re.search(r"\(([^)]*android[^)]*)\)", ua, flags=re.IGNORECASE)
    if not android_match:
        return None
    segments = [segment.strip() for segment in android_match.group(1).split(";")]
    android_index = next((index for index, segment in enumerate(segments) if "android" in segment.lower()), None)
    if android_index is None:
        return None
    for segment in segments[android_index + 1:]:
        cleaned = _clean_android_model_token(segment)
        if cleaned:
            return cleaned
    return None


def infer_device_vendor(model: str | None, os_name: str | None = None) -> str | None:
    if model in {"iPhone", "iPad"}:
        return "Apple"
    if model:
        for prefix, vendor in _ANDROID_VENDOR_PREFIXES:
            if str(model).startswith(prefix):
                return vendor
    lowered_os = str(os_name or "").lower()
    if lowered_os.startswith("android"):
        return "Android"
    if lowered_os.startswith("ios"):
        return "Apple"
    return None


def prettify_device_model(model: str | None) -> str | None:
    if not model:
        return None
    for prefix, label in _KNOWN_MODEL_PREFIXES:
        if str(model).startswith(prefix):
            return f"{label} ({model})"
    return model


def fallback_device_name(*, os_name: str | None, device_type: str | None, screen_resolution: str | None) -> str:
    os_family = normalize_os_family(os_name)
    size_class = screen_size_class(screen_resolution)
    if os_family == "iOS" and device_type == "tablet":
        return "iPad"
    if os_family == "iOS":
        return "iPhone"
    if os_family == "Android":
        if device_type == "tablet" or size_class == "tablet":
            return "Android tablet"
        return "Android phone"
    lowered_os = str(os_name or "").lower()
    if "windows" in lowered_os:
        return "Windows desktop"
    if "mac" in lowered_os:
        return "Mac desktop"
    if "linux" in lowered_os:
        return "Linux device"
    if device_type == "tablet":
        return "Tablet"
    if device_type == "mobile":
        return "Mobile device"
    return "Unknown device"


def infer_device_descriptor(device: Any, visitors: list[Any] | None = None) -> dict[str, str | None]:
    visitors = visitors or []
    model_counter: Counter[str] = Counter()
    vendor_counter: Counter[str] = Counter()
    os_counter: Counter[str] = Counter()
    type_counter: Counter[str] = Counter()

    for visitor in visitors:
        visitor_os = _visitor_value(visitor, "os")
        visitor_type = _visitor_value(visitor, "device_type")
        if visitor_os:
            os_counter[str(visitor_os)] += 1
        if visitor_type:
            type_counter[str(visitor_type)] += 1
        model = extract_device_model_from_user_agent(_visitor_value(visitor, "user_agent"))
        if model:
            model_counter[model] += 1
            vendor = infer_device_vendor(model, visitor_os or getattr(device, "os", None))
            if vendor:
                vendor_counter[vendor] += 1

    resolved_os = _counter_choice(os_counter) or getattr(device, "os", None)
    resolved_type = _counter_choice(type_counter) or getattr(device, "type", None)
    probable_model = _counter_choice(model_counter)
    probable_vendor = _counter_choice(vendor_counter) or infer_device_vendor(probable_model, resolved_os)
    pretty_model = prettify_device_model(probable_model)

    if pretty_model:
        if probable_vendor and probable_vendor.lower() not in pretty_model.lower():
            display_name = f"{probable_vendor} {pretty_model}"
        else:
            display_name = pretty_model
    else:
        display_name = fallback_device_name(
            os_name=resolved_os,
            device_type=resolved_type,
            screen_resolution=getattr(device, "screen_resolution", None),
        )

    return {
        "display_name": display_name,
        "probable_model": probable_model,
        "probable_vendor": probable_vendor,
    }


def infer_group_descriptor(devices: list[Any], visitors_by_device: dict[str, list[Any]] | None = None) -> dict[str, str | None]:
    visitors_by_device = visitors_by_device or {}
    model_counter: Counter[str] = Counter()
    vendor_counter: Counter[str] = Counter()
    label_counter: Counter[str] = Counter()

    for device in devices:
        descriptor = infer_device_descriptor(device, visitors_by_device.get(getattr(device, "id", ""), []))
        if descriptor.get("probable_model"):
            model_counter[str(descriptor["probable_model"])] += 1
        if descriptor.get("probable_vendor"):
            vendor_counter[str(descriptor["probable_vendor"])] += 1
        if descriptor.get("display_name"):
            label_counter[str(descriptor["display_name"])] += 1

    probable_model = _counter_choice(model_counter)
    probable_vendor = _counter_choice(vendor_counter)
    if probable_model:
        pretty_model = prettify_device_model(probable_model)
        if probable_vendor and probable_vendor.lower() not in str(pretty_model).lower():
            display_name = f"{probable_vendor} {pretty_model}"
        else:
            display_name = pretty_model
    else:
        display_name = _counter_choice(label_counter) or "Unknown device"

    return {
        "display_name": display_name,
        "probable_model": probable_model,
        "probable_vendor": probable_vendor,
    }


def _build_device_payload(device: Any, visitor_count: int, descriptor: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": device.id,
        "fingerprint": device.fingerprint,
        "display_name": descriptor.get("display_name"),
        "probable_model": descriptor.get("probable_model"),
        "probable_vendor": descriptor.get("probable_vendor"),
        "browser": device.browser,
        "os": device.os,
        "risk_score": device.risk_score,
        "status": device.status,
        "linked_user": device.linked_user,
        "visitor_count": visitor_count or 0,
        "first_seen": isoformat(device.first_seen),
        "last_seen": isoformat(device.last_seen),
    }


def _init_group(
    *,
    group_id: str,
    match_key: str | None,
    match_strength: str,
    match_label: str,
    match_evidence: list[str],
) -> dict[str, Any]:
    return {
        "group_id": group_id,
        "match_key": match_key,
        "match_strength": match_strength,
        "match_label": match_label,
        "match_evidence": list(match_evidence),
        "fingerprint_count": 0,
        "visitor_count": 0,
        "statuses": set(),
        "linked_users": set(),
        "first_seen_raw": None,
        "last_seen_raw": None,
        "devices": [],
        "raw_devices": [],
        "visitors_by_device": {},
    }


def _append_device_to_group(entry: dict[str, Any], device: Any, visitor_count: int) -> None:
    entry["fingerprint_count"] += 1
    entry["visitor_count"] += visitor_count or 0
    entry["statuses"].add(device.status)
    if device.linked_user:
        entry["linked_users"].add(device.linked_user)
    if device.first_seen and (entry["first_seen_raw"] is None or device.first_seen < entry["first_seen_raw"]):
        entry["first_seen_raw"] = device.first_seen
    if device.last_seen and (entry["last_seen_raw"] is None or device.last_seen > entry["last_seen_raw"]):
        entry["last_seen_raw"] = device.last_seen
    entry["raw_devices"].append(device)
    descriptor = infer_device_descriptor(device, entry["visitors_by_device"].get(device.id, []))
    entry["devices"].append(_build_device_payload(device, visitor_count, descriptor))


def _finalize_group(entry: dict[str, Any]) -> dict[str, Any]:
    devices_for_name = entry.pop("raw_devices")
    visitors_by_device = entry.pop("visitors_by_device")
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
    entry.update(infer_group_descriptor(devices_for_name, visitors_by_device))
    entry["first_seen"] = isoformat(entry.pop("first_seen_raw"))
    entry["last_seen"] = isoformat(entry.pop("last_seen_raw"))
    entry["devices"].sort(key=lambda item: item["last_seen"] or "", reverse=True)
    return entry


def _recent_ip_details(visitors: list[Any], cutoff: datetime) -> tuple[dict[str, set[str]], dict[str, datetime]]:
    ip_days: dict[str, set[str]] = {}
    ip_last_seen: dict[str, datetime] = {}
    for visitor in visitors:
        ip = _visitor_value(visitor, "ip")
        last_seen = _visitor_value(visitor, "last_seen")
        if not ip or not last_seen or last_seen < cutoff:
            continue
        ip_days.setdefault(ip, set()).add(last_seen.date().isoformat())
        current_last_seen = ip_last_seen.get(ip)
        if current_last_seen is None or last_seen > current_last_seen:
            ip_last_seen[ip] = last_seen
    return ip_days, ip_last_seen


def _device_context(device: Any, visitors: list[Any], cutoff: datetime) -> dict[str, Any]:
    fallback_os = next(
        (
            _visitor_value(visitor, "os")
            for visitor in visitors
            if _visitor_value(visitor, "os")
        ),
        None,
    )
    ip_days, ip_last_seen = _recent_ip_details(visitors, cutoff)
    return {
        "device": device,
        "os_family": normalize_os_family(device.os) or normalize_os_family(fallback_os),
        "language": normalize_language(device.language),
        "timezone": device.timezone,
        "aspect_ratio": normalized_aspect_ratio(device.screen_resolution),
        "aspect_bucket": screen_aspect_bucket(device.screen_resolution),
        "screen_size_class": screen_size_class(device.screen_resolution),
        "recent_ip_days": ip_days,
        "recent_ip_last_seen": ip_last_seen,
    }


def _is_probable_mobile_eligible(context: dict[str, Any]) -> bool:
    return (
        context["device"].type == "mobile"
        and context["os_family"] in {"Android", "iOS"}
    )


def _pair_score(left: dict[str, Any], right: dict[str, Any]) -> dict[str, Any] | None:
    if left["os_family"] != right["os_family"] or not left["os_family"]:
        return None

    shared_ips = sorted(set(left["recent_ip_days"]) & set(right["recent_ip_days"]))
    if not shared_ips:
        return None

    score = 0.40
    signals = {"shared recent IP"}
    if len(shared_ips) >= 2:
        score += 0.10
        signals.add("multiple shared IPs")

    repeated_cooccurrence = any(
        len(left["recent_ip_days"][ip]) >= 2 and len(right["recent_ip_days"][ip]) >= 2
        for ip in shared_ips
    )
    if repeated_cooccurrence:
        score += 0.05
        signals.add("repeated network co-occurrence")

    if left["timezone"] and left["timezone"] == right["timezone"]:
        score += 0.10
        signals.add("same timezone")

    if left["language"] and left["language"] == right["language"]:
        score += 0.10
        signals.add("same language")

    if left["screen_size_class"] and left["screen_size_class"] == right["screen_size_class"]:
        score += 0.15
        signals.add("same mobile form factor")

    if (
        left["aspect_ratio"] is not None
        and right["aspect_ratio"] is not None
        and abs(left["aspect_ratio"] - right["aspect_ratio"]) <= 0.12
    ):
        score += 0.10
        signals.add("similar screen aspect")

    score = round(min(score, 1.0), 2)
    if score < PROBABLE_MOBILE_THRESHOLD:
        return None

    most_recent_shared_seen = max(
        max(left["recent_ip_last_seen"][ip], right["recent_ip_last_seen"][ip])
        for ip in shared_ips
    )
    return {
        "score": score,
        "signals": signals,
        "most_recent_shared_seen": most_recent_shared_seen,
    }


def _qualifying_pairs(contexts: dict[str, dict[str, Any]]) -> dict[frozenset[str], dict[str, Any]]:
    pairs: dict[frozenset[str], dict[str, Any]] = {}
    device_ids = sorted(contexts)
    for left_id, right_id in combinations(device_ids, 2):
        pair = _pair_score(contexts[left_id], contexts[right_id])
        if pair is not None:
            pairs[frozenset({left_id, right_id})] = pair
    return pairs


def _qualifying_cliques(
    contexts: dict[str, dict[str, Any]],
    pair_scores: dict[frozenset[str], dict[str, Any]],
) -> list[dict[str, Any]]:
    device_ids = sorted(contexts)
    cliques: list[dict[str, Any]] = []
    max_size = min(MAX_PROBABLE_GROUP_SIZE, len(device_ids))
    for size in range(2, max_size + 1):
        for member_ids in combinations(device_ids, size):
            pair_keys = [frozenset(pair) for pair in combinations(member_ids, 2)]
            if any(pair_key not in pair_scores for pair_key in pair_keys):
                continue
            min_pairwise = min(pair_scores[pair_key]["score"] for pair_key in pair_keys)
            avg_pairwise = round(
                sum(pair_scores[pair_key]["score"] for pair_key in pair_keys) / len(pair_keys),
                4,
            )
            most_recent = max(
                contexts[member_id]["device"].last_seen or contexts[member_id]["device"].first_seen
                for member_id in member_ids
            )
            cliques.append(
                {
                    "device_ids": member_ids,
                    "pair_keys": pair_keys,
                    "min_pairwise": min_pairwise,
                    "avg_pairwise": avg_pairwise,
                    "most_recent": most_recent,
                }
            )

    maximal: list[dict[str, Any]] = []
    for clique in cliques:
        members = set(clique["device_ids"])
        if any(
            members < set(other["device_ids"])
            for other in cliques
        ):
            continue
        maximal.append(clique)

    maximal.sort(
        key=lambda item: (
            -item["min_pairwise"],
            -item["avg_pairwise"],
            -(item["most_recent"].timestamp() if item["most_recent"] else 0),
            tuple(item["device_ids"]),
        )
    )
    return maximal


def _probable_group_evidence(
    clique: dict[str, Any],
    pair_scores: dict[frozenset[str], dict[str, Any]],
) -> list[str]:
    common_signals = set.intersection(*(pair_scores[pair_key]["signals"] for pair_key in clique["pair_keys"]))
    common_signals.discard("shared recent IP")
    ordered = ["shared recent IP"]
    for signal in [
        "multiple shared IPs",
        "repeated network co-occurrence",
        "same timezone",
        "same language",
        "same mobile form factor",
        "similar screen aspect",
    ]:
        if signal in common_signals:
            ordered.append(signal)
    return ordered


def _probable_group_id(contexts: dict[str, dict[str, Any]], member_ids: tuple[str, ...]) -> str:
    leader = contexts[member_ids[0]]
    raw = "||".join(
        [
            *member_ids,
            leader["os_family"] or "",
            leader["language"] or "",
            leader["timezone"] or "",
            leader["screen_size_class"] or "",
            str(leader["aspect_bucket"] or ""),
        ]
    )
    digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()[:24]
    return f"probable_mobile:{digest}"


def group_devices(
    rows: list[tuple[Any, int]],
    recent_visitors_by_device: dict[str, list[Any]] | None = None,
    *,
    now: datetime | None = None,
) -> list[dict[str, Any]]:
    recent_visitors_by_device = recent_visitors_by_device or {}
    ordered = sorted(rows, key=lambda item: item[0].last_seen or item[0].first_seen, reverse=True)
    device_map = {device.id: (device, visitor_count or 0) for device, visitor_count in ordered}
    grouped: list[dict[str, Any]] = []
    assigned_ids: set[str] = set()

    strict_buckets: dict[str, list[tuple[Any, int]]] = {}
    for device, visitor_count in ordered:
        if device.match_key:
            strict_buckets.setdefault(device.match_key, []).append((device, visitor_count or 0))

    for match_key, members in strict_buckets.items():
        if len(members) < 2:
            continue
        entry = _init_group(
            group_id=match_key,
            match_key=match_key,
            match_strength="strict",
            match_label=STRICT_LABEL,
            match_evidence=STRICT_EVIDENCE,
        )
        entry["visitors_by_device"] = recent_visitors_by_device
        for device, visitor_count in members:
            assigned_ids.add(device.id)
            _append_device_to_group(entry, device, visitor_count)
        grouped.append(_finalize_group(entry))

    cutoff = (now or datetime.now(timezone.utc)) - timedelta(days=RECENT_IP_WINDOW_DAYS)
    eligible_contexts: dict[str, dict[str, Any]] = {}
    for device, _visitor_count in ordered:
        if device.id in assigned_ids:
            continue
        context = _device_context(
            device,
            recent_visitors_by_device.get(device.id, []),
            cutoff,
        )
        if _is_probable_mobile_eligible(context):
            eligible_contexts[device.id] = context

    pair_scores = _qualifying_pairs(eligible_contexts)
    selected_cliques: list[dict[str, Any]] = []
    used_probable_ids: set[str] = set()
    for clique in _qualifying_cliques(eligible_contexts, pair_scores):
        members = set(clique["device_ids"])
        if members & used_probable_ids:
            continue
        used_probable_ids.update(members)
        selected_cliques.append(clique)

    for clique in selected_cliques:
        evidence = _probable_group_evidence(clique, pair_scores)
        group_id = _probable_group_id(eligible_contexts, clique["device_ids"])
        entry = _init_group(
            group_id=group_id,
            match_key=None,
            match_strength="probable_mobile",
            match_label=PROBABLE_MOBILE_LABEL,
            match_evidence=evidence,
        )
        entry["visitors_by_device"] = recent_visitors_by_device
        for device_id in clique["device_ids"]:
            device, visitor_count = device_map[device_id]
            assigned_ids.add(device_id)
            _append_device_to_group(entry, device, visitor_count)
        grouped.append(_finalize_group(entry))

    for device, visitor_count in ordered:
        if device.id in assigned_ids:
            continue
        entry = _init_group(
            group_id=f"device:{device.id}",
            match_key=device.match_key,
            match_strength="exact",
            match_label=EXACT_LABEL,
            match_evidence=EXACT_EVIDENCE,
        )
        entry["visitors_by_device"] = recent_visitors_by_device
        _append_device_to_group(entry, device, visitor_count)
        grouped.append(_finalize_group(entry))

    grouped.sort(key=lambda item: item["last_seen"] or "", reverse=True)
    return grouped
