import unittest
from datetime import datetime, timezone
from types import SimpleNamespace

from app.services.device_identity import (
    MATCH_VERSION,
    apply_device_match,
    build_match_key,
    group_devices,
    normalize_language,
    update_device_metadata,
)


def make_device(**overrides):
    base = {
        "id": "device-1",
        "fingerprint": "fp-1",
        "match_key": None,
        "match_version": None,
        "browser": None,
        "os": None,
        "type": None,
        "screen_resolution": "2048x1152",
        "language": "fr-FR",
        "timezone": "Etc/GMT-1",
        "canvas_hash": None,
        "webgl_hash": "webgl-1",
        "risk_score": 0,
        "status": "active",
        "linked_user": None,
        "first_seen": datetime(2026, 3, 30, 0, 0, tzinfo=timezone.utc),
        "last_seen": datetime(2026, 3, 30, 1, 0, tzinfo=timezone.utc),
    }
    base.update(overrides)
    return SimpleNamespace(**base)


class DeviceIdentityTests(unittest.TestCase):
    def test_normalize_language_reduces_to_primary_tag(self):
        self.assertEqual(normalize_language("fr-FR"), "fr")
        self.assertEqual(normalize_language("en_US"), "en")
        self.assertEqual(normalize_language("ar,fr;q=0.9"), "ar")

    def test_build_match_key_requires_all_strict_signals(self):
        key = build_match_key("wg", "1920x1080", "Etc/GMT-1", "fr-FR")
        self.assertTrue(key.startswith(f"strict:v{MATCH_VERSION}:"))
        self.assertIsNone(build_match_key("wg", "1920x1080", None, "fr-FR"))

    def test_apply_device_match_groups_cross_browser_language_variants(self):
        firefox = make_device(browser="Firefox 148.0", language="fr")
        chrome = make_device(
            id="device-2",
            fingerprint="fp-2",
            browser="Chrome 146.0.0",
            language="fr-FR",
            canvas_hash="other-canvas",
        )
        apply_device_match(firefox)
        apply_device_match(chrome)
        self.assertEqual(firefox.match_key, chrome.match_key)
        self.assertEqual(firefox.match_version, MATCH_VERSION)

    def test_update_device_metadata_populates_browser_fields_and_match(self):
        device = make_device(screen_resolution=None, language=None, timezone=None, webgl_hash=None)
        update_device_metadata(
            device,
            browser="Chrome 146.0.0",
            os_name="Windows 10",
            device_type="desktop",
            screen_resolution="2048x1152",
            language="fr-FR",
            timezone_name="Etc/GMT-1",
            canvas_hash="canvas-1",
            webgl_hash="webgl-1",
        )
        self.assertEqual(device.browser, "Chrome 146.0.0")
        self.assertEqual(device.os, "Windows 10")
        self.assertEqual(device.type, "desktop")
        self.assertEqual(device.match_version, MATCH_VERSION)
        self.assertIsNotNone(device.match_key)

    def test_group_devices_merges_strict_children_and_preserves_singletons(self):
        firefox = make_device(browser="Firefox 148.0", language="fr")
        chrome = make_device(
            id="device-2",
            fingerprint="fp-2",
            browser="Chrome 146.0.0",
            language="fr-FR",
            status="blocked",
            last_seen=datetime(2026, 3, 30, 2, 0, tzinfo=timezone.utc),
        )
        standalone = make_device(
            id="device-3",
            fingerprint="fp-3",
            webgl_hash=None,
            language=None,
            last_seen=datetime(2026, 3, 30, 3, 0, tzinfo=timezone.utc),
        )
        apply_device_match(firefox)
        apply_device_match(chrome)
        apply_device_match(standalone)

        groups = group_devices([(firefox, 1), (chrome, 1), (standalone, 2)])
        self.assertEqual(len(groups), 2)
        strict_group = next(group for group in groups if group["match_strength"] == "strict")
        exact_group = next(group for group in groups if group["match_strength"] == "exact")
        self.assertEqual(strict_group["fingerprint_count"], 2)
        self.assertEqual(strict_group["status"], "mixed")
        self.assertEqual(exact_group["fingerprint_count"], 1)
        self.assertEqual(exact_group["match_key"], None)


if __name__ == "__main__":
    unittest.main()
