import unittest

from app.services import anti_evasion
from app.services.bot_detection import detect_click_farm, detect_crawler_signature, detect_headless_signals


class AntiEvasionTests(unittest.TestCase):
    def test_assess_behavior_entropy_flags_overly_regular_timings(self):
        assessment = anti_evasion._assess_behavior_entropy(
            {
                "total_interactions": 12,
                "click_intervals_ms": [500, 500, 500, 500],
                "scroll_intervals_ms": [500, 500, 500, 500],
                "pointer_intervals_ms": [500, 500],
                "keydown_intervals_ms": [],
            }
        )

        self.assertIsNotNone(assessment)
        self.assertEqual(assessment["severity"], "critical")
        self.assertLess(assessment["entropy_score"], 0.18)

    def test_assess_behavior_entropy_ignores_varied_human_like_timings(self):
        assessment = anti_evasion._assess_behavior_entropy(
            {
                "total_interactions": 14,
                "click_intervals_ms": [120, 460, 780, 210],
                "scroll_intervals_ms": [900, 1400, 300, 1100],
                "pointer_intervals_ms": [80, 240, 710, 1280],
                "keydown_intervals_ms": [160, 620],
            }
        )

        self.assertIsNone(assessment)

    def test_detect_crawler_signature_flags_scripted_clients(self):
        assessment = detect_crawler_signature("python-requests/2.31")

        self.assertIsNotNone(assessment)
        self.assertEqual(assessment["severity"], "critical")
        self.assertEqual(assessment["matched_token"], "python-requests")

    def test_detect_headless_signals_uses_webdriver_trait(self):
        assessment = detect_headless_signals(
            "Mozilla/5.0 HeadlessChrome",
            {"webdriver": True, "plugin_count": 0, "platform": "HeadlessChrome"},
        )

        self.assertIsNotNone(assessment)
        self.assertEqual(assessment["severity"], "critical")
        self.assertIn("webdriver=true", assessment["reasons"])

    def test_detect_click_farm_flags_repetitive_click_bursts(self):
        assessment = detect_click_farm(
            {
                "total_interactions": 20,
                "click_count": 18,
                "scroll_count": 0,
                "keydown_count": 0,
                "session_duration_ms": 30000,
                "click_intervals_ms": [500, 500, 500, 500, 500, 500],
            }
        )

        self.assertIsNotNone(assessment)
        self.assertGreaterEqual(assessment["clicks_per_minute"], 30)


if __name__ == "__main__":
    unittest.main()
