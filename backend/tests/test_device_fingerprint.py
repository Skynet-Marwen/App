import unittest

from app.services.device_fingerprint import (
    build_assessment,
    compute_confidence,
    compute_composite_hash,
    detect_clock_skew,
    issue_device_cookie,
    verify_device_cookie,
)


class DeviceFingerprintTests(unittest.TestCase):
    def test_cookie_round_trip_verifies(self):
        token = issue_device_cookie("cookie-123")
        self.assertEqual(verify_device_cookie(token), "cookie-123")

    def test_invalid_cookie_signature_is_rejected(self):
        token = issue_device_cookie("cookie-123")
        broken = token[:-1] + ("0" if token[-1] != "0" else "1")
        self.assertIsNone(verify_device_cookie(broken))

    def test_confidence_rewards_richer_signal_snapshots(self):
        sparse = compute_confidence({"screen": "1920x1080"})
        rich = compute_confidence(
            {
                "screen": "1920x1080",
                "language": "en-US",
                "timezone": "UTC",
                "canvas_hash": "canvas",
                "webgl_hash": "webgl",
                "hardware_concurrency": 8,
                "device_memory": 8,
                "platform": "Linux x86_64",
                "connection_type": "4g",
                "plugin_count": 4,
                "touch_points": 0,
                "clock_resolution_ms": 0.1,
                "raf_jitter_score": 1.2,
            }
        )
        self.assertGreater(rich, sparse)

    def test_assessment_detects_signal_drift(self):
        previous = (
            '{"canvas_hash":"canvas-a","device_memory":8.0,"hardware_concurrency":8,'
            '"language":"en-US","platform":"Linux x86_64","raf_jitter_score":1.5,'
            '"screen":"1920x1080","timezone":"UTC","webgl_hash":"webgl-a"}'
        )
        assessment = build_assessment(
            previous_snapshot_raw=previous,
            screen="1920x1080",
            language="en-US",
            timezone_name="UTC",
            canvas_hash="canvas-b",
            webgl_hash="webgl-a",
            fingerprint_traits={
                "hardware_concurrency": 4,
                "device_memory": 8,
                "platform": "Linux x86_64",
                "raf_jitter_score": 3.5,
            },
        )
        self.assertGreater(assessment["drift_score"], 0)
        self.assertIn("canvas_hash", assessment["changed_fields"])
        self.assertIn("hardware_concurrency", assessment["changed_fields"])

    def test_composite_hash_changes_when_weighted_traits_change(self):
        left = compute_composite_hash({
            "screen": "1920x1080",
            "language": "en-US",
            "timezone": "UTC",
            "hardware_concurrency": 8,
        })
        right = compute_composite_hash({
            "screen": "1920x1080",
            "language": "en-US",
            "timezone": "UTC",
            "hardware_concurrency": 4,
        })
        self.assertNotEqual(left, right)

    def test_clock_skew_detection_compares_client_offset_to_geo_timezone(self):
        snapshot = {
            "timezone_offset_minutes": 60,
        }
        skew, detected = detect_clock_skew(snapshot, geo_timezone="UTC", tolerance_minutes=30)
        self.assertEqual(skew, 60)
        self.assertTrue(detected)

    def test_assessment_includes_composite_and_clock_skew_metadata(self):
        assessment = build_assessment(
            previous_snapshot_raw=None,
            screen="1920x1080",
            language="en-US",
            timezone_name="UTC",
            canvas_hash="canvas-a",
            webgl_hash="webgl-a",
            fingerprint_traits={
                "hardware_concurrency": 8,
                "timezone_offset_minutes": 120,
            },
            geo_timezone="UTC",
            clock_skew_tolerance_minutes=30,
        )
        self.assertTrue(assessment["composite_hash"])
        self.assertGreater(assessment["composite_score"], 0)
        self.assertEqual(assessment["clock_skew_minutes"], 120)
        self.assertTrue(assessment["clock_skew_detected"])


if __name__ == "__main__":
    unittest.main()
