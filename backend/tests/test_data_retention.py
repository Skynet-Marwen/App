import unittest
from datetime import datetime, timezone

from app.services import data_retention


class FakeDeleteResult:
    def __init__(self, rowcount):
        self.rowcount = rowcount


class FakeAsyncSession:
    def __init__(self, *, rowcount=0):
        self.rowcount = rowcount
        self.queries = []

    async def execute(self, query):
        self.queries.append(query)
        return FakeDeleteResult(self.rowcount)


class DataRetentionTests(unittest.IsolatedAsyncioTestCase):
    def test_activity_retention_cutoff_uses_configured_days(self):
        now = datetime(2026, 4, 2, 12, 0, tzinfo=timezone.utc)

        cutoff = data_retention.activity_retention_cutoff(30, now=now)

        self.assertEqual(cutoff, datetime(2026, 3, 3, 12, 0, tzinfo=timezone.utc))

    async def test_prune_activity_events_returns_deleted_rowcount(self):
        session = FakeAsyncSession(rowcount=7)
        now = datetime(2026, 4, 2, 12, 0, tzinfo=timezone.utc)

        pruned = await data_retention.prune_activity_events(session, retention_days=14, now=now)

        self.assertEqual(pruned, 7)
        self.assertEqual(len(session.queries), 1)


if __name__ == "__main__":
    unittest.main()
