import unittest
from unittest.mock import AsyncMock, patch

from app.api.routes import settings_storage as settings_storage_route


class FakeAsyncSession:
    def __init__(self):
        self.commit_count = 0

    async def commit(self):
        self.commit_count += 1


class FakeUser:
    def __init__(self, role="admin"):
        self.id = "operator-1"
        self.role = role


class SettingsStorageActionTests(unittest.IsolatedAsyncioTestCase):
    async def test_tracker_purge_returns_summary_and_commits(self):
        session = FakeAsyncSession()
        with patch.object(
            settings_storage_route,
            "purge_tracker_data",
            AsyncMock(return_value=(type("Site", (), {"id": "site-1", "name": "Mouwaten"})(), {"visitors_deleted": 4})),
        ), patch.object(settings_storage_route, "log_action"):
            result = await settings_storage_route.purge_tracker_scope(
                body={"site_id": "site-1"},
                request=None,
                db=session,
                current=FakeUser("admin"),
            )

        self.assertTrue(result["ok"])
        self.assertEqual(result["site"]["name"], "Mouwaten")
        self.assertEqual(result["summary"]["visitors_deleted"], 4)
        self.assertEqual(session.commit_count, 1)

    async def test_reset_install_requires_confirmation_phrase(self):
        session = FakeAsyncSession()
        with patch.object(settings_storage_route, "log_action"):
            with self.assertRaises(Exception) as captured:
                await settings_storage_route.reset_install_storage(
                    body={"confirmation": "RESET"},
                    request=None,
                    db=session,
                    current=FakeUser("superadmin"),
                )

        self.assertIn("RESET SKYNET", str(captured.exception))
        self.assertEqual(session.commit_count, 0)


if __name__ == "__main__":
    unittest.main()
