import unittest
from types import SimpleNamespace
from unittest.mock import patch

from app.api.routes import stats as stats_route


class FakeExecuteResult:
    def __init__(self, rows=None):
        self.rows = list(rows or [])

    def fetchall(self):
        return list(self.rows)

    def scalars(self):
        return self

    def all(self):
        return list(self.rows)

    def scalar_one_or_none(self):
        return None


class FakeAsyncSession:
    def __init__(self):
        self.scalar_queries = []
        self.execute_queries = []

    async def scalar(self, query):
        self.scalar_queries.append(query)
        return 0

    async def execute(self, query, *_args, **_kwargs):
        self.execute_queries.append(query)
        return FakeExecuteResult()


def _sql(query) -> str:
    return str(query).lower()


class StatsOrphanCleanupContractTests(unittest.IsolatedAsyncioTestCase):
    async def test_overview_ignores_orphaned_incidents_and_flags(self):
        session = FakeAsyncSession()

        with patch.object(stats_route, "summarize_gateway_dashboard", return_value=None):
            await stats_route.overview(
                time_range="24h",
                db=session,
                _=SimpleNamespace(id="operator-1"),
            )

        incident_queries = [
            _sql(query)
            for query in [*session.scalar_queries, *session.execute_queries]
            if "incidents" in _sql(query)
        ]
        self.assertTrue(incident_queries)
        self.assertTrue(any("exists" in query and "user_profiles" in query for query in incident_queries))
        self.assertTrue(any("exists" in query and "devices" in query for query in incident_queries))

        profile_queries = [
            _sql(query)
            for query in session.execute_queries
            if "anomaly_flags" in _sql(query)
        ]
        self.assertTrue(profile_queries)
        self.assertTrue(any("related_device_id" in query and "exists" in query for query in profile_queries))
        self.assertTrue(any("related_visitor_id" in query and "exists" in query for query in profile_queries))


if __name__ == "__main__":
    unittest.main()
