import json
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException

from app.models.theme import Theme
from app.services import theme_packages


class FakeAsyncSession:
    def __init__(self, *, get_map=None, scalar_values=None):
        self.get_map = dict(get_map or {})
        self.scalar_values = list(scalar_values or [])
        self.added = []
        self.flush_count = 0

    async def get(self, model, key):
        return self.get_map.get((model, key))

    async def scalar(self, _query):
        if self.scalar_values:
            return self.scalar_values.pop(0)
        return None

    def add(self, obj):
        self.added.append(obj)
        if hasattr(obj, "id"):
            self.get_map[(type(obj), obj.id)] = obj

    async def flush(self):
        self.flush_count += 1


class ThemePackagesTests(unittest.IsolatedAsyncioTestCase):
    def test_export_theme_package_embeds_logo_payload(self):
        theme = Theme(
            id="signal-lab",
            name="Signal Lab",
            colors={"primary": "#22d3ee"},
            layout={"role_visibility": {"viewer": {"hidden_nav": ["settings"]}}},
            widgets=[],
            branding={"title": "Signal Lab"},
            is_default=False,
            is_active=True,
            updated_at=datetime(2026, 4, 2, 12, 0, tzinfo=timezone.utc),
        )
        with tempfile.TemporaryDirectory() as tempdir:
            logo_path = Path(tempdir) / "logo.png"
            logo_path.write_bytes(b"fake-image")
            with patch("app.services.theme_packages.find_theme_logo_path", return_value=logo_path):
                document, filename = theme_packages.export_theme_package(theme)

        self.assertEqual(document.schema_version, theme_packages.PACKAGE_SCHEMA_VERSION)
        self.assertEqual(document.theme.id, "signal-lab")
        self.assertEqual(document.logo.content_type, "image/png")
        self.assertEqual(filename, "signal-lab-1775131200.theme.json")

    def test_parse_theme_package_document_rejects_invalid_json(self):
        with self.assertRaises(HTTPException) as error:
            theme_packages.parse_theme_package_document(b"not-json")

        self.assertEqual(error.exception.status_code, 422)

    async def test_import_theme_package_creates_theme_and_applies_logo(self):
        session = FakeAsyncSession()
        package = theme_packages.ThemePackageDocument.model_validate(
            {
                "schema_version": theme_packages.PACKAGE_SCHEMA_VERSION,
                "exported_at": "2026-04-02T12:00:00+00:00",
                "theme": {
                    "id": "ops-sunrise",
                    "name": "Ops Sunrise",
                    "colors": {"primary": "#f97316"},
                    "layout": {"role_visibility": {"viewer": {"hidden_nav": ["settings"]}}},
                    "widgets": [],
                    "branding": {"title": "Ops Sunrise"},
                    "is_default": True,
                    "is_active": True,
                },
                "logo": {
                    "filename": "logo.png",
                    "content_type": "image/png",
                    "data_base64": "aGVsbG8=",
                    "size_bytes": 5,
                },
            }
        )

        with patch("app.services.theme_packages._import_theme_logo", AsyncMock(return_value=True)), patch(
            "app.services.theme_packages.set_default_theme",
            AsyncMock(),
        ) as set_default_mock:
            result = await theme_packages.import_theme_package(session, package, replace_existing=False)

        self.assertEqual(result.theme.id, "ops-sunrise")
        self.assertTrue(result.imported_logo)
        self.assertFalse(result.replaced_existing)
        self.assertEqual(len(session.added), 1)
        self.assertEqual(session.flush_count, 2)
        set_default_mock.assert_awaited_once()

    async def test_import_theme_package_preserves_existing_default_safety(self):
        existing = Theme(
            id="skynet-default",
            name="SkyNet Default",
            colors={"primary": "#22d3ee"},
            layout={"sidebar": "expanded"},
            widgets=[],
            branding={"title": "SkyNet"},
            is_default=True,
            is_active=True,
        )
        session = FakeAsyncSession(get_map={(Theme, "skynet-default"): existing})
        package = theme_packages.ThemePackageDocument.model_validate(
            json.loads(
                json.dumps(
                    {
                        "schema_version": theme_packages.PACKAGE_SCHEMA_VERSION,
                        "exported_at": "2026-04-02T12:00:00+00:00",
                        "theme": {
                            "id": "skynet-default",
                            "name": "SkyNet Default",
                            "colors": {"primary": "#111827"},
                            "layout": {},
                            "widgets": [],
                            "branding": {"title": "Imported"},
                            "is_default": False,
                            "is_active": False,
                        },
                    }
                )
            )
        )

        with patch("app.services.theme_packages._import_theme_logo", AsyncMock(return_value=False)), patch(
            "app.services.theme_packages.set_default_theme",
            AsyncMock(),
        ):
            result = await theme_packages.import_theme_package(session, package, replace_existing=True)

        self.assertTrue(result.theme.is_default)
        self.assertTrue(result.theme.is_active)


if __name__ == "__main__":
    unittest.main()
