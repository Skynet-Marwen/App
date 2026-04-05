"""
Isolation Forest anomaly detector wrapper.

API:
    is_model_available() -> bool
    load_model()         -> dict | None   (cached artefact)
    train_model(X)       -> dict | None
    save_model(artefact) -> None
    score_sample(features, artefact) -> float  (0.0 normal … 1.0 anomalous)

The saved artefact is a plain dict:
    {
        "model":       IsolationForest instance,
        "score_min":   float,   # raw score at training-time minimum
        "score_max":   float,   # raw score at training-time maximum
        "trained_at":  str,     # ISO-8601
        "n_samples":   int,
    }

Persistence is atomic: write to .tmp then rename.
"""
from __future__ import annotations

import logging
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

log = logging.getLogger("skynet.ml")

# Resolve path relative to project root (4 parents up from this file)
_BASE = Path(__file__).resolve().parents[3]  # → /app (Docker WORKDIR = backend root)
MODEL_PATH = _BASE / "data" / "ml_models" / "anomaly_model.pkl"

MIN_TRAINING_SAMPLES = 100
CONTAMINATION = 0.05
N_ESTIMATORS = 100
RANDOM_STATE = 42

# Module-level cache so we don't reload from disk on every request
_cached_artefact: dict[str, Any] | None = None
_cache_mtime: float = 0.0


def is_model_available() -> bool:
    return MODEL_PATH.exists()


def load_model() -> dict[str, Any] | None:
    """Load artefact from disk, with mtime-based cache invalidation."""
    global _cached_artefact, _cache_mtime
    if not MODEL_PATH.exists():
        return None
    try:
        mtime = MODEL_PATH.stat().st_mtime
        if _cached_artefact is not None and mtime == _cache_mtime:
            return _cached_artefact
        import joblib
        artefact = joblib.load(MODEL_PATH)
        _cached_artefact = artefact
        _cache_mtime = mtime
        return artefact
    except Exception:
        log.exception("Failed to load ML model from %s", MODEL_PATH)
        return None


def save_model(artefact: dict[str, Any]) -> None:
    """Atomically persist artefact to MODEL_PATH."""
    global _cached_artefact, _cache_mtime
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    try:
        import joblib
        fd, tmp_path = tempfile.mkstemp(
            dir=MODEL_PATH.parent, prefix="anomaly_model_", suffix=".tmp"
        )
        os.close(fd)
        joblib.dump(artefact, tmp_path)
        os.replace(tmp_path, MODEL_PATH)
        _cached_artefact = artefact
        _cache_mtime = MODEL_PATH.stat().st_mtime
        log.info("ML model saved (%d samples, trained at %s)", artefact["n_samples"], artefact["trained_at"])
    except Exception:
        log.exception("Failed to save ML model")


def train_model(feature_matrix: list[list[float]]) -> dict[str, Any] | None:
    """
    Train IsolationForest on feature_matrix.
    Returns None (and skips) if len(feature_matrix) < MIN_TRAINING_SAMPLES.
    Saves artefact to disk on success.
    """
    if len(feature_matrix) < MIN_TRAINING_SAMPLES:
        log.info("ML training skipped: only %d samples (min %d)", len(feature_matrix), MIN_TRAINING_SAMPLES)
        return None
    try:
        import numpy as np
        from sklearn.ensemble import IsolationForest

        X = np.array(feature_matrix, dtype=np.float32)
        clf = IsolationForest(
            n_estimators=N_ESTIMATORS,
            contamination=CONTAMINATION,
            random_state=RANDOM_STATE,
        )
        clf.fit(X)

        raw_scores = clf.score_samples(X)
        score_min = float(raw_scores.min())
        score_max = float(raw_scores.max())

        artefact: dict[str, Any] = {
            "model": clf,
            "score_min": score_min,
            "score_max": score_max,
            "trained_at": datetime.now(timezone.utc).isoformat(),
            "n_samples": len(feature_matrix),
        }
        save_model(artefact)
        return artefact
    except Exception:
        log.exception("ML training failed")
        return None


def score_sample(features: list[float] | None, artefact: dict[str, Any] | None = None) -> float:
    """
    Return anomaly score in [0.0, 1.0].
    0.0 = normal, 1.0 = highly anomalous.
    Returns 0.5 (neutral) when no model is available or features is None.
    """
    if features is None or artefact is None:
        return 0.5
    try:
        import numpy as np

        clf = artefact["model"]
        score_min: float = artefact["score_min"]
        score_max: float = artefact["score_max"]

        X = np.array([features], dtype=np.float32)
        raw = float(clf.score_samples(X)[0])

        # IsolationForest: more negative = more anomalous
        # Invert and normalise to [0, 1]
        span = score_max - score_min
        if span < 1e-9:
            return 0.5
        normalised = (score_max - raw) / span
        return float(min(max(normalised, 0.0), 1.0))
    except Exception:
        log.exception("ML scoring failed")
        return 0.5
