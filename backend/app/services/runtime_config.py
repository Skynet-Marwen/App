from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from ..models.runtime_config import RuntimeConfig


DEFAULT_RUNTIME_SETTINGS = {
    "instance_name": "SkyNet",
    "base_url": "http://localhost:8000",
    "https_mode": "off",
    "https_provider": "reverse_proxy",
    "https_certificate_strategy": "edge_managed",
    "https_self_signed_common_name": "localhost",
    "https_self_signed_valid_days": 30,
    "https_letsencrypt_domain": "",
    "https_letsencrypt_email": "",
    "https_letsencrypt_challenge": "http",
    "https_letsencrypt_dns_provider": "",
    "https_letsencrypt_dns_api_token_enc": "",
    "https_uploaded_cert_path": "",
    "https_uploaded_key_path": "",
    "trust_proxy_headers": False,
    "hsts_enabled": False,
    "allowed_domains": [],
    "cors_allowed_origins": ["*"],
    "cors_allowed_methods": ["*"],
    "cors_allowed_headers": ["*"],
    "cors_allow_credentials": True,
    "timezone": "UTC",
    "realtime_enabled": True,
    "developer_mode_enabled": False,
    "feature_flags": {
        "advanced_diagnostics": False,
        "maintenance_console": False,
        "response_ladder": True,
        "ml_anomaly_detection": False,
    },
    "ui_visibility": {
        "settings": {
            "feature_status_summary": True,
            "feature_status_details": True,
        },
        "overview": {
            "realtime_banner": True,
            "stat_cards": True,
            "traffic_heatmap": True,
            "threat_hotspots": True,
            "enforcement_pressure": True,
            "gateway_operations": True,
            "risk_leaderboard": True,
            "priority_investigations": True,
        },
        "navigation": {
            "overview": True,
            "visitors": True,
            "users": True,
            "devices": True,
            "blocking": True,
            "anti-evasion": True,
            "audit": True,
            "integration": True,
            "settings": True,
        },
    },
    "auto_block_tor_vpn": False,
    "require_auth": False,
    "intel_refresh_interval_hours": 24,
    "scan_interval_hours": 12,
    "enable_auto_defense": False,
    "max_scan_depth": 8,
    "correlation_sensitivity": 0.7,
    "visitor_retention_days": 90,
    "event_retention_days": 90,
    "incident_retention_days": 365,
    "anonymize_ips": False,
    "integration_api_access_enabled": True,
    "integration_api_key_prefix": "sk_",
    "rate_limit_integration_per_minute": 120,
    "integration_siem_enabled": False,
    "integration_siem_url": "",
    "integration_siem_secret_enc": "",
    "integration_siem_events": ["high_severity_incident", "evasion_detected", "spam_detected", "block_triggered"],
    "integration_monitoring_enabled": False,
    "integration_monitoring_url": "",
    "integration_monitoring_secret_enc": "",
    "integration_monitoring_events": ["high_severity_incident", "spam_detected", "block_triggered"],
    "webhook_url": "",
    "webhook_secret_enc": "",
    "webhook_events": {},
    "notification_event_matrix": {
        "high_severity_incident": {"label": "High Severity Incident", "webhook": True, "smtp": True, "escalate": True},
        "evasion_detected": {"label": "Evasion Detected", "webhook": True, "smtp": False, "escalate": False},
        "spam_detected": {"label": "Spam Detected", "webhook": True, "smtp": False, "escalate": False},
        "block_triggered": {"label": "Block Triggered", "webhook": True, "smtp": False, "escalate": False},
        "new_user": {"label": "New User", "webhook": True, "smtp": False, "escalate": False},
    },
    "notification_escalation_enabled": False,
    "notification_escalation_min_severity": "critical",
    "notification_escalation_delay_minutes": 15,
    "notification_escalation_repeat_limit": 2,
    "notification_escalation_channels": {"smtp": True, "webhook": True},
    "geoip_provider": "ip-api",
    "smtp_enabled": False,
    "smtp_host": "",
    "smtp_port": 587,
    "smtp_user": "",
    "smtp_password_enc": "",
    "smtp_from_name": "SkyNet",
    "smtp_from_email": "",
    "smtp_tls": True,
    "smtp_ssl": False,
    "keycloak_sync_enabled": False,
    "keycloak_sync_base_url": "",
    "keycloak_sync_auth_realm": "",
    "keycloak_sync_realm": "",
    "keycloak_sync_client_id": "admin-cli",
    "keycloak_sync_client_secret_enc": "",
    "keycloak_sync_username": "",
    "keycloak_sync_password_enc": "",
    "keycloak_sync_user_limit": 500,
    "keycloak_sync_last_run_at": "",
    "keycloak_sync_last_summary": {},
    "idp_default_provider": "",
    "idp_providers": [],
    "auth_jwt_expire_minutes": 1440,
    "auth_max_sessions": 5,
    "auth_password_min_length": 8,
    "auth_password_require_uppercase": False,
    "auth_password_require_numbers": False,
    "auth_password_require_symbols": False,
    "keycloak_enabled": False,
    "keycloak_jwks_url": "",
    "keycloak_issuer": "",
    "keycloak_audience": "",
    "keycloak_cache_ttl_sec": 300,
    "risk_auto_flag_threshold": 0.60,
    "risk_auto_challenge_threshold": 0.80,
    "risk_auto_block_threshold": 0.95,
    "risk_auto_block_enforced": True,
    "response_slowdown_enabled": True,
    "response_slowdown_retry_after_sec": 30,
    "risk_modifier_weights": {
        "shared_device": 0.20,
        "new_device": 0.10,
        "geo_jump": 0.30,
        "tor_vpn": 0.40,
        "headless": 0.30,
        "multi_account": 0.25,
        "behavior_drift": 0.15,
    },
    "group_escalation_enabled": False,
    "group_recent_window_hours": 24,
    "group_history_window_days": 30,
    "group_behavior_burst_window_minutes": 30,
    "group_behavior_similarity_threshold": 1.75,
    "group_escalation_weights": {
        "same_device_risky_visitors": 0.22,
        "strict_group_risky_siblings": 0.18,
        "coordinated_behavior": 0.20,
        "repeated_group_spike": 0.12,
        "multi_device_suspicious_parent": 0.16,
    },
    "fingerprint_clock_skew_tolerance_minutes": 90,
    "fingerprint_signal_weights": {
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
    },
    "network_proxy_action": "observe",
    "network_vpn_action": "observe",
    "network_datacenter_action": "observe",
    "network_country_watchlist": [],
    "network_country_action": "observe",
    "network_provider_watchlist": [],
    "network_provider_action": "observe",
    "network_ip_allowlist": [],
    "network_ip_denylist": [],
    "rate_limit_default_per_minute": 300,
    "rate_limit_track_per_minute": 200,
    "rate_limit_auth_per_minute": 30,
    "rate_limit_auth_login_per_minute": 10,
    "theme_dynamic_enabled": False,
    "theme_dynamic_strategy": "risk",
    "theme_dynamic_risk_map": {},
    "theme_dynamic_tenant_map": {},
    "gateway_enabled": False,
    "gateway_target_origin": "",
    "gateway_site_id": "",
    "gateway_timeout_ms": 10000,
    "gateway_forward_ip_headers": True,
    "gateway_proxy_strip_prefix": "",
    "onboarding_enabled": True,
    "onboarding_completed": False,
    "onboarding_last_completed_at": "",
}

