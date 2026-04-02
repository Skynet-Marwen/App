import json
import unittest
from collections import deque
from datetime import datetime, timedelta, timezone

from app.models.anomaly_flag import AnomalyFlag
from app.models.device import Device
from app.models.identity_link import IdentityLink
from app.models.risk_event import RiskEvent
from app.models.user_profile import UserProfile
from app.services import risk_engine


class FakeScalarResult:
    def __init__(self, values):
        self.values = list(values)

    def all(self):
        return list(self.values)


class FakeExecuteResult:
    def __init__(self, values):
        self.values = values

    def scalars(self):
        return FakeScalarResult(self.values)


class FakeAsyncSession:
    def __init__(self, *, scalar_values=None, execute_values=None):
        self.scalar_values = deque(scalar_values or [])
        self.execute_values = deque(execute_values or [])
        self.added = []
        self.flush_count = 0

    async def scalar(self, _query):
        if not self.scalar_values:
            raise AssertionError("Unexpected scalar() call")
        return self.scalar_values.popleft()

    async def execute(self, _query):
        if not self.execute_values:
            raise AssertionError("Unexpected execute() call")
        return FakeExecuteResult(self.execute_values.popleft())

    def add(self, obj):
        self.added.append(obj)

    async def flush(self):
        self.flush_count += 1


