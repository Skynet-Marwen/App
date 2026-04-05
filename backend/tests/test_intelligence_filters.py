import unittest

from sqlalchemy import select

from app.models.anomaly_flag import AnomalyFlag
from app.models.incident import Incident
from app.services.intelligence_filters import (
    active_anomaly_flag_clause,
    active_incident_clause,
    orphan_anomaly_flag_clause,
    orphan_incident_clause,
)


def _sql(query) -> str:
    return str(query).lower()


class IntelligenceFiltersTests(unittest.TestCase):
    def test_active_incident_clause_requires_live_parent_entities(self):
        sql = _sql(select(Incident).where(active_incident_clause()))

        self.assertIn("exists", sql)
        self.assertIn("user_profiles", sql)
        self.assertIn("devices", sql)
        self.assertIn("incidents.user_id", sql)
        self.assertIn("incidents.device_id", sql)

    def test_active_anomaly_flag_clause_requires_live_related_entities(self):
        sql = _sql(select(AnomalyFlag).where(active_anomaly_flag_clause()))

        self.assertIn("exists", sql)
        self.assertIn("user_profiles", sql)
        self.assertIn("devices", sql)
        self.assertIn("visitors", sql)
        self.assertIn("related_device_id", sql)
        self.assertIn("related_visitor_id", sql)

    def test_orphan_predicates_target_missing_parents(self):
        incident_sql = _sql(select(Incident).where(orphan_incident_clause()))
        flag_sql = _sql(select(AnomalyFlag).where(orphan_anomaly_flag_clause()))

        self.assertIn("not (exists", incident_sql)
        self.assertIn("not (exists", flag_sql)


if __name__ == "__main__":
    unittest.main()