DEFAULT_ANTI_EVASION_CONFIG = {
    "vpn_detection": True,
    "tor_detection": True,
    "proxy_detection": True,
    "datacenter_detection": True,
    "headless_browser_detection": True,
    "bot_detection": True,
    "crawler_signature_detection": True,
    "click_farm_detection": True,
    "canvas_fingerprint": True,
    "webgl_fingerprint": True,
    "font_fingerprint": True,
    "audio_fingerprint": True,
    "timezone_mismatch": True,
    "language_mismatch": True,
    "language_mismatch_allowed_languages_by_country": {
        "TN": ["ar", "fr", "en"],
    },
    "cookie_evasion": True,
    "ip_rotation_detection": True,
    "challenge_enabled": True,
    "challenge_type": "js_pow",
    "challenge_redirect_url": "",
    "challenge_pow_difficulty": 4,
    "challenge_bypass_ttl_sec": 900,
    "challenge_honeypot_field": "website",
    "spam_rate_threshold": 10,
    "form_honeypot_detection": True,
    "form_submission_velocity_threshold": 3,
    "form_submission_velocity_window_sec": 300,
    "form_content_dedupe_threshold": 3,
    "form_content_dedupe_window_sec": 1800,
    "adblocker_detection": False,   # keep opt-in until script-tag probe is revalidated in production
    "adblocker_action": "flag",
    "dns_filter_detection": True,
    "dns_filter_action": "flag",
    "isp_resolution_detection": False,
    "isp_unresolved_action": "observe",
    "dnsbl_enabled": False,
    "dnsbl_providers": ["zen.spamhaus.org", "bl.spamcop.net"],
    "dnsbl_action": "challenge",
    "dnsbl_cache_ttl_sec": 900,
    "dnsbl_soft_fail_country_codes": ["TN"],
    "dnsbl_soft_fail_risk_points": 8,
    "max_accounts_per_device": 3,
    "max_accounts_per_ip": 5,
    "webrtc_leak_detection": True,
}

