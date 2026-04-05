import unittest
from unittest.mock import AsyncMock, patch

from app.models.device import Device
from app.services import runtime_config
from app.services.group_escalation.exact_device import compute_device_group_modifier
from app.services.group_escalation.orchestrator import (
    apply_device_parent_score,
    recompute_user_parent_posture,
)
from app.services.group_escalation.strict_group import compute_strict_group_modifier
from app.services.group_escalation.user_parent import compute_user_group_modifiers


class GroupParentEscalationTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self._settings_snapshot = runtime_config.runtime_settings_snapshot()
        self._anti_snapshot = runtime_config.anti_evasion_settings_snapshot()
        self.weights = {
            "same_device_risky_visitors": 0.22,
            "strict_group_risky_siblings": 0.18,
            "coordinated_behavior": 0.20,
            "repeated_group_spike": 0.12,
            "multi_device_suspicious_parent": 0.16,
        }

    def tearDown(self):
        runtime_config.apply_runtime_cache(self._settings_snapshot, self._anti_snapshot)

    def test_single_risky_visitor_only_raises_exact_device_posture(self):
        single = compute_device_group_modifier(
            recent_visitors=1,
            recent_risky_visitors=1,
            burst_events=1,
            burst_distinct_visitors=1,
            recent_risky_events=1,
            history_risky_events=0,
            similarity_ratio=1.0,
            weights=self.weights,
            similarity_threshold=1.75,
        )
        many = compute_device_group_modifier(
            recent_visitors=3,
            recent_risky_visitors=2,
            burst_events=4,
            burst_distinct_visitors=2,
            recent_risky_events=3,
            history_risky_events=2,
            similarity_ratio=2.2,
            weights=self.weights,
            similarity_threshold=1.75,
        )

        self.assertGreater(single["modifier"], 0.0)
        self.assertGreater(many["modifier"], single["modifier"])

    def test_strict_group_risk_isolated_from_unrelated_devices(self):
        none = compute_strict_group_modifier(
            recent_risky_siblings=0,
            recent_active_siblings=1,
            history_risky_siblings=0,
            similarity_ratio=1.0,
            weights=self.weights,
            similarity_threshold=1.75,
        )
        grouped = compute_strict_group_modifier(
            recent_risky_siblings=2,
            recent_active_siblings=2,
            history_risky_siblings=1,
            similarity_ratio=2.0,
            weights=self.weights,
            similarity_threshold=1.75,
        )

        self.assertEqual(none["modifier"], 0.0)
        self.assertGreater(grouped["modifier"], 0.0)
        self.assertTrue(grouped["coordinated"])

    def test_many_risky_devices_raise_user_risk_without_blocked_child(self):
        result = compute_user_group_modifiers(
            risky_devices=2,
            blocked_devices=0,
            risky_match_keys=1,
            recent_activity_count=4,
            history_activity_count=2,
            recent_distinct_devices=2,
            burst_activity_count=3,
            burst_distinct_devices=2,
            similarity_ratio=2.1,
            weights=self.weights,
            similarity_threshold=1.75,
        )

        self.assertGreater(result["extra_modifiers"]["group_user_risk"], 0.0)
        self.assertIn("strict_group_risky_siblings", result["extra_modifiers"])
        self.assertIn("coordinated_group_behavior", result["extra_modifiers"])

    def test_repeated_spike_adds_more_than_weak_history(self):
        weak = compute_user_group_modifiers(
            risky_devices=2,
            blocked_devices=0,
            risky_match_keys=0,
            recent_activity_count=3,
            history_activity_count=0,
            recent_distinct_devices=2,
            burst_activity_count=3,
            burst_distinct_devices=2,
            similarity_ratio=1.1,
            weights=self.weights,
            similarity_threshold=1.75,
        )
        repeated = compute_user_group_modifiers(
            risky_devices=2,
            blocked_devices=0,
            risky_match_keys=0,
            recent_activity_count=3,
            history_activity_count=5,
            recent_distinct_devices=2,
            burst_activity_count=3,
            burst_distinct_devices=2,
            similarity_ratio=2.4,
            weights=self.weights,
            similarity_threshold=1.75,
        )

        self.assertNotIn("repeated_group_spike", weak["extra_modifiers"])
        self.assertIn("repeated_group_spike", repeated["extra_modifiers"])

    def test_device_parent_score_only_blocks_when_threshold_crosses(self):
        device = Device(id="device-1", fingerprint="fp-1", risk_score=40, status="active")
        _, score, status = apply_device_parent_score(device, computed_score=90, enforce_block=True)
        self.assertEqual(score, 90)
        self.assertEqual(status, "active")

        _, score, status = apply_device_parent_score(device, computed_score=96, enforce_block=True)
        self.assertEqual(score, 96)
        self.assertEqual(status, "blocked")

    def test_device_parent_score_is_idempotent(self):
        device = Device(id="device-2", fingerprint="fp-2", risk_score=72, status="active")
        first = apply_device_parent_score(device, computed_score=72, enforce_block=True)
        second = apply_device_parent_score(device, computed_score=72, enforce_block=True)

        self.assertEqual(first[1], 72)
        self.assertEqual(second[1], 72)

    async def test_group_escalation_disabled_falls_back_to_base_risk_engine(self):
        runtime_config.apply_runtime_cache({"group_escalation_enabled": False}, self._anti_snapshot)
        with patch(
            "app.services.group_escalation.orchestrator.risk_engine.recompute",
            AsyncMock(return_value=(0.1, 0.2, "normal")),
        ) as mocked:
            result = await recompute_user_parent_posture(
                object(),
                "external-user-1",
                trigger_context={"trigger_type": "manual"},
            )

        self.assertEqual(result, (0.1, 0.2, "normal"))
        mocked.assert_awaited_once()


if __name__ == "__main__":
    unittest.main()
