import json
import unittest
from collections import deque
from datetime import datetime, timezone

from app.models.device import Device
from app.models.identity_link import IdentityLink
from app.models.user_profile import UserProfile
from app.models.visitor import Visitor
from app.services import identity_service


class FakeScalarResult:
    def __init__(self, values):
        self.values = list(values)

    def all(self):
        return list(self.values)


class FakeExecuteResult:
    def __init__(self, values):
        self.values = values

    def scalars(self):
        return FakeScalarResult(self.values)


class FakeAsyncSession:
    def __init__(self, *, scalar_values=None, get_map=None, execute_values=None):
        self.scalar_values = deque(scalar_values or [])
        self.get_map = dict(get_map or {})
        self.execute_values = deque(execute_values or [])
        self.added = []
        self.flush_count = 0

    async def scalar(self, _query):
        if not self.scalar_values:
            raise AssertionError("Unexpected scalar() call")
        return self.scalar_values.popleft()

    async def execute(self, _query):
        if not self.execute_values:
            raise AssertionError("Unexpected execute() call")
        return FakeExecuteResult(self.execute_values.popleft())

    async def get(self, model, key):
        return self.get_map.get((model, key))

    def add(self, obj):
        self.added.append(obj)

    async def flush(self):
        self.flush_count += 1


