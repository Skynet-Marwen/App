from __future__ import annotations

import json
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.blocking import BlockedIP
from ..models.security_finding import SecurityFinding
from ..models.security_recommendation import SecurityRecommendation
from ..models.target_profile import TargetProfile
from ..models.threat_intel import ThreatIntel
from .runtime_config import runtime_settings, save_runtime_settings_cache


def security_settings() -> dict:
    _settings = runtime_settings()
    sensitivity = _settings.get("correlation_sensitivity", 0.7)
    try:
        sensitivity = float(sensitivity)
    except Exception:
        sensitivity = 0.7
    return {
        "intel_refresh_interval_hours": int(_settings.get("intel_refresh_interval_hours", 24)),
        "scan_interval_hours": int(_settings.get("scan_interval_hours", 12)),
        "enable_auto_defense": bool(_settings.get("enable_auto_defense", False)),
        "max_scan_depth": int(_settings.get("max_scan_depth", 8)),
        "correlation_sensitivity": max(0.25, min(1.5, sensitivity)),
    }


def load_json(value: str, fallback):
    try:
        return json.loads(value or json.dumps(fallback))
    except Exception:
        return fallback


def _load_list_json(value: str) -> list:
    parsed = load_json(value, [])
    return parsed if isinstance(parsed, list) else []


async def get_security_status(db: AsyncSession) -> dict:
    cfg = security_settings()
    profiles = list((await db.execute(select(TargetProfile).order_by(TargetProfile.last_scanned_at.desc()).limit(10))).scalars())
    return {
        "scheduler": cfg,
        "threat_intel_entries": int(await db.scalar(select(func.count()).select_from(ThreatIntel)) or 0),
        "last_intel_refresh": await db.scalar(select(func.max(ThreatIntel.updated_at))),
        "last_scan_at": await db.scalar(select(func.max(TargetProfile.last_scanned_at))),
        "open_findings": int(await db.scalar(select(func.count()).select_from(SecurityFinding).where(SecurityFinding.status == "open")) or 0),
        "active_exploitation_findings": int(
            await db.scalar(
                select(func.count()).select_from(SecurityFinding).where(
                    SecurityFinding.status == "open",
                    SecurityFinding.active_exploitation_suspected.is_(True),
                )
            ) or 0
        ),
        "open_recommendations": int(
            await db.scalar(select(func.count()).select_from(SecurityRecommendation).where(SecurityRecommendation.status == "open")) or 0
        ),
        "profiles": [
            {
                "id": item.id,
                "site_id": item.site_id,
                "base_url": item.base_url,
                "detected_server": item.detected_server,
                "frameworks": _load_list_json(item.frameworks),
                "technologies": _load_list_json(item.technologies),
                "scan_status": item.scan_status,
                "last_scanned_at": item.last_scanned_at,
                "notes": item.notes,
            }
            for item in profiles
        ],
    }


async def list_findings(db: AsyncSession, *, limit: int = 100) -> list[dict]:
    rows = list(
        (
            await db.execute(
                select(SecurityFinding).order_by(
                    SecurityFinding.active_exploitation_suspected.desc(),
                    SecurityFinding.correlated_risk_score.desc(),
                    SecurityFinding.created_at.desc(),
                ).limit(limit)
            )
        ).scalars()
    )
    return [
        {
            "id": item.id,
            "site_id": item.site_id,
            "profile_id": item.profile_id,
            "finding_type": item.finding_type,
            "title": item.title,
            "severity": item.severity,
            "endpoint": item.endpoint,
            "evidence": load_json(item.evidence, {}),
            "correlated_risk_score": item.correlated_risk_score,
            "active_exploitation_suspected": item.active_exploitation_suspected,
            "status": item.status,
            "created_at": item.created_at,
            "updated_at": item.updated_at,
        }
        for item in rows
    ]


async def list_recommendations(db: AsyncSession, *, limit: int = 100) -> list[dict]:
    findings = {item["id"]: item for item in await list_findings(db, limit=limit)}
    rows = list((await db.execute(select(SecurityRecommendation).order_by(SecurityRecommendation.created_at.desc()).limit(limit))).scalars())
    return [
        {
            "id": item.id,
            "finding_id": item.finding_id,
            "recommendation_text": item.recommendation_text,
            "priority": item.priority,
            "auto_applicable": item.auto_applicable,
            "action_key": item.action_key,
            "action_payload": load_json(item.action_payload, {}),
            "status": item.status,
            "created_at": item.created_at,
            "updated_at": item.updated_at,
            "finding_title": findings.get(item.finding_id, {}).get("title"),
            "finding_severity": findings.get(item.finding_id, {}).get("severity"),
            "finding_endpoint": findings.get(item.finding_id, {}).get("endpoint"),
        }
        for item in rows
    ]


async def ignore_finding(db: AsyncSession, finding_id: str) -> None:
    finding = await db.get(SecurityFinding, finding_id)
    if not finding:
        raise ValueError("Finding not found")
    finding.status = "ignored"
    finding.updated_at = datetime.now(timezone.utc)
    rows = list((await db.execute(select(SecurityRecommendation).where(SecurityRecommendation.finding_id == finding_id))).scalars())
    for item in rows:
        item.status = "ignored"
        item.updated_at = datetime.now(timezone.utc)
    await db.commit()


async def apply_recommendation(db: AsyncSession, recommendation_id: str) -> None:
    _settings = runtime_settings()
    recommendation = await db.get(SecurityRecommendation, recommendation_id)
    if not recommendation:
        raise ValueError("Recommendation not found")
    payload = load_json(recommendation.action_payload, {})
    settings_changed = False
    if recommendation.action_key == "enable_auto_defense":
        _settings["enable_auto_defense"] = True
        settings_changed = True
    elif recommendation.action_key == "block_suspicious_ips":
        for ip in payload.get("ips", [])[:10]:
            blocked = await db.get(BlockedIP, ip)
            if not blocked:
                db.add(BlockedIP(ip=ip, reason="Applied from STIE recommendation"))
            else:
                blocked.reason = "Applied from STIE recommendation"
    elif recommendation.action_key == "enable_auto_block_tor_vpn":
        _settings["auto_block_tor_vpn"] = True
        settings_changed = True
    if settings_changed:
        await save_runtime_settings_cache(db)
    recommendation.status = "applied"
    recommendation.updated_at = datetime.now(timezone.utc)
    await db.commit()
