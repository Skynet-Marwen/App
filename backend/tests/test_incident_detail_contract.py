import unittest
from types import SimpleNamespace

from app.api.routes import anti_evasion as anti_evasion_route
from app.models.device import Device
from app.models.incident import Incident
from app.models.user_profile import UserProfile
from app.models.visitor import Visitor


class FakeExecuteResult:
    def __init__(self, rows=None):
        self.rows = list(rows or [])

    def scalars(self):
        return self

    def all(self):
        return list(self.rows)


class FakeAsyncSession:
    def __init__(self, *, get_map=None, profile=None, visitors=None):
        self.get_map = dict(get_map or {})
        self.profile = profile
        self.visitors = list(visitors or [])

    async def get(self, model, key):
        return self.get_map.get((model, key))

    async def scalar(self, _query):
        return self.profile

    async def execute(self, _query):
        return FakeExecuteResult(self.visitors)


class IncidentDetailContractTests(unittest.IsolatedAsyncioTestCase):
    async def test_incident_detail_includes_resolved_entities(self):
        incident = Incident(
            id="incident-1",
            type="behavior_drift",
            description="Suspicious behavior burst",
            ip="1.2.3.4",
            device_id="device-1",
            user_id="ext-user-1",
            severity="high",
            status="open",
        )
        device = Device(
            id="device-1",
            fingerprint="fp-123",
            browser="Firefox",
            os="Windows",
            status="active",
            risk_score=72,
            owner_user_id="ext-user-1",
        )
        profile = UserProfile(
            external_user_id="ext-user-1",
            email="user@example.com",
            display_name="Portal User",
            current_risk_score=0.82,
            trust_level="suspicious",
            total_devices=2,
            total_sessions=5,
        )
        visitor = Visitor(
            id="visitor-1",
            ip="1.2.3.4",
            device_id="device-1",
            external_user_id="ext-user-1",
            browser="Firefox",
            os="Windows",
            status="active",
            page_views=4,
        )
        session = FakeAsyncSession(
            get_map={
                (Incident, "incident-1"): incident,
                (Device, "device-1"): device,
            },
            profile=profile,
            visitors=[visitor],
        )

        result = await anti_evasion_route.get_incident_detail(
            "incident-1",
            db=session,
            _=SimpleNamespace(id="operator-1"),
        )

        self.assertEqual(result["id"], "incident-1")
        self.assertEqual(result["related_device"]["id"], "device-1")
        self.assertEqual(result["related_user"]["external_user_id"], "ext-user-1")
        self.assertEqual(len(result["related_visitors"]), 1)
        self.assertEqual(result["related_visitors"][0]["id"], "visitor-1")


if __name__ == "__main__":
    unittest.main()
