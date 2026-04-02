import unittest
from collections import deque

from app.services import overview_realtime


class FakeAsyncSession:
    def __init__(self, *, scalar_values=None):
        self.scalar_values = deque(scalar_values or [])

    async def scalar(self, _query):
        if not self.scalar_values:
            raise AssertionError("Unexpected scalar() call")
        return self.scalar_values.popleft()


class OverviewRealtimeTests(unittest.IsolatedAsyncioTestCase):
    async def test_get_realtime_snapshot_returns_expected_shape(self):
        session = FakeAsyncSession(scalar_values=[7, 3, 11])

        result = await overview_realtime.get_realtime_snapshot(session)

        self.assertEqual(
            result,
            {
                "active_visitors": 7,
                "blocked_attempts_last_minute": 3,
                "suspicious_sessions": 11,
            },
        )


if __name__ == "__main__":
    unittest.main()
