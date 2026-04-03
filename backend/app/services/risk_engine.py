"""User-level risk engine.

Aggregates device-level risk signals into a per-user composite score,
stores a time-series snapshot, and updates the UserProfile trust_level.

Score range: 0.0 (clean) → 1.0 (high risk)
Trust levels: trusted (<0.2) | normal (0.2–0.5) | suspicious (0.5–0.75) | blocked (>0.75)
"""
import json
import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.identity_link import IdentityLink
from ..models.device import Device
from ..models.user_profile import UserProfile
from ..models.risk_event import RiskEvent
from ..models.anomaly_flag import AnomalyFlag
from .runtime_config import runtime_settings


# ── Score modifiers ────────────────────────────────────────────────────────────

_MODIFIERS = {
    "shared_device": 0.20,    # device used by >1 user
    "new_device": 0.10,       # link created < 24h ago
    "geo_jump": 0.30,         # impossible_travel flag open
    "tor_vpn": 0.40,          # device risk_score == 100 (proxy/tor heuristic)
    "headless": 0.30,         # headless browser detected
    "multi_account": 0.25,    # multi_account flag open
    "behavior_drift": 0.15,   # low-entropy interaction timing
}

_TRUST_THRESHOLDS = [
    (0.20, "trusted"),
    (0.50, "normal"),
    (0.95, "suspicious"),
    (1.01, "blocked"),
]


def _score_to_trust(score: float) -> str:
    for threshold, level in _TRUST_THRESHOLDS:
        if score < threshold:
            return level
    return "blocked"


def _modifier_weights() -> dict[str, float]:
    configured = runtime_settings().get("risk_modifier_weights") or {}
    merged = dict(_MODIFIERS)
    if isinstance(configured, dict):
        for key, default in _MODIFIERS.items():
            try:
                merged[key] = max(float(configured.get(key, default)), 0.0)
            except (TypeError, ValueError):
                merged[key] = default
    return merged


def _enforcement_thresholds() -> tuple[float, float, float]:
    settings = runtime_settings()
    flag = float(settings.get("risk_auto_flag_threshold", 0.60) or 0.60)
    challenge = float(settings.get("risk_auto_challenge_threshold", 0.80) or 0.80)
    block = float(settings.get("risk_auto_block_threshold", 0.95) or 0.95)
    challenge = max(challenge, flag)
    block = max(block, challenge)
    return flag, challenge, block


def enforcement_action(score: float) -> str:
    flag, challenge, block = _enforcement_thresholds()
    if score >= block:
        return "block"
    if score >= challenge:
        return "challenge"
    if score >= flag:
        return "flag"
    return "allow"


def _threshold_crossed(previous_score: float, new_score: float, threshold: float) -> bool:
    return previous_score < threshold <= new_score


def _build_threshold_flag(external_user_id: str, flag_type: str, severity: str, evidence: dict) -> AnomalyFlag:
    return AnomalyFlag(
        id=str(uuid.uuid4()),
        external_user_id=external_user_id,
        flag_type=flag_type,
        severity=severity,
        status="open",
        evidence=json.dumps(evidence, separators=(",", ":"), sort_keys=True),
        detected_at=datetime.now(timezone.utc),
    )


