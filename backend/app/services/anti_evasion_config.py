DEFAULT_ANTI_EVASION_CONFIG = {
    "vpn_detection": True,
    "tor_detection": True,
    "proxy_detection": True,
    "datacenter_detection": True,
    "headless_browser_detection": True,
    "bot_detection": True,
    "canvas_fingerprint": True,
    "webgl_fingerprint": True,
    "font_fingerprint": True,
    "audio_fingerprint": True,
    "timezone_mismatch": True,
    "language_mismatch": True,
    "cookie_evasion": True,
    "ip_rotation_detection": True,
    "spam_rate_threshold": 10,
    "max_accounts_per_device": 3,
    "max_accounts_per_ip": 5,
}

_anti_evasion_config = dict(DEFAULT_ANTI_EVASION_CONFIG)


def get_anti_evasion_config() -> dict:
    return dict(_anti_evasion_config)


def update_anti_evasion_config(data: dict) -> dict:
    for key, value in data.items():
        if key in DEFAULT_ANTI_EVASION_CONFIG:
            _anti_evasion_config[key] = value
    return get_anti_evasion_config()
