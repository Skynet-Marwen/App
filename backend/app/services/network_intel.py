from __future__ import annotations

from typing import Any


ACTION_PRIORITY = {"observe": 0, "flag": 1, "challenge": 2, "block": 3}
CLOUD_PROVIDER_KEYWORDS = (
    "aws",
    "amazon",
    "azure",
    "gcp",
    "google cloud",
    "digitalocean",
    "linode",
    "ovh",
    "hetzner",
    "oracle cloud",
    "vultr",
    "alibaba",
    "tencent cloud",
    "cloudflare",
)
VPN_PROVIDER_KEYWORDS = (
    "nord",
    "expressvpn",
    "surfshark",
    "mullvad",
    "proton",
    "pia",
    "private internet access",
    "windscribe",
    "cyberghost",
    "purevpn",
    "ivpn",
)


def normalize_list(value: Any) -> list[str]:
    if isinstance(value, list):
        items = value
    elif isinstance(value, str):
        items = value.split(",")
    else:
        return []
    cleaned = []
    for item in items:
        text = str(item or "").strip()
        if text:
            cleaned.append(text)
    return cleaned


def provider_label(geo: dict | None) -> str:
    if not isinstance(geo, dict):
        return ""
    return " ".join(
        str(geo.get(key) or "").strip()
        for key in ("isp", "org", "as")
        if str(geo.get(key) or "").strip()
    ).strip()


def language_country(language: str | None) -> str | None:
    if not language:
        return None
    normalized = str(language).replace("_", "-").strip()
    parts = [part for part in normalized.split("-") if part]
    if len(parts) < 2:
        return None
    region = parts[-1].upper()
    return region if len(region) == 2 and region.isalpha() else None


def language_country_mismatch(language: str | None, geo_country_code: str | None) -> bool:
    lang_country = language_country(language)
    if not lang_country or not geo_country_code:
        return False
    return lang_country != str(geo_country_code).upper()


def is_datacenter_provider(geo: dict | None) -> bool:
    label = provider_label(geo).lower()
    return bool(geo and (geo.get("hosting") or any(keyword in label for keyword in CLOUD_PROVIDER_KEYWORDS)))


def is_vpn_provider(geo: dict | None) -> bool:
    label = provider_label(geo).lower()
    proxy = bool(geo and geo.get("proxy"))
    return bool(proxy and any(keyword in label for keyword in VPN_PROVIDER_KEYWORDS))


def country_watchlist(settings: dict) -> list[str]:
    return [item.upper() for item in normalize_list(settings.get("network_country_watchlist"))]


def provider_watchlist(settings: dict) -> list[str]:
    return [item.lower() for item in normalize_list(settings.get("network_provider_watchlist"))]


def match_country_rule(settings: dict, geo: dict | None) -> dict | None:
    country_code = str((geo or {}).get("country_code") or "").upper()
    if not country_code:
        return None
    watchlist = set(country_watchlist(settings))
    if country_code not in watchlist:
        return None
    return {
        "kind": "country_rule",
        "action": str(settings.get("network_country_action") or "observe"),
        "country_code": country_code,
        "country": (geo or {}).get("country"),
    }


def match_provider_rule(settings: dict, geo: dict | None) -> dict | None:
    label = provider_label(geo)
    lowered = label.lower()
    if not lowered:
        return None
    keywords = provider_watchlist(settings)
    matched = next((keyword for keyword in keywords if keyword in lowered), None)
    if not matched:
        return None
    return {
        "kind": "provider_rule",
        "action": str(settings.get("network_provider_action") or "observe"),
        "provider": label,
        "matched_keyword": matched,
    }


def network_detection_matches(settings: dict, geo: dict | None) -> list[dict]:
    matches: list[dict] = []
    geo = geo or {}
    if geo.get("proxy"):
        matches.append({"kind": "proxy_detected", "action": str(settings.get("network_proxy_action") or "observe")})
    if is_vpn_provider(geo):
        matches.append({"kind": "vpn_detected", "action": str(settings.get("network_vpn_action") or "observe")})
    if is_datacenter_provider(geo):
        matches.append({"kind": "datacenter_detected", "action": str(settings.get("network_datacenter_action") or "observe")})
    country_match = match_country_rule(settings, geo)
    if country_match:
        matches.append(country_match)
    provider_match = match_provider_rule(settings, geo)
    if provider_match:
        matches.append(provider_match)
    return matches


def highest_priority_action(matches: list[dict]) -> dict | None:
    if not matches:
        return None
    selected = max(matches, key=lambda item: ACTION_PRIORITY.get(str(item.get("action") or "observe"), 0))
    return selected if ACTION_PRIORITY.get(str(selected.get("action") or "observe"), 0) > 0 else None


def filter_detection_matches(matches: list[dict], config: dict | None) -> list[dict]:
    if not config:
        return matches
    enabled = {
        "proxy_detected": bool(config.get("proxy_detection", True)),
        "vpn_detected": bool(config.get("vpn_detection", True)),
        "datacenter_detected": bool(config.get("datacenter_detection", True)),
    }
    filtered = []
    for match in matches:
        kind = str(match.get("kind") or "")
        if kind in enabled and not enabled[kind]:
            continue
        filtered.append(match)
    return filtered