async def recompute(
    db: AsyncSession,
    external_user_id: str,
    trigger_type: str = "manual",
    trigger_detail: Optional[dict] = None,
) -> tuple[float, float, str]:
    """Recompute and persist a user's risk score.

    Returns (previous_score, new_score, trust_level).
    """
    profile = await db.scalar(
        select(UserProfile).where(UserProfile.external_user_id == external_user_id)
    )
    previous_score: float = profile.current_risk_score if profile else 0.0

    # 1. Collect all linked devices
    links = (
        await db.execute(
            select(IdentityLink).where(
                IdentityLink.external_user_id == external_user_id,
                IdentityLink.fingerprint_id.isnot(None),
            )
        )
    ).scalars().all()

    if not links:
        new_score = 0.0
    else:
        device_ids = [lk.fingerprint_id for lk in links]
        devices = (
            await db.execute(select(Device).where(Device.id.in_(device_ids)))
        ).scalars().all()

        # 2. Base: weighted average of device risk scores (normalised to 0–1)
        raw_scores = [min(d.risk_score / 100.0, 1.0) for d in devices]
        if raw_scores:
            base = max(raw_scores) * 0.6 + (sum(raw_scores) / len(raw_scores)) * 0.4
        else:
            base = 0.0

        # 3. Apply modifiers
        modifier_weights = _modifier_weights()
        modifier = 0.0

        # Shared device
        if any(d.shared_user_count and d.shared_user_count > 0 for d in devices):
            modifier += modifier_weights["shared_device"]

        # New device (any link < 24h old)
        from datetime import timedelta
        cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
        if any(lk.linked_at > cutoff for lk in links):
            modifier += modifier_weights["new_device"]

        # Open anomaly flags
        open_flags = (
            await db.execute(
                select(AnomalyFlag.flag_type).where(
                    AnomalyFlag.external_user_id == external_user_id,
                    AnomalyFlag.status == "open",
                )
            )
        ).scalars().all()
        flag_types = set(open_flags)
        if "impossible_travel" in flag_types or "geo_jump" in flag_types:
            modifier += modifier_weights["geo_jump"]
        if "multi_account" in flag_types:
            modifier += modifier_weights["multi_account"]
        if "behavior_drift" in flag_types:
            modifier += modifier_weights["behavior_drift"]

        # Tor/VPN heuristic: device risk_score == 100
        if any(d.risk_score >= 100 for d in devices):
            modifier += modifier_weights["tor_vpn"]

        new_score = min(base + modifier, 1.0)

    delta = round(new_score - previous_score, 4)
    trust_level = _score_to_trust(new_score)
    flag_threshold, challenge_threshold, block_threshold = _enforcement_thresholds()

    # 4. Persist risk_event
    event = RiskEvent(
        id=str(uuid.uuid4()),
        external_user_id=external_user_id,
        score=new_score,
        delta=delta,
        trigger_type=trigger_type,
        trigger_detail=json.dumps(trigger_detail) if trigger_detail else None,
        created_at=datetime.now(timezone.utc),
    )
    db.add(event)

    # 5. Update profile
    if profile:
        profile.current_risk_score = new_score
        profile.trust_level = "blocked" if new_score >= block_threshold else trust_level
        profile.total_devices = len(links)

    # 6. Auto-flag on spike
    if abs(delta) >= 0.20 and delta > 0:
        spike_flag = AnomalyFlag(
            id=str(uuid.uuid4()),
            external_user_id=external_user_id,
            flag_type="risk_spike",
            severity="high" if new_score > 0.75 else "medium",
            status="open",
            evidence=json.dumps({"previous": previous_score, "new": new_score, "delta": delta}),
            detected_at=datetime.now(timezone.utc),
        )
        db.add(spike_flag)

    if _threshold_crossed(previous_score, new_score, flag_threshold):
        db.add(
            _build_threshold_flag(
                external_user_id,
                "risk_auto_flag",
                "medium",
                {"threshold": flag_threshold, "score": new_score, "action": "flag"},
            )
        )
    if _threshold_crossed(previous_score, new_score, challenge_threshold):
        db.add(
            _build_threshold_flag(
                external_user_id,
                "risk_auto_challenge",
                "high",
                {"threshold": challenge_threshold, "score": new_score, "action": "challenge"},
            )
        )
    if _threshold_crossed(previous_score, new_score, block_threshold):
        db.add(
            _build_threshold_flag(
                external_user_id,
                "risk_auto_block",
                "critical",
                {"threshold": block_threshold, "score": new_score, "action": "block"},
            )
        )

    if new_score >= block_threshold:
        trust_level = "blocked"

    await db.flush()
    return previous_score, new_score, trust_level