_settings_cache = dict(DEFAULT_RUNTIME_SETTINGS)
_anti_evasion_cache = dict(DEFAULT_ANTI_EVASION_CONFIG)


def runtime_settings() -> dict:
    return _settings_cache


def anti_evasion_settings() -> dict:
    return _anti_evasion_cache


def runtime_settings_snapshot() -> dict:
    return dict(_settings_cache)


def anti_evasion_settings_snapshot() -> dict:
    return dict(_anti_evasion_cache)


def _merge_defaults(payload: dict | None, defaults: dict) -> dict:
    merged = dict(defaults)
    if not isinstance(payload, dict):
        return merged
    for key in defaults:
        if key in payload:
            merged[key] = payload[key]
    return merged


def apply_runtime_cache(
    runtime_payload: dict | None = None,
    anti_evasion_payload: dict | None = None,
) -> None:
    if runtime_payload is not None:
        _settings_cache.clear()
        _settings_cache.update(_merge_defaults(runtime_payload, DEFAULT_RUNTIME_SETTINGS))
    if anti_evasion_payload is not None:
        _anti_evasion_cache.clear()
        _anti_evasion_cache.update(_merge_defaults(anti_evasion_payload, DEFAULT_ANTI_EVASION_CONFIG))


async def get_or_create_runtime_config(db: AsyncSession) -> RuntimeConfig:
    config = await db.get(RuntimeConfig, 1)
    if config is None:
        config = RuntimeConfig(
            id=1,
            runtime_settings=runtime_settings_snapshot(),
            anti_evasion_config=anti_evasion_settings_snapshot(),
        )
        db.add(config)
        await db.flush()
    return config


async def load_runtime_config(db: AsyncSession) -> RuntimeConfig:
    config = await get_or_create_runtime_config(db)
    apply_runtime_cache(config.runtime_settings, config.anti_evasion_config)
    return config


async def load_runtime_settings(db: AsyncSession) -> dict:
    await load_runtime_config(db)
    return runtime_settings_snapshot()


async def load_anti_evasion_config(db: AsyncSession) -> dict:
    await load_runtime_config(db)
    return anti_evasion_settings_snapshot()


async def save_runtime_settings_cache(db: AsyncSession) -> dict:
    config = await get_or_create_runtime_config(db)
    config.runtime_settings = runtime_settings_snapshot()
    await db.flush()
    return runtime_settings_snapshot()


async def save_anti_evasion_settings_cache(db: AsyncSession) -> dict:
    config = await get_or_create_runtime_config(db)
    config.anti_evasion_config = anti_evasion_settings_snapshot()
    await db.flush()
    return anti_evasion_settings_snapshot()


async def update_runtime_settings(db: AsyncSession, data: dict) -> dict:
    for key, value in data.items():
        if key in DEFAULT_RUNTIME_SETTINGS:
            _settings_cache[key] = value
    return await save_runtime_settings_cache(db)


async def update_anti_evasion_settings(db: AsyncSession, data: dict) -> dict:
    for key, value in data.items():
        if key in DEFAULT_ANTI_EVASION_CONFIG:
            _anti_evasion_cache[key] = value
    return await save_anti_evasion_settings_cache(db)


async def replace_runtime_settings(db: AsyncSession, payload: dict) -> dict:
    apply_runtime_cache(payload, None)
    return await save_runtime_settings_cache(db)


async def replace_anti_evasion_settings(db: AsyncSession, payload: dict) -> dict:
    apply_runtime_cache(None, payload)
    return await save_anti_evasion_settings_cache(db)
