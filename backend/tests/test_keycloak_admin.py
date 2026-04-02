import unittest
from collections import deque
from unittest.mock import AsyncMock, patch

from app.models.user_profile import UserProfile
from app.services import keycloak_admin


class FakeAsyncSession:
    def __init__(self, scalar_values=None):
        self.scalar_values = deque(scalar_values or [])
        self.added = []

    async def scalar(self, _query):
        if not self.scalar_values:
            return None
        return self.scalar_values.popleft()

    def add(self, obj):
        self.added.append(obj)


class KeycloakAdminSyncTests(unittest.IsolatedAsyncioTestCase):
    async def test_sync_keycloak_users_creates_missing_profiles(self):
        session = FakeAsyncSession(scalar_values=[None, None])
        users = [
            {"id": "kc-1", "email": "alice@example.com", "firstName": "Alice", "lastName": "Stone", "username": "alice"},
            {"id": "kc-2", "email": "bob@example.com", "username": "bob"},
        ]
        cfg = {
            "enabled": True,
            "base_url": "https://kc.example.com",
            "realm": "mouwaten",
            "client_id": "admin-cli",
            "client_secret": "secret",
            "username": "",
            "password": "",
            "user_limit": 500,
        }

        with patch("app.services.keycloak_admin._cfg", return_value=cfg), \
             patch("app.services.keycloak_admin._admin_token", new=AsyncMock(return_value="token")), \
             patch("app.services.keycloak_admin._fetch_users", new=AsyncMock(return_value=users)):
            summary = await keycloak_admin.sync_keycloak_users(session)

        self.assertEqual(summary["realm"], "mouwaten")
        self.assertEqual(summary["fetched"], 2)
        self.assertEqual(summary["created"], 2)
        self.assertEqual(summary["updated"], 0)
        self.assertEqual(len(session.added), 2)
        self.assertTrue(all(isinstance(item, UserProfile) for item in session.added))

    async def test_sync_keycloak_users_updates_existing_profiles(self):
        existing = UserProfile(external_user_id="kc-1", email="old@example.com", display_name="Old Name")
        session = FakeAsyncSession(scalar_values=[existing])
        users = [
            {"id": "kc-1", "email": "new@example.com", "firstName": "New", "lastName": "Name", "username": "new-name"},
        ]
        cfg = {
            "enabled": True,
            "base_url": "https://kc.example.com",
            "realm": "mouwaten",
            "client_id": "admin-cli",
            "client_secret": "secret",
            "username": "",
            "password": "",
            "user_limit": 500,
        }

        with patch("app.services.keycloak_admin._cfg", return_value=cfg), \
             patch("app.services.keycloak_admin._admin_token", new=AsyncMock(return_value="token")), \
             patch("app.services.keycloak_admin._fetch_users", new=AsyncMock(return_value=users)):
            summary = await keycloak_admin.sync_keycloak_users(session)

        self.assertEqual(summary["created"], 0)
        self.assertEqual(summary["updated"], 1)
        self.assertEqual(existing.email, "new@example.com")
        self.assertEqual(existing.display_name, "New Name")


if __name__ == "__main__":
    unittest.main()
