import unittest
from datetime import datetime, timedelta, timezone
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


def make_visitor(**overrides):
    base = {
        "device_id": "device-1",
        "ip": "10.0.0.1",
        "last_seen": datetime(2026, 3, 30, 1, 0, tzinfo=timezone.utc),
        "os": "Android 15",
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
        self.assertEqual(strict_group["match_label"], "Same Device (Cross-Browser)")
        self.assertEqual(strict_group["match_evidence"], ["matched screen + timezone + language"])
        self.assertEqual(exact_group["fingerprint_count"], 1)
        self.assertEqual(exact_group["match_key"], None)
        self.assertEqual(exact_group["match_label"], "Exact Only")

    def test_group_devices_adds_probable_mobile_group_for_same_phone_signals(self):
        now = datetime(2026, 3, 30, 12, 0, tzinfo=timezone.utc)
        firefox = make_device(
            id="device-1",
            fingerprint="fp-android-firefox",
            type="mobile",
            browser="Firefox Mobile 149.0",
            os="Android 15",
            screen_resolution="456x1013",
            language="fr-FR",
            timezone="Africa/Tunis",
            webgl_hash=None,
            match_key=None,
        )
        chrome = make_device(
            id="device-2",
            fingerprint="fp-android-chrome",
            type="mobile",
            browser="Chrome Mobile 146.0.0",
            os="Android 10",
            screen_resolution="412x915",
            language="fr",
            timezone="Africa/Tunis",
            webgl_hash=None,
            match_key=None,
            last_seen=now - timedelta(hours=1),
        )
        visitors = {
            "device-1": [make_visitor(device_id="device-1", ip="10.0.0.30", last_seen=now - timedelta(days=1), os="Android 15")],
            "device-2": [make_visitor(device_id="device-2", ip="10.0.0.30", last_seen=now - timedelta(days=2), os="Android 10")],
        }

        groups = group_devices([(firefox, 2), (chrome, 3)], visitors, now=now)

        self.assertEqual(len(groups), 1)
        probable_group = groups[0]
        self.assertEqual(probable_group["match_strength"], "probable_mobile")
        self.assertEqual(probable_group["match_label"], "Same Phone (Probable)")
        self.assertEqual(probable_group["fingerprint_count"], 2)
        self.assertEqual(probable_group["visitor_count"], 5)
        self.assertIn("shared recent IP", probable_group["match_evidence"])
        self.assertIn("same timezone", probable_group["match_evidence"])
        self.assertIn("same language", probable_group["match_evidence"])
        self.assertIn("same mobile form factor", probable_group["match_evidence"])
        self.assertIn("similar screen aspect", probable_group["match_evidence"])

    def test_probable_mobile_requires_shared_recent_ip(self):
        now = datetime(2026, 3, 30, 12, 0, tzinfo=timezone.utc)
        left = make_device(
            id="device-1",
            fingerprint="fp-1",
            type="mobile",
            os="Android 15",
            screen_resolution="456x1013",
            language="fr-FR",
            timezone="Africa/Tunis",
            webgl_hash=None,
            match_key=None,
        )
        right = make_device(
            id="device-2",
            fingerprint="fp-2",
            type="mobile",
            os="Android 14",
            screen_resolution="412x915",
            language="fr",
            timezone="Africa/Tunis",
            webgl_hash=None,
            match_key=None,
        )
        visitors = {
            "device-1": [make_visitor(device_id="device-1", ip="10.0.0.30", last_seen=now - timedelta(days=31))],
            "device-2": [make_visitor(device_id="device-2", ip="10.0.0.30", last_seen=now - timedelta(days=1))],
        }

        groups = group_devices([(left, 1), (right, 1)], visitors, now=now)

        self.assertEqual(len(groups), 2)
        self.assertTrue(all(group["match_strength"] == "exact" for group in groups))

    def test_probable_mobile_same_ip_but_low_score_stays_exact(self):
        now = datetime(2026, 3, 30, 12, 0, tzinfo=timezone.utc)
        left = make_device(
            id="device-1",
            fingerprint="fp-1",
            type="mobile",
            os="Android 15",
            screen_resolution="360x800",
            language="en-US",
            timezone="Africa/Tunis",
            webgl_hash=None,
            match_key=None,
        )
        right = make_device(
            id="device-2",
            fingerprint="fp-2",
            type="mobile",
            os="Android 14",
            screen_resolution="800x800",
            language="fr-FR",
            timezone="Europe/Paris",
            webgl_hash=None,
            match_key=None,
        )
        visitors = {
            "device-1": [make_visitor(device_id="device-1", ip="10.0.0.30", last_seen=now - timedelta(days=1))],
            "device-2": [make_visitor(device_id="device-2", ip="10.0.0.30", last_seen=now - timedelta(days=1))],
        }

        groups = group_devices([(left, 1), (right, 1)], visitors, now=now)

        self.assertEqual(len(groups), 2)
        self.assertTrue(all(group["match_strength"] == "exact" for group in groups))

    def test_probable_mobile_never_groups_across_os_families(self):
        now = datetime(2026, 3, 30, 12, 0, tzinfo=timezone.utc)
        android = make_device(
            id="device-1",
            fingerprint="fp-1",
            type="mobile",
            os="Android 15",
            screen_resolution="456x1013",
            language="fr-FR",
            timezone="Africa/Tunis",
            webgl_hash=None,
            match_key=None,
        )
        ios = make_device(
            id="device-2",
            fingerprint="fp-2",
            type="mobile",
            os="iOS 18.1",
            screen_resolution="430x932",
            language="fr-FR",
            timezone="Africa/Tunis",
            webgl_hash=None,
            match_key=None,
        )
        visitors = {
            "device-1": [make_visitor(device_id="device-1", ip="10.0.0.30", last_seen=now - timedelta(days=1), os="Android 15")],
            "device-2": [make_visitor(device_id="device-2", ip="10.0.0.30", last_seen=now - timedelta(days=1), os="iOS 18.1")],
        }

        groups = group_devices([(android, 1), (ios, 1)], visitors, now=now)

        self.assertEqual(len(groups), 2)
        self.assertTrue(all(group["match_strength"] == "exact" for group in groups))

    def test_probable_mobile_avoids_weak_transitive_chain_merges(self):
        now = datetime(2026, 3, 30, 12, 0, tzinfo=timezone.utc)
        device_a = make_device(
            id="device-a",
            fingerprint="fp-a",
            type="mobile",
            os="Android 15",
            screen_resolution="456x1013",
            language="en-US",
            timezone="Africa/Tunis",
            webgl_hash=None,
            match_key=None,
        )
        device_b = make_device(
            id="device-b",
            fingerprint="fp-b",
            type="mobile",
            os="Android 15",
            screen_resolution="412x915",
            language="en-US",
            timezone="Africa/Tunis",
            webgl_hash=None,
            match_key=None,
            last_seen=now - timedelta(minutes=30),
        )
        device_c = make_device(
            id="device-c",
            fingerprint="fp-c",
            type="mobile",
            os="Android 15",
            screen_resolution="360x800",
            language="fr-FR",
            timezone="Africa/Tunis",
            webgl_hash=None,
            match_key=None,
            last_seen=now - timedelta(minutes=10),
        )
        visitors = {
            "device-a": [make_visitor(device_id="device-a", ip="10.0.0.30", last_seen=now - timedelta(days=1))],
            "device-b": [
                make_visitor(device_id="device-b", ip="10.0.0.30", last_seen=now - timedelta(days=1)),
                make_visitor(device_id="device-b", ip="10.0.0.31", last_seen=now - timedelta(days=2)),
            ],
            "device-c": [
                make_visitor(device_id="device-c", ip="10.0.0.30", last_seen=now - timedelta(days=1)),
                make_visitor(device_id="device-c", ip="10.0.0.31", last_seen=now - timedelta(days=2)),
            ],
        }

        groups = group_devices([(device_a, 1), (device_b, 1), (device_c, 1)], visitors, now=now)

        probable_groups = [group for group in groups if group["match_strength"] == "probable_mobile"]
        exact_groups = [group for group in groups if group["match_strength"] == "exact"]
        self.assertEqual(len(probable_groups), 1)
        self.assertEqual(probable_groups[0]["fingerprint_count"], 2)
        self.assertEqual({device["id"] for device in probable_groups[0]["devices"]}, {"device-a", "device-b"})
        self.assertEqual(len(exact_groups), 1)
        self.assertEqual(exact_groups[0]["devices"][0]["id"], "device-c")


if __name__ == "__main__":
    unittest.main()
