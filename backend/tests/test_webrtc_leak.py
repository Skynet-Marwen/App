import unittest

from app.services.anti_evasion import _check_webrtc_leak


class WebRTCLeakTests(unittest.TestCase):
    def _traits(self, **overrides):
        base = {
            "webrtc_available": True,
            "webrtc_vpn_suspected": True,
            "webrtc_stun_reachable": True,
            "webrtc_local_ip_count": 2,
            "webrtc_leak_detected": None,
        }
        base.update(overrides)
        return base

    def test_returns_none_for_none_traits(self):
        self.assertIsNone(_check_webrtc_leak(None))

    def test_returns_none_for_empty_traits(self):
        self.assertIsNone(_check_webrtc_leak({}))

    def test_returns_none_when_webrtc_unavailable(self):
        self.assertIsNone(_check_webrtc_leak(self._traits(webrtc_available=False)))

    def test_returns_none_when_stun_unreachable(self):
        # Probe timed out — inconclusive
        self.assertIsNone(_check_webrtc_leak(self._traits(webrtc_stun_reachable=False)))

    def test_returns_none_when_vpn_not_suspected(self):
        self.assertIsNone(_check_webrtc_leak(self._traits(webrtc_vpn_suspected=False)))

    def test_returns_none_when_available_is_none(self):
        self.assertIsNone(_check_webrtc_leak(self._traits(webrtc_available=None)))

    def test_returns_finding_when_all_conditions_met(self):
        result = _check_webrtc_leak(self._traits())
        self.assertIsNotNone(result)
        self.assertEqual(result["signal"], "webrtc_vpn_bypass")

    def test_severity_is_high(self):
        result = _check_webrtc_leak(self._traits())
        self.assertEqual(result["severity"], "high")

    def test_risk_score_is_75(self):
        result = _check_webrtc_leak(self._traits())
        self.assertEqual(result["risk_score"], 75)

    def test_ip_count_in_finding(self):
        result = _check_webrtc_leak(self._traits(webrtc_local_ip_count=3))
        self.assertEqual(result["webrtc_local_ip_count"], 3)

    def test_returns_none_when_stun_reachable_is_none(self):
        # None means probe incomplete
        self.assertIsNone(_check_webrtc_leak(self._traits(webrtc_stun_reachable=None)))


if __name__ == "__main__":
    unittest.main()
