import json
import math
import unittest
from types import SimpleNamespace

from app.services.ml.feature_extractor import (
    FEATURE_DIM,
    extract_behavior_stats,
    extract_device_features,
)
from app.services.ml.anomaly_detector import score_sample, train_model


def _make_device(**overrides):
    """Build a minimal mock Device with all fields the extractor reads."""
    defaults = dict(
        fingerprint_snapshot=None,
        composite_score=0.5,
        stability_score=0.9,
        fingerprint_confidence=0.8,
        status="active",
        risk_score=10,
    )
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


class BehaviorStatsTests(unittest.TestCase):
    def test_empty_returns_zeros(self):
        self.assertEqual(extract_behavior_stats([]), (0.0, 0.0, 0.0, 0.0))

    def test_none_returns_zeros(self):
        self.assertEqual(extract_behavior_stats(None), (0.0, 0.0, 0.0, 0.0))

    def test_single_value(self):
        mean, std, mn, mx = extract_behavior_stats([500])
        self.assertEqual(mean, 500.0)
        self.assertEqual(std, 0.0)
        self.assertEqual(mn, 500.0)
        self.assertEqual(mx, 500.0)

    def test_multiple_values(self):
        mean, std, mn, mx = extract_behavior_stats([100, 200, 300])
        self.assertAlmostEqual(mean, 200.0)
        self.assertGreater(std, 0.0)
        self.assertEqual(mn, 100.0)
        self.assertEqual(mx, 300.0)


class FeatureExtractorTests(unittest.TestCase):
    def test_returns_none_for_none_device(self):
        self.assertIsNone(extract_device_features(None))

    def test_returns_correct_dimension(self):
        device = _make_device()
        vec = extract_device_features(device)
        self.assertIsNotNone(vec)
        self.assertEqual(len(vec), FEATURE_DIM)

    def test_handles_missing_snapshot(self):
        device = _make_device(fingerprint_snapshot=None)
        vec = extract_device_features(device)
        self.assertEqual(len(vec), FEATURE_DIM)
        # Behavior features should all be 0.0
        for i in range(16):
            self.assertEqual(vec[i], 0.0, f"feature[{i}] should be 0 when no behavior data")

    def test_handles_invalid_snapshot_json(self):
        device = _make_device(fingerprint_snapshot="not-json")
        vec = extract_device_features(device)
        self.assertEqual(len(vec), FEATURE_DIM)

    def test_device_scores_in_vector(self):
        device = _make_device(composite_score=0.7, stability_score=0.6, fingerprint_confidence=0.9)
        vec = extract_device_features(device)
        self.assertAlmostEqual(vec[24], 0.7)
        self.assertAlmostEqual(vec[25], 0.6)
        self.assertAlmostEqual(vec[26], 0.9)

    def test_behavior_from_snapshot(self):
        behavior = {
            "click_intervals_ms": [100, 200, 300],
            "session_duration_ms": 60000,
            "click_count": 10,
            "total_interactions": 15,
        }
        snapshot = json.dumps({"behavior": behavior})
        device = _make_device(fingerprint_snapshot=snapshot)
        vec = extract_device_features(device)
        # click_rate = 10 / (60000/60000) = 10 clicks/min, normalised /60 ≈ 0.167
        self.assertAlmostEqual(vec[17], 10.0 / 60.0, places=3)

    def test_all_values_finite(self):
        device = _make_device()
        vec = extract_device_features(device)
        for i, v in enumerate(vec):
            self.assertTrue(math.isfinite(v), f"feature[{i}] is not finite: {v}")

    def test_all_values_non_negative(self):
        device = _make_device()
        vec = extract_device_features(device)
        for i, v in enumerate(vec):
            self.assertGreaterEqual(v, 0.0, f"feature[{i}] is negative: {v}")


class AnomalyDetectorTests(unittest.TestCase):
    def test_score_sample_no_model_returns_neutral(self):
        vec = [0.0] * FEATURE_DIM
        self.assertEqual(score_sample(vec, None), 0.5)

    def test_score_sample_none_features_returns_neutral(self):
        self.assertEqual(score_sample(None, None), 0.5)

    def test_train_model_skips_below_minimum(self):
        X = [[0.0] * FEATURE_DIM for _ in range(50)]
        result = train_model(X)
        self.assertIsNone(result)

    def test_train_model_returns_artefact_above_minimum(self):
        X = [[float(i % 10) / 10.0] * FEATURE_DIM for i in range(120)]
        artefact = train_model(X)
        self.assertIsNotNone(artefact)
        self.assertIn("model", artefact)
        self.assertEqual(artefact["n_samples"], 120)

    def test_score_sample_range(self):
        X = [[float(i % 10) / 10.0] * FEATURE_DIM for i in range(120)]
        artefact = train_model(X)
        if artefact is None:
            self.skipTest("train_model returned None (likely no sklearn)")
        vec = [0.5] * FEATURE_DIM
        score = score_sample(vec, artefact)
        self.assertGreaterEqual(score, 0.0)
        self.assertLessEqual(score, 1.0)


if __name__ == "__main__":
    unittest.main()
