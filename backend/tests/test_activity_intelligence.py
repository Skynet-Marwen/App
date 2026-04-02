import json
import unittest
from collections import deque
from datetime import datetime, timedelta, timezone

from app.models.activity_event import ActivityEvent
from app.models.anomaly_flag import AnomalyFlag
from app.services import activity_intelligence


class FakeAsyncSession:
    def __init__(self, *, scalar_values=None):
        self.scalar_values = deque(scalar_values or [])
        self.added = []
        self.flush_count = 0

    async def scalar(self, _query):
        if not self.scalar_values:
            raise AssertionError("Unexpected scalar() call")
        return self.scalar_values.popleft()

    def add(self, obj):
        self.added.append(obj)

    async def flush(self):
        self.flush_count += 1


class ActivityIntelligenceTests(unittest.IsolatedAsyncioTestCase):
    def test_evaluate_impossible_travel_returns_none_when_countries_match(self):
        result = activity_intelligence.evaluate_impossible_travel(
            previous_country="FR",
            current_country="FR",
            previous_ip="1.1.1.1",
            current_ip="2.2.2.2",
            previous_created_at=datetime(2026, 4, 2, 10, 0, tzinfo=timezone.utc),
            current_created_at=datetime(2026, 4, 2, 11, 0, tzinfo=timezone.utc),
        )

        self.assertIsNone(result)

    def test_evaluate_impossible_travel_returns_evidence_for_fast_country_jump(self):
        result = activity_intelligence.evaluate_impossible_travel(
            previous_country="FR",
            current_country="US",
            previous_ip="1.1.1.1",
            current_ip="2.2.2.2",
            previous_created_at=datetime(2026, 4, 2, 10, 0, tzinfo=timezone.utc),
            current_created_at=datetime(2026, 4, 2, 11, 15, tzinfo=timezone.utc),
        )

        self.assertIsNotNone(result)
        self.assertEqual(result["from_country"], "FR")
        self.assertEqual(result["to_country"], "US")
        self.assertEqual(result["severity"], "high")

    async def test_detect_impossible_travel_creates_flag_with_evidence(self):
        previous = ActivityEvent(
            id="evt-prev",
            external_user_id="ext-user-1",
            event_type="pageview",
            ip="1.1.1.1",
            country="FR",
            created_at=datetime.now(timezone.utc) - timedelta(hours=2),
        )
        now = datetime.now(timezone.utc)
        session = FakeAsyncSession(scalar_values=[previous, None])

        flag = await activity_intelligence.detect_impossible_travel(
            session,
            external_user_id="ext-user-1",
            current_country="US",
            current_ip="2.2.2.2",
            current_created_at=now,
            related_device_id="device-1",
        )

        self.assertIsNotNone(flag)
        self.assertEqual(flag.flag_type, "impossible_travel")
        self.assertEqual(flag.related_device_id, "device-1")
        self.assertEqual(flag.status, "open")
        self.assertEqual(flag.severity, "high")
        self.assertEqual(len(session.added), 1)
        self.assertIsInstance(session.added[0], AnomalyFlag)
        self.assertEqual(session.flush_count, 1)
        evidence = json.loads(flag.evidence)
        self.assertEqual(evidence["from_country"], "FR")
        self.assertEqual(evidence["to_country"], "US")

    async def test_detect_impossible_travel_skips_when_recent_open_flag_exists(self):
        previous = ActivityEvent(
            id="evt-prev",
            external_user_id="ext-user-2",
            event_type="pageview",
            ip="1.1.1.1",
            country="FR",
            created_at=datetime.now(timezone.utc) - timedelta(hours=2),
        )
        existing_flag = AnomalyFlag(
            id="flag-1",
            external_user_id="ext-user-2",
            flag_type="impossible_travel",
            severity="high",
            status="open",
            detected_at=datetime.now(timezone.utc) - timedelta(hours=1),
        )
        session = FakeAsyncSession(scalar_values=[previous, existing_flag])

        flag = await activity_intelligence.detect_impossible_travel(
            session,
            external_user_id="ext-user-2",
            current_country="US",
            current_ip="2.2.2.2",
            current_created_at=datetime.now(timezone.utc),
            related_device_id="device-2",
        )

        self.assertIsNone(flag)
        self.assertEqual(session.added, [])
        self.assertEqual(session.flush_count, 0)


if __name__ == "__main__":
    unittest.main()
