from __future__ import annotations


_CRAWLER_SIGNATURES = (
    "bot",
    "crawler",
    "spider",
    "curl",
    "wget",
    "python-requests",
    "go-http-client",
    "facebookexternalhit",
    "slurp",
    "bingpreview",
)


def detect_crawler_signature(user_agent: str | None) -> dict | None:
    ua = (user_agent or "").strip()
    lowered = ua.lower()
    match = next((token for token in _CRAWLER_SIGNATURES if token in lowered), None)
    if not match:
        return None
    severity = "critical" if match in {"curl", "wget", "python-requests", "go-http-client"} else "high"
    return {
        "signal": "crawler_signature",
        "matched_token": match,
        "severity": severity,
        "risk_score": 100 if severity == "critical" else 82,
    }


def detect_headless_signals(user_agent: str | None, fingerprint_traits: dict | None) -> dict | None:
    traits = fingerprint_traits or {}
    lowered = (user_agent or "").lower()
    reasons: list[str] = []

    webdriver = traits.get("webdriver")
    if isinstance(webdriver, bool) and webdriver:
        reasons.append("webdriver=true")
    if "headless" in lowered:
        reasons.append("headless user-agent")
    if "phantomjs" in lowered:
        reasons.append("phantomjs user-agent")

    plugin_count = traits.get("plugin_count")
    platform = str(traits.get("platform") or "")
    if isinstance(plugin_count, int) and plugin_count == 0 and ("chrome" in lowered or "headlesschrome" in platform.lower()):
        reasons.append("zero plugins on chrome-like client")

    if not reasons:
        return None

    severity = "critical" if any("webdriver" in reason for reason in reasons) else "high"
    return {
        "signal": "headless_browser",
        "reasons": reasons,
        "severity": severity,
        "risk_score": 98 if severity == "critical" else 85,
    }


def detect_click_farm(behavior: dict | None) -> dict | None:
    if not isinstance(behavior, dict):
        return None

    total = int(behavior.get("total_interactions") or 0)
    clicks = int(behavior.get("click_count") or 0)
    scrolls = int(behavior.get("scroll_count") or 0)
    keys = int(behavior.get("keydown_count") or 0)
    duration_ms = int(behavior.get("session_duration_ms") or 0)
    intervals = [int(value) for value in (behavior.get("click_intervals_ms") or []) if isinstance(value, (int, float)) and value > 0]

    if total < 16 or clicks < 12 or duration_ms <= 0:
        return None

    duration_minutes = max(duration_ms / 60000.0, 0.01)
    clicks_per_minute = round(clicks / duration_minutes, 2)
    repetitive = bool(intervals) and len({max(1, int(value // 250)) for value in intervals}) <= 2
    low_context = scrolls <= 1 and keys <= 1

    if clicks_per_minute < 18 or not (repetitive or low_context):
        return None

    severity = "critical" if clicks_per_minute >= 30 and repetitive else "high"
    return {
        "signal": "click_farm",
        "severity": severity,
        "click_count": clicks,
        "clicks_per_minute": clicks_per_minute,
        "scroll_count": scrolls,
        "keydown_count": keys,
        "duration_ms": duration_ms,
        "repetitive": repetitive,
        "risk_score": 96 if severity == "critical" else 82,
    }
