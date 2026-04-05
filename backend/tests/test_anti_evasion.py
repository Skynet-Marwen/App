import unittest

from app.services import anti_evasion
from app.services.bot_detection import detect_click_farm, detect_crawler_signature, detect_headless_signals
from app.services.dnsbl import should_soft_fail_dnsbl
from app.services.network_intel import language_country_mismatch


class AntiEvasionTests(unittest.TestCase):
    def test_runtime_filter_signals_detect_extension_like_blockers(self):
        signals = anti_evasion._runtime_filter_signals(
            {
                "js_active": True,
                "adblock_dom_bait_blocked": True,
                "adblock_same_origin_probe_blocked": False,
                "remote_ad_probe_blocked": True,
            }
        )

        self.assertTrue(signals["adblocker_detected"])
        self.assertFalse(signals["dns_filter_suspected"])
        self.assertEqual(signals["blocker_family"], "extension_like")

    def test_runtime_filter_signals_detect_dns_filter_heuristic(self):
        signals = anti_evasion._runtime_filter_signals(
            {
                "js_active": True,
                "adblock_dom_bait_blocked": False,
                "adblock_same_origin_probe_blocked": False,
                "remote_ad_probe_blocked": True,
            }
        )

        self.assertFalse(signals["adblocker_detected"])
        self.assertTrue(signals["dns_filter_suspected"])
        self.assertEqual(signals["blocker_family"], "dns_or_network_filter")

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

    def test_dnsbl_soft_fail_matches_tunisia_by_default_style_config(self):
        self.assertTrue(
            should_soft_fail_dnsbl(
                "TN",
                {"dnsbl_soft_fail_country_codes": ["TN"]},
            )
        )

    def test_dnsbl_soft_fail_does_not_match_other_countries(self):
        self.assertFalse(
            should_soft_fail_dnsbl(
                "FR",
                {"dnsbl_soft_fail_country_codes": ["TN"]},
            )
        )

    def test_language_mismatch_allows_common_tunisian_languages(self):
        config = {"language_mismatch_allowed_languages_by_country": {"TN": ["ar", "fr", "en"]}}

        self.assertFalse(language_country_mismatch("fr-FR", "TN", config))
        self.assertFalse(language_country_mismatch("en-US", "TN", config))
        self.assertFalse(language_country_mismatch("ar-TN", "TN", config))

    def test_language_mismatch_still_flags_unlisted_languages_for_tunisia(self):
        config = {"language_mismatch_allowed_languages_by_country": {"TN": ["ar", "fr", "en"]}}

        self.assertTrue(language_country_mismatch("it-IT", "TN", config))


if __name__ == "__main__":
    unittest.main()
