import unittest
from unittest.mock import patch

from app.api.routes import settings as settings_route
from app.models.block_page_config import BlockPageConfig
from app.models.runtime_config import RuntimeConfig
from app.services import anti_evasion_config, backup_sections, runtime_config


class FakeAsyncSession:
    def __init__(self, *, get_map=None):
        self.get_map = dict(get_map or {})
        self.added = []
        self.deleted = []
        self.flush_count = 0
        self.commit_count = 0

    async def get(self, model, key):
        return self.get_map.get((model, key))

    def add(self, obj):
        self.added.append(obj)
        if hasattr(obj, "id"):
            self.get_map[(type(obj), obj.id)] = obj

    async def delete(self, obj):
        self.deleted.append(obj)
        if hasattr(obj, "id"):
            self.get_map.pop((type(obj), obj.id), None)

    async def flush(self):
        self.flush_count += 1

    async def commit(self):
        self.commit_count += 1


class FakeUser:
    id = "operator-1"


class SettingsPersistenceTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self._settings_snapshot = runtime_config.runtime_settings_snapshot()
        self._anti_evasion_snapshot = runtime_config.anti_evasion_settings_snapshot()

    def tearDown(self):
        runtime_config.apply_runtime_cache(self._settings_snapshot, self._anti_evasion_snapshot)

    async def test_update_settings_refreshes_runtime_contract(self):
        session = FakeAsyncSession()
        payload = {
            "instance_name": "SkyNet Ops",
            "base_url": "https://ops.example/",
            "timezone": "UTC",
            "realtime_enabled": False,
        }

        result = await settings_route.update_settings(
            payload,
            request=None,
            db=session,
            current=FakeUser(),
        )

        stored = session.get_map[(RuntimeConfig, 1)]
        self.assertEqual(result["instance_name"], "SkyNet Ops")
        self.assertEqual(result["base_url"], "https://ops.example/")
        self.assertFalse(result["realtime_enabled"])
        self.assertEqual(settings_route._settings["instance_name"], "SkyNet Ops")
        self.assertEqual(stored.runtime_settings["instance_name"], "SkyNet Ops")
        self.assertEqual(session.commit_count, 1)

    async def test_block_page_update_persists_row_and_round_trips(self):
        session = FakeAsyncSession()
        patcher = patch("app.api.routes.settings.log_action")
        self.addCleanup(patcher.stop)
        patcher.start()

        result = await settings_route.update_block_page(
            {
                "title": "ACCESS LOCKED",
                "subtitle": "Contact security",
                "message": "Denied",
                "bg_color": "#101010",
                "accent_color": "#ff0000",
                "logo_url": "https://cdn.example/logo.svg",
                "contact_email": "security@example.com",
                "show_request_id": False,
                "show_contact": True,
            },
            request=None,
            db=session,
            current=FakeUser(),
        )

        self.assertEqual(result, {"ok": True})
        self.assertEqual(len(session.added), 1)
        row = session.added[0]
        self.assertIsInstance(row, BlockPageConfig)
        self.assertEqual(row.id, 1)
        self.assertEqual(row.title, "ACCESS LOCKED")
        self.assertEqual(row.contact_email, "security@example.com")
        self.assertEqual(session.commit_count, 1)

        session.get_map[(BlockPageConfig, 1)] = row
        loaded = await settings_route.get_block_page(db=session, _=FakeUser())
        self.assertEqual(loaded["title"], "ACCESS LOCKED")
        self.assertEqual(loaded["logo_url"], "https://cdn.example/logo.svg")
        self.assertFalse(loaded["show_request_id"])

    async def test_backup_settings_snapshot_and_restore_keep_runtime_and_block_page(self):
        runtime_config.apply_runtime_cache(
            {
                "instance_name": "Snapshot Source",
                "base_url": "https://snapshot.example",
                "realtime_enabled": True,
            },
            {
                "spam_rate_threshold": 18,
                "max_accounts_per_device": 4,
            },
        )
        block_page = BlockPageConfig(
            id=1,
            title="Snapshot Block",
            subtitle="Blocked",
            message="Nope",
            bg_color="#000000",
            accent_color="#ef4444",
            logo_url=None,
            contact_email=None,
            show_request_id=True,
            show_contact=False,
        )
        session = FakeAsyncSession(get_map={(BlockPageConfig, 1): block_page})

        snapshot = await backup_sections._snapshot_settings(session)

        self.assertEqual(snapshot["runtime"]["instance_name"], "Snapshot Source")
        self.assertEqual(snapshot["anti_evasion"]["spam_rate_threshold"], 18)
        self.assertEqual(snapshot["block_page"]["title"], "Snapshot Block")

        await backup_sections._restore_settings(
            session,
            {
                "runtime": {
                    "instance_name": "Restored",
                    "base_url": "https://restored.example",
                    "realtime_enabled": False,
                },
                "anti_evasion": {
                    "spam_rate_threshold": 25,
                    "max_accounts_per_device": 6,
                },
                "block_page": {
                    "id": 1,
                    "title": "Restored Block",
                    "subtitle": "Updated",
                    "message": "Still blocked",
                    "bg_color": "#111111",
                    "accent_color": "#ff9900",
                    "logo_url": "https://cdn.example/restored.svg",
                    "contact_email": "ops@example.com",
                    "show_request_id": False,
                    "show_contact": True,
                },
            },
        )

        stored = session.get_map[(RuntimeConfig, 1)]
        self.assertEqual(settings_route._settings["instance_name"], "Restored")
        self.assertEqual(stored.runtime_settings["base_url"], "https://restored.example")
        self.assertEqual(anti_evasion_config.get_anti_evasion_config()["spam_rate_threshold"], 25)
        self.assertEqual(stored.anti_evasion_config["max_accounts_per_device"], 6)
        self.assertEqual(block_page.title, "Restored Block")
        self.assertEqual(block_page.contact_email, "ops@example.com")
        self.assertEqual(session.flush_count, 4)

    async def test_backup_restore_without_block_page_deletes_existing_row(self):
        block_page = BlockPageConfig(id=1, title="Old", subtitle="Old", message="Old")
        session = FakeAsyncSession(get_map={(BlockPageConfig, 1): block_page})

        await backup_sections._restore_settings(
            session,
            {
                "runtime": {
                    "instance_name": "Restored",
                    "base_url": "https://restored.example",
                }
            },
        )

        self.assertEqual(settings_route._settings["instance_name"], "Restored")
        self.assertEqual(session.deleted, [block_page])
        self.assertEqual(session.flush_count, 4)

    async def test_anti_evasion_config_contract_ignores_unknown_keys_and_returns_copy(self):
        session = FakeAsyncSession()
        config = await anti_evasion_config.update_anti_evasion_config(
            session,
            {
                "spam_rate_threshold": 25,
                "max_accounts_per_device": 4,
                "adblocker_detection": True,
                "adblocker_action": "challenge",
                "dns_filter_detection": True,
                "dns_filter_action": "flag",
                "isp_resolution_detection": True,
                "isp_unresolved_action": "observe",
                "language_mismatch_allowed_languages_by_country": {"TN": ["ar", "fr", "en"], "MA": ["ar", "fr"]},
                "dnsbl_soft_fail_country_codes": ["TN", "MA"],
                "dnsbl_soft_fail_risk_points": 6,
                "unknown_flag": True,
            },
        )

        stored = session.get_map[(RuntimeConfig, 1)]
        self.assertEqual(config["spam_rate_threshold"], 25)
        self.assertEqual(config["max_accounts_per_device"], 4)
        self.assertTrue(config["adblocker_detection"])
        self.assertEqual(config["adblocker_action"], "challenge")
        self.assertTrue(config["dns_filter_detection"])
        self.assertEqual(config["dns_filter_action"], "flag")
        self.assertTrue(config["isp_resolution_detection"])
        self.assertEqual(config["isp_unresolved_action"], "observe")
        self.assertEqual(config["language_mismatch_allowed_languages_by_country"], {"TN": ["ar", "fr", "en"], "MA": ["ar", "fr"]})
        self.assertEqual(config["dnsbl_soft_fail_country_codes"], ["TN", "MA"])
        self.assertEqual(config["dnsbl_soft_fail_risk_points"], 6)
        self.assertNotIn("unknown_flag", config)
        self.assertEqual(stored.anti_evasion_config["spam_rate_threshold"], 25)
        self.assertTrue(stored.anti_evasion_config["adblocker_detection"])
        self.assertEqual(stored.anti_evasion_config["dns_filter_action"], "flag")
        self.assertEqual(stored.anti_evasion_config["language_mismatch_allowed_languages_by_country"], {"TN": ["ar", "fr", "en"], "MA": ["ar", "fr"]})
        self.assertEqual(stored.anti_evasion_config["dnsbl_soft_fail_country_codes"], ["TN", "MA"])

        config["spam_rate_threshold"] = 99
        self.assertEqual(anti_evasion_config.get_anti_evasion_config()["spam_rate_threshold"], 25)

    async def test_event_retention_setting_round_trips_through_runtime_config_store(self):
        session = FakeAsyncSession()

        result = await runtime_config.update_runtime_settings(
            session,
            {
                "event_retention_days": 30,
                "visitor_retention_days": 45,
                "unknown_key": 99,
            },
        )

        stored = session.get_map[(RuntimeConfig, 1)]
        self.assertEqual(result["event_retention_days"], 30)
        self.assertEqual(result["visitor_retention_days"], 45)
        self.assertNotIn("unknown_key", result)
        self.assertEqual(stored.runtime_settings["event_retention_days"], 30)
        self.assertEqual(stored.runtime_settings["visitor_retention_days"], 45)
        self.assertEqual(runtime_config.runtime_settings()["event_retention_days"], 30)

    async def test_group_escalation_runtime_settings_round_trip(self):
        session = FakeAsyncSession()

        result = await runtime_config.update_runtime_settings(
            session,
            {
                "group_escalation_enabled": True,
                "group_recent_window_hours": 12,
                "group_history_window_days": 21,
                "group_behavior_burst_window_minutes": 20,
                "group_behavior_similarity_threshold": 2.25,
                "group_escalation_weights": {
                    "same_device_risky_visitors": 0.3,
                    "strict_group_risky_siblings": 0.4,
                },
            },
        )

        stored = session.get_map[(RuntimeConfig, 1)]
        self.assertTrue(result["group_escalation_enabled"])
        self.assertEqual(result["group_recent_window_hours"], 12)
        self.assertEqual(result["group_history_window_days"], 21)
        self.assertEqual(result["group_behavior_burst_window_minutes"], 20)
        self.assertEqual(result["group_behavior_similarity_threshold"], 2.25)
        self.assertEqual(
            stored.runtime_settings["group_escalation_weights"]["same_device_risky_visitors"],
            0.3,
        )
        self.assertEqual(
            runtime_config.runtime_settings()["group_escalation_weights"]["strict_group_risky_siblings"],
            0.4,
        )


if __name__ == "__main__":
    unittest.main()
