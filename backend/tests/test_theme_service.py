import unittest
from collections import deque
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import AsyncMock, patch

from app.models.theme import Theme
from app.services import theme_service


class FakeResult:
    def __init__(self, scalar_value=None):
        self.scalar_value = scalar_value

    def scalar_one_or_none(self):
        return self.scalar_value


class FakeAsyncSession:
    def __init__(self, *, get_map=None, execute_results=None):
        self.get_map = dict(get_map or {})
        self.execute_results = deque(execute_results or [])
        self.added = []
        self.executed = []
        self.flush_count = 0

    async def get(self, model, key):
        return self.get_map.get((model, key))

    async def execute(self, query):
        self.executed.append(query)
        if self.execute_results:
            result = self.execute_results.popleft()
            if isinstance(result, FakeResult):
                return result
            return FakeResult(result)
        return FakeResult(None)

    def add(self, obj):
        self.added.append(obj)
        if hasattr(obj, "id"):
            self.get_map[(type(obj), obj.id)] = obj

    async def flush(self):
        self.flush_count += 1


class FakeUser:
    def __init__(self, *, theme_id, theme_source):
        self.theme_id = theme_id
        self.theme_source = theme_source


class ThemeServiceTests(unittest.IsolatedAsyncioTestCase):
    def test_serialize_theme_rewrites_uploaded_logo_url(self):
        theme = Theme(
            id="theme-1",
            name="Theme One",
            colors={"primary": "#22d3ee"},
            layout={"sidebar": "expanded"},
            widgets=[],
            branding={"logo_url": "/theme-assets/theme-1/logo.png"},
            is_default=False,
            is_active=True,
            updated_at=datetime(2026, 4, 2, 12, 0, tzinfo=timezone.utc),
        )

        with patch("app.services.theme_service.find_theme_logo_path", return_value=Path("/tmp/logo.png")):
            payload = theme_service.serialize_theme(theme)

        self.assertEqual(payload["branding"]["logo_url"], "/api/v1/themes/theme-1/logo?v=1775131200")

    async def test_ensure_default_theme_creates_default_theme_row_when_missing(self):
        session = FakeAsyncSession(execute_results=[None, None])

        theme = await theme_service.ensure_default_theme(session)

        self.assertEqual(theme.id, theme_service.DEFAULT_THEME_ID)
        self.assertEqual(theme.name, "SkyNet Default")
        self.assertTrue(theme.is_default)
        self.assertTrue(theme.is_active)
        self.assertEqual(len(session.added), 1)
        self.assertIs(session.added[0], theme)
        self.assertEqual(session.flush_count, 1)

    async def test_resolve_user_theme_falls_back_when_selected_theme_is_invalid(self):
        default_theme = Theme(
            id=theme_service.DEFAULT_THEME_ID,
            name="SkyNet Default",
            colors={"primary": "#22d3ee"},
            layout={"sidebar": "expanded"},
            widgets=[],
            branding={"logo_text": "SkyNet"},
            is_default=True,
            is_active=True,
        )
        invalid_theme = Theme(
            id="theme-broken",
            name="Broken Theme",
            colors={},
            layout={},
            widgets=[],
            branding={},
            is_default=False,
            is_active=False,
        )
        session = FakeAsyncSession(get_map={(Theme, "theme-broken"): invalid_theme})
        user = FakeUser(theme_id="theme-broken", theme_source="user")

        with patch(
            "app.services.theme_service.ensure_user_theme_assignment",
            AsyncMock(return_value=default_theme),
        ), patch(
            "app.services.theme_service.list_available_themes",
            AsyncMock(return_value=[default_theme]),
        ), patch(
            "app.services.theme_service.find_theme_logo_path",
            return_value=None,
        ):
            payload = await theme_service.resolve_user_theme(session, user)

        self.assertTrue(payload["fallback_applied"])
        self.assertEqual(payload["fallback_reason"], "selected_theme_unavailable")
        self.assertEqual(payload["selected_theme_id"], theme_service.DEFAULT_THEME_ID)
        self.assertEqual(payload["theme_source"], "default")
        self.assertEqual(user.theme_id, theme_service.DEFAULT_THEME_ID)
        self.assertEqual(user.theme_source, "default")
        self.assertEqual(session.flush_count, 1)

    async def test_resolve_user_theme_uses_tenant_mapping_when_enabled(self):
        default_theme = Theme(
            id=theme_service.DEFAULT_THEME_ID,
            name="SkyNet Default",
            colors={"primary": "#22d3ee"},
            layout={"sidebar": "expanded"},
            widgets=[],
            branding={"logo_text": "SkyNet"},
            is_default=True,
            is_active=True,
        )
        tenant_theme = Theme(
            id="tenant-theme",
            name="Tenant Theme",
            colors={"primary": "#f97316"},
            layout={"sidebar": "collapsed"},
            widgets=[],
            branding={"logo_text": "Tenant"},
            is_default=False,
            is_active=True,
        )
        session = FakeAsyncSession(get_map={(Theme, "tenant-theme"): tenant_theme})
        user = FakeUser(theme_id=theme_service.DEFAULT_THEME_ID, theme_source="default")

        with patch(
            "app.services.theme_service.ensure_user_theme_assignment",
            AsyncMock(return_value=default_theme),
        ), patch(
            "app.services.theme_service.list_available_themes",
            AsyncMock(return_value=[default_theme, tenant_theme]),
        ), patch(
            "app.services.theme_service.find_theme_logo_path",
            return_value=None,
        ), patch(
            "app.services.theme_service.runtime_settings",
            return_value={
                "theme_dynamic_enabled": True,
                "theme_dynamic_strategy": "tenant",
                "theme_dynamic_risk_map": {},
                "theme_dynamic_tenant_map": {"mouwaten.local": "tenant-theme"},
            },
        ):
            payload = await theme_service.resolve_user_theme(session, user, tenant_hint="mouwaten.local:8443")

        self.assertEqual(payload["theme_source"], "dynamic")
        self.assertEqual(payload["fallback_reason"], "dynamic_tenant:mouwaten.local")
        self.assertEqual(payload["resolved_theme"]["id"], "tenant-theme")


if __name__ == "__main__":
    unittest.main()