class RiskEngineTests(unittest.IsolatedAsyncioTestCase):
    async def test_recompute_resets_profile_when_no_devices_are_linked(self):
        profile = UserProfile(
            id="profile-1",
            external_user_id="ext-user-1",
            current_risk_score=0.35,
            trust_level="normal",
            total_devices=3,
            total_sessions=7,
            first_seen=datetime(2026, 4, 1, 9, 0, tzinfo=timezone.utc),
            last_seen=datetime(2026, 4, 2, 9, 0, tzinfo=timezone.utc),
        )
        session = FakeAsyncSession(
            scalar_values=[profile],
            execute_values=[[]],
        )

        previous, new_score, trust_level = await risk_engine.recompute(
            session,
            "ext-user-1",
            trigger_type="manual",
        )

        self.assertEqual(previous, 0.35)
        self.assertEqual(new_score, 0.0)
        self.assertEqual(trust_level, "trusted")
        self.assertEqual(profile.current_risk_score, 0.0)
        self.assertEqual(profile.trust_level, "trusted")
        self.assertEqual(profile.total_devices, 0)
        self.assertEqual(len(session.added), 1)
        self.assertIsInstance(session.added[0], RiskEvent)
        self.assertEqual(session.flush_count, 1)

    async def test_recompute_applies_modifiers_and_creates_risk_spike_flag(self):
        now = datetime.now(timezone.utc)
        profile = UserProfile(
            id="profile-1",
            external_user_id="ext-user-2",
            current_risk_score=0.1,
            trust_level="trusted",
            total_devices=1,
            total_sessions=3,
            first_seen=now - timedelta(days=2),
            last_seen=now - timedelta(minutes=5),
        )
        links = [
            IdentityLink(
                id="link-1",
                external_user_id="ext-user-2",
                fingerprint_id="device-1",
                platform="web",
                linked_at=now - timedelta(hours=2),
                last_seen_at=now - timedelta(hours=1),
            )
        ]
        devices = [
            Device(
                id="device-1",
                fingerprint="fp-1",
                risk_score=50,
                shared_user_count=1,
            )
        ]
        open_flags = ["geo_jump", "multi_account"]
        session = FakeAsyncSession(
            scalar_values=[profile],
            execute_values=[links, devices, open_flags],
        )

        previous, new_score, trust_level = await risk_engine.recompute(
            session,
            "ext-user-2",
            trigger_type="new_device",
            trigger_detail={"fingerprint_id": "device-1"},
        )

        self.assertEqual(previous, 0.1)
        self.assertEqual(new_score, 1.0)
        self.assertEqual(trust_level, "blocked")
        self.assertEqual(profile.current_risk_score, 1.0)
        self.assertEqual(profile.trust_level, "blocked")
        self.assertEqual(profile.total_devices, 1)
        self.assertEqual(len(session.added), 5)
        self.assertIsInstance(session.added[0], RiskEvent)
        self.assertIsInstance(session.added[1], AnomalyFlag)
        self.assertEqual(session.added[1].flag_type, "risk_spike")
        self.assertEqual(session.added[1].severity, "high")
        self.assertEqual(json.loads(session.added[1].evidence)["delta"], 0.9)
        self.assertEqual([item.flag_type for item in session.added[2:]], [
            "risk_auto_flag",
            "risk_auto_challenge",
            "risk_auto_block",
        ])
        self.assertEqual(session.flush_count, 1)

    async def test_recompute_uses_weighted_device_scores_without_spike_flag(self):
        now = datetime.now(timezone.utc)
        profile = UserProfile(
            id="profile-3",
            external_user_id="ext-user-3",
            current_risk_score=0.4,
            trust_level="normal",
            total_devices=1,
            total_sessions=9,
            first_seen=now - timedelta(days=10),
            last_seen=now - timedelta(hours=1),
        )
        links = [
            IdentityLink(
                id="link-1",
                external_user_id="ext-user-3",
                fingerprint_id="device-a",
                platform="web",
                linked_at=now - timedelta(days=3),
                last_seen_at=now - timedelta(days=1),
            ),
            IdentityLink(
                id="link-2",
                external_user_id="ext-user-3",
                fingerprint_id="device-b",
                platform="web",
                linked_at=now - timedelta(days=2),
                last_seen_at=now - timedelta(hours=4),
            ),
        ]
        devices = [
            Device(id="device-a", fingerprint="fp-a", risk_score=20, shared_user_count=0),
            Device(id="device-b", fingerprint="fp-b", risk_score=60, shared_user_count=0),
        ]
        session = FakeAsyncSession(
            scalar_values=[profile],
            execute_values=[links, devices, []],
        )

        previous, new_score, trust_level = await risk_engine.recompute(
            session,
            "ext-user-3",
            trigger_type="manual",
        )

        self.assertEqual(previous, 0.4)
        self.assertAlmostEqual(new_score, 0.52, places=2)
        self.assertEqual(trust_level, "suspicious")
        self.assertEqual(profile.current_risk_score, new_score)
        self.assertEqual(profile.trust_level, "suspicious")
        self.assertEqual(profile.total_devices, 2)
        self.assertEqual(len(session.added), 1)
        self.assertIsInstance(session.added[0], RiskEvent)
        self.assertEqual(session.flush_count, 1)

    async def test_recompute_applies_behavior_drift_modifier(self):
        now = datetime.now(timezone.utc)
        profile = UserProfile(
            id="profile-4",
            external_user_id="ext-user-4",
            current_risk_score=0.2,
            trust_level="normal",
            total_devices=1,
            total_sessions=4,
            first_seen=now - timedelta(days=4),
            last_seen=now - timedelta(minutes=30),
        )
        links = [
            IdentityLink(
                id="link-1",
                external_user_id="ext-user-4",
                fingerprint_id="device-1",
                platform="web",
                linked_at=now - timedelta(days=2),
                last_seen_at=now - timedelta(minutes=30),
            )
        ]
        devices = [
            Device(id="device-1", fingerprint="fp-1", risk_score=30, shared_user_count=0)
        ]
        session = FakeAsyncSession(
            scalar_values=[profile],
            execute_values=[links, devices, ["behavior_drift"]],
        )

        _, new_score, trust_level = await risk_engine.recompute(
            session,
            "ext-user-4",
            trigger_type="behavior_drift",
        )

        self.assertAlmostEqual(new_score, 0.45, places=2)
        self.assertEqual(trust_level, "normal")

    def test_enforcement_action_uses_explicit_threshold_bands(self):
        self.assertEqual(risk_engine.enforcement_action(0.59), "allow")
        self.assertEqual(risk_engine.enforcement_action(0.60), "flag")
        self.assertEqual(risk_engine.enforcement_action(0.80), "challenge")
        self.assertEqual(risk_engine.enforcement_action(0.95), "block")


if __name__ == "__main__":
    unittest.main()