class IdentityServiceTests(unittest.IsolatedAsyncioTestCase):
    async def test_upsert_profile_creates_new_profile(self):
        session = FakeAsyncSession(scalar_values=[None])

        profile = await identity_service.upsert_profile(
            session,
            external_user_id="ext-user-1",
            email="user@example.com",
            display_name="User One",
            ip="1.2.3.4",
            country="TN",
        )

        self.assertEqual(profile.external_user_id, "ext-user-1")
        self.assertEqual(profile.email, "user@example.com")
        self.assertEqual(profile.display_name, "User One")
        self.assertEqual(profile.last_ip, "1.2.3.4")
        self.assertEqual(profile.last_country, "TN")
        self.assertEqual(len(session.added), 1)
        self.assertIsInstance(session.added[0], UserProfile)
        self.assertEqual(session.flush_count, 1)

    async def test_upsert_profile_refreshes_existing_profile_without_blank_overwrite(self):
        existing = UserProfile(
            id="profile-1",
            external_user_id="ext-user-1",
            email="old@example.com",
            display_name="Existing User",
            first_seen=datetime(2026, 4, 1, 9, 0, tzinfo=timezone.utc),
            last_seen=datetime(2026, 4, 1, 9, 0, tzinfo=timezone.utc),
            last_ip="10.0.0.1",
            last_country="FR",
        )
        session = FakeAsyncSession(scalar_values=[existing])

        profile = await identity_service.upsert_profile(
            session,
            external_user_id="ext-user-1",
            email=None,
            display_name="Refreshed User",
            ip="10.0.0.2",
            country=None,
        )

        self.assertIs(profile, existing)
        self.assertEqual(profile.email, "old@example.com")
        self.assertEqual(profile.display_name, "Refreshed User")
        self.assertEqual(profile.last_ip, "10.0.0.2")
        self.assertEqual(profile.last_country, "FR")
        self.assertGreater(profile.last_seen, datetime(2026, 4, 1, 9, 0, tzinfo=timezone.utc))
        self.assertEqual(session.added, [])
        self.assertEqual(session.flush_count, 1)

    async def test_link_device_creates_link_and_sets_first_owner(self):
        device = Device(
            id="device-1",
            fingerprint="fingerprint-1",
            owner_user_id=None,
            shared_user_count=0,
            last_known_platform=None,
        )
        visitor = Visitor(
            id="visitor-1",
            ip="1.2.3.4",
            device_id="device-1",
            site_id="site-1",
            page_views=3,
        )
        session = FakeAsyncSession(
            scalar_values=[None],
            get_map={(Device, "device-1"): device, (Visitor, "visitor-1"): visitor},
            execute_values=[[visitor]],
        )

        link, is_new = await identity_service.link_device(
            session,
            external_user_id="ext-user-1",
            fingerprint_id="device-1",
            visitor_id="visitor-1",
            platform="web",
            ip="1.2.3.4",
            id_provider="google",
        )

        self.assertTrue(is_new)
        self.assertEqual(link.external_user_id, "ext-user-1")
        self.assertEqual(link.id_provider, "google")
        self.assertEqual(link.fingerprint_id, "device-1")
        self.assertEqual(link.visitor_id, "visitor-1")
        self.assertEqual(link.platform, "web")
        self.assertEqual(device.owner_user_id, "ext-user-1")
        self.assertEqual(device.shared_user_count, 0)
        self.assertEqual(device.last_known_platform, "web")
        self.assertEqual(visitor.external_user_id, "ext-user-1")
        self.assertEqual(len(session.added), 1)
        self.assertIsInstance(session.added[0], IdentityLink)
        self.assertEqual(session.flush_count, 1)

    async def test_link_device_updates_existing_link_without_creating_duplicate(self):
        existing = IdentityLink(
            id="link-1",
            external_user_id="ext-user-1",
            fingerprint_id="device-1",
            visitor_id=None,
            platform="web",
            ip="1.1.1.1",
            linked_at=datetime(2026, 4, 1, 9, 0, tzinfo=timezone.utc),
            last_seen_at=datetime(2026, 4, 1, 9, 0, tzinfo=timezone.utc),
        )
        device = Device(
            id="device-1",
            fingerprint="fingerprint-1",
            owner_user_id="ext-user-1",
            shared_user_count=0,
            last_known_platform="web",
        )
        visitor = Visitor(
            id="visitor-1",
            ip="8.8.8.8",
            device_id="device-1",
            site_id="site-1",
            page_views=2,
        )
        session = FakeAsyncSession(
            scalar_values=[existing],
            get_map={(Device, "device-1"): device, (Visitor, "visitor-1"): visitor},
            execute_values=[[visitor]],
        )

        link, is_new = await identity_service.link_device(
            session,
            external_user_id="ext-user-1",
            fingerprint_id="device-1",
            visitor_id="visitor-1",
            platform="ios",
            ip="8.8.8.8",
            id_provider="github",
        )

        self.assertFalse(is_new)
        self.assertIs(link, existing)
        self.assertEqual(link.id_provider, "github")
        self.assertEqual(link.platform, "ios")
        self.assertEqual(link.ip, "8.8.8.8")
        self.assertEqual(link.visitor_id, "visitor-1")
        self.assertEqual(visitor.external_user_id, "ext-user-1")
        self.assertEqual(session.added, [])
        self.assertEqual(session.flush_count, 1)

    async def test_detect_multi_account_creates_high_severity_flag(self):
        existing = IdentityLink(
            id="link-existing",
            external_user_id="other-user",
            fingerprint_id="device-1",
            platform="web",
            linked_at=datetime(2026, 4, 1, 9, 0, tzinfo=timezone.utc),
            last_seen_at=datetime(2026, 4, 1, 9, 0, tzinfo=timezone.utc),
        )
        session = FakeAsyncSession(scalar_values=[existing])

        flag = await identity_service.detect_multi_account(
            session,
            external_user_id="ext-user-1",
            fingerprint_id="device-1",
        )

        self.assertIsNotNone(flag)
        self.assertEqual(flag.flag_type, "multi_account")
        self.assertEqual(flag.severity, "high")
        self.assertEqual(flag.status, "open")
        self.assertEqual(flag.related_device_id, "device-1")
        self.assertEqual(json.loads(flag.evidence), {"other_user": "other-user"})
        self.assertEqual(len(session.added), 1)
        self.assertEqual(session.flush_count, 1)

    async def test_link_device_propagates_to_strict_match_group_siblings(self):
        exact = Device(
            id="device-1",
            fingerprint="fingerprint-1",
            owner_user_id=None,
            shared_user_count=0,
            last_known_platform=None,
            match_key="strict:v2:66323c2f",
        )
        sibling = Device(
            id="device-2",
            fingerprint="fingerprint-2",
            owner_user_id=None,
            shared_user_count=0,
            last_known_platform=None,
            match_key="strict:v2:66323c2f",
        )
        exact_visitor = Visitor(
            id="visitor-1",
            ip="1.2.3.4",
            device_id="device-1",
            site_id="site-1",
            page_views=3,
        )
        sibling_visitor = Visitor(
            id="visitor-2",
            ip="1.2.3.4",
            device_id="device-2",
            site_id="site-1",
            page_views=5,
        )
        session = FakeAsyncSession(
            scalar_values=[None, None],
            get_map={
                (Device, "device-1"): exact,
                (Device, "device-2"): sibling,
                (Visitor, "visitor-1"): exact_visitor,
            },
            execute_values=[
                [exact_visitor],
                [sibling],
                [sibling_visitor],
            ],
        )

        link, is_new = await identity_service.link_device(
            session,
            external_user_id="mp-ss-user",
            fingerprint_id="device-1",
            visitor_id="visitor-1",
            platform="web",
            ip="1.2.3.4",
            site_id="site-1",
            id_provider="keycloak",
        )

        self.assertTrue(is_new)
        self.assertEqual(link.fingerprint_id, "device-1")
        self.assertEqual(exact.owner_user_id, "mp-ss-user")
        self.assertEqual(sibling.owner_user_id, "mp-ss-user")
        self.assertEqual(exact_visitor.external_user_id, "mp-ss-user")
        self.assertEqual(sibling_visitor.external_user_id, "mp-ss-user")
        self.assertEqual(len(session.added), 2)
        self.assertTrue(any(isinstance(item, IdentityLink) and item.fingerprint_id == "device-2" for item in session.added))

    async def test_link_device_reconciles_historical_strict_groups_for_existing_links(self):
        current = Device(
            id="device-1",
            fingerprint="fingerprint-1",
            owner_user_id=None,
            shared_user_count=0,
            last_known_platform=None,
            match_key=None,
        )
        historical = Device(
            id="device-old",
            fingerprint="fingerprint-old",
            owner_user_id="mp-ss-user",
            shared_user_count=0,
            last_known_platform="web",
            match_key="strict:v2:66323c2f",
        )
        sibling = Device(
            id="device-2",
            fingerprint="fingerprint-2",
            owner_user_id=None,
            shared_user_count=0,
            last_known_platform=None,
            match_key="strict:v2:66323c2f",
        )
        current_visitor = Visitor(
            id="visitor-1",
            ip="1.2.3.4",
            device_id="device-1",
            site_id="site-1",
            page_views=1,
        )
        sibling_visitor = Visitor(
            id="visitor-2",
            ip="1.2.3.4",
            device_id="device-2",
            site_id="site-1",
            page_views=5,
        )
        session = FakeAsyncSession(
            scalar_values=[None, sibling_visitor, None],
            get_map={
                (Device, "device-1"): current,
                (Device, "device-old"): historical,
                (Device, "device-2"): sibling,
                (Visitor, "visitor-1"): current_visitor,
            },
            execute_values=[
                [current_visitor],
                ["device-old"],
                [sibling],
                [sibling_visitor],
            ],
        )

        link, is_new = await identity_service.link_device(
            session,
            external_user_id="mp-ss-user",
            fingerprint_id="device-1",
            visitor_id="visitor-1",
            platform="web",
            ip="1.2.3.4",
            site_id="site-1",
            id_provider="keycloak",
        )

        self.assertTrue(is_new)
        self.assertEqual(link.fingerprint_id, "device-1")
        self.assertEqual(current.owner_user_id, "mp-ss-user")
        self.assertEqual(sibling.owner_user_id, "mp-ss-user")
        self.assertEqual(current_visitor.external_user_id, "mp-ss-user")
        self.assertEqual(sibling_visitor.external_user_id, "mp-ss-user")
        self.assertEqual(len(session.added), 2)
        self.assertTrue(any(isinstance(item, IdentityLink) and item.fingerprint_id == "device-2" for item in session.added))


if __name__ == "__main__":
    unittest.main()
