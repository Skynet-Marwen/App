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
    "timezone": "UTC",
    "realtime_enabled": True,
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
    "webhook_url": "",
    "webhook_secret": "",
    "webhook_events": {},
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
    "fingerprint_clock_skew_tolerance_minutes": 90,
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
    "dnsbl_enabled": False,
    "dnsbl_providers": ["zen.spamhaus.org", "bl.spamcop.net"],
    "dnsbl_action": "challenge",
    "dnsbl_cache_ttl_sec": 900,
    "max_accounts_per_device": 3,
    "max_accounts_per_ip": 5,
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
