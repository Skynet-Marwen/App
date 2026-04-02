import unittest
from collections import deque
from types import SimpleNamespace

from app.api.routes import search as search_route
from app.api.routes import devices as devices_route
from app.api.routes import risk as risk_route
from app.api.routes import users as users_route
from app.api.routes import visitors as visitors_route


class FakeExecuteResult:
    def __init__(self, rows=None):
        self.rows = list(rows or [])

    def scalars(self):
        return self

    def all(self):
        return list(self.rows)


class FakeAsyncSession:
    def __init__(self, *, scalar_values=None, execute_results=None):
        self.scalar_queries = []
        self.execute_queries = []
        self.scalar_values = deque(scalar_values or [])
        self.execute_results = deque(execute_results or [])

    async def scalar(self, query):
        self.scalar_queries.append(query)
        if self.scalar_values:
            return self.scalar_values.popleft()
        return 0

    async def execute(self, query):
        self.execute_queries.append(query)
        if self.execute_results:
            return self.execute_results.popleft()
        return FakeExecuteResult()


def _sql(query):
    return str(query).lower()


class DashboardSearchContractTests(unittest.IsolatedAsyncioTestCase):
    def assertQueryMentions(self, query, *expected_terms):
        sql = _sql(query)
        for term in expected_terms:
            self.assertIn(term, sql)

    async def test_users_search_filters_identity_fields(self):
        session = FakeAsyncSession()

        await users_route.list_users(page=1, page_size=20, search="alice", db=session, _=SimpleNamespace(id="operator-1"))

        self.assertEqual(len(session.scalar_queries), 1)
        self.assertEqual(len(session.execute_queries), 1)
        self.assertQueryMentions(session.scalar_queries[0], "email", "username")
        self.assertQueryMentions(session.execute_queries[0], "email", "username")

    async def test_visitors_search_filters_geo_and_browser_fields(self):
        session = FakeAsyncSession()

        await visitors_route.list_visitors(page=1, page_size=20, search="france", db=session, _=SimpleNamespace(id="operator-1"))

        self.assertEqual(len(session.scalar_queries), 1)
        self.assertEqual(len(session.execute_queries), 1)
        self.assertQueryMentions(session.scalar_queries[0], "ip", "country", "browser", "os")
        self.assertQueryMentions(session.execute_queries[0], "ip", "country", "browser", "os")

    async def test_visitors_support_country_and_status_filters_for_drilldowns(self):
        session = FakeAsyncSession()

        await visitors_route.list_visitors(
            page=1,
            page_size=20,
            search="",
            country="Tunisia",
            status="blocked",
            db=session,
            _=SimpleNamespace(id="operator-1"),
        )

        self.assertEqual(len(session.scalar_queries), 1)
        self.assertEqual(len(session.execute_queries), 1)
        self.assertQueryMentions(session.scalar_queries[0], "country", "status")
        self.assertQueryMentions(session.execute_queries[0], "country", "status")

    async def test_devices_search_filters_fingerprint_and_match_fields(self):
        session = FakeAsyncSession()

        await devices_route.list_devices(page=1, page_size=20, search="pixel", db=session, _=SimpleNamespace(id="operator-1"))

        self.assertEqual(len(session.scalar_queries), 1)
        self.assertEqual(len(session.execute_queries), 1)
        self.assertQueryMentions(session.scalar_queries[0], "fingerprint", "browser", "os", "match_key")
        self.assertQueryMentions(session.execute_queries[0], "fingerprint", "browser", "os", "match_key")

    async def test_risk_search_filters_user_profile_identity_fields(self):
        session = FakeAsyncSession()

        await risk_route.list_risky_users(
            search="ext-user",
            min_score=0.0,
            trust_level="",
            has_flags=False,
            page=1,
            page_size=20,
            db=session,
            _=SimpleNamespace(id="operator-1"),
        )

        self.assertEqual(len(session.scalar_queries), 1)
        self.assertEqual(len(session.execute_queries), 1)
        self.assertQueryMentions(session.scalar_queries[0], "external_user_id", "email", "display_name")
        self.assertQueryMentions(session.execute_queries[0], "external_user_id", "email", "display_name")

    async def test_global_search_route_returns_grouped_totals(self):
        visitor_rows = FakeExecuteResult([
            SimpleNamespace(id="visitor-1", ip="1.2.3.4", country="Tunisia", country_flag="TN", browser="Chrome", os="Windows", status="active"),
        ])
        device_rows = FakeExecuteResult([
            SimpleNamespace(id="device-1", fingerprint="abc123fingerprint", browser="Chrome", os="Windows", status="active"),
        ])
        portal_user_rows = FakeExecuteResult([
            SimpleNamespace(external_user_id="user-1", email="alice@example.com", display_name="Alice", trust_level="normal", current_risk_score=0.42),
        ])
        session = FakeAsyncSession(
            scalar_values=[1, 1, 1],
            execute_results=[visitor_rows, device_rows, portal_user_rows],
        )

        result = await search_route.search_entities(q="alice", limit=3, db=session, _=SimpleNamespace(id="operator-1"))

        self.assertEqual(result.query, "alice")
        self.assertEqual(result.totals.overall, 3)
        self.assertEqual(result.totals.visitors, 1)
        self.assertEqual(result.totals.devices, 1)
        self.assertEqual(result.totals.portal_users, 1)
        self.assertEqual([section.key for section in result.sections], ["visitors", "devices", "portal_users"])


if __name__ == "__main__":
    unittest.main()
